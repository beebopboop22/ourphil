import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Map, { Marker, Popup } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RRule } from 'rrule';
import {
  Calendar,
  Compass,
  MapPin,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import { supabase } from './supabaseClient.js';
import { getMapboxToken } from './config/mapboxToken.js';
import { AuthContext } from './AuthProvider.jsx';
import useEventFavorite from './utils/useEventFavorite.js';
import useAreaLookup from './utils/useAreaLookup.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  PHILLY_TIME_ZONE,
  formatMonthDay,
  formatWeekdayAbbrev,
  getWeekendWindow,
  getZonedDate,
  parseEventDateValue,
  parseISODate,
  setEndOfDay,
  setStartOfDay,
} from './utils/dateUtils.js';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/light-v11';
const DEFAULT_VIEW_STATE = {
  latitude: 39.9526,
  longitude: -75.1652,
  zoom: 12.2,
};
const HORIZON_DAYS = 45;
const MAX_EVENTS = 1200;
const DATE_FILTERS = ['today', 'weekend', 'custom'];

const markerClass =
  'flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white shadow-lg ring-2 ring-white';

function mapboxIsSupported() {
  if (typeof window === 'undefined') return false;
  if (!mapboxgl || typeof mapboxgl.supported !== 'function') return false;
  try {
    return Boolean(mapboxgl.supported({ failIfMajorPerformanceCaveat: true }));
  } catch (err) {
    console.error('Mapbox support check failed', err);
    return false;
  }
}

function toPhillyISODate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PHILLY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseNumber(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseISODateLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if ([y, m, d].some(part => Number.isNaN(part))) return null;
  return new Date(y, m - 1, d);
}

function parseMonthDayYear(str) {
  if (!str) return null;
  const [month, day, year] = str.split('/').map(Number);
  if ([month, day, year].some(part => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day);
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [hStr, mStr = '00'] = timeStr.split(':');
  let hour = parseInt(hStr, 10);
  if (Number.isNaN(hour)) return null;
  const minutes = mStr.slice(0, 2).padStart(2, '0');
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  hour = hour % 12 || 12;
  return `${hour}:${minutes} ${suffix}`;
}

function buildTimingLabel(event, now) {
  if (!event?.startDate) return 'Upcoming';
  const start = setStartOfDay(event.startDate);
  const today = setStartOfDay(now);
  const diffDays = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = event.start_time ? ` · ${formatTime(event.start_time)}` : '';
  if (diffDays === 0) return `Today${timeLabel}`;
  if (diffDays === 1) return `Tomorrow${timeLabel}`;
  return `${formatWeekdayAbbrev(event.startDate, PHILLY_TIME_ZONE)}${timeLabel}`;
}

function eventDateBounds(event) {
  const start = event?.startDate ? setStartOfDay(event.startDate) : null;
  let end = event?.endDate ? setEndOfDay(event.endDate) : null;
  if (!end && start) {
    end = setEndOfDay(start);
  }
  return { start, end };
}

function eventMatchesDateFilter(event, filter, customRange, weekendRange, todayStart) {
  const { start, end } = eventDateBounds(event);
  if (!start || !end) return false;
  switch (filter) {
    case 'today': {
      const todayEnd = setEndOfDay(todayStart);
      return !(end < todayStart || start > todayEnd);
    }
    case 'weekend': {
      return !(end < weekendRange.start || start > weekendRange.end);
    }
    case 'custom': {
      const customStart = customRange?.start ? setStartOfDay(customRange.start) : null;
      const customEnd = customRange?.end ? setEndOfDay(customRange.end) : null;
      if (!customStart && !customEnd) return true;
      if (customStart && !customEnd) return end >= customStart;
      if (!customStart && customEnd) return start <= customEnd;
      if (customStart && customEnd && customEnd < customStart) {
        return !(end < customEnd || start > customStart);
      }
      return !(end < customStart || start > customEnd);
    }
    default:
      return true;
  }
}
function normalizeAllEvent(row) {
  const start = parseEventDateValue(row.start_date, PHILLY_TIME_ZONE);
  if (!start) return null;
  const end = parseEventDateValue(row.end_date || row.start_date, PHILLY_TIME_ZONE) || start;
  const venue = row.venues || null;
  const latitude = parseNumber(row.latitude != null ? row.latitude : venue?.latitude);
  const longitude = parseNumber(row.longitude != null ? row.longitude : venue?.longitude);
  const areaId = row.area_id != null ? row.area_id : venue?.area_id ?? null;
  const detailPath = getDetailPathForItem({
    ...row,
    venue_slug: venue?.slug,
    venues: venue ? { ...venue } : null,
  });
  return {
    id: `all-${row.id}`,
    taggableId: row.id,
    source_table: 'all_events',
    favoriteId: row.id,
    title: row.name,
    description: row.description || '',
    detailPath: detailPath || '/',
    startDate: start,
    endDate: end,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    imageUrl: row.image || '',
    latitude,
    longitude,
    area_id: areaId,
    venue_area_id: venue?.area_id ?? null,
    venues: venue ? { name: venue.name, slug: venue.slug } : null,
    tags: [],
    badges: [],
  };
}

function normalizeTradition(row) {
  const start = parseMonthDayYear(row.Dates);
  if (!start) return null;
  const end = parseMonthDayYear(row['End Date']) || start;
  const latitude = parseNumber(row.latitude);
  const longitude = parseNumber(row.longitude);
  const detailPath = getDetailPathForItem({
    ...row,
    slug: row.slug,
  });
  return {
    id: `trad-${row.id}`,
    taggableId: row.id,
    source_table: 'events',
    favoriteId: row.id,
    title: row['E Name'],
    description: row['E Description'] || '',
    detailPath: detailPath || '/',
    startDate: start,
    endDate: end,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    imageUrl: row['E Image'] || '',
    latitude,
    longitude,
    area_id: row.area_id ?? null,
    badges: ['Tradition'],
    tags: [],
  };
}

function normalizeGroupEvent(row) {
  const start = parseISODate(row.start_date, PHILLY_TIME_ZONE);
  if (!start) return null;
  const end = parseISODate(row.end_date || row.start_date, PHILLY_TIME_ZONE) || start;
  let imageUrl = row.image_url || '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    const { data } = supabase.storage.from('big-board').getPublicUrl(imageUrl);
    imageUrl = data?.publicUrl || imageUrl;
  }
  const latitude = parseNumber(row.latitude);
  const longitude = parseNumber(row.longitude);
  const groupSlug = row.groups?.slug || null;
  const detailPath = getDetailPathForItem({
    ...row,
    group_slug: groupSlug,
    isGroupEvent: true,
  });
  return {
    id: `group-${row.id}`,
    taggableId: row.id,
    source_table: 'group_events',
    favoriteId: row.id,
    title: row.title,
    description: row.description || '',
    detailPath: detailPath || '/',
    startDate: start,
    endDate: end,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    imageUrl,
    latitude,
    longitude,
    area_id: row.area_id ?? null,
    badges: ['Group Event'],
    tags: [],
  };
}

