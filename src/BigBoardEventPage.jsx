import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Map from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  CalendarCheck,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';

import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import useFollow from './utils/useFollow';
import SubmitEventSection from './SubmitEventSection';
import FloatingAddButton from './FloatingAddButton';
import PostFlyerModal from './PostFlyerModal';
import TriviaTonightBanner from './TriviaTonightBanner';
import Seo from './components/Seo.jsx';
import {
  DEFAULT_OG_IMAGE,
  SITE_BASE_URL,
  buildEventJsonLd,
  ensureAbsoluteUrl,
} from './utils/seoHelpers.js';
import {
  PHILLY_TIME_ZONE,
  getZonedDate,
  parseISODate,
  setEndOfDay,
  setStartOfDay,
} from './utils/dateUtils.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import { getMapboxToken } from './config/mapboxToken.js';
import { ensureAreaCache } from './utils/areaCache.js';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/light-v11';
const MAP_WARNING_KEY = 'bigBoardEventMapWarning';

const FALLBACK_TITLE = 'Community Event – Our Philly';
const FALLBACK_DESCRIPTION =
  'Discover community-submitted events happening around Philadelphia with Our Philly.';

const pillStyles = [
  'bg-red-100 text-red-800',
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
];

const recommendationCache = new Map();
const RECOMMENDATION_TTL = 1000 * 60 * 60 * 24; // 24 hours

function formatTimeLabel(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: PHILLY_TIME_ZONE,
  }).format(date);
}

function buildPhillyDate(dateStr, timeStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split('-').map(Number);
  if ([y, m, d].some(Number.isNaN)) return null;
  let hours = 0;
  let minutes = 0;
  if (typeof timeStr === 'string' && timeStr.trim()) {
    const [h, min = '00'] = timeStr.trim().split(':');
    const parsedHours = Number.parseInt(h, 10);
    const parsedMinutes = Number.parseInt(min, 10);
    if (!Number.isNaN(parsedHours) && parsedHours >= 0 && parsedHours < 24) {
      hours = parsedHours;
    }
    if (!Number.isNaN(parsedMinutes) && parsedMinutes >= 0 && parsedMinutes < 60) {
      minutes = parsedMinutes;
    }
  }
  try {
    const utc = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0));
    return getZonedDate(utc, PHILLY_TIME_ZONE);
  } catch (error) {
    console.warn('Failed to build zoned date', error);
    return null;
  }
}

function formatHeaderDate(startDate) {
  if (!startDate) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: PHILLY_TIME_ZONE,
  }).format(startDate);
}

function formatDateRange(event) {
  const start = buildPhillyDate(event?.start_date, event?.start_time);
  const end = event?.end_time
    ? buildPhillyDate(event?.start_date, event?.end_time)
    : null;
  const dateLabel = formatHeaderDate(start);
  const timeLabel = start ? formatTimeLabel(start) : '';
  const endLabel = end ? formatTimeLabel(end) : '';

  if (!dateLabel) {
    return { dateLabel: '', timeLabel: 'Time TBA' };
  }

  if (!timeLabel && !endLabel) {
    return { dateLabel, timeLabel: 'Time TBA' };
  }

  if (timeLabel && endLabel) {
    if (timeLabel.split(' ').slice(-1)[0] === endLabel.split(' ').slice(-1)[0]) {
      const [startTime, meridiem] = timeLabel.split(' ');
      const [endTime] = endLabel.split(' ');
      return { dateLabel, timeLabel: `${startTime}–${endTime} ${meridiem}` };
    }
    return { dateLabel, timeLabel: `${timeLabel} – ${endLabel}` };
  }

  return { dateLabel, timeLabel: timeLabel || 'Time TBA' };
}

function formatFullDateRange(event) {
  const start = buildPhillyDate(event?.start_date, event?.start_time);
  const endDateStr = event?.end_date || event?.start_date;
  const end = buildPhillyDate(endDateStr, event?.end_time || event?.start_time);
  if (!start) return '';
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: PHILLY_TIME_ZONE,
  });
  const startLabel = dateFormatter.format(start);
  if (!end || end.getTime() === start.getTime()) {
    return startLabel;
  }
  const endLabel = dateFormatter.format(end);
  return `${startLabel} – ${endLabel}`;
}

