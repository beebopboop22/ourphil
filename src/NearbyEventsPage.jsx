import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, AlertCircle } from 'lucide-react';

import Navbar from './Navbar';
import Footer from './Footer';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import { supabase } from './supabaseClient.js';
import { AuthContext } from './AuthProvider.jsx';
import useProfile from './utils/useProfile.js';
import useAreaLookup, { getAreaNameFromCache, resolveAreaSlug } from './utils/useAreaLookup.js';
import useEventFavorite from './utils/useEventFavorite.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import { formatMonthDay, PHILLY_TIME_ZONE, toPhillyISODate } from './utils/dateUtils.js';
import { getMapboxToken } from './config/mapboxToken.js';

const METERS_PER_MILE = 1609.344;
const RADIUS_OPTIONS_MI = [0.5, 1, 1.5];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Map preview error', error, info);
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback(this.state.error);
      }
      return fallback || null;
    }
    return this.props.children;
  }
}

function FavoriteState({ eventId, sourceTable, children }) {
  const state = useEventFavorite({ event_id: eventId, source_table: sourceTable });
  return children(state);
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="hidden h-20 w-20 flex-shrink-0 rounded-xl bg-gray-200 sm:block" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-6 w-3/4 rounded bg-gray-300" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

function formatMilesLabel(radiusMeters) {
  const miles = radiusMeters / METERS_PER_MILE;
  if (!Number.isFinite(miles) || miles <= 0) return '';
  if (miles >= 10) {
    return `${Math.round(miles)} mi`;
  }
  if (Math.abs(miles - Math.round(miles)) < 1e-2) {
    return `${Math.round(miles)} mi`;
  }
  return `${miles.toFixed(1)} mi`;
}

function formatPhillyTime(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILLY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter
    .format(date)
    .replace(' AM', ' a.m.')
    .replace(' PM', ' p.m.')
    .replace(' am', ' a.m.')
    .replace(' pm', ' p.m.');
}

function formatTimeRange(startDate, endDate) {
  if (!startDate) return '';
  const start = formatPhillyTime(startDate);
  const end = endDate ? formatPhillyTime(endDate) : '';
  if (start && end && start !== end) {
    return `${start} – ${end}`;
  }
  return start || end || '';
}

function formatStartLabel(date) {
  if (!date) return '';
  const dateLabel = formatMonthDay(date, PHILLY_TIME_ZONE);
  const timeLabel = formatPhillyTime(date);
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

function parseCoordinate(value) {
  if (value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function titleCaseFromSlug(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeTags(row) {
  const tags = [];
  const source = Array.isArray(row.tags)
    ? row.tags
    : Array.isArray(row.tag_slugs)
    ? row.tag_slugs
    : Array.isArray(row.tagNames)
    ? row.tagNames
    : [];

  source.forEach(entry => {
    if (!entry) return;
    if (typeof entry === 'string') {
      const slug = entry.trim();
      if (!slug) return;
      tags.push({ slug, name: titleCaseFromSlug(slug) || slug });
      return;
    }
    if (typeof entry === 'object') {
      const slug = typeof entry.slug === 'string' && entry.slug.trim()
        ? entry.slug.trim()
        : typeof entry.name === 'string' && entry.name.trim()
        ? entry.name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        : '';
      if (!slug) return;
      const name = typeof entry.name === 'string' && entry.name.trim()
        ? entry.name.trim()
        : titleCaseFromSlug(slug) || slug;
      tags.push({ slug, name });
    }
  });

  const seen = new Set();
  return tags.filter(tag => {
    if (!tag.slug) return false;
    const key = tag.slug;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDistanceMiles(distanceMeters) {
  const distance = typeof distanceMeters === 'number' ? distanceMeters : Number(distanceMeters);
  if (!Number.isFinite(distance) || distance <= 0) return '';
  const miles = distance / METERS_PER_MILE;
  if (miles >= 10) return `${Math.round(miles)} mi away`;
  return `${miles.toFixed(1)} mi away`;
}

function normalizeEventRow(row, areaLookup) {
  if (!row) return null;
  const id = row.id || row.event_id || row.uuid;
  if (!id) return null;

  const startDate = row.start_datetime ? new Date(row.start_datetime) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  const endDate = row.end_datetime ? new Date(row.end_datetime) : null;

  const areaId = row.area_id || null;
  const areaName = areaId ? areaLookup[areaId] || row.area_name || null : row.area_name || null;

  const tags = normalizeTags(row);
  const timeLabel = formatTimeRange(startDate, endDate || startDate);
  const detailCandidate = {
    ...row,
    source_table: row.source_table || 'events_unified',
    id,
  };
  const detailPath = getDetailPathForItem(detailCandidate);

  const latitude = parseCoordinate(row.latitude ?? row.lat);
  const longitude = parseCoordinate(row.longitude ?? row.lng);
  const distanceLabel = formatDistanceMiles(row.distance_m);

  const imageUrl =
    row.image_url ||
    row.image ||
    row.hero_image ||
    row.photo_url ||
    row.card_image ||
    '';

  const venueName =
    row.venue_name ||
    row.venue?.name ||
    row.location_name ||
    row.place_name ||
    null;

  const address =
    row.address ||
    row.location ||
    row.street_address ||
    row.full_address ||
    null;

  const externalUrl =
    row.url ||
    row.event_url ||
    row.ticket_url ||
    row.external_url ||
    null;

  return {
    id,
    title: row.title || row.name || 'Untitled event',
    description: row.description || row.summary || '',
    startDate,
    endDate: endDate || startDate,
    area_id: areaId,
    areaName,
    tags,
    mapTags: tags,
    timeLabel,
    favoriteId: id,
    source_table: row.source_table || 'events_unified',
    detailPath,
    externalUrl,
    imageUrl,
    venueName,
    address,
    latitude,
    longitude,
    distance_m: typeof row.distance_m === 'number' ? row.distance_m : Number(row.distance_m),
    distanceLabel,
  };
}

function NearbyEventCard({ event }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const tags = event.tags || [];
  const areaLabel = event.areaName || getAreaNameFromCache(event.area_id) || null;
  const label = formatStartLabel(event.startDate);
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};

  const actions = event.source_table
    ? (
        <FavoriteState eventId={event.favoriteId} sourceTable={event.source_table}>
          {({ isFavorite, toggleFavorite, loading }) => (
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                if (!user) {
                  navigate('/login');
                  return;
                }
                toggleFavorite();
              }}
              disabled={loading}
              className={`border border-indigo-600 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isFavorite
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          )}
        </FavoriteState>
      )
    : event.externalUrl
    ? (
        <a
          href={event.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-indigo-600 rounded-full px-4 py-2 text-sm font-semibold text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors text-center"
          onClick={e => e.stopPropagation()}
        >
          Get Tickets
        </a>
      )
    : null;

  const containerClass = event.detailPath
    ? 'block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
    : 'rounded-2xl border border-gray-200 bg-white shadow-sm';

  return (
    <Wrapper {...wrapperProps} className={containerClass}>
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex w-full items-start gap-4">
          <div className="hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:block">
            {event.imageUrl ? (
              <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              {label && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{label}</span>}
              {event.distanceLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700">
                  {event.distanceLabel}
                </span>
              )}
              {areaLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[0.65rem] font-semibold normal-case text-[#29313f]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {areaLabel}
                </span>
              )}
            </div>
            <h3 className="mt-2 break-words text-lg font-bold text-gray-800">{event.title}</h3>
            {event.timeLabel && <p className="mt-1 text-sm text-gray-600">{event.timeLabel}</p>}
            {event.description && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{event.description}</p>}
            {event.venueName && <p className="mt-1 text-sm text-gray-500">at {event.venueName}</p>}
            {!event.venueName && event.address && (
              <p className="mt-1 text-sm text-gray-500">{event.address}</p>
            )}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.slice(0, 3).map((tag, index) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    onClick={e => e.stopPropagation()}
                    className={`${pillStyles[index % pillStyles.length]} rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                  >
                    #{tag.name}
                  </Link>
                ))}
                {tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{tags.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-col items-stretch gap-2 md:w-40">{actions}</div>}
      </div>
    </Wrapper>
  );
}

export default function NearbyEventsPage() {
  const { areaSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useProfile();
  const areaLookup = useAreaLookup();
  const todayKey = useMemo(() => toPhillyISODate(new Date()), []);
  const mapboxToken = useMemo(() => getMapboxToken(), []);

  const [areaState, setAreaState] = useState({ status: 'loading', area: null, error: '' });
  const [eventRows, setEventRows] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [rpcError, setRpcError] = useState('');
  const [appliedDefaultRadius, setAppliedDefaultRadius] = useState(null);

  const rawDate = searchParams.get('date');
  const startKey = DATE_REGEX.test(rawDate || '') ? rawDate : todayKey;

  useEffect(() => {
    if (DATE_REGEX.test(rawDate || '')) return;
    const params = new URLSearchParams(searchParams);
    params.set('date', startKey);
    setSearchParams(params, { replace: true });
  }, [rawDate, startKey, searchParams, setSearchParams]);

  const rawRadius = searchParams.get('radius');
  const parsedRadius = rawRadius ? Number.parseInt(rawRadius, 10) : NaN;
  const defaultRadius = profile?.preferred_radius_m && profile.preferred_radius_m > 0
    ? Math.round(profile.preferred_radius_m)
    : 1609;
  const radius = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : defaultRadius;

  useEffect(() => {
    const hasValidParam = Number.isFinite(parsedRadius) && parsedRadius > 0;
    if (!hasValidParam) {
      const params = new URLSearchParams(searchParams);
      params.set('radius', String(defaultRadius));
      setSearchParams(params, { replace: true });
      setAppliedDefaultRadius(defaultRadius);
      return;
    }

    if (appliedDefaultRadius !== null) {
      if (parsedRadius === appliedDefaultRadius && defaultRadius !== appliedDefaultRadius) {
        const params = new URLSearchParams(searchParams);
        params.set('radius', String(defaultRadius));
        setSearchParams(params, { replace: true });
        setAppliedDefaultRadius(defaultRadius);
        return;
      }

      if (parsedRadius !== appliedDefaultRadius) {
        setAppliedDefaultRadius(null);
      }
    }
  }, [parsedRadius, defaultRadius, searchParams, setSearchParams, appliedDefaultRadius]);

  useEffect(() => {
    let isMounted = true;
    setAreaState({ status: 'loading', area: null, error: '' });

    const slug = typeof areaSlug === 'string' ? areaSlug : '';
    resolveAreaSlug(slug)
      .then(area => {
        if (!isMounted) return;
        if (area) {
          setAreaState({ status: 'ready', area, error: '' });
        } else {
          setAreaState({ status: 'not-found', area: null, error: '' });
        }
      })
      .catch(error => {
        if (!isMounted) return;
        setAreaState({ status: 'error', area: null, error: error?.message || 'Unable to load neighborhood.' });
      });

    return () => {
      isMounted = false;
    };
  }, [areaSlug]);

  const areaInfo = areaState.area;
  const radiusForQuery = Math.max(1, Math.round(radius));

  useEffect(() => {
    if (!areaInfo?.id || !startKey || !radiusForQuery) return;
    let active = true;
    setLoadingEvents(true);
    setRpcError('');

    supabase
      .rpc('events_nearby_distance_first', {
        area_id: areaInfo.id,
        radius_m: radiusForQuery,
        start: startKey,
        limit_rows: 50,
      })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('events_nearby_distance_first error', error);
          setRpcError('We hit a snag loading events. Please try again.');
          setEventRows([]);
        } else {
          setEventRows(Array.isArray(data) ? data : []);
        }
      })
      .catch(err => {
        if (!active) return;
        console.error('events_nearby_distance_first failed', err);
        setRpcError('We hit a snag loading events. Please try again.');
        setEventRows([]);
      })
      .finally(() => {
        if (active) {
          setLoadingEvents(false);
        }
      });

    return () => {
      active = false;
    };
  }, [areaInfo?.id, startKey, radiusForQuery]);

  const events = useMemo(
    () =>
      (eventRows || [])
        .map(row => normalizeEventRow(row, areaLookup))
        .filter(Boolean),
    [eventRows, areaLookup],
  );

  const eventsWithCoordinates = useMemo(
    () => events.filter(evt => Number.isFinite(evt.latitude) && Number.isFinite(evt.longitude)),
    [events],
  );

  const radiusLabel = formatMilesLabel(radiusForQuery);
  const areaName = areaInfo?.name || (areaInfo?.id ? areaLookup[areaInfo.id] : '');
  const pageTitle = areaName ? `Upcoming near ${areaName}` : 'Upcoming events nearby';

  const handleRadiusChange = miles => {
    const meters = Math.max(1, Math.round(miles * METERS_PER_MILE));
    const params = new URLSearchParams(searchParams);
    params.set('radius', String(meters));
    params.set('date', startKey);
    setSearchParams(params, { replace: false });
  };

  const handleExpandRadius = () => {
    handleRadiusChange(1.5);
  };

  if (areaState.status === 'loading') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-32 text-center text-gray-500">
          Loading neighborhood…
        </div>
        <Footer />
      </div>
    );
  }

  if (areaState.status === 'not-found') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="mx-auto max-w-2xl px-4 pb-20 pt-32 text-center">
          <h1 className="text-3xl font-semibold text-gray-800">Neighborhood not found</h1>
          <p className="mt-4 text-gray-600">
            We couldn’t find that neighborhood. Try browsing all events instead.
          </p>
          <Link
            to="/upcoming-events"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
          >
            Browse all events
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (areaState.status === 'error') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-32 text-center text-gray-600">
          <p>We couldn’t load that neighborhood right now. Please try again shortly.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Upcoming events within reach of ${areaName || 'this neighborhood'}.`} />
      </Helmet>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-28">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{pageTitle}</h1>
            {radiusLabel && (
              <span className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                within {radiusLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {RADIUS_OPTIONS_MI.map(miles => {
              const meters = Math.round(miles * METERS_PER_MILE);
              const isActive = Math.abs(meters - radiusForQuery) < 2;
              return (
                <button
                  key={miles}
                  type="button"
                  onClick={() => handleRadiusChange(miles)}
                  className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow'
                      : 'border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {miles} mi
                </button>
              );
            })}
          </div>
        </header>

        {mapboxToken && eventsWithCoordinates.length > 0 ? (
          <div className="mb-8">
            <MapErrorBoundary
              fallback={() => (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  Map preview temporarily unavailable.
                </div>
              )}
            >
              <MonthlyEventsMap events={eventsWithCoordinates} height={320} />
            </MapErrorBoundary>
          </div>
        ) : null}

        {rpcError && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {rpcError}
          </div>
        )}

        {loadingEvents ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="space-y-4">
            {events.map(event => (
              <NearbyEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">
            <p className="text-lg font-semibold text-gray-800">No events nearby just yet.</p>
            <p className="mt-2 text-sm text-gray-600">
              Try widening your search radius to catch more happenings.
            </p>
            <button
              type="button"
              onClick={handleExpandRadius}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
            >
              Expand to 1.5 mi
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
