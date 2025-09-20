import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Seo from './components/Seo.jsx';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import { fetchUnifiedEventRows } from './utils/fetchAllEventRows.js';
import { supabase } from './supabaseClient';
import {
  PHILLY_TIME_ZONE,
  monthSlugToIndex,
  getMonthWindow,
  formatMonthYear,
  indexToMonthSlug,
  formatEventDateRange,
  getZonedDate,
} from './utils/dateUtils';
import { buildIsoDateTime, DEFAULT_OG_IMAGE, SITE_BASE_URL } from './utils/seoHelpers.js';
import { CATEGORY_ORDER, getCategoryConfig } from './utils/monthlyCategoryConfig.js';

const PAGE_SIZE = 50;

function formatTimeLabel(time) {
  if (!time) return '';
  const [hourPart, minutePart] = time.split(':');
  const hours = Number(hourPart);
  if (Number.isNaN(hours)) return time;
  const minutes = (minutePart || '00').slice(0, 2).padStart(2, '0');
  const period = hours >= 12 ? 'p.m.' : 'a.m.';
  const displayHour = ((hours % 12) || 12).toString();
  return `${displayHour}:${minutes} ${period}`;
}

function formatAgeFlag(flag) {
  if (!flag) return null;
  const normalized = flag.toString().toLowerCase();
  if (normalized.includes('all')) return 'All Ages';
  if (normalized.includes('21')) return '21+';
  return flag;
}

function formatPriceFlag(flag) {
  if (!flag) return null;
  if (flag === true || flag === 'free') return 'Free';
  if (flag === false) return '$$';
  const normalized = flag.toString().toLowerCase();
  if (normalized === 'free' || normalized === '0') return 'Free';
  return flag;
}

function FavoriteButton({ event }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const canFavorite = Boolean(event?.favoriteId) && Boolean(event?.source_table);
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event?.favoriteId,
    source_table: event?.source_table,
  });

  if (!canFavorite) return null;

  const handleClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
        isFavorite
          ? 'bg-indigo-600 text-white shadow-md'
          : 'border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'
      } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {isFavorite ? 'In the Plans' : 'Add to Plans'}
    </button>
  );
}

function buildJsonLd({ events, title, description }) {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    description: description,
    numberOfItems: events.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: events.map((event, index) => {
      const url = event.canonicalPath
        ? `${SITE_BASE_URL}${event.canonicalPath}`
        : event.detailUrl;
      const startDateIso = buildIsoDateTime(event.start_date, event.start_time) || event.start_date;
      const endDateIso = buildIsoDateTime(event.end_date, event.end_time) || event.end_date || event.start_date;
      const locationName = event.venue || event.neighborhood || 'Philadelphia';
      const postalCode = event.zip ? event.zip.toString() : undefined;
      return {
        '@type': 'ListItem',
        position: index + 1,
        url,
        item: {
          '@type': 'Event',
          name: event.title,
          startDate: startDateIso,
          endDate: endDateIso,
          eventStatus:
            event.status === 'cancelled'
              ? 'https://schema.org/EventCancelled'
              : 'https://schema.org/EventScheduled',
          location: {
            '@type': 'Place',
            name: locationName,
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Philadelphia',
              addressRegion: 'PA',
              addressCountry: 'US',
              ...(postalCode ? { postalCode } : {}),
            },
          },
          ...(event.image_url ? { image: [event.image_url] } : {}),
          ...(url ? { url } : {}),
        },
      };
    }),
  };
  return itemList;
}

