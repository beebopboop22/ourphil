import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { FaStar } from 'react-icons/fa';

import Navbar from './Navbar';
import Footer from './Footer';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useProfile from './utils/useProfile.js';
import useAreaLookup, { resolveAreaBySlug } from './utils/useAreaLookup.js';
import useEventFavorite from './utils/useEventFavorite.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import { getMapboxToken } from './config/mapboxToken.js';
import {
  PHILLY_TIME_ZONE,
  getZonedDate,
  setStartOfDay,
  formatMonthDay,
} from './utils/dateUtils.js';

const METERS_PER_MILE = 1609.34;
const DEFAULT_RADIUS_M = 1609;
const RADIUS_OPTIONS = [
  { miles: 0.5, label: '0.5 mi', value: Math.round(0.5 * METERS_PER_MILE) },
  { miles: 1, label: '1 mi', value: Math.round(1 * METERS_PER_MILE) },
  { miles: 1.5, label: '1.5 mi', value: Math.round(1.5 * METERS_PER_MILE) },
];

const PILL_STYLES = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

function toPhillyISODate(date) {
  const zoned = getZonedDate(date, PHILLY_TIME_ZONE);
  const start = setStartOfDay(zoned);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(value) {
  if (!value || typeof value !== 'string') return null;
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return setStartOfDay(date);
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hoursStr, minutesStr] = timeStr.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr ? minutesStr.padStart(2, '0') : '00';
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatMiles(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  const miles = meters / METERS_PER_MILE;
  const rounded = Math.round(miles * 10) / 10;
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} mi`;
}

function formatRadiusChip(meters) {
  const milesLabel = formatMiles(meters);
  return milesLabel ? `within ${milesLabel}` : null;
}

function formatEventTiming(event, now) {
  if (!event?.startDate || !now) return '';
  const eventDate = setStartOfDay(new Date(event.startDate));
  const diffMs = eventDate.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return `Today${event.start_time ? ` · ${formatTime(event.start_time)}` : ''}`;
  }
  if (diffDays === 1) {
    return `Tomorrow${event.start_time ? ` · ${formatTime(event.start_time)}` : ''}`;
  }
  const weekday = event.startDate
    ? new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(event.startDate)
    : '';
  return `${weekday}${event.start_time ? ` · ${formatTime(event.start_time)}` : ''}`;
}

function pickNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(normalized)) return normalized;
  }
  return null;
}

function normalizeTag(tag) {
  if (!tag) return null;
  if (typeof tag === 'string') {
    const slug = tag.trim();
    if (!slug) return null;
    return { slug, name: slug.replace(/[-_]+/g, ' ') };
  }
  if (typeof tag === 'object') {
    const slug =
      (typeof tag.slug === 'string' && tag.slug.trim()) ||
      (typeof tag.name === 'string' && tag.name.trim().toLowerCase().replace(/\s+/g, '-')) ||
      null;
    const name =
      (typeof tag.name === 'string' && tag.name.trim()) ||
      (typeof tag.slug === 'string' && tag.slug.trim()) ||
      '';
    if (!slug && !name) return null;
    return { slug: slug || name, name: name || slug || '' };
  }
  return null;
}

function selectFavoriteId(row) {
  const candidates = [
    row.favorite_id,
    row.favoriteId,
    row.event_int_id,
    row.event_uuid,
    row.eventUuid,
    row.event_id,
    row.eventId,
    row.source_id,
    row.sourceId,
    row.id,
  ];
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && candidate !== '') {
      return candidate;
    }
  }
  return null;
}

function normalizeNearbyEvent(row, areaLookup) {
  if (!row) return null;
  const sourceTable =
    row.source_table ||
    row.sourceTable ||
    row.table ||
    row.source ||
    'all_events';
  const favoriteId = selectFavoriteId(row);
  const startDate = parseISODate(row.start_date || row.startDate || row.date);
  const endDate = parseISODate(row.end_date || row.endDate || row.start_date || row.startDate) || startDate;
  const areaId = row.area_id ?? row.areaId ?? row.venue_area_id ?? null;
  const areaName = areaId ? areaLookup[areaId] || row.area_name || row.areaName || null : row.area_name || row.areaName || null;
  const detailPath = row.detail_path || getDetailPathForItem({ ...row, source_table: sourceTable });
  const rawTags = Array.isArray(row.tags) ? row.tags : [];
  const normalizedTags = rawTags.map(normalizeTag).filter(Boolean);
  const distanceMeters =
    typeof row.distance_m === 'number'
      ? row.distance_m
      : typeof row.distanceMeters === 'number'
      ? row.distanceMeters
      : null;
  const badges = Array.isArray(row.badges)
    ? row.badges
    : row.fallback_reason
    ? [row.fallback_reason]
    : [];
  const latitude = pickNumber(
    row.latitude,
    row.lat,
    row.event_latitude,
    row.venue_latitude,
    row.location?.latitude,
  );
  const longitude = pickNumber(
    row.longitude,
    row.lon,
    row.lng,
    row.event_longitude,
    row.venue_longitude,
    row.location?.longitude,
  );

  const idBase =
    favoriteId ??
    row.event_uuid ??
    row.event_id ??
    row.slug ??
    row.id ??
    Math.random();
  const key = `${sourceTable}:${idBase}:${row.start_date || row.startDate || ''}`;

  return {
    id: key,
    source_table: sourceTable,
    favoriteId,
    title: row.title || row.name || row.event_name || 'Untitled event',
    description: row.description || row.summary || '',
    startDate,
    endDate,
    start_date: row.start_date || row.startDate || null,
    end_date: row.end_date || row.endDate || null,
    start_time: row.start_time || row.startTime || null,
    end_time: row.end_time || row.endTime || null,
    area_id: areaId,
    areaName,
    detailPath,
    tags: normalizedTags,
    badges,
    externalUrl: row.external_url || row.link || row.url || null,
    imageUrl: row.image_url || row.image || row.hero_image || '',
    latitude,
    longitude,
    distance_m: distanceMeters,
    venues: row.venues || row.venue || null,
    address: row.address || row.location?.address || null,
    raw: row,
  };
}

function FavoriteState({ eventId, sourceTable, children }) {
  const state = useEventFavorite({ event_id: eventId, source_table: sourceTable });
  return children(state);
}

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      // Reset the error boundary when underlying data changes
      // to give the map a fresh attempt.
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-start gap-4">
          <div className="hidden h-20 w-20 flex-shrink-0 rounded-xl bg-gray-200 sm:block" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-32 rounded-full bg-gray-200" />
            <div className="h-6 w-3/4 rounded-full bg-gray-200" />
            <div className="h-4 w-1/2 rounded-full bg-gray-200" />
          </div>
        </div>
        <div className="h-9 w-32 rounded-full bg-gray-200" />
      </div>
    </div>
  );
}

function NearbyEventRow({ event, tags, now }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const label = formatEventTiming(event, now);
  const areaLabel =
    [event.areaName, event.area?.name, event.area_name]
      .map(candidate => (typeof candidate === 'string' ? candidate.trim() : ''))
      .find(Boolean) || null;
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};
  const containerClass = event.detailPath
    ? 'block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
    : 'rounded-2xl border border-gray-200 bg-white shadow-sm';
  const distanceLabel = event.distance_m ? formatMiles(event.distance_m) : null;
  const timeRangeLabel = event.start_time
    ? event.end_time
      ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
      : formatTime(event.start_time)
    : null;
  const badges = Array.isArray(event.badges) ? event.badges : [];

  const actions = event.source_table && event.favoriteId ? (
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
          className={`rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition-colors ${
            isFavorite
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
          }`}
        >
          {isFavorite ? 'In the Plans' : 'Add to Plans'}
        </button>
      )}
    </FavoriteState>
  ) : event.externalUrl ? (
    <a
      href={event.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full border border-indigo-600 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-600 hover:text-white"
    >
      Get Tickets
    </a>
  ) : null;

  return (
    <Wrapper {...wrapperProps} className={containerClass}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex w-full items-start gap-4">
          <div className="hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:block">
            {event.imageUrl && <img src={event.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              {label && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{label}</span>}
              {distanceLabel && (
                <span className="rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[#29313f]">{distanceLabel} away</span>
              )}
              {areaLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[#29313f]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {areaLabel}
                </span>
              )}
              {badges.map(badge => (
                <span
                  key={badge}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    badge === 'Tradition'
                      ? 'bg-yellow-100 text-yellow-800'
                      : badge === 'Submission'
                      ? 'bg-purple-100 text-purple-800'
                      : badge === 'Sports'
                      ? 'bg-green-100 text-green-800'
                      : badge === 'Recurring'
                      ? 'bg-blue-100 text-blue-800'
                      : badge === 'Group Event'
                      ? 'bg-emerald-100 text-emerald-800'
                      : badge === 'Featured'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {badge === 'Tradition' && <FaStar className="text-yellow-500" />}
                  {badge}
                </span>
              ))}
            </div>
            <h3 className="mt-2 break-words text-lg font-bold text-gray-800">{event.title}</h3>
            {timeRangeLabel && <p className="mt-1 text-sm font-medium text-[#29313f]">{timeRangeLabel}</p>}
            {event.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{event.description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-col items-stretch gap-2 sm:w-40">{actions}</div>}
      </div>
      {tags.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 3).map((tag, index) => (
              <Link
                key={tag.slug || `${tag.name}-${index}`}
                to={`/tags/${tag.slug}`}
                className={`${PILL_STYLES[index % PILL_STYLES.length]} rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                onClick={e => e.stopPropagation()}
              >
                #{tag.name}
              </Link>
            ))}
            {tags.length > 3 && <span className="text-xs text-gray-500">+{tags.length - 3} more</span>}
          </div>
        </div>
      )}
    </Wrapper>
  );
}