function normalizeBigBoardEvent(row) {
  const start = parseISODate(row.start_date, PHILLY_TIME_ZONE);
  if (!start) return null;
  const end = parseISODate(row.end_date || row.start_date, PHILLY_TIME_ZONE) || start;
  let imageUrl = row.big_board_posts?.[0]?.image_url || '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    const { data } = supabase.storage.from('big-board').getPublicUrl(imageUrl);
    imageUrl = data?.publicUrl || imageUrl;
  }
  const latitude = parseNumber(row.latitude);
  const longitude = parseNumber(row.longitude);
  const detailPath = getDetailPathForItem({
    ...row,
    isBigBoard: true,
  });
  return {
    id: `bb-${row.id}`,
    taggableId: row.id,
    source_table: 'big_board_events',
    favoriteId: row.id,
    title: row.title,
    description: row.description || '',
    detailPath: detailPath || '/',
    startDate: start,
    endDate: end,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    imageUrl,
    latitude,
    longitude,
    area_id: row.area_id ?? null,
    badges: ['Submission'],
    tags: [],
  };
}
function expandRecurringEvent(row, rangeStart, rangeEnd) {
  if (!row?.rrule || !row.start_date) return [];
  try {
    const opts = RRule.parseString(row.rrule);
    const startTime = row.start_time || '00:00:00';
    opts.dtstart = new Date(`${row.start_date}T${startTime}`);
    if (Number.isNaN(opts.dtstart?.getTime?.())) {
      opts.dtstart = new Date(row.start_date);
    }
    if (row.end_date) {
      opts.until = new Date(`${row.end_date}T23:59:59`);
    }
    const rule = new RRule(opts);
    const occurrences = rule.between(rangeStart, rangeEnd, true);
    return occurrences.map(occurrence => {
      const date = getZonedDate(occurrence, PHILLY_TIME_ZONE);
      const detailDate = toPhillyISODate(date);
      const latitude = parseNumber(row.latitude);
      const longitude = parseNumber(row.longitude);
      return {
        id: `rec-${row.id}-${detailDate}`,
        taggableId: row.id,
        source_table: 'recurring_events',
        favoriteId: row.id,
        title: row.name,
        description: row.description || '',
        detailPath: row.slug ? `/series/${row.slug}/${detailDate}` : '/',
        startDate: setStartOfDay(date),
        endDate: setStartOfDay(date),
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        imageUrl: row.image_url || '',
        latitude,
        longitude,
        area_id: row.area_id ?? null,
        badges: ['Recurring'],
        tags: [],
      };
    });
  } catch (err) {
    console.error('Failed to expand recurring event', err);
    return [];
  }
}