function truncate(text, max = 200) {
  if (!text) return '';
  const normalized = text.toString().replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export default function MonthlyCategoryEventsPage({ categorySlugOverride } = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const categorySlugParam = categorySlugOverride || params.categorySlug;
  const category = getCategoryConfig(categorySlugParam);
  const monthSlugParam = params.month ? params.month.toLowerCase() : null;
  const monthIndex = monthSlugParam ? monthSlugToIndex(monthSlugParam) : null;
  const yearParam = params.year ? Number(params.year) : NaN;
  const hasValidYear = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100;
  const hasValidMonth = Boolean(monthIndex);
  const isValid = Boolean(category && hasValidMonth && hasValidYear);

  const monthWindow = useMemo(() => {
    if (!isValid) return { start: null, end: null };
    return getMonthWindow(yearParam, monthIndex, PHILLY_TIME_ZONE);
  }, [isValid, monthIndex, yearParam]);

  const { start: monthStart, end: monthEnd } = monthWindow;
  const monthStartMs = monthStart ? monthStart.getTime() : null;
  const monthEndMs = monthEnd ? monthEnd.getTime() : null;

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [tagLabelMap, setTagLabelMap] = useState({});

  useEffect(() => {
    setPage(1);
  }, [categorySlugParam, monthStartMs, monthEndMs]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('tags')
      .select('slug,name')
      .then(({ data, error: tagsError }) => {
        if (cancelled || tagsError) return;
        const map = {};
        (data || []).forEach(({ slug, name }) => {
          if (!slug) return;
          map[slug.toLowerCase()] = name || slug;
        });
        setTagLabelMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isValid || !monthStart || !monthEnd) {
      setAllEvents([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchUnifiedEventRows({ monthStart, monthEnd })
      .then(rows => {
        if (cancelled) return;
        setAllEvents(rows || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('monthly category load failed', err);
        if (cancelled) return;
        setError('We had trouble loading events. Please try again soon.');
        setAllEvents([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isValid, monthStartMs, monthEndMs]);

  useEffect(() => {
    if (!isValid) {
      const timer = setTimeout(() => {
        navigate('/philadelphia-events/', { replace: true });
      }, 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isValid, navigate]);

  const categoryTagSet = useMemo(() => {
    if (!category) return new Set();
    return new Set((category.tags || []).map(tag => tag.toLowerCase()));
  }, [category]);

  const filteredEvents = useMemo(() => {
    if (!isValid) return [];
    return allEvents
      .filter(evt => evt && evt.status !== 'cancelled')
      .filter(evt => {
        if (!evt?.tags || evt.tags.length === 0) return false;
        return evt.tags.some(tag => categoryTagSet.has(tag.toLowerCase()));
      });
  }, [allEvents, categoryTagSet, isValid]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aStart = a.startDate instanceof Date ? a.startDate.getTime() : 0;
      const bStart = b.startDate instanceof Date ? b.startDate.getTime() : 0;
      if (aStart !== bStart) return aStart - bStart;
      const aTime = a.start_time || '';
      const bTime = b.start_time || '';
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;
      if (aTime && bTime) {
        const cmp = aTime.localeCompare(bTime);
        if (cmp !== 0) return cmp;
      }
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [filteredEvents]);

  const monthLabel = monthStart ? formatMonthYear(monthStart, PHILLY_TIME_ZONE) : '';
  const canonicalMonthSlug = monthIndex ? indexToMonthSlug(monthIndex) : monthSlugParam;
  const canonicalUrl =
    category && canonicalMonthSlug && hasValidYear
      ? `${SITE_BASE_URL}/${category.slug}-events-in-philadelphia-${canonicalMonthSlug}-${yearParam}/`
      : `${SITE_BASE_URL}/philadelphia-events/`;

  const pageTitle = category && monthLabel
    ? `${category.label} Events in Philadelphia – ${monthLabel}`
    : 'Philadelphia Events – Our Philly';

  const metaDescription = category && monthLabel
    ? `Plan ${monthLabel} in Philadelphia with ${category.label.toLowerCase()} events, festivals, and happenings curated by Our Philly.`
    : 'Discover monthly event guides for Philadelphia, curated by Our Philly.';

  const firstImage = useMemo(() => {
    for (const evt of sortedEvents) {
      if (evt?.image_url) return evt.image_url;
    }
    return null;
  }, [sortedEvents]);

  const jsonLd = useMemo(() => buildJsonLd({ events: sortedEvents, title: pageTitle, description: metaDescription }), [sortedEvents, pageTitle, metaDescription]);

  const paginatedEvents = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(sortedEvents.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return {
      totalPages,
      items: sortedEvents.slice(start, end),
      currentPage: safePage,
    };
  }, [sortedEvents, page]);

  const updatedStamp = useMemo(() => {
    const zoned = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    return zoned.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, []);

  const monthNavLinks = useMemo(() => {
    if (!canonicalMonthSlug || !hasValidYear) return [];
    return CATEGORY_ORDER.map(cat => ({
      slug: cat.slug,
      label: cat.label,
      href: `/${cat.slug}-events-in-philadelphia-${canonicalMonthSlug}-${yearParam}/`,
    }));
  }, [canonicalMonthSlug, hasValidYear, yearParam]);

  if (!isValid) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center bg-white px-4">
          <p className="text-gray-600 text-center max-w-md">
            We couldn’t find that month of events. Redirecting you to the latest guide…
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title={pageTitle}
        description={metaDescription}
        canonicalUrl={canonicalUrl}
        ogImage={firstImage || DEFAULT_OG_IMAGE}
        ogType="website"
        jsonLd={jsonLd}
      />
      <Navbar />
      <main className="flex-1 pt-36 pb-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e]">
              {category.label} Events in Philadelphia – {monthLabel}
            </h1>
            <p className="mt-4 text-lg text-gray-700">
              Updated {updatedStamp}. Explore {category.label.toLowerCase()} happenings all month long.
            </p>
          </div>

          <nav className="mt-8 flex flex-wrap justify-center gap-3">
            {monthNavLinks.map(link => {
              const isActive = link.slug === category.slug;
              return (
                <Link
                  key={link.slug}
                  to={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-12">
            {loading ? (
              <p className="text-gray-500">Loading {category.label.toLowerCase()} events…</p>
            ) : error ? (
              <p className="text-red-600">{error}</p>
            ) : paginatedEvents.items.length === 0 ? (
              <p className="text-gray-600">No events match this category yet. Check back soon!</p>
            ) : (
              <div className="space-y-8">
                {paginatedEvents.items.map(event => {
                  const detailHref = event.canonicalPath || event.detailUrl || '';
                  const hasLink = Boolean(detailHref);
                  const isExternal = hasLink && /^https?:\/\//i.test(detailHref);
                  const dateRange = formatEventDateRange(event.startDate, event.endDate, PHILLY_TIME_ZONE);
                  const timeLabel = formatTimeLabel(event.start_time);
                  const displayTags = (event.tags || []).map(slug => ({
                    slug,
                    label: tagLabelMap[slug] || slug,
                  }));
                  const ageLabel = formatAgeFlag(event.age_flag);
                  const priceLabel = formatPriceFlag(event.price_flag);

                  const badge = event.isTradition ? (
                    <span className="absolute left-4 top-4 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-lg">
                      Tradition
                    </span>
                  ) : null;

                  const imageNode = event.image_url ? (
                    hasLink
                      ? isExternal
                        ? (
                          <a
                            href={detailHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <div className="relative h-56 w-full bg-gray-100">
                              <img
                                src={event.image_url}
                                alt={event.title}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                              {badge}
                            </div>
                          </a>
                        )
                        : (
                          <Link to={detailHref} className="block">
                            <div className="relative h-56 w-full bg-gray-100">
                              <img
                                src={event.image_url}
                                alt={event.title}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                              {badge}
                            </div>
                          </Link>
                        )
                      : (
                        <div className="relative h-56 w-full bg-gray-100">
                          <img
                            src={event.image_url}
                            alt={event.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          {badge}
                        </div>
                      )
                  ) : null;

                  const titleNode = hasLink
                    ? isExternal
                      ? (
                        <a
                          href={detailHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-2xl font-semibold text-[#28313e] hover:underline"
                        >
                          {event.title}
                        </a>
                      )
                      : (
                        <Link to={detailHref} className="text-2xl font-semibold text-[#28313e] hover:underline">
                          {event.title}
                        </Link>
                      )
                    : (
                      <span className="text-2xl font-semibold text-[#28313e]">
                        {event.title}
                      </span>
                    );

                  return (
                    <article
                      key={`${event.source_table}-${event.id}`}
                      className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm"
                    >
                      {imageNode}
                      <div className="flex flex-col gap-4 p-6">
                        <div className="flex flex-col gap-2">
                          {titleNode}
                          <p className="text-sm font-semibold text-gray-700">
                            {dateRange}
                            {timeLabel ? ` • ${timeLabel}` : ''}
                          </p>
                          {(event.neighborhood || event.venue) && (
                            <p className="text-sm text-gray-600">
                              {[event.neighborhood, event.venue].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-gray-700">
                              {truncate(event.description)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {displayTags.slice(0, 6).map(tag => (
                            <span
                              key={tag.slug}
                              className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700"
                            >
                              #{tag.label}
                            </span>
                          ))}
                          {priceLabel && (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                              {priceLabel}
                            </span>
                          )}
                          {ageLabel && (
                            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-700">
                              {ageLabel}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <FavoriteButton event={event} />
                          {hasLink && (
                            isExternal ? (
                              <a
                                href={detailHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-indigo-600 hover:underline"
                              >
                                View Details
                              </a>
                            ) : (
                              <Link
                                to={detailHref}
                                className="text-sm font-semibold text-indigo-600 hover:underline"
                              >
                                View Details
                              </Link>
                            )
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {paginatedEvents.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-between rounded-full border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
              <button
                type="button"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={paginatedEvents.currentPage === 1}
                className={`rounded-full px-4 py-2 font-semibold transition ${
                  paginatedEvents.currentPage === 1
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {paginatedEvents.currentPage} of {paginatedEvents.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(prev => Math.min(paginatedEvents.totalPages, prev + 1))}
                disabled={paginatedEvents.currentPage === paginatedEvents.totalPages}
                className={`rounded-full px-4 py-2 font-semibold transition ${
                  paginatedEvents.currentPage === paginatedEvents.totalPages
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
