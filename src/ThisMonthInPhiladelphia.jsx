import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import Seo from './components/Seo.jsx';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  PHILLY_TIME_ZONE,
  monthSlugToIndex,
  getMonthWindow,
  indexToMonthSlug,
  overlaps,
  setEndOfDay,
  setStartOfDay,
  formatMonthYear,
  formatEventDateRange,
  parseEventDateValue,
  getZonedDate,
} from './utils/dateUtils';

const DEFAULT_OG_IMAGE = 'https://ourphilly.org/og-image.png';
const CANONICAL_BASE = 'https://ourphilly.org/philadelphia-events-';
const CANONICAL_INDEX = 'https://ourphilly.org/philadelphia-events/';
const MONTH_VIEW_REGEX = /^philadelphia-events-([a-z-]+)-(\d{4})$/i;
const GENERIC_TITLE = 'Philadelphia Events & Traditions – Our Philly';
const GENERIC_DESCRIPTION =
  'Explore Philadelphia events, traditions, festivals, and family-friendly plans updated regularly.';

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

export default function ThisMonthInPhiladelphia({ monthSlugOverride, yearOverride } = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const viewParam = params.view;
  const viewMatch = useMemo(() => {
    if (!viewParam) return null;
    const match = viewParam.match(MONTH_VIEW_REGEX);
    if (!match) return null;
    return { monthSlug: match[1].toLowerCase(), year: match[2] };
  }, [viewParam]);

  const monthSlugParam = monthSlugOverride || params.month || (viewMatch ? viewMatch.monthSlug : null);
  const yearParam = yearOverride || params.year || (viewMatch ? viewMatch.year : null);

  const normalizedMonthSlug = monthSlugParam ? monthSlugParam.toLowerCase() : null;
  const monthIndex = normalizedMonthSlug ? monthSlugToIndex(normalizedMonthSlug) : null;
  const yearNum = yearParam ? Number(yearParam) : NaN;
  const hasValidYear = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100;
  const hasValidParams = Boolean(monthIndex && hasValidYear);

  const monthWindow = useMemo(() => {
    if (!hasValidParams) {
      return { start: null, end: null };
    }
    return getMonthWindow(yearNum, monthIndex, PHILLY_TIME_ZONE);
  }, [hasValidParams, monthIndex, yearNum]);

  const monthStart = monthWindow.start;
  const monthEnd = monthWindow.end;
  const monthStartMs = monthStart ? monthStart.getTime() : null;
  const monthEndMs = monthEnd ? monthEnd.getTime() : null;

  const [monthlyEvents, setMonthlyEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ogImage, setOgImage] = useState(DEFAULT_OG_IMAGE);

  useEffect(() => {
    if (hasValidParams || monthSlugOverride || yearOverride) return;
    const timer = setTimeout(() => {
      navigate('/philadelphia-events/', { replace: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [hasValidParams, navigate, monthSlugOverride, yearOverride]);

  useEffect(() => {
    if (!hasValidParams || !monthStart || !monthEnd) {
      setMonthlyEvents([]);
      setLoading(false);
      setOgImage(DEFAULT_OG_IMAGE);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setOgImage(DEFAULT_OG_IMAGE);

    supabase
      .from('events')
      .select(`
        id,
        "E Name",
        "E Description",
        Dates,
        "End Date",
        "E Image",
        slug,
        latitude,
        longitude
      `)
      .order('Dates', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error loading monthly events', error);
          setMonthlyEvents([]);
          setLoading(false);
          return;
        }

        const filtered = (data || [])
          .map(evt => {
            const startRaw =
              evt['E Start Date'] || evt.Dates || evt['Start Date'] || evt.start_date;
            const endRaw =
              evt['E End Date'] || evt['End Date'] || evt.end_date || startRaw;
            const startDate = parseEventDateValue(startRaw, PHILLY_TIME_ZONE);
            const endDateBase = parseEventDateValue(endRaw, PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateBase) return null;
            const endDate = setEndOfDay(endDateBase);
            if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
            const latitudeRaw = evt.latitude;
            const longitudeRaw = evt.longitude;
            const latitude =
              latitudeRaw !== undefined && latitudeRaw !== null
                ? Number(latitudeRaw)
                : null;
            const longitude =
              longitudeRaw !== undefined && longitudeRaw !== null
                ? Number(longitudeRaw)
                : null;
            const hasValidLatitude = Number.isFinite(latitude);
            const hasValidLongitude = Number.isFinite(longitude);

            return {
              id: evt.id,
              title: evt['E Name'],
              description: evt['E Description'],
              imageUrl: evt['E Image'] || null,
              startDate,
              endDate,
              slug: evt.slug,
              source_table: 'events',
              latitude: hasValidLatitude ? latitude : null,
              longitude: hasValidLongitude ? longitude : null,
            };
          })
          .filter(Boolean)
          .sort((a, b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0));

        setMonthlyEvents(filtered);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasValidParams, monthStartMs, monthEndMs, monthSlugOverride, yearOverride]);

  const todayReferenceMs = useMemo(() => {
    const zonedNow = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    const startOfToday = setStartOfDay(zonedNow);
    return startOfToday?.getTime?.() ?? zonedNow.getTime();
  }, []);

  const { upcomingEvents, pastEvents, orderedEvents } = useMemo(() => {
    if (!monthlyEvents.length) {
      return { upcomingEvents: [], pastEvents: [], orderedEvents: [] };
    }

    const upcoming = [];
    const past = [];

    monthlyEvents.forEach(evt => {
      const endMs = evt.endDate?.getTime?.() ?? evt.startDate?.getTime?.() ?? 0;
      if (endMs >= todayReferenceMs) {
        upcoming.push(evt);
      } else {
        past.push(evt);
      }
    });

    return { upcomingEvents: upcoming, pastEvents: past, orderedEvents: [...upcoming, ...past] };
  }, [monthlyEvents, todayReferenceMs]);

  const totalEvents = orderedEvents.length;
  const upcomingCount = upcomingEvents.length;
  const hasPastEvents = pastEvents.length > 0;

  useEffect(() => {
    if (!hasValidParams) return;
    const firstWithImage = orderedEvents.find(evt => evt.imageUrl);
    if (firstWithImage?.imageUrl) {
      setOgImage(firstWithImage.imageUrl);
    }
  }, [orderedEvents, hasValidParams]);

  const monthLabel = monthStart ? formatMonthYear(monthStart, PHILLY_TIME_ZONE) : '';
  const canonicalSlug = monthIndex ? indexToMonthSlug(monthIndex) : null;
  const canonicalUrl = hasValidParams && canonicalSlug
    ? `${CANONICAL_BASE}${canonicalSlug}-${yearNum}/`
    : CANONICAL_INDEX;

  const seoTitle = hasValidParams && monthLabel
    ? `Events in Philadelphia – ${monthLabel} (Traditions, Festivals, Markets)`
    : GENERIC_TITLE;

  const seoDescription = hasValidParams && monthLabel
    ? `Explore ${monthLabel} events in Philadelphia, including traditions, festivals, and family-friendly plans.`
    : GENERIC_DESCRIPTION;

  const countText = hasValidParams && monthLabel ? `${totalEvents} traditions in ${monthLabel}!` : '';

  const upcomingEventsWithCoordinates = useMemo(
    () =>
      upcomingEvents.filter(
        evt => Number.isFinite(evt.latitude) && Number.isFinite(evt.longitude),
      ),
    [upcomingEvents],
  );

  const upcomingEventsForMap = useMemo(
    () =>
      upcomingEventsWithCoordinates.map(evt => ({
        ...evt,
        detailPath: getDetailPathForItem(evt) || null,
      })),
    [upcomingEventsWithCoordinates],
  );

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="website"
      />
      <Navbar />
      <main className="flex-1 pb-16 pt-24 md:pt-32">
        <div className="container mx-auto px-4 max-w-5xl">
          {hasValidParams ? (
            <>
              <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e] text-center">{countText}</h1>
              <p className="mt-6 text-lg text-gray-700 text-center max-w-3xl mx-auto">
                Browse traditions, festivals, and family-friendly events happening throughout {monthLabel}.
              </p>

              <section className="mt-10 bg-white border border-gray-200 rounded-2xl shadow-sm">
                {loading ? (
                  <p className="p-6 text-gray-500">Loading {monthLabel} traditions…</p>
                ) : totalEvents === 0 ? (
                  <p className="p-6 text-gray-500">No traditions posted yet for {monthLabel}. Check back soon.</p>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {orderedEvents.length > 0 && upcomingCount > 0 && (
                      <div className="px-6 py-4 bg-gray-50">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Upcoming Events</h3>
                        {hasPastEvents && (
                          <p className="mt-1 text-sm text-gray-500">
                            Happening next in Philadelphia this month.
                          </p>
                        )}
                      </div>
                    )}
                    {upcomingCount > 0 && upcomingEventsForMap.length > 0 && (
                      <div className="px-6 py-6">
                        <MonthlyEventsMap events={upcomingEventsForMap} />
                      </div>
                    )}
                    {orderedEvents.length > 0 && upcomingCount === 0 && hasPastEvents && (
                      <div className="px-6 py-4 bg-gray-50">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Previous Events</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          All of the events in this guide have already happened this month.
                        </p>
                      </div>
                    )}
                    {orderedEvents.map((evt, index) => {
                      const summary = evt.description?.trim() || 'Details coming soon.';
                      const detailPath = getDetailPathForItem(evt) || '/';
                      const shouldRenderPastHeading = hasPastEvents && upcomingCount > 0 && index === upcomingCount;
                      return (
                        <React.Fragment key={`${evt.source_table || 'events'}-${evt.id}`}>
                          {shouldRenderPastHeading && (
                            <div className="px-6 py-4 bg-gray-50">
                              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Previous Events</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Everything listed below has already taken place earlier this month.
                              </p>
                            </div>
                          )}
                          <article className="flex flex-col md:flex-row gap-4 px-6 py-6">
                            <div className="md:w-48 w-full flex-shrink-0">
                              <div className="relative w-full overflow-hidden rounded-xl bg-gray-100 aspect-[4/3]">
                                <img
                                  src={evt.imageUrl || DEFAULT_OG_IMAGE}
                                  alt={evt.title}
                                  loading="lazy"
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col">
                              <Link
                                to={detailPath}
                                className="text-2xl font-semibold text-[#28313e] hover:underline"
                              >
                                {evt.title}
                              </Link>
                              <p className="mt-2 text-sm font-semibold text-gray-700">
                                {formatEventDateRange(evt.startDate, evt.endDate, PHILLY_TIME_ZONE)}
                              </p>
                              <p className="mt-2 text-sm text-gray-600">{summary}</p>
                              <div className="mt-4">
                                <FavoriteState event_id={evt.id} source_table={evt.source_table || 'events'}>
                                  {({ isFavorite, toggleFavorite, loading: favLoading }) => (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!user) {
                                          navigate('/login');
                                          return;
                                        }
                                        toggleFavorite();
                                      }}
                                      disabled={favLoading}
                                      className={`inline-flex items-center px-4 py-2 border border-indigo-600 rounded-full font-semibold transition-colors ${
                                        isFavorite
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                                      }`}
                                    >
                                      {isFavorite ? 'In the Plans' : 'Add to Plans'}
                                    </button>
                                  )}
                                </FavoriteState>
                              </div>
                            </div>
                          </article>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="py-24 text-center text-gray-600">
              <p>Redirecting to the latest Philadelphia traditions…</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