function FavoriteButton({ eventId, sourceTable }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: eventId,
    source_table: sourceTable,
  });

  return (
    <button
      type="button"
      onClick={() => {
        if (!user) {
          navigate('/login');
          return;
        }
        toggleFavorite();
      }}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition-colors ${
        isFavorite
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      <CalendarCheck className="h-4 w-4" aria-hidden="true" />
      {isFavorite ? 'In the Plans' : 'Add to Plans'}
    </button>
  );
}

function RecommendationSkeleton({ title }) {
  return (
    <section className="mt-12">
      <div className="mb-4 h-6 w-56 rounded bg-gray-200" aria-label={`${title} loading`} />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-2xl border border-gray-200 bg-gray-100 animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}

function FavoriteState({ eventId, sourceTable, children }) {
  const state = useEventFavorite({ event_id: eventId, source_table: sourceTable });
  return children(state);
}

function formatEventTiming(event, now) {
  if (!event?.startDate) return 'Time TBA';
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: PHILLY_TIME_ZONE,
  });
  const today = setStartOfDay(new Date(now));
  const eventDay = setStartOfDay(new Date(event.startDate));
  const diffDays = Math.round(
    (eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  let prefix;
  if (diffDays === 0) prefix = 'Today';
  else if (diffDays === 1) prefix = 'Tomorrow';
  else prefix = dayFormatter.format(event.startDate);

  if (!event.start_time) {
    return `${prefix} · Time TBA`;
  }
  const timeLabel = formatTimeLabel(buildPhillyDate(event.start_date ?? event.startDateISO, event.start_time));
  return timeLabel ? `${prefix} · ${timeLabel}` : `${prefix} · Time TBA`;
}

function RecommendationList({ title, events }) {
  const now = useMemo(() => getZonedDate(new Date(), PHILLY_TIME_ZONE), []);

  if (!events?.length) {
    return null;
  }

  return (
    <section className="mt-12" aria-label={title}>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">
        {events.map(event => {
          const areaLabel =
            [event.areaName, event.area?.name, event.area_name]
              .map(value => (typeof value === 'string' ? value.trim() : ''))
              .find(Boolean) || null;
          return (
            <Link
              key={`${event.source_table}:${event.favoriteId}`}
              to={event.detailPath}
              className="block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6">
                <div className="flex items-start gap-4">
                  <div className="hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:block">
                    {event.imageUrl && (
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">
                        {formatEventTiming(event, now)}
                      </span>
                      {areaLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[#29313f]">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {areaLabel}
                        </span>
                      )}
                      {(event.badges || []).map(badge => (
                        <span
                          key={badge}
                          className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-purple-800"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-gray-900">{event.title}</h3>
                    {event.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{event.description}</p>
                    )}
                    {event.address && (
                      <p className="mt-1 text-sm text-gray-500">{event.address}</p>
                    )}
                  </div>
                </div>
                <div className="flex w-full items-center justify-start gap-3 md:w-auto md:justify-end">
                  {event.source_table ? (
                    <FavoriteState eventId={event.favoriteId} sourceTable={event.source_table}>
                      {({ isFavorite, toggleFavorite, loading }) => (
                        <button
                          type="button"
                          onClick={evt => {
                            evt.preventDefault();
                            evt.stopPropagation();
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
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function mergeRecommendations(list, areaId) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const prioritized = [...list].sort((a, b) => {
    const aAreaMatch = a.area_id && areaId && a.area_id === areaId ? 0 : 1;
    const bAreaMatch = b.area_id && areaId && b.area_id === areaId ? 0 : 1;
    if (aAreaMatch !== bAreaMatch) return aAreaMatch - bAreaMatch;
    const startDiff = (a.startDate?.getTime?.() || 0) - (b.startDate?.getTime?.() || 0);
    if (startDiff !== 0) return startDiff;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });
  return prioritized.filter(event => {
    const key = `${event.source_table}:${event.favoriteId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeBigBoardEvent(row, areaLookup) {
  const start = parseISODate(row.start_date, PHILLY_TIME_ZONE);
  const end = parseISODate(row.end_date || row.start_date, PHILLY_TIME_ZONE) || start;
  const areaName = row.area_id ? areaLookup?.[row.area_id] || null : null;
  return {
    id: `big-${row.id}`,
    favoriteId: row.id,
    source_table: 'big_board_events',
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl || '',
    startDate: start,
    endDate: end,
    start_time: row.start_time,
    end_time: row.end_time,
    address: row.address || '',
    area_id: row.area_id,
    areaName,
    detailPath: `/big-board/${row.slug}`,
    badges: ['Submission'],
  };
}

function normalizeAllEvent(row, areaLookup) {
  const startKey = (row.start_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
  const startDate = new Date(startKey);
  const endKey = ((row.end_date || row.start_date) || '').slice(0, 10) || startKey;
  const endDate = new Date(endKey);
  const areaId = row.area_id ?? row.venue_id?.area_id ?? null;
  const areaName = areaId ? areaLookup?.[areaId] || null : null;
  return {
    id: `all-${row.id}`,
    favoriteId: row.id,
    source_table: 'all_events',
    title: row.name,
    description: row.description,
    imageUrl: row.image || '',
    startDate,
    endDate,
    start_time: row.start_time,
    end_time: row.end_time,
    address: row.venues?.name || '',
    area_id: areaId,
    areaName,
    detailPath: getDetailPathForItem(row) || `/events/${row.slug}`,
    badges: ['Listed Event'],
  };
}

function normalizeGroupEvent(row, areaLookup) {
  const startKey = (row.start_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
  const startDate = new Date(startKey);
  const endKey = (row.end_date || row.start_date || '').slice(0, 10) || startKey;
  const endDate = new Date(endKey);
  const groupRecord = Array.isArray(row.groups) ? row.groups[0] : row.groups;
  const areaId = row.area_id ?? null;
  const areaName = areaId ? areaLookup?.[areaId] || null : null;
  let imageUrl = '';
  if (row.image_url) {
    if (row.image_url.startsWith('http')) {
      imageUrl = row.image_url;
    } else {
      const { data } = supabase.storage.from('big-board').getPublicUrl(row.image_url);
      imageUrl = data?.publicUrl || '';
    }
  } else if (groupRecord?.imag) {
    imageUrl = groupRecord.imag;
  }
  const detailPath = getDetailPathForItem({
    ...row,
    group_slug: groupRecord?.slug,
    isGroupEvent: true,
  });
  return {
    id: `group-${row.id}`,
    favoriteId: row.id,
    source_table: 'group_events',
    title: row.title,
    description: row.description,
    imageUrl,
    startDate,
    endDate,
    start_time: row.start_time,
    end_time: row.end_time,
    area_id: areaId,
    areaName,
    detailPath,
    badges: ['Group Event'],
  };
}

function normalizeRecurringEvent(row, areaLookup, occurrenceDate) {
  const date = parseISODate(occurrenceDate, PHILLY_TIME_ZONE);
  if (!date) return null;
  const areaId = row.area_id ?? null;
  const areaName = areaId ? areaLookup?.[areaId] || null : null;
  return {
    id: `${row.id}::${occurrenceDate}`,
    favoriteId: row.id,
    source_table: 'recurring_events',
    title: row.name,
    description: row.description,
    imageUrl: row.image_url || '',
    startDate: date,
    endDate: date,
    start_time: row.start_time,
    end_time: row.end_time,
    address: row.address || '',
    area_id: areaId,
    areaName,
    detailPath: getDetailPathForItem({
      id: `${row.id}::${occurrenceDate}`,
      slug: row.slug,
      start_date: occurrenceDate,
      isRecurring: true,
    }),
    badges: ['Recurring'],
  };
}

function normalizeTradition(row, areaLookup) {
  const start = parseISODate(row.Dates, PHILLY_TIME_ZONE);
  const end = parseISODate(row['End Date'] || row.Dates, PHILLY_TIME_ZONE) || start;
  const areaId = row.area_id ?? null;
  const areaName = areaId ? areaLookup?.[areaId] || null : null;
  return {
    id: `trad-${row.id}`,
    favoriteId: row.id,
    source_table: 'events',
    title: row['E Name'],
    description: row['E Description'],
    imageUrl: row['E Image'] || '',
    startDate: start,
    endDate: end,
    start_time: row.start_time,
    end_time: null,
    area_id: areaId,
    areaName,
    detailPath: getDetailPathForItem({ ...row, isTradition: true }),
    badges: ['Tradition'],
  };
}

function storeRecommendations(slug, key, data) {
  const existing = recommendationCache.get(slug) || {};
  recommendationCache.set(slug, {
    ...existing,
    [key]: { data, timestamp: Date.now() },
  });
}

function readRecommendations(slug, key) {
  const cached = recommendationCache.get(slug)?.[key];
  if (!cached) return null;
  if (Date.now() - cached.timestamp > RECOMMENDATION_TTL) return null;
  return cached.data;
}

export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [tags, setTags] = useState([]);
  const [poster, setPoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    address: '',
    latitude: null,
    longitude: null,
  });
  const [saving, setSaving] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [similarEvents, setSimilarEvents] = useState(null);
  const [nearbyEvents, setNearbyEvents] = useState(null);
  const [loadingSimilar, setLoadingSimilar] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);

  const geocoderToken = getMapboxToken();
  const sessionToken = useRef(crypto.randomUUID());
  const suggestRef = useRef(null);

  const { isFollowing: isPosterFollowing, toggleFollow: togglePosterFollow } = useFollow(
    poster?.id,
  );

  useEffect(() => {
    ensureAreaCache().catch(() => {
      /* handled via console warning */
    });
  }, []);

  const mapboxToken = useMemo(() => getMapboxToken(), []);

  useEffect(() => {
    async function loadEvent() {
      setLoading(true);
      setError(null);
      try {
        const { data: eventRow, error: eventError } = await supabase
          .from('big_board_events')
          .select(
            `id, slug, title, description, link, start_date, end_date, start_time, end_time, address, latitude, longitude, post_id, area_id`,
          )
          .eq('slug', slug)
          .single();
        if (eventError) throw eventError;
        if (!eventRow) throw new Error('Event not found');

        const [{ data: postRow }, { data: tagRows }, areaLookup] = await Promise.all([
          supabase
            .from('big_board_posts')
            .select('image_url, user_id')
            .eq('id', eventRow.post_id)
            .single(),
          supabase
            .from('taggings')
            .select('tag_id, tags(name, slug, id)')
            .eq('taggable_type', 'big_board_events')
            .eq('taggable_id', eventRow.id),
          ensureAreaCache(),
        ]);

        let imageUrl = '';
        if (postRow?.image_url) {
          const { data } = supabase.storage.from('big-board').getPublicUrl(postRow.image_url);
          imageUrl = data?.publicUrl || '';
        }

        const areaName = eventRow.area_id ? areaLookup?.[eventRow.area_id] || null : null;

        setEvent({
          ...eventRow,
          imageUrl,
          owner_id: postRow?.user_id || null,
          areaName,
        });
        setTags((tagRows || []).map(row => row.tags).filter(Boolean));
      } catch (err) {
        console.error(err);
        setError('Could not load event.');
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [slug]);

  useEffect(() => {
    if (!event?.owner_id) {
      setPoster(null);
      return;
    }
    async function loadPoster() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, image_url, slug')
          .eq('id', event.owner_id)
          .single();
        let image = profile?.image_url || '';
        if (image && !image.startsWith('http')) {
          const { data } = supabase.storage.from('profile-images').getPublicUrl(image);
          image = data?.publicUrl || '';
        }
        setPoster({
          id: profile?.id,
          username: profile?.username || '',
          image,
          slug: profile?.slug || null,
        });
      } catch (posterError) {
        console.error('Failed to load poster', posterError);
        setPoster(null);
      }
    }
    loadPoster();
  }, [event?.owner_id]);

  useEffect(() => {
    if (!event || !isEditing) return;
    setFormData({
      title: event.title,
      description: event.description || '',
      link: event.link || '',
      start_date: event.start_date || '',
      end_date: event.end_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      address: event.address || '',
      latitude: event.latitude,
      longitude: event.longitude,
    });
  }, [event, isEditing]);

  useEffect(() => {
    if (!event) return;
    async function loadRecommendations() {
      const cachedSimilar = readRecommendations(slug, 'similar');
      const cachedNearby = readRecommendations(slug, 'nearby');
      if (cachedSimilar) {
        setSimilarEvents(cachedSimilar);
        setLoadingSimilar(false);
      }
      if (cachedNearby) {
        setNearbyEvents(cachedNearby);
        setLoadingNearby(false);
      }
      if (cachedSimilar && cachedNearby) return;

      const areaLookup = await ensureAreaCache();

      async function fetchImageForBigBoard(id) {
        const { data } = await supabase
          .from('big_board_posts')
          .select('image_url')
          .eq('event_id', id)
          .single();
        if (data?.image_url) {
          const { data: storage } = supabase.storage
            .from('big-board')
            .getPublicUrl(data.image_url);
          return storage?.publicUrl || '';
        }
        return '';
      }

      async function loadSimilar() {
        if (!tags.length) {
          setSimilarEvents([]);
          setLoadingSimilar(false);
          return;
        }
        try {
          setLoadingSimilar(true);
          const tagIds = tags.map(tag => tag.id).filter(Boolean);
          if (!tagIds.length) {
            setSimilarEvents([]);
            setLoadingSimilar(false);
            return;
          }

          const { data: taggingsRows, error: taggingsError } = await supabase
            .from('taggings')
            .select('taggable_id, taggable_type')
            .in('tag_id', tagIds)
            .neq('taggable_id', event.id);
          if (taggingsError) throw taggingsError;

          const idsByType = taggingsRows.reduce((acc, row) => {
            const type = row.taggable_type;
            if (!acc[type]) acc[type] = new Set();
            acc[type].add(row.taggable_id);
            return acc;
          }, {});

          const [bigBoardRes, allEventsRes, traditionsRes, groupEventsRes, recurringRes] = await Promise.all([
            idsByType.big_board_events && idsByType.big_board_events.size
              ? supabase
                  .from('big_board_events')
                  .select('id, title, description, start_date, end_date, start_time, end_time, slug, area_id, address')
                  .in('id', Array.from(idsByType.big_board_events))
              : Promise.resolve({ data: [] }),
            idsByType.all_events && idsByType.all_events.size
              ? supabase
                  .from('all_events')
                  .select('id, name, description, start_date, end_date, start_time, end_time, slug, image, area_id, venue_id(area_id, name)')
                  .in('id', Array.from(idsByType.all_events))
              : Promise.resolve({ data: [] }),
            idsByType.events && idsByType.events.size
              ? supabase
                  .from('events')
                  .select('id, "E Name", "E Description", "E Image", Dates, "End Date", start_time, slug, area_id')
                  .in('id', Array.from(idsByType.events))
              : Promise.resolve({ data: [] }),
            idsByType.group_events && idsByType.group_events.size
              ? supabase
                  .from('group_events')
                  .select('id, title, description, image_url, start_date, end_date, start_time, end_time, slug, area_id, groups(Name, imag, slug)')
                  .in('id', Array.from(idsByType.group_events))
              : Promise.resolve({ data: [] }),
            idsByType.recurring_events && idsByType.recurring_events.size
              ? supabase
                  .from('recurring_events')
                  .select('id, name, description, start_date, end_date, start_time, end_time, slug, rrule, image_url, address, area_id')
                  .in('id', Array.from(idsByType.recurring_events))
              : Promise.resolve({ data: [] }),
          ]);

          const similarList = [];

          for (const row of bigBoardRes.data || []) {
            const normalized = normalizeBigBoardEvent(
              {
                ...row,
                imageUrl: await fetchImageForBigBoard(row.id),
              },
              areaLookup,
            );
            if (normalized) similarList.push(normalized);
          }

          for (const row of allEventsRes.data || []) {
            const normalized = normalizeAllEvent(row, areaLookup);
            if (normalized) similarList.push(normalized);
          }

          for (const row of traditionsRes.data || []) {
            const normalized = normalizeTradition(row, areaLookup);
            if (normalized) similarList.push(normalized);
          }

          for (const row of groupEventsRes.data || []) {
            const normalized = normalizeGroupEvent(row, areaLookup);
            if (normalized) similarList.push(normalized);
          }

          if (recurringRes.data?.length) {
            const { RRule } = await import('rrule');
            for (const series of recurringRes.data) {
              try {
                const options = RRule.parseString(series.rrule);
                options.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
                if (series.end_date) {
                  options.until = new Date(`${series.end_date}T23:59:59`);
                }
                const rule = new RRule(options);
                const occurrences = rule.all(() => true).slice(0, 3);
                occurrences.forEach(date => {
                  const iso = new Date(date).toISOString().slice(0, 10);
                  const normalized = normalizeRecurringEvent(series, areaLookup, iso);
                  if (normalized) similarList.push(normalized);
                });
              } catch (rruleError) {
                console.error('Failed to expand recurring event', rruleError);
              }
            }
          }

          const merged = mergeRecommendations(similarList, event.area_id)
            .filter(item => item.detailPath && item.favoriteId !== event.id)
            .slice(0, 15);
          setSimilarEvents(merged);
          storeRecommendations(slug, 'similar', merged);
        } catch (similarError) {
          console.error('Failed to load similar events', similarError);
          setSimilarEvents([]);
        } finally {
          setLoadingSimilar(false);
        }
      }

      async function loadNearby() {
        if (!event?.start_date) {
          setNearbyEvents([]);
          setLoadingNearby(false);
          return;
        }
        try {
          setLoadingNearby(true);
          const start = parseISODate(event.start_date, PHILLY_TIME_ZONE);
          if (!start) {
            setNearbyEvents([]);
            setLoadingNearby(false);
            return;
          }
          const rangeStart = setStartOfDay(new Date(start));
          const rangeEnd = setEndOfDay(new Date(start));

          const [bigBoardRes, allEventsRes, groupEventsRes, recurringRes] = await Promise.all([
            supabase
              .from('big_board_events')
              .select('id, title, description, start_date, end_date, start_time, end_time, slug, area_id, address')
              .gte('start_date', event.start_date)
              .lte('start_date', event.start_date)
              .neq('id', event.id)
              .order('start_date', { ascending: true }),
            supabase
              .from('all_events')
              .select('id, name, description, start_date, end_date, start_time, end_time, slug, image, area_id, venue_id(area_id, name)')
              .gte('start_date', event.start_date)
              .lte('start_date', event.start_date)
              .limit(200),
            supabase
              .from('group_events')
              .select('id, title, description, image_url, start_date, end_date, start_time, end_time, slug, area_id, groups(Name, imag, slug)')
              .gte('start_date', event.start_date)
              .lte('start_date', event.start_date)
              .limit(200),
            supabase
              .from('recurring_events')
              .select('id, name, description, start_date, end_date, start_time, end_time, slug, rrule, image_url, address, area_id')
              .eq('is_active', true),
          ]);

          const nearbyList = [];

          for (const row of bigBoardRes.data || []) {
            const normalized = normalizeBigBoardEvent(row, areaLookup);
            if (normalized) nearbyList.push(normalized);
          }

          for (const row of allEventsRes.data || []) {
            const normalized = normalizeAllEvent(row, areaLookup);
            if (normalized) nearbyList.push(normalized);
          }

          for (const row of groupEventsRes.data || []) {
            const normalized = normalizeGroupEvent(row, areaLookup);
            if (normalized) nearbyList.push(normalized);
          }

          if (recurringRes.data?.length) {
            const { RRule } = await import('rrule');
            for (const series of recurringRes.data) {
              try {
                const options = RRule.parseString(series.rrule);
                options.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
                if (series.end_date) {
                  options.until = new Date(`${series.end_date}T23:59:59`);
                }
                const rule = new RRule(options);
                const occurrences = rule.between(rangeStart, rangeEnd, true);
                occurrences.forEach(date => {
                  const iso = new Date(date).toISOString().slice(0, 10);
                  const normalized = normalizeRecurringEvent(series, areaLookup, iso);
                  if (normalized) nearbyList.push(normalized);
                });
              } catch (rruleError) {
                console.error('Failed to expand recurring event', rruleError);
              }
            }
          }

          const merged = mergeRecommendations(nearbyList, event.area_id)
            .filter(item => item.detailPath && item.favoriteId !== event.id)
            .slice(0, 15);
          setNearbyEvents(merged);
          storeRecommendations(slug, 'nearby', merged);
        } catch (nearbyError) {
          console.error('Failed to load nearby events', nearbyError);
          setNearbyEvents([]);
        } finally {
          setLoadingNearby(false);
        }
      }

      if (!cachedSimilar) loadSimilar();
      if (!cachedNearby) loadNearby();
    }

    loadRecommendations();
  }, [event, tags, slug]);

  useEffect(() => {
    if (!isEditing) return;
    const value = formData.address?.trim();
    if (!value) {
      setAddressSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(value)}&access_token=${geocoderToken}&session_token=${sessionToken.current}&limit=5&proximity=-75.1652,39.9526&bbox=-75.2803,39.8670,-74.9558,40.1379`,
      )
        .then(response => response.json())
        .then(json => setAddressSuggestions(json.suggestions || []))
        .catch(err => console.error('suggest error', err));
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.address, geocoderToken, isEditing]);

  const formattedDateRange = useMemo(
    () => formatDateRange(event),
    [event?.start_date, event?.start_time, event?.end_time],
  );
  const fullDateRange = useMemo(
    () => formatFullDateRange(event),
    [event?.start_date, event?.end_date, event?.start_time, event?.end_time],
  );

  const canonicalUrl = `${SITE_BASE_URL}/big-board/${slug}`;
  const seoDescription = event?.description
    ? event.description.replace(/\s+/g, ' ').slice(0, 155)
    : FALLBACK_DESCRIPTION;
  const absoluteImage = ensureAbsoluteUrl(event?.imageUrl);
  const ogImage = absoluteImage || DEFAULT_OG_IMAGE;
  const seoTitle = event?.title
    ? `${event.title} | Our Philly`
    : FALLBACK_TITLE;

  const jsonLd = useMemo(
    () =>
      buildEventJsonLd({
        name: event?.title || FALLBACK_TITLE,
        canonicalUrl,
        startDate: event?.start_date || null,
        endDate: event?.end_date || event?.start_date || null,
        locationName: event?.address || 'Philadelphia',
        description: seoDescription,
        image: ogImage,
      }),
    [event, canonicalUrl, seoDescription, ogImage],
  );

  const { isFavorite, toggleFavorite, loading: favLoading } = useEventFavorite({
    event_id: event?.id,
    source_table: 'big_board_events',
  });

  const startEditing = () => setIsEditing(true);

  const handleChange = evt => {
    const { name, value } = evt.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const pickSuggestion = feature => {
    fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${feature.mapbox_id}?access_token=${geocoderToken}&session_token=${sessionToken.current}`,
    )
      .then(response => response.json())
      .then(json => {
        const retrieved = json.features?.[0];
        if (!retrieved) return;
        const namePreferred =
          retrieved.properties?.name_preferred || retrieved.properties?.name || '';
        const context = retrieved.properties?.place_formatted || '';
        const [lng, lat] = retrieved.geometry?.coordinates || [];
        setFormData(prev => ({
          ...prev,
          address: [namePreferred, context].filter(Boolean).join(', '),
          latitude: Number.isFinite(lat) ? lat : prev.latitude,
          longitude: Number.isFinite(lng) ? lng : prev.longitude,
        }));
      })
      .catch(err => console.error('retrieve error', err));
    setAddressSuggestions([]);
    suggestRef.current?.blur();
  };

  const handleSave = async evt => {
    evt.preventDefault();
    if (!event) return;
    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        link: formData.link || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        address: formData.address || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };
      const { data, error: updateError } = await supabase
        .from('big_board_events')
        .update(payload)
        .eq('id', event.id)
        .select()
        .single();
      if (updateError) throw updateError;
      setEvent(prev => ({ ...prev, ...data }));
      setIsEditing(false);
    } catch (saveError) {
      console.error('Failed to save event', saveError);
      alert('Error saving event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const confirmed = window.confirm('Delete this event?');
    if (!confirmed) return;
    try {
      await supabase.from('big_board_events').delete().eq('id', event.id);
      navigate('/');
    } catch (deleteError) {
      console.error('Failed to delete event', deleteError);
      alert('Could not delete event.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Seo
          title={FALLBACK_TITLE}
          description={FALLBACK_DESCRIPTION}
          canonicalUrl={canonicalUrl}
          ogImage={DEFAULT_OG_IMAGE}
          ogType="event"
        />
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Loading…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Seo
          title={FALLBACK_TITLE}
          description={FALLBACK_DESCRIPTION}
          canonicalUrl={canonicalUrl}
          ogImage={DEFAULT_OG_IMAGE}
          ogType="event"
        />
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-lg text-red-600">{error || 'Event not found.'}</p>
        </main>
        <Footer />
      </div>
    );
  }

  const neighborhoodLabel = event.areaName || null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="event"
        jsonLd={jsonLd}
      />
      <Navbar />
      <TriviaTonightBanner />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-16">
        <header className="sticky top-28 z-20 mb-10 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="truncate text-2xl font-semibold text-gray-900">{event.title}</h1>
              <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
                {fullDateRange}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                {formattedDateRange.dateLabel && (
                  <span className="font-semibold text-gray-900">
                    {formattedDateRange.dateLabel} • {formattedDateRange.timeLabel}
                  </span>
                )}
                {neighborhoodLabel && (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                    <span aria-hidden="true">📍</span>
                    {neighborhoodLabel}
                  </span>
                )}
                {event.address && <span>{event.address}</span>}
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Link
                      key={tag.slug || tag.name}
                      to={`/tags/${tag.slug || ''}`}
                      className={`${pillStyles[index % pillStyles.length]} rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              )}
              {poster?.username && (
                <div className="text-sm text-gray-500">
                  Submitted by{' '}
                  {poster.slug ? (
                    <Link to={`/profiles/${poster.slug}`} className="font-semibold text-indigo-600">
                      @{poster.username}
                    </Link>
                  ) : (
                    <span className="font-semibold text-indigo-600">@{poster.username}</span>
                  )}
                </div>
              )}
            </div>
            <div className="hidden md:flex md:flex-col md:items-end md:gap-3">
              <FavoriteButton eventId={event.id} sourceTable="big_board_events" />
              {poster && poster.id !== user?.id && (
                <button
                  type="button"
                  onClick={togglePosterFollow}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {isPosterFollowing ? 'Following' : 'Follow organizer'}
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="mb-8 space-y-6">
          {event.description && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">About this event</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-700">{event.description}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-4 text-sm font-semibold text-indigo-600">
            {event.link && (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> See original listing
              </a>
            )}
            {event.owner_id === user?.id && (
              <>
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                </button>
              </>
            )}
          </div>
        </section>

        <section className="mb-10">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-auto w-full max-h-[520px] rounded-3xl object-cover shadow-md"
          />
        </section>

        {event.latitude != null && event.longitude != null && mapboxToken ? (
          <section className="mb-12">
            <div className="overflow-hidden rounded-3xl border border-gray-200 shadow-sm" style={{ height: 360 }}>
              <Map
                initialViewState={{
                  latitude: event.latitude,
                  longitude: event.longitude,
                  zoom: 14,
                }}
                mapStyle={MAPBOX_STYLE}
                mapboxAccessToken={mapboxToken}
                style={{ width: '100%', height: '100%' }}
                reuseMaps
                attributionControl={false}
              />
            </div>
          </section>
        ) : event.latitude != null && event.longitude != null ? (
          (() => {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              if (!window.sessionStorage.getItem(MAP_WARNING_KEY)) {
                console.warn('Mapbox token missing or invalid. Suppressing map render.');
                window.sessionStorage.setItem(MAP_WARNING_KEY, '1');
              }
            }
            return null;
          })()
        ) : null}

        {isEditing && (
          <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Website</label>
                <input
                  name="link"
                  value={formData.link}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  ref={suggestRef}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {addressSuggestions.length > 0 && (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow">
                    {addressSuggestions.map(suggestion => (
                      <button
                        type="button"
                        key={suggestion.mapbox_id}
                        onClick={() => pickSuggestion(suggestion)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                      >
                        {suggestion.place_formatted}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {!isEditing && (
          <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:hidden">
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
              className={`flex w-full items-center justify-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition-colors ${
                isFavorite
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          </section>
        )}

        {loadingSimilar ? (
          <RecommendationSkeleton title="More events like this" />
        ) : (
          <RecommendationList title="More events like this" events={similarEvents} />
        )}

        {loadingNearby ? (
          <RecommendationSkeleton title="More happening nearby this day" />
        ) : (
          <RecommendationList title="More happening nearby this day" events={nearbyEvents} />
        )}

        <SubmitEventSection
          onNext={file => {
            setInitialFlyer(file);
            setModalStartStep(2);
            setShowFlyerModal(true);
          }}
        />
      </main>
      <Footer />
      <FloatingAddButton
        onClick={() => {
          setModalStartStep(1);
          setInitialFlyer(null);
          setShowFlyerModal(true);
        }}
      />
      <PostFlyerModal
        isOpen={showFlyerModal}
        onClose={() => setShowFlyerModal(false)}
        startStep={modalStartStep}
        initialFile={initialFlyer}
      />
    </div>
  );
}