async function fetchSportsEvents() {
  const clientId = import.meta.env.VITE_SEATGEEK_CLIENT_ID;
  if (!clientId) return [];
  try {
    const teamSlugs = [
      'philadelphia-phillies',
      'philadelphia-76ers',
      'philadelphia-eagles',
      'philadelphia-flyers',
      'philadelphia-union',
    ];
    const events = [];
    for (const slug of teamSlugs) {
      const response = await fetch(
        `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=40&sort=datetime_local.asc&client_id=${clientId}`,
      );
      const json = await response.json();
      events.push(...(json.events || []));
    }
    return events
      .map(event => {
        const dt = event.datetime_local ? new Date(event.datetime_local) : null;
        if (!dt || Number.isNaN(dt.getTime())) return null;
        const performers = event.performers || [];
        const home = performers.find(p => p.home_team) || performers[0] || {};
        const away = performers.find(p => p.id !== home.id) || {};
        const title =
          event.short_title ||
          `${(home.name || '').replace(/^Philadelphia\s+/i, '')} vs ${(away.name || '').replace(/^Philadelphia\s+/i, '')}`;
        const location = event.venue || {};
        return {
          id: `sport-${event.id}`,
          taggableId: null,
          source_table: null,
          favoriteId: null,
          title,
          description: event.description || '',
          detailPath: event.url || null,
          startDate: dt,
          endDate: dt,
          start_time: dt.toTimeString().slice(0, 5),
          end_time: null,
          imageUrl: home.image || away.image || '',
          latitude: parseNumber(location.location?.lat),
          longitude: parseNumber(location.location?.lon),
          area_id: null,
          badges: ['Sports'],
          tags: [],
          externalUrl: event.url || null,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Sports fetch failed', err);
    return [];
  }
}

async function fetchUpcomingEvents(rangeStart, rangeEnd) {
  const startIso = toPhillyISODate(rangeStart);
  const endIso = toPhillyISODate(rangeEnd);

  let allEventsQuery = supabase
    .from('all_events')
    .select(
      `id,name,description,link,image,start_date,start_time,end_time,end_date,slug,latitude,longitude,area_id,venue_id,venues:venue_id(name,slug,latitude,longitude,area_id)`
    )
    .order('start_date', { ascending: true })
    .limit(MAX_EVENTS);

  let groupEventsQuery = supabase
    .from('group_events')
    .select(
      `id,title,description,image_url,start_date,start_time,end_time,end_date,slug,link,latitude,longitude,area_id,groups:group_id(Name,slug)`
    )
    .order('start_date', { ascending: true })
    .limit(MAX_EVENTS);

  let bigBoardQuery = supabase
    .from('big_board_events')
    .select(
      `id,title,description,start_date,start_time,end_time,end_date,slug,latitude,longitude,area_id,big_board_posts:big_board_posts_event_id_fkey(image_url,user_id)`
    )
    .order('start_date', { ascending: true })
    .limit(MAX_EVENTS);

  let recurringQuery = supabase
    .from('recurring_events')
    .select(
      `id,name,description,address,link,slug,start_date,end_date,start_time,end_time,rrule,image_url,latitude,longitude,area_id`
    )
    .eq('is_active', true)
    .limit(MAX_EVENTS);

  if (startIso && endIso) {
    allEventsQuery = allEventsQuery
      .lte('start_date', endIso)
      .or(
        `and(end_date.is.null,start_date.gte.${startIso},start_date.lte.${endIso}),` +
          `end_date.gte.${startIso}`,
      );

    groupEventsQuery = groupEventsQuery
      .lte('start_date', endIso)
      .or(
        `and(end_date.is.null,start_date.gte.${startIso},start_date.lte.${endIso}),` +
          `end_date.gte.${startIso}`,
      );

    bigBoardQuery = bigBoardQuery
      .lte('start_date', endIso)
      .or(
        `and(end_date.is.null,start_date.gte.${startIso},start_date.lte.${endIso}),` +
          `end_date.gte.${startIso}`,
      );
  }

  const [
    traditionsRes,
    allEventsRes,
    groupEventsRes,
    recurringRes,
    bigBoardRes,
    sports,
  ] = await Promise.all([
    supabase
      .from('events')
      .select(
        `id,"E Name","E Description",Dates,"End Date","E Image","E Link",slug,start_time,end_time,latitude,longitude,area_id`
      )
      .order('Dates', { ascending: true })
      .limit(MAX_EVENTS),
    allEventsQuery,
    groupEventsQuery,
    recurringQuery,
    bigBoardQuery,
    fetchSportsEvents(),
  ]);

  if (traditionsRes.error) throw traditionsRes.error;
  if (allEventsRes.error) throw allEventsRes.error;
  if (groupEventsRes.error) throw groupEventsRes.error;
  if (recurringRes.error) throw recurringRes.error;
  if (bigBoardRes.error) throw bigBoardRes.error;

  const rangeStartDate = setStartOfDay(rangeStart);
  const rangeEndDate = setEndOfDay(rangeEnd);

  const normalized = [
    ...(allEventsRes.data || []).map(normalizeAllEvent).filter(Boolean),
    ...(traditionsRes.data || []).map(normalizeTradition).filter(Boolean),
    ...(groupEventsRes.data || []).map(normalizeGroupEvent).filter(Boolean),
    ...(bigBoardRes.data || []).map(normalizeBigBoardEvent).filter(Boolean),
    ...(recurringRes.data || [])
      .flatMap(row => expandRecurringEvent(row, rangeStartDate, rangeEndDate))
      .filter(Boolean),
    ...(sports || []),
  ];

  return normalized.filter(event => {
    if (!event?.startDate || !event?.endDate) return false;
    const { start, end } = eventDateBounds(event);
    if (!start || !end) return false;
    return !(end < rangeStartDate || start > rangeEndDate);
  });
}
function getTagName(tagSlug, tag, allTags) {
  if (tag && tag.slug === tagSlug) return tag.name;
  const match = allTags.find(t => t.slug === tagSlug);
  return match ? match.name : tagSlug;
}

function eventInBounds(event, bounds) {
  if (!bounds) return true;
  if (event.latitude == null || event.longitude == null) return false;
  const { latitude, longitude } = event;
  if (longitude < bounds.west || longitude > bounds.east) return false;
  if (latitude < bounds.south || latitude > bounds.north) return false;
  return true;
}

function FavoriteButton({ event }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const hasFavorite = event.favoriteId && event.source_table;
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: hasFavorite ? event.favoriteId : null,
    source_table: hasFavorite ? event.source_table : null,
  });

  if (!hasFavorite) {
    if (event.externalUrl) {
      return (
        <a
          href={event.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
        >
          Get Tickets
        </a>
      );
    }
    return null;
  }

  return (
    <button
      type="button"
      onClick={evt => {
        evt.preventDefault();
        evt.stopPropagation();
        if (!user) {
          navigate('/login');
          return;
        }
        toggleFavorite();
      }}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
        isFavorite
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      {isFavorite ? 'In the Plans' : 'Add to Plans'}
    </button>
  );
}

function TagEventRow({ event, tags, areaLookup, now }) {
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};
  const areaLabel =
    (event.area_id && areaLookup[event.area_id]) ||
    (event.venue_area_id && areaLookup[event.venue_area_id]) ||
    null;
  const label = buildTimingLabel(event, now);
  const startTime = formatTime(event.start_time);
  const endTime = formatTime(event.end_time);
  const timeRange = startTime
    ? endTime
      ? `${startTime} – ${endTime}`
      : startTime
    : null;
  const dateRange = (() => {
    const { start, end } = eventDateBounds(event);
    if (!start || !end) return null;
    if (start.getTime() === end.getTime()) {
      return `${formatMonthDay(start, PHILLY_TIME_ZONE)}`;
    }
    return `${formatMonthDay(start, PHILLY_TIME_ZONE)} – ${formatMonthDay(end, PHILLY_TIME_ZONE)}`;
  })();

  return (
    <Wrapper
      {...wrapperProps}
      className="block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{label}</span>
            {areaLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[#29313f]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {areaLabel}
              </span>
            )}
            {(event.badges || []).map(badge => (
              <span
                key={badge}
                className={`rounded-full px-2 py-0.5 ${
                  badge === 'Tradition'
                    ? 'bg-yellow-100 text-yellow-800'
                    : badge === 'Submission'
                    ? 'bg-purple-100 text-purple-800'
                    : badge === 'Recurring'
                    ? 'bg-blue-100 text-blue-800'
                    : badge === 'Group Event'
                    ? 'bg-emerald-100 text-emerald-800'
                    : badge === 'Sports'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {badge}
              </span>
            ))}
          </div>
          <h3 className="text-lg font-semibold text-[#28313e]">{event.title}</h3>
          <div className="text-sm text-gray-600">
            {dateRange && <span>{dateRange}</span>}
            {timeRange && (
              <span>{dateRange ? ` · ${timeRange}` : timeRange}</span>
            )}
          </div>
          {event.description && (
            <p className="line-clamp-2 text-sm text-gray-600">{event.description}</p>
          )}
          {tags?.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.slice(0, 4).map(tag => (
                <Link
                  key={tag.slug || tag.name}
                  to={tag.slug ? `/tags/${tag.slug}` : '#'}
                  onClick={e => {
                    if (!tag.slug) {
                      e.preventDefault();
                    }
                  }}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-[#bf3d35] hover:text-[#bf3d35]"
                >
                  #{tag.name || tag.slug}
                </Link>
              ))}
              {tags.length > 4 && (
                <span className="text-xs font-semibold text-gray-500">+{tags.length - 4} more</span>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:w-48">
          <FavoriteButton event={event} />
        </div>
      </div>
    </Wrapper>
  );
}

function FilterChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-[#28313e] text-white shadow'
          : 'bg-white text-[#28313e] hover:bg-gray-100 border border-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
export default function TagPage() {
  const { slug: rawSlug } = useParams();
  const slug = (rawSlug || '').replace(/^#/, '');
  const [searchParams, setSearchParams] = useSearchParams();
  const areaLookup = useAreaLookup();
  const { user } = useContext(AuthContext);

  const [tag, setTag] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [events, setEvents] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewState, setViewState] = useState(() => ({ ...DEFAULT_VIEW_STATE }));
  const [mapBounds, setMapBounds] = useState(null);
  const [limitToMap, setLimitToMap] = useState(searchParams.get('limit') === '1');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const initialTags = useMemo(() => {
    const param = searchParams.get('tags');
    if (param) {
      return param
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
    return slug ? [slug] : [];
  }, [searchParams, slug]);

  const [selectedTags, setSelectedTags] = useState(initialTags);

  useEffect(() => {
    if (!selectedTags.length && slug) {
      setSelectedTags([slug]);
    }
  }, [slug]);

  const initialDate = searchParams.get('date');
  const [dateFilter, setDateFilter] = useState(
    DATE_FILTERS.includes(initialDate) ? initialDate : 'today',
  );

  const [customRange, setCustomRange] = useState(() => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    return {
      start: startParam ? parseISODateLocal(startParam) : null,
      end: endParam ? parseISODateLocal(endParam) : null,
    };
  });

  const [selectedArea, setSelectedArea] = useState(searchParams.get('area') || '');

  const mapRef = useRef(null);
  const mapboxToken = getMapboxToken();

  const [isMapReady, setIsMapReady] = useState(() => {
    if (!mapboxToken) return false;
    return mapboxIsSupported();
  });
  const [mapStatusMessage, setMapStatusMessage] = useState(() =>
    mapboxToken ? '' : 'Map view unavailable — missing Mapbox token.',
  );
  const todayInPhilly = useMemo(
    () => setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)),
    [],
  );
  const weekendRange = useMemo(() => getWeekendWindow(new Date(), PHILLY_TIME_ZONE), []);
  const horizonEnd = useMemo(() => {
    const end = new Date(todayInPhilly);
    end.setDate(end.getDate() + HORIZON_DAYS);
    return setEndOfDay(end);
  }, [todayInPhilly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [tagRes, eventsRes, tagsRes] = await Promise.all([
          slug
            ? supabase.from('tags').select('*').eq('slug', slug).maybeSingle()
            : { data: null },
          fetchUpcomingEvents(todayInPhilly, horizonEnd),
          supabase.from('tags').select('name,slug').order('name', { ascending: true }),
        ]);
        if (cancelled) return;
        if (tagRes.error) {
          console.error('Tag fetch failed', tagRes.error);
        }
        setTag(tagRes.data || null);
        if (tagsRes.error) {
          console.error('Tags list error', tagsRes.error);
          setAllTags([]);
        } else {
          setAllTags(tagsRes.data || []);
        }
        setEvents(eventsRes || []);
      } catch (err) {
        console.error('Failed to load tag page', err);
        if (!cancelled) {
          setError('Something went wrong while loading events.');
          setEvents([]);
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
  }, [slug, todayInPhilly, horizonEnd]);

  useEffect(() => {
    const idsByType = events.reduce((acc, event) => {
      if (!event?.source_table || !event.taggableId) return acc;
      const table = event.source_table;
      if (!acc[table]) acc[table] = new Set();
      acc[table].add(event.taggableId);
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
        console.error('Error loading tag map', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [events]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (dateFilter !== 'today') {
      next.set('date', dateFilter);
    }
    if (dateFilter === 'custom') {
      if (customRange.start) {
        next.set('start', toPhillyISODate(customRange.start));
      }
      if (customRange.end) {
        next.set('end', toPhillyISODate(customRange.end));
      }
    }
    if (selectedArea) {
      next.set('area', selectedArea);
    }
    if (selectedTags.length) {
      next.set('tags', selectedTags.join(','));
    }
    if (limitToMap) {
      next.set('limit', '1');
    }
    setSearchParams(next, { replace: true });
  }, [dateFilter, customRange, selectedArea, selectedTags, limitToMap, setSearchParams]);

  const eventsWithTags = useMemo(() => {
    return events.map(event => {
      const key = `${event.source_table}:${event.taggableId}`;
      const tags = event.source_table ? tagMap[key] || [] : event.tags || [];
      return { ...event, tags };
    });
  }, [events, tagMap]);

  const filtered = useMemo(() => {
    return eventsWithTags
      .filter(event => eventMatchesDateFilter(event, dateFilter, customRange, weekendRange, todayInPhilly))
      .filter(event => {
        if (!selectedTags.length) return true;
        const tagSlugs = (event.tags || []).map(tag => tag.slug).filter(Boolean);
        return selectedTags.every(tagSlug => tagSlugs.includes(tagSlug));
      })
      .filter(event => {
        if (!selectedArea) return true;
        const areaId = event.area_id != null ? String(event.area_id) : null;
        const venueAreaId = event.venue_area_id != null ? String(event.venue_area_id) : null;
        return areaId === selectedArea || venueAreaId === selectedArea;
      })
      .sort((a, b) => {
        const aStart = a.startDate ? a.startDate.getTime() : Infinity;
        const bStart = b.startDate ? b.startDate.getTime() : Infinity;
        if (aStart !== bStart) return aStart - bStart;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [eventsWithTags, dateFilter, customRange, weekendRange, todayInPhilly, selectedTags, selectedArea]);

  const visibleEvents = useMemo(() => {
    if (!limitToMap || !mapBounds) return filtered;
    return filtered.filter(event => eventInBounds(event, mapBounds));
  }, [filtered, limitToMap, mapBounds]);

  const areaOptions = useMemo(() => {
    const entries = Object.entries(areaLookup || {}).map(([id, name]) => ({ id, name }));
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [areaLookup]);

  const handleMapMoveEnd = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    try {
      const bounds = map.getBounds();
      setMapBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    } catch (err) {
      console.error('Failed to read map bounds', err);
    }
  }, []);

  useEffect(() => {
    if (!mapboxToken) {
      setIsMapReady(false);
      setMapStatusMessage('Map view unavailable — missing Mapbox token.');
      return;
    }
    const supported = mapboxIsSupported();
    setIsMapReady(supported);
    if (!supported) {
      setMapStatusMessage('Interactive map is not supported in this browser.');
    } else {
      setMapStatusMessage('');
    }
  }, [mapboxToken]);

  const handleMapLoad = useCallback(() => {
    setIsMapReady(true);
    setMapStatusMessage('');
    handleMapMoveEnd();
  }, [handleMapMoveEnd]);

  const handleMapError = useCallback(error => {
    console.error('Tag map failed to load', error?.error || error);
    setIsMapReady(false);
    setMapStatusMessage(
      'Map view unavailable right now. Use the filters below to browse upcoming events.',
    );
  }, []);

  const fitMapToEvents = useCallback(
    eventsToFit => {
      if (!mapRef.current?.getMap || !eventsToFit?.length) return;
      const map = mapRef.current.getMap();
      const coords = eventsToFit.filter(evt => evt.latitude != null && evt.longitude != null);
      if (!coords.length) return;
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach(evt => {
        bounds.extend([evt.longitude, evt.latitude]);
      });
      try {
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
      } catch (err) {
        console.error('fitBounds failed', err);
      }
    },
    [],
  );

  useEffect(() => {
    if (!limitToMap) {
      fitMapToEvents(filtered.slice(0, 40));
    }
  }, [filtered, limitToMap, fitMapToEvents]);

  const handleLocateMe = useCallback(() => {
    if (isLocating) return;
    if (!navigator?.geolocation) {
      setGeoError('Geolocation is not available on this device.');
      return;
    }
    setIsLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setViewState(current => ({
          ...current,
          latitude,
          longitude,
          zoom: Math.max(current.zoom ?? DEFAULT_VIEW_STATE.zoom, 13),
        }));
        const map = mapRef.current?.getMap?.();
        map?.flyTo({ center: [longitude, latitude], zoom: 13.5, essential: true });
        setIsLocating(false);
        setGeoError('');
      },
      err => {
        setGeoError(err.message || 'Unable to determine your location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [isLocating]);

  const handleManualSearch = useCallback(
    async evt => {
      evt.preventDefault();
      if (!manualQuery.trim() || !mapboxToken) return;
      setIsGeocoding(true);
      setGeoError('');
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(manualQuery)}.json?proximity=-75.1652,39.9526&limit=1&access_token=${mapboxToken}`,
        );
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        const [feature] = data.features || [];
        if (!feature?.center) {
          setGeoError('We could not find that location.');
        } else {
          const [longitude, latitude] = feature.center;
          setViewState(current => ({ ...current, latitude, longitude, zoom: 13 }));
          const map = mapRef.current?.getMap?.();
          map?.flyTo({ center: [longitude, latitude], zoom: 13, essential: true });
        }
      } catch (err) {
        console.error('Manual geocode failed', err);
        setGeoError('We could not look up that spot. Try a different ZIP or neighborhood.');
      } finally {
        setIsGeocoding(false);
      }
    },
    [manualQuery, mapboxToken],
  );

  const showEmptyState = !loading && !visibleEvents.length;
  const now = todayInPhilly;

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <Helmet>
        <title>{tag?.name ? `${tag.name} in Philly` : 'Events around Philly'}</title>
      </Helmet>
      <Navbar />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-0 sm:px-6 lg:px-8">
        <section className="relative mt-0 overflow-hidden rounded-none border-b border-gray-200 bg-white shadow-sm sm:rounded-3xl sm:border">
          {isMapReady && mapboxToken ? (
            <div className="relative h-[360px] w-full sm:h-[420px]">
              <div className="pointer-events-none absolute right-4 top-4 z-10 flex w-full max-w-[260px] flex-col gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleLocateMe}
                  disabled={isLocating || !isMapReady}
                  className="pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full border border-indigo-500/70 bg-white px-3 py-1.5 font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Compass className="h-4 w-4" aria-hidden="true" />
                  {isLocating ? 'Locating…' : 'Near Me'}
                </button>
                {(geoError || !navigator?.geolocation) && (
                  <form
                    onSubmit={handleManualSearch}
                    className="pointer-events-auto rounded-full border border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur"
                  >
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>ZIP or neighborhood</span>
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={manualQuery}
                        onChange={e => setManualQuery(e.target.value)}
                        className="w-full rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
                        placeholder="19107 or Fishtown"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
                        disabled={isGeocoding}
                      >
                        {isGeocoding ? '…' : 'Go'}
                      </button>
                    </div>
                    {geoError && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600">{geoError}</p>
                    )}
                  </form>
                )}
              </div>
              <Map
                ref={mapRef}
                mapboxAccessToken={mapboxToken}
                mapStyle={MAPBOX_STYLE}
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                onMoveEnd={handleMapMoveEnd}
                onLoad={handleMapLoad}
                onError={handleMapError}
                style={{ width: '100%', height: '100%' }}
              >
                {visibleEvents
                  .filter(evt => evt.latitude != null && evt.longitude != null)
                  .map(evt => (
                    <Marker
                      key={evt.id}
                      latitude={evt.latitude}
                      longitude={evt.longitude}
                      anchor="bottom"
                      onClick={event => {
                        event.originalEvent.stopPropagation();
                        setSelectedEvent(evt);
                      }}
                    >
                      <div className={markerClass} aria-label={evt.title}>
                        ●
                      </div>
                    </Marker>
                  ))}
                {selectedEvent && selectedEvent.latitude != null && selectedEvent.longitude != null && (
                  <Popup
                    latitude={selectedEvent.latitude}
                    longitude={selectedEvent.longitude}
                    anchor="top"
                    closeOnClick={false}
                    onClose={() => setSelectedEvent(null)}
                    className="max-w-xs"
                  >
                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{formatWeekdayAbbrev(selectedEvent.startDate, PHILLY_TIME_ZONE)}</p>
                      <h4 className="text-base font-semibold text-[#28313e] leading-snug">{selectedEvent.title}</h4>
                      <p className="text-xs text-gray-600">
                        {formatMonthDay(selectedEvent.startDate, PHILLY_TIME_ZONE)}
                        {selectedEvent.start_time && ` · ${formatTime(selectedEvent.start_time)}`}
                      </p>
                      {selectedEvent.detailPath && (
                        <Link
                          to={selectedEvent.detailPath}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          View details
                        </Link>
                      )}
                    </div>
                  </Popup>
                )}
              </Map>
            </div>
          ) : (
            <div className="flex h-[320px] items-center justify-center bg-gray-100 px-6 text-center text-sm text-gray-600">
              {mapStatusMessage || 'Interactive map unavailable — please use the filters below.'}
            </div>
          )}
        </section>

        <section className="-mt-2 space-y-6 rounded-3xl bg-transparent pb-2 pt-6">
          <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={dateFilter === 'today'} onClick={() => setDateFilter('today')}>
                Today
              </FilterChip>
              <FilterChip active={dateFilter === 'weekend'} onClick={() => setDateFilter('weekend')}>
                Weekend
              </FilterChip>
              <FilterChip active={dateFilter === 'custom'} onClick={() => setDateFilter('custom')}>
                Custom
              </FilterChip>
              {dateFilter === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 rounded-full bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <label className="flex items-center gap-2">
                    Start
                    <input
                      type="date"
                      value={customRange.start ? toPhillyISODate(customRange.start) : ''}
                      onChange={e =>
                        setCustomRange(range => ({
                          ...range,
                          start: e.target.value ? parseISODateLocal(e.target.value) : null,
                        }))
                      }
                      className="rounded-full border border-gray-200 px-3 py-1 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    End
                    <input
                      type="date"
                      value={customRange.end ? toPhillyISODate(customRange.end) : ''}
                      onChange={e =>
                        setCustomRange(range => ({
                          ...range,
                          end: e.target.value ? parseISODateLocal(e.target.value) : null,
                        }))
                      }
                      className="rounded-full border border-gray-200 px-3 py-1 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#28313e]">
                <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                Neighborhood
                <select
                  value={selectedArea}
                  onChange={e => setSelectedArea(e.target.value)}
                  className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">All</option>
                  {areaOptions.map(area => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {selectedTags.map(tagSlug => (
                  <button
                    key={tagSlug}
                    type="button"
                    onClick={() =>
                      setSelectedTags(tags => tags.filter(value => value !== tagSlug))
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-[#29313f] px-3 py-1 text-sm font-semibold text-white"
                  >
                    #{getTagName(tagSlug, tag, allTags)}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
                <select
                  value=""
                  onChange={e => {
                    const next = e.target.value;
                    if (!next) return;
                    setSelectedTags(tags => (tags.includes(next) ? tags : [...tags, next]));
                  }}
                  className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Add tag…</option>
                  {allTags
                    .filter(option => !selectedTags.includes(option.slug))
                    .map(option => (
                      <option key={option.slug} value={option.slug}>
                        {option.name}
                      </option>
                    ))}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#28313e]">
                <input
                  type="checkbox"
                  checked={limitToMap}
                  onChange={e => {
                    setLimitToMap(e.target.checked);
                    if (e.target.checked) {
                      handleMapMoveEnd();
                    } else {
                      fitMapToEvents(filtered.slice(0, 40));
                    }
                  }}
                  disabled={!isMapReady}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
                Limit to map view
              </label>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {loading && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
              Loading events…
            </div>
          )}
          {error && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">
              {error}
            </div>
          )}
          {showEmptyState && (
            <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
              <h2 className="text-xl font-semibold text-[#28313e]">No events match these filters yet.</h2>
              <p className="mt-2 text-sm text-gray-600">
                Try widening the dates or clearing your neighborhood filter.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {selectedArea && (
                  <button
                    type="button"
                    onClick={() => setSelectedArea('')}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-[#28313e] hover:bg-gray-100"
                  >
                    Clear neighborhood
                  </button>
                )}
                {dateFilter === 'custom' && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('weekend')}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-[#28313e] hover:bg-gray-100"
                  >
                    Show this weekend
                  </button>
                )}
                {limitToMap && (
                  <button
                    type="button"
                    onClick={() => setLimitToMap(false)}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-[#28313e] hover:bg-gray-100"
                  >
                    Expand to all Philly
                  </button>
                )}
              </div>
            </div>
          )}
          {!loading && !showEmptyState && (
            <div className="space-y-4">
              {visibleEvents.map(event => (
                <TagEventRow
                  key={event.id}
                  event={event}
                  tags={event.tags || []}
                  areaLookup={areaLookup}
                  now={now}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