export default function NearbyEventsPage() {
  const { areaSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useProfile();
  const areaLookup = useAreaLookup();
  const todayIso = useMemo(() => toPhillyISODate(new Date()), []);
  const mapboxToken = useMemo(() => getMapboxToken(), []);

  const radiusParam = searchParams.get('radius');
  const dateParam = searchParams.get('date');
  const parsedRadius = radiusParam ? Number(radiusParam) : NaN;
  const initialRadius = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : DEFAULT_RADIUS_M;

  const [radiusMeters, setRadiusMeters] = useState(initialRadius);
  const [startDate, setStartDate] = useState(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam;
    }
    return todayIso;
  });
  const [areaInfo, setAreaInfo] = useState(null);
  const [areaStatus, setAreaStatus] = useState('loading');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tagMap, setTagMap] = useState({});
  const [mapErrored, setMapErrored] = useState(false);

  const nowInPhilly = useMemo(() => getZonedDate(new Date(), PHILLY_TIME_ZONE), []);

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setStartDate(dateParam);
      return;
    }
    if (dateParam === todayIso) return;
    const next = new URLSearchParams(searchParams);
    next.set('date', todayIso);
    setStartDate(todayIso);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam, todayIso]);

  useEffect(() => {
    if (Number.isFinite(parsedRadius) && parsedRadius > 0) {
      setRadiusMeters(parsedRadius);
      return;
    }
    const fallback = profile?.preferred_radius_m || DEFAULT_RADIUS_M;
    if (radiusMeters === fallback && radiusParam) return;
    setRadiusMeters(fallback);
    if (radiusParam === String(fallback)) return;
    const next = new URLSearchParams(searchParams);
    next.set('radius', String(fallback));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedRadius, profile?.preferred_radius_m]);

  useEffect(() => {
    let cancelled = false;
    setAreaStatus('loading');
    setAreaInfo(null);
    resolveAreaBySlug(areaSlug)
      .then(area => {
        if (cancelled) return;
        if (area) {
          setAreaInfo(area);
          setAreaStatus('ready');
        } else {
          setAreaStatus('notfound');
        }
      })
      .catch(err => {
        console.error('Failed to resolve area slug', err);
        if (!cancelled) {
          setAreaStatus('notfound');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [areaSlug]);

  useEffect(() => {
    if (areaStatus !== 'ready' || !areaInfo?.id || !startDate || !radiusMeters) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setMapErrored(false);
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('events_nearby', {
          area_id: areaInfo.id,
          radius_m: radiusMeters,
          start_date: startDate,
        });
        if (rpcError) {
          throw rpcError;
        }
        if (cancelled) return;
        const lookup = areaLookup || {};
        const normalized = (data || [])
          .map(row => normalizeNearbyEvent(row, lookup))
          .filter(Boolean);
        setEvents(normalized);
        setError('');
      } catch (err) {
        console.error('Failed to load nearby events', err);
        if (!cancelled) {
          setEvents([]);
          setError('We had trouble loading nearby events. Please try again soon.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [areaStatus, areaInfo?.id, startDate, radiusMeters, areaLookup]);

  useEffect(() => {
    const idsByType = events.reduce((acc, event) => {
      if (!event?.source_table || !event.favoriteId) return acc;
      const key = event.source_table;
      if (!acc[key]) acc[key] = new Set();
      acc[key].add(event.favoriteId);
      return acc;
    }, {});
    const entries = Object.entries(idsByType);
    if (!entries.length) {
      setTagMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const responses = await Promise.all(
          entries.map(([table, ids]) =>
            supabase
              .from('taggings')
              .select('taggable_id, tags:tags(name, slug)')
              .eq('taggable_type', table)
              .in('taggable_id', Array.from(ids)),
          ),
        );
        if (cancelled) return;
        const next = {};
        responses.forEach((res, index) => {
          const table = entries[index][0];
          if (res.error) {
            console.error('Failed to load taggings for', table, res.error);
            return;
          }
          res.data?.forEach(row => {
            if (!row?.tags) return;
            const key = `${table}:${row.taggable_id}`;
            if (!next[key]) next[key] = [];
            next[key].push(row.tags);
          });
        });
        setTagMap(next);
      } catch (err) {
        console.error('Error loading taggings', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [events]);

  const combineTags = useMemo(
    () =>
      function getTags(event) {
        const direct = Array.isArray(event.tags) ? event.tags : [];
        const key = event.source_table && event.favoriteId ? `${event.source_table}:${event.favoriteId}` : null;
        const fetched = key && tagMap[key] ? tagMap[key] : [];
        const bySlug = new Map();
        direct.forEach(tag => {
          if (tag?.slug) bySlug.set(tag.slug, tag);
        });
        fetched.forEach(tag => {
          if (tag?.slug && !bySlug.has(tag.slug)) {
            bySlug.set(tag.slug, tag);
          }
        });
        return Array.from(bySlug.values());
      },
    [tagMap],
  );

  const mapEvents = useMemo(() => {
    return events
      .map(event => {
        if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) {
          return null;
        }
        const tagsForEvent = combineTags(event);
        const timeLabel = event.start_time
          ? event.end_time
            ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
            : formatTime(event.start_time)
          : null;
        return {
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          start_time: event.start_time,
          end_time: event.end_time,
          timeLabel,
          detailPath: event.detailPath,
          areaName: event.areaName,
          latitude: event.latitude,
          longitude: event.longitude,
          mapTags: tagsForEvent,
          badges: event.badges,
          source_table: event.source_table,
          favoriteId: event.favoriteId,
          externalUrl: event.externalUrl,
        };
      })
      .filter(Boolean);
  }, [events, combineTags]);

  const showMap = Boolean(mapboxToken) && !mapErrored && mapEvents.length > 0;
  const mapNotice = !mapboxToken
    ? 'Map preview unavailable — missing Mapbox access token.'
    : mapErrored
    ? 'Map preview temporarily unavailable. Showing the list below while we reset the map.'
    : null;

  const radiusChip = formatRadiusChip(radiusMeters);
  const areaName = areaInfo?.name || (areaInfo?.id ? areaLookup?.[areaInfo.id] : null) || areaSlug;
  const startDateObj = parseISODate(startDate) || nowInPhilly;
  const startDateLabel = formatMonthDay(startDateObj, PHILLY_TIME_ZONE);

  const handleRadiusChange = value => {
    if (!value || value <= 0) return;
    setRadiusMeters(value);
    const next = new URLSearchParams(searchParams);
    next.set('radius', String(value));
    if (!next.get('date')) {
      next.set('date', startDate);
    }
    setSearchParams(next, { replace: true });
  };

  const emptyState = !loading && !error && events.length === 0;
  const canWiden = radiusMeters < RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1].value;

  if (areaStatus === 'notfound') {
    return (
      <>
        <Helmet>
          <title>Neighborhood not found | Our Philly</title>
        </Helmet>
        <div className="min-h-screen bg-[#fdf7f2] text-[#29313f]">
          <Navbar />
          <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
            <h1 className="text-4xl font-black sm:text-5xl">Neighborhood not found</h1>
            <p className="mt-4 text-lg text-[#4a5568]">
              We couldn’t find that neighborhood. Double-check the link or explore the latest events across Philly.
            </p>
            <Link
              to="/philadelphia-events/"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[#bf3d35] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-[#bf3d35]/30 transition hover:-translate-y-0.5 hover:bg-[#a2322c]"
            >
              Browse all events
            </Link>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  const pageTitle = areaName
    ? `Upcoming near ${areaName}`
    : 'Upcoming events nearby';

  return (
    <>
      <Helmet>
        <title>{`${pageTitle} | Our Philly`}</title>
        <meta
          name="description"
          content={`See upcoming events within ${formatMiles(radiusMeters) || 'the neighborhood'} of ${areaName || 'your area'}.`}
        />
      </Helmet>
      <div className="min-h-screen bg-[#fdf7f2] text-[#29313f]">
        <Navbar />
        <main className="pt-24 pb-16">
          <section className="border-b border-[#f4c9bc]/70 bg-white/80">
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
              <div className="flex flex-col gap-3">
                <h1 className="text-4xl font-black leading-tight sm:text-5xl">{pageTitle}</h1>
                {radiusChip && (
                  <span className="inline-flex w-fit items-center rounded-full bg-[#f2cfc3] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#29313f]">
                    {radiusChip}
                  </span>
                )}
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#9a6f62]">
                  Showing events starting {startDateLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-wide text-[#bf3d35]">
                <span>Radius</span>
                <div className="flex items-center gap-2">
                  {RADIUS_OPTIONS.map(option => {
                    const isActive = Math.round(radiusMeters) === Math.round(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleRadiusChange(option.value)}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                          isActive
                            ? 'border-[#bf3d35] bg-[#bf3d35] text-white shadow'
                            : 'border-[#f4c9bc] bg-white text-[#bf3d35] hover:border-[#bf3d35] hover:bg-[#fef3f2]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {mapNotice && (
                  <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {mapNotice}
                  </span>
                )}
              </div>
            </div>
          </section>

          {showMap && (
            <section className="mx-auto max-w-5xl px-6 pt-8">
              <MapErrorBoundary resetKey={`${radiusMeters}-${startDate}-${areaInfo?.id}`} onError={() => setMapErrored(true)}>
                <MonthlyEventsMap events={mapEvents} height={360} />
              </MapErrorBoundary>
            </section>
          )}

          <section className="mx-auto max-w-5xl px-6 pt-10">
            {error && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-rose-700">
                {error}
              </div>
            )}
            {loading ? (
              <div className="flex flex-col gap-4">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : emptyState ? (
              <div className="rounded-2xl border border-dashed border-[#f4c9bc] bg-white px-6 py-12 text-center text-[#4a5568] shadow-sm">
                <p className="text-lg font-semibold text-[#29313f]">No events within this radius yet.</p>
                <p className="mt-3">Widen your search to catch more happenings nearby.</p>
                {canWiden && (
                  <button
                    type="button"
                    onClick={() => handleRadiusChange(RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1].value)}
                    className="mt-6 inline-flex items-center justify-center rounded-full bg-[#bf3d35] px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-[#bf3d35]/30 transition hover:-translate-y-0.5 hover:bg-[#a2322c]"
                  >
                    Expand to 1.5 mi
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {events.map(event => {
                  const tagsForEvent = combineTags(event);
                  return <NearbyEventRow key={event.id} event={event} tags={tagsForEvent} now={nowInPhilly} />;
                })}
              </div>
            )}
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
