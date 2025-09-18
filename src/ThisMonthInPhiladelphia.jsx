import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import {
  PHILLY_TIME_ZONE,
  monthSlugToIndex,
  indexToMonthSlug,
  getMonthWindow,
  parseMonthDayYear,
  overlaps,
  setEndOfDay,
  formatMonthYear,
  formatEventDateRange,
} from './utils/dateUtils';

const DEFAULT_OG_IMAGE = 'https://ourphilly.org/og-image.png';
const CANONICAL_BASE = 'https://ourphilly.org/philadelphia-events-';
const CANONICAL_INDEX = 'https://ourphilly.org/philadelphia-events/';

function setMetaTag(name, content) {
  if (typeof document === 'undefined') return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setPropertyTag(property, content) {
  if (typeof document === 'undefined') return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonicalLink(url) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

const MONTH_VIEW_REGEX = /^philadelphia-events-([a-z-]+)-(\d{4})$/i;

export default function ThisMonthInPhiladelphia({ monthSlugOverride, yearOverride } = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const viewParam = params.view;
  const viewMatch = useMemo(() => {
    if (viewParam) {
      const match = viewParam.match(MONTH_VIEW_REGEX);
      if (match) {
        return { monthSlug: match[1].toLowerCase(), year: match[2] };
      }
    }
    return null;
  }, [viewParam]);

  const monthSlugParam = monthSlugOverride || params.monthSlug || (viewMatch ? viewMatch.monthSlug : null);
  const yearParam = yearOverride || params.year || (viewMatch ? viewMatch.year : null);

  const normalizedMonthSlug = monthSlugParam ? monthSlugParam.toLowerCase() : null;
  const monthIndex = normalizedMonthSlug ? monthSlugToIndex(normalizedMonthSlug) : null;
  const yearNum = yearParam ? Number(yearParam) : NaN;
  const hasValidParams = Boolean(monthIndex && !Number.isNaN(yearNum));

  useEffect(() => {
    if (!hasValidParams) {
      navigate('/philadelphia-events/', { replace: true });
    }
  }, [hasValidParams, navigate]);

  const monthWindow = useMemo(() => {
    if (!monthIndex || Number.isNaN(yearNum)) return { start: null, end: null };
    return getMonthWindow(yearNum, monthIndex, PHILLY_TIME_ZONE);
  }, [monthIndex, yearNum]);

  const monthStart = monthWindow.start;
  const monthEnd = monthWindow.end;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!monthIndex || Number.isNaN(yearNum) || !monthStart || !monthEnd) return;
    setLoading(true);
    supabase
      .from('events')
      .select(`
        id,
        "E Name",
        "E Description",
        Dates,
        "End Date",
        "E Image",
        slug
      `)
      .order('Dates', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading monthly events', error);
          setEvents([]);
          setLoading(false);
          return;
        }
        const filtered = (data || [])
          .map(evt => {
            const startDate = parseMonthDayYear(evt.Dates, PHILLY_TIME_ZONE);
            const endDateRaw = parseMonthDayYear(evt['End Date'], PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateRaw) return null;
            const endDate = setEndOfDay(new Date(endDateRaw));
            if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
            return {
              id: evt.id,
              title: evt['E Name'],
              description: evt['E Description'],
              imageUrl: evt['E Image'] || '',
              startDate,
              endDate,
              slug: evt.slug,
              source_table: 'events',
            };
          })
          .filter(Boolean)
          .sort((a, b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0));
        setEvents(filtered);
        setLoading(false);
      });
  }, [monthIndex, yearNum, monthStart, monthEnd]);

  const monthLabel = monthStart ? formatMonthYear(monthStart, PHILLY_TIME_ZONE) : '';
  const headingLabel = monthLabel || 'Philadelphia';
  const prevMonthIndex = monthIndex ? (monthIndex === 1 ? 12 : monthIndex - 1) : null;
  const prevYear = monthIndex === 1 ? yearNum - 1 : yearNum;
  const nextMonthIndex = monthIndex ? (monthIndex === 12 ? 1 : monthIndex + 1) : null;
  const nextYear = monthIndex === 12 ? yearNum + 1 : yearNum;

  const prevWindow = prevMonthIndex ? getMonthWindow(prevYear, prevMonthIndex, PHILLY_TIME_ZONE) : null;
  const nextWindow = nextMonthIndex ? getMonthWindow(nextYear, nextMonthIndex, PHILLY_TIME_ZONE) : null;

  const prevSlug = prevMonthIndex
    ? `/philadelphia-events-${indexToMonthSlug(prevMonthIndex)}-${prevYear}/`
    : '/philadelphia-events/';
  const nextSlug = nextMonthIndex
    ? `/philadelphia-events-${indexToMonthSlug(nextMonthIndex)}-${nextYear}/`
    : '/philadelphia-events/';

  const prevLabel = prevWindow ? formatMonthYear(prevWindow.start, PHILLY_TIME_ZONE) : '';
  const nextLabel = nextWindow ? formatMonthYear(nextWindow.start, PHILLY_TIME_ZONE) : '';

  const firstImage = useMemo(() => {
    for (const evt of events) {
      if (evt.imageUrl) return evt.imageUrl;
    }
    return null;
  }, [events]);

  const canonicalUrl = monthIndex && !Number.isNaN(yearNum)
    ? `${CANONICAL_BASE}${indexToMonthSlug(monthIndex)}-${yearNum}/`
    : CANONICAL_INDEX;

  useEffect(() => {
    if (!monthIndex || Number.isNaN(yearNum) || !monthStart) return;
    const heroImage = firstImage || DEFAULT_OG_IMAGE;
    const pageTitle = monthLabel ? `Philly Traditions in ${monthLabel}` : 'Philly Traditions in Philadelphia';
    const description = `${monthLabel || 'Philadelphia'} traditions, festivals, family-friendly fun, concerts, and markets from the most comprehensive events calendar in Philadelphia.`;
    if (typeof document !== 'undefined') {
      document.title = pageTitle;
    }
    setMetaTag('description', description);
    setPropertyTag('og:title', pageTitle);
    setPropertyTag('og:description', description);
    setPropertyTag('og:url', canonicalUrl);
    setPropertyTag('og:image', heroImage);
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', pageTitle);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', heroImage);
    setCanonicalLink(canonicalUrl);
  }, [monthIndex, yearNum, monthLabel, canonicalUrl, firstImage, monthStart]);

  const countText = `${events.length} traditions in ${headingLabel}!`;

  if (!hasValidParams) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />
        <main className="flex-1 pt-36 pb-16 flex items-center justify-center">
          <p className="text-gray-600">Redirecting to the latest Philadelphia traditions…</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-1 pt-36 md:pt-40 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e] text-center">
            Philly Traditions in {headingLabel}
          </h1>
          <p className="mt-6 text-lg text-gray-700 text-center max-w-3xl mx-auto">
            Welcome to the most comprehensive events calendar in Philadelphia. Explore {headingLabel} traditions covering markets, festivals, concerts, and family-friendly outings so your plans stay rich all month long.
          </p>

          <div className="mt-10 md:sticky md:top-24 bg-white/90 border border-gray-200 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center justify-center gap-4">
            <Link to={prevSlug} className="text-sm font-semibold text-indigo-600 hover:underline">
              ← {prevLabel || 'Previous'}
            </Link>
            <span className="hidden md:block text-gray-300">|</span>
            <Link to="/this-weekend-in-philadelphia/" className="text-sm font-semibold text-indigo-600 hover:underline">
              This Weekend →
            </Link>
            <span className="hidden md:block text-gray-300">|</span>
            <Link to={nextSlug} className="text-sm font-semibold text-indigo-600 hover:underline">
              {nextLabel || 'Next'} →
            </Link>
          </div>

          <p className="mt-8 text-xl font-semibold text-[#28313e] text-center">{countText}</p>

          <section className="mt-10 bg-white border border-gray-200 rounded-2xl shadow-sm">
            {loading ? (
              <p className="p-6 text-gray-500">Loading this month’s traditions…</p>
            ) : events.length === 0 ? (
              <p className="p-6 text-gray-500">No events match this month just yet. Check back soon!</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {events.map(evt => (
                  <div key={evt.id} className="flex flex-col md:flex-row gap-4 px-6 py-6">
                    <div className="md:w-48 w-full flex-shrink-0">
                      <img
                        src={evt.imageUrl || ''}
                        alt={evt.title}
                        loading="lazy"
                        className="w-full h-40 md:h-32 object-cover rounded-xl"
                      />
                    </div>
                    <div className="flex-1">
                      <Link to={`/events/${evt.slug}`} className="text-2xl font-semibold text-[#28313e] hover:underline">
                        {evt.title}
                      </Link>
                      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                        <span className="font-semibold text-gray-700">What to Expect:</span> {evt.description || 'Stay tuned for details — we’ll share updates soon.'}
                      </p>
                      <p className="mt-3 text-sm font-semibold text-gray-700">
                        {formatEventDateRange(evt.startDate, evt.endDate, PHILLY_TIME_ZONE)}
                      </p>
                      <FavoriteState event_id={evt.id} source_table="events">
                        {({ isFavorite, toggleFavorite, loading: favLoading }) => (
                          <button
                            onClick={() => {
                              if (!user) {
                                navigate('/login');
                                return;
                              }
                              toggleFavorite();
                            }}
                            disabled={favLoading}
                            className={`mt-4 inline-flex items-center px-4 py-2 border border-indigo-600 rounded-full font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                          >
                            {isFavorite ? 'In the Plans' : 'Add to Plans'}
                          </button>
                        )}
                      </FavoriteState>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!user && (
            <section className="mt-16">
              <div className="bg-indigo-600/10 border border-indigo-200 rounded-3xl px-6 py-12 flex flex-col items-center text-center gap-6">
                <h2 className="text-3xl sm:text-4xl font-[Barrio] text-[#28313e]">Keep your Philly traditions organized</h2>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center px-10 py-4 bg-indigo-600 text-white text-xl font-semibold rounded-full shadow-lg hover:bg-indigo-700 transition"
                >
                  Sign up to save your favorite traditions
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

