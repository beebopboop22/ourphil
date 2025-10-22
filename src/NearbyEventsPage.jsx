import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import EventListRow from './components/EventListRow.jsx';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import { supabase } from './supabaseClient.js';
import {
  PHILLY_TIME_ZONE,
  getZonedDate,
  setStartOfDay,
  parseEventDateValue,
  formatMonthDay,
} from './utils/dateUtils.js';
import {
  fetchNearbyEvents,
  buildAreaMetaMap,
  buildAreaSlugMap,
} from './utils/fetchNearbyEvents.js';

const DEFAULT_RADIUS_M = 1609;
const EXPANDED_RADIUS_M = Math.round(DEFAULT_RADIUS_M * 1.5);
const SPARSE_RESULT_COUNT = 6;

function useQueryParams() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

export default function NearbyEventsPage() {
  const { areaSlug } = useParams();
  const query = useQueryParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasError, setAreasError] = useState(null);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);
  const [tagMap, setTagMap] = useState({});

  const todayInPhilly = useMemo(() => setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)), []);

  useEffect(() => {
    let cancelled = false;
    setAreasLoading(true);
    supabase
      .from('areas')
      .select('id,name,slug,latitude,longitude,centroid_lat,centroid_lng')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Failed to load areas', error);
          setAreasError('Unable to load neighborhoods right now.');
          setAreas([]);
        } else {
          setAreas(data || []);
          setAreasError(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAreasLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const areaLookup = useMemo(() => {
    const map = {};
    areas.forEach(area => {
      if (area?.id != null) {
        map[area.id] = area.name || '';
      }
    });
    return map;
  }, [areas]);

  const areaMeta = useMemo(() => buildAreaMetaMap(areas), [areas]);
  const slugMap = useMemo(() => buildAreaSlugMap(areas), [areas]);

  const areaId = areaSlug ? slugMap[areaSlug] ?? null : null;
  const areaName = areaId != null ? areaLookup[areaId] || null : null;

  const radiusParam = Number(query.get('radius'));
  const radiusMeters = Number.isFinite(radiusParam) && radiusParam > 0 ? radiusParam : DEFAULT_RADIUS_M;
  const startParam = query.get('start');
  const startDate = useMemo(() => {
    const parsed = startParam ? parseEventDateValue(startParam) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    return todayInPhilly;
  }, [startParam, todayInPhilly]);
  const startIso = useMemo(() => startDate.toISOString().slice(0, 10), [startDate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let changed = false;
    if (!params.get('radius')) {
      params.set('radius', String(radiusMeters));
      changed = true;
    }
    if (!params.get('start')) {
      params.set('start', startIso);
      changed = true;
    }
    if (changed) {
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate, radiusMeters, startIso]);

  useEffect(() => {
    if (!areaSlug || areaId == null) {
      return;
    }
    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    setEventsLoading(true);
    setEventsError(null);
    fetchNearbyEvents({
      areaId,
      start: startDate,
      radius: radiusMeters,
      limit: 40,
      areaLookup,
      areaMeta,
      signal: controller?.signal,
    })
      .then(result => {
        if (cancelled) return;
        setEvents(Array.isArray(result) ? result : []);
        setEventsError(null);
      })
      .catch(err => {
        console.error('Failed to load nearby list', err);
        if (cancelled) return;
        setEvents([]);
        setEventsError('We had trouble loading nearby events.');
      })
      .finally(() => {
        if (!cancelled) {
          setEventsLoading(false);
        }
      });
    return () => {
      cancelled = true;
      if (controller) controller.abort();
    };
  }, [areaSlug, areaId, startDate, radiusMeters, areaLookup, areaMeta]);

  useEffect(() => {
    if (!events.length) {
      setTagMap({});
      return;
    }
    const idsByType = events.reduce((acc, event) => {
      if (!event?.source_table || !event.favoriteId) return acc;
      const key = event.source_table;
      acc[key] = acc[key] || new Set();
      acc[key].add(event.favoriteId);
      return acc;
    }, {});
    const entries = Object.entries(idsByType);
    if (!entries.length) {
      setTagMap({});
      return;
    }
    let cancelled = false;
    Promise.all(
      entries.map(([table, ids]) =>
        supabase
          .from('taggings')
          .select('taggable_id, tags:tags(name, slug)')
          .eq('taggable_type', table)
          .in('taggable_id', Array.from(ids))
      )
    )
      .then(results => {
        if (cancelled) return;
        const map = {};
        results.forEach((res, index) => {
          if (res.error) {
            console.error('Failed to load tags for type', entries[index][0], res.error);
            return;
          }
          res.data?.forEach(row => {
            const table = entries[index][0];
            const key = `${table}:${row.taggable_id}`;
            if (!map[key]) map[key] = [];
            if (Array.isArray(row.tags)) {
              map[key].push(...row.tags);
            }
          });
        });
        setTagMap(map);
      })
      .catch(err => {
        console.error('Failed to load nearby tags', err);
        if (!cancelled) {
          setTagMap({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [events]);

  const isSparse = !eventsLoading && events.length > 0 && events.length < SPARSE_RESULT_COUNT && radiusMeters < EXPANDED_RADIUS_M;

  const handleExpandRadius = () => {
    const params = new URLSearchParams(location.search);
    params.set('radius', String(EXPANDED_RADIUS_M));
    params.set('start', startIso);
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  const handleResetStart = () => {
    const params = new URLSearchParams(location.search);
    params.set('start', todayInPhilly.toISOString().slice(0, 10));
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  const pageTitle = areaName ? `Events near ${areaName}` : 'Nearby events';
  const description = areaName
    ? `Roughly ${events.length} upcoming events within ${(radiusMeters / 1609.344).toFixed(1)} miles of ${areaName}.`
    : 'Upcoming events near your selected neighborhood.';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Helmet>
        <title>{`${pageTitle} | Our Philly`}</title>
        <meta name="description" content={description} />
      </Helmet>
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Nearby events</p>
            <h1 className="mt-3 text-3xl font-bold text-[#28313e] sm:text-4xl">
              {areaName ? `Around ${areaName}` : 'Nearby events'}
            </h1>
            <p className="mt-3 text-sm text-gray-600 sm:text-base">
              {areaName
                ? `Upcoming happenings within about ${(radiusMeters / 1609.344).toFixed(1)} miles of ${areaName}.`
                : 'Pick a neighborhood from the homepage to personalize this list.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">
                Start date: {formatMonthDay(startDate, PHILLY_TIME_ZONE)}
              </span>
              <button
                type="button"
                onClick={handleExpandRadius}
                disabled={radiusMeters >= EXPANDED_RADIUS_M}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-3 py-1 font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Expand to 1.5 mi
              </button>
              <button
                type="button"
                onClick={handleResetStart}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-3 py-1 font-semibold text-indigo-600 transition hover:bg-indigo-50"
              >
                Reset date
              </button>
            </div>
          </div>

          {areasError && !areaId && !areasLoading ? (
            <div className="mt-8 rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-sm text-rose-700">{areasError}</div>
          ) : null}

          {areaSlug && areaId == null && !areasLoading ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              We couldn’t find that neighborhood. Try heading back to the homepage to pick a different area.
            </div>
          ) : null}

          {eventsLoading ? (
            <div className="mt-10 space-y-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-36 w-full animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : null}

          {!eventsLoading && eventsError ? (
            <div className="mt-10 rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-sm text-rose-700">
              {eventsError}
            </div>
          ) : null}

          {!eventsLoading && !eventsError && events.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 text-sm text-indigo-900 sm:text-base">
              <p className="font-semibold">We don’t have any events in range yet.</p>
              <p className="mt-2">Expand the radius to catch a wider net of nearby happenings.</p>
              <button
                type="button"
                onClick={handleExpandRadius}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
              >
                Expand to 1.5 mi
              </button>
            </div>
          ) : null}

          {!eventsLoading && events.length > 0 ? (
            <div className="mt-12 space-y-6">
              <MonthlyEventsMap events={events} height={320} variant="panel" />
              <div className="space-y-4">
                {events.map((event, idx) => {
                  const key = event.source_table && event.favoriteId ? `${event.source_table}:${event.favoriteId}` : null;
                  const tags = key && tagMap ? tagMap[key] || [] : [];
                  const eventKey = event.id || key || event.slug || `${event.title || 'event'}-${idx}`;
                  return (
                    <EventListRow
                      key={eventKey}
                      event={event}
                      tags={tags}
                      now={todayInPhilly}
                      distanceMeters={event.distance_meters}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {isSparse ? (
            <div className="mt-8">
              <button
                type="button"
                onClick={handleExpandRadius}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
              >
                Expand to 1.5 mi
              </button>
            </div>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
