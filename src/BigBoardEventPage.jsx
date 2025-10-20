import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import SubmitEventSection from './SubmitEventSection';
import PostFlyerModal from './PostFlyerModal';
import FloatingAddButton from './FloatingAddButton';
import Seo from './components/Seo.jsx';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import { getMapboxToken } from './config/mapboxToken.js';
import {
  PHILLY_TIME_ZONE,
  formatMonthDay,
  formatWeekdayAbbrev,
  parseEventDateValue,
  setStartOfDay,
  getZonedDate,
} from './utils/dateUtils.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  CalendarClock,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  UserCircle,
} from 'lucide-react';

const FALLBACK_TITLE = 'Community Event – Our Philly';
const FALLBACK_DESCRIPTION =
  'Discover community-submitted events happening around Philadelphia with Our Philly.';
const DEFAULT_MAP_HEIGHT = 360;

const STATIC_AREA_LOOKUP = {
  '1': 'Center City',
  '2': 'North Philly',
  '3': 'Northeast Philly',
  '4': 'Northwest Philly',
  '5': 'South Philly',
  '6': 'Southwest Philly',
  '7': 'West Philly',
  '8': 'River Wards',
  '9': 'Far Northeast',
};

const AREA_CACHE_KEY = 'ourphilly-area-cache';

const TAG_PILL_CLASSES = [
  'bg-red-100 text-red-800',
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
];

const RELATED_SOURCES = [
  'events',
  'big_board_events',
  'all_events',
  'group_events',
  'recurring_events',
];

const FAVORITE_LABELS = {
  default: 'Add to Plans',
  active: 'In the Plans',
};

const EMPTY_FORM = {
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
  area_id: null,
};

function loadAreaCache() {
  if (typeof window === 'undefined') {
    return { ...STATIC_AREA_LOOKUP };
  }
  try {
    const raw = window.localStorage.getItem(AREA_CACHE_KEY);
    if (!raw) return { ...STATIC_AREA_LOOKUP };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...STATIC_AREA_LOOKUP };
    }
    return { ...STATIC_AREA_LOOKUP, ...parsed };
  } catch {
    return { ...STATIC_AREA_LOOKUP };
  }
}

function persistAreaCache(cache) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AREA_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage failures
  }
}

function toPhillyDate(dateStr) {
  const parsed = parseEventDateValue(dateStr, PHILLY_TIME_ZONE);
  return parsed ? setStartOfDay(parsed) : null;
}

function buildTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').slice(0, 2).map(Number);
  if ([year, month, day, hour, minute].some(value => Number.isNaN(value))) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function formatTimeRange(startDate, startTime, endDate, endTime) {
  if (!startDate || !startTime) {
    return 'Time TBA';
  }
  const start = buildTime(startDate, startTime);
  if (!start) return 'Time TBA';
  const startFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILLY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });
  const startLabel = startFormatter.format(start);

  if (!endTime && !endDate) {
    return startLabel;
  }
  const effectiveEndDate = endDate || startDate;
  const end = buildTime(effectiveEndDate, endTime || startTime);
  if (!end) return startLabel;
  const endFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILLY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });
  if (startLabel === endFormatter.format(end)) {
    return startLabel;
  }
  return `${startLabel}–${endFormatter.format(end)}`;
}

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const date = toPhillyDate(dateStr);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PHILLY_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function extractShortAddress(address) {
  if (!address) return '';
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, 2).join(', ');
}

function createFavoriteHandler(toggleFavorite, user, navigate) {
  return () => {
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite();
  };
}

function resolveNeighborhood(areaId, venueArea, cache) {
  const cacheKey = areaId != null ? String(areaId) : null;
  if (cacheKey && cache[cacheKey]) {
    return cache[cacheKey];
  }
  if (typeof venueArea === 'string' && venueArea.trim()) {
    return venueArea.trim();
  }
  return 'Neighborhood TBA';
}

function buildMapEvents(eventRecord, neighborhoodName) {
  if (!eventRecord) return [];
  const { latitude, longitude } = eventRecord;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return [];
  }
  return [
    {
      id: eventRecord.id,
      title: eventRecord.title,
      latitude,
      longitude,
      startDate: toPhillyDate(eventRecord.start_date) || null,
      endDate: toPhillyDate(eventRecord.end_date) || toPhillyDate(eventRecord.start_date) || null,
      detailPath: getDetailPathForItem({ ...eventRecord, source_table: 'big_board_events' }),
      areaName: neighborhoodName,
    },
  ];
}

function buildSessionToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mapTagsToLookup(tags) {
  const lookup = {};
  tags.forEach(tag => {
    if (!tag?.taggable_type || tag.taggable_id == null) return;
    const key = `${tag.taggable_type}:${tag.taggable_id}`;
    if (!lookup[key]) lookup[key] = [];
    if (tag.tags) lookup[key].push(tag.tags);
  });
  return lookup;
}

function normalizeCardImage(imageUrl, fallback) {
  if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
    return imageUrl;
  }
  if (!imageUrl) return fallback;
  return imageUrl;
}

function buildCardBase(record) {
  const startDateKey = record.start_date || record.Dates || record.date || null;
  const endDateKey = record.end_date || record['End Date'] || record.next_start_date || null;
  return {
    id: record.id,
    title: record.title || record.name || '',
    description: record.description || record['E Description'] || '',
    startDateKey,
    endDateKey,
    startDate: toPhillyDate(startDateKey) || null,
    endDate: toPhillyDate(endDateKey) || toPhillyDate(startDateKey) || null,
    start_time: record.start_time || record.startTime || '',
    end_time: record.end_time || record.endTime || '',
    area_id: record.area_id != null ? record.area_id : record.areaId,
    areaName:
      record.areaName ||
      record.area?.name ||
      record.area_name ||
      record.areas?.name ||
      null,
  };
}

function createDetailPath(record, source) {
  return (
    getDetailPathForItem({
      ...record,
      source_table: source,
    }) || null
  );
}

function mapBigBoardRecord(record, areaLookup) {
  const base = buildCardBase(record);
  const post = Array.isArray(record.big_board_posts)
    ? record.big_board_posts[0]
    : record.big_board_posts;
  let imageUrl = '';
  if (post?.image_url) {
    const { data } = supabase.storage.from('big-board').getPublicUrl(post.image_url);
    imageUrl = data?.publicUrl || '';
  }
  const areaName = resolveNeighborhood(base.area_id, base.areaName, areaLookup);
  return {
    ...base,
    imageUrl,
    detailPath: createDetailPath(record, 'big_board_events'),
    source_table: 'big_board_events',
    favoriteId: record.id,
    areaName,
  };
}

function mapTraditionRecord(record, areaLookup) {
  const base = buildCardBase(record);
  const image = record['E Image'] || record.image || '';
  const areaName = resolveNeighborhood(base.area_id, base.areaName, areaLookup);
  return {
    ...base,
    imageUrl: normalizeCardImage(image, ''),
    detailPath: createDetailPath(
      {
        ...record,
        title: record['E Name'],
        isTradition: true,
      },
      'events',
    ),
    source_table: 'events',
    favoriteId: record.id,
    title: record['E Name'] || base.title,
    areaName,
  };
}

function mapAllEventRecord(record, areaLookup) {
  const base = buildCardBase(record);
  const areaName = resolveNeighborhood(base.area_id, base.areaName, areaLookup);
  return {
    ...base,
    imageUrl: normalizeCardImage(record.image, ''),
    detailPath: createDetailPath(record, 'all_events'),
    source_table: 'all_events',
    favoriteId: record.id,
    areaName,
    venues: record.venue_id,
    link: record.link,
  };
}

function mapGroupEventRecord(record, groupSlugMap, areaLookup) {
  const base = buildCardBase(record);
  const image = record.image_url || '';
  const groupId = record.group_id;
  const detailRecord = {
    ...record,
    group_slug: groupSlugMap[groupId] || record.group_slug,
    isGroupEvent: true,
  };
  const areaName = resolveNeighborhood(base.area_id, base.areaName, areaLookup);
  return {
    ...base,
    imageUrl: normalizeCardImage(image, ''),
    detailPath: createDetailPath(detailRecord, 'group_events'),
    source_table: 'group_events',
    favoriteId: record.id,
    areaName,
  };
}

function mapRecurringRecord(record, areaLookup) {
  const base = buildCardBase(record);
  const areaName = resolveNeighborhood(base.area_id, base.areaName, areaLookup);
  return {
    ...base,
    imageUrl: normalizeCardImage(record.image_url, ''),
    detailPath: createDetailPath({ ...record, isRecurring: true }, 'recurring_events'),
    source_table: 'recurring_events',
    favoriteId: record.id,
    areaName,
  };
}

function sortCardsDeterministically(cards) {
  return cards.slice().sort((a, b) => {
    const aTime = a.startDate?.getTime?.() ?? 0;
    const bTime = b.startDate?.getTime?.() ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    const aStart = (a.start_time || '').localeCompare(b.start_time || '');
    if (aStart !== 0) return aStart;
    return (a.title || '').localeCompare(b.title || '');
  });
}

function formatListTimeLabel(event, now = getZonedDate(new Date(), PHILLY_TIME_ZONE)) {
  if (!event.startDate) return 'Date TBA';
  const eventDate = setStartOfDay(new Date(event.startDate));
  const diff = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = event.start_time && event.startDateKey
    ? formatTimeRange(event.startDateKey, event.start_time, event.endDateKey, event.end_time)
    : '';
  if (diff === 0) {
    return `Today${timeLabel ? ` · ${timeLabel}` : ''}`;
  }
  if (diff === 1) {
    return `Tomorrow${timeLabel ? ` · ${timeLabel}` : ''}`;
  }
  const weekday = formatWeekdayAbbrev(event.startDate, PHILLY_TIME_ZONE);
  return `${weekday}${timeLabel ? ` · ${timeLabel}` : ''}`;
}

function FavoritePill({ eventId, sourceTable, user, navigate }) {
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: eventId,
    source_table: sourceTable,
  });
  const handleToggle = useCallback(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite();
  }, [toggleFavorite, user, navigate]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition-colors ${
        isFavorite
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      {isFavorite ? FAVORITE_LABELS.active : FAVORITE_LABELS.default}
    </button>
  );
}

function RelatedEventCard({ event, tags = [], user, navigate }) {
  const timeLabel = useMemo(() => formatListTimeLabel(event), [event]);
  const tagPills = tags.slice(0, 3);
  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <Link to={event.detailPath || '#'} className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{timeLabel}</span>
          {event.areaName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[#28313e] normal-case">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {event.areaName}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-[#28313e]">{event.title}</h3>
        {event.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
        )}
        {tagPills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tagPills.map((tag, index) => (
              <Link
                key={tag.slug}
                to={`/tags/${tag.slug}`}
                className={`${TAG_PILL_CLASSES[index % TAG_PILL_CLASSES.length]} rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                onClick={event => event.stopPropagation()}
              >
                #{tag.name}
              </Link>
            ))}
            {tags.length > tagPills.length && (
              <span className="text-xs text-gray-500">+{tags.length - tagPills.length} more</span>
            )}
          </div>
        )}
        <div className="mt-4 hidden sm:flex">
          <FavoritePill eventId={event.favoriteId} sourceTable={event.source_table} user={user} navigate={navigate} />
        </div>
      </Link>
      <div className="px-5 pb-5 sm:hidden">
        <FavoritePill eventId={event.favoriteId} sourceTable={event.source_table} user={user} navigate={navigate} />
      </div>
    </article>
  );
}
export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [eventImageUrl, setEventImageUrl] = useState('');
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [eventTags, setEventTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [relatedByTags, setRelatedByTags] = useState([]);
  const [relatedByTagsLookup, setRelatedByTagsLookup] = useState({});
  const [relatedNearby, setRelatedNearby] = useState([]);
  const [relatedNearbyLookup, setRelatedNearbyLookup] = useState({});
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);
  const [headerOffset, setHeaderOffset] = useState(120);
  const [areaLookup, setAreaLookup] = useState(() => loadAreaCache());
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const geocoderToken = getMapboxToken();
  const sessionToken = useRef(buildSessionToken());
  const suggestRef = useRef(null);

  const favoriteState = useEventFavorite({
    event_id: event?.id ?? null,
    source_table: 'big_board_events',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const measure = () => {
      const nav = document.querySelector('nav');
      const belt = document.querySelector('[data-tag-belt]');
      const navHeight = nav ? nav.getBoundingClientRect().height : 0;
      const beltHeight = belt ? belt.getBoundingClientRect().height : 0;
      setHeaderOffset(Math.max(navHeight + beltHeight + 12, 96));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError('');

    async function loadEvent() {
      try {
        const { data: ev, error: evErr } = await supabase
          .from('big_board_events')
          .select(
            `id, post_id, title, description, link, start_date, end_date, start_time, end_time, address, latitude, longitude, area_id, venue_id`
          )
          .eq('slug', slug)
          .single();

        if (evErr) throw evErr;
        if (!isActive) return;

        let venueArea = null;
        if (ev?.venue_id) {
          const { data: venueRow } = await supabase
            .from('venues')
            .select('id, area, name, address')
            .eq('id', ev.venue_id)
            .single();
          venueArea = venueRow?.area || null;
        }

        const { data: post, error: postErr } = await supabase
          .from('big_board_posts')
          .select('image_url, user_id')
          .eq('id', ev.post_id)
          .single();
        if (postErr) throw postErr;

        let imageUrl = '';
        if (post?.image_url) {
          const { data } = supabase.storage.from('big-board').getPublicUrl(post.image_url);
          imageUrl = data?.publicUrl || '';
        }

        let poster = null;
        if (post?.user_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, username, slug, image_url')
            .eq('id', post.user_id)
            .single();
          if (prof) {
            let avatar = prof.image_url || '';
            if (avatar && !avatar.startsWith('http')) {
              const { data } = supabase.storage.from('profile-images').getPublicUrl(avatar);
              avatar = data?.publicUrl || '';
            }
            poster = {
              id: prof.id,
              username: prof.username || '',
              slug: prof.slug || '',
              image: avatar,
            };
          }
        }

        const { data: tagRows } = await supabase
          .from('taggings')
          .select('tag_id, tags:tags(name, slug)')
          .eq('taggable_type', 'big_board_events')
          .eq('taggable_id', ev.id);

        const eventTagList = (tagRows || [])
          .filter(row => row?.tags?.name)
          .map(row => ({ id: row.tag_id, name: row.tags.name, slug: row.tags.slug }));

        const areaName = resolveNeighborhood(ev.area_id, venueArea, areaLookup);
        if (ev.area_id != null && areaName && !areaLookup[String(ev.area_id)]) {
          const nextLookup = { ...areaLookup, [String(ev.area_id)]: areaName };
          setAreaLookup(nextLookup);
          persistAreaCache(nextLookup);
        }

        setEvent({ ...ev, neighborhoodName: areaName, venueArea });
        setEventImageUrl(imageUrl);
        setOwnerProfile(poster);
        setEventTags(eventTagList);
        setSelectedTagIds(eventTagList.map(tag => tag.id).filter(Boolean));
        setFormData({
          title: ev.title || '',
          description: ev.description || '',
          link: ev.link || '',
          start_date: ev.start_date || '',
          end_date: ev.end_date || '',
          start_time: ev.start_time || '',
          end_time: ev.end_time || '',
          address: ev.address || '',
          latitude: ev.latitude ?? null,
          longitude: ev.longitude ?? null,
          area_id: ev.area_id ?? null,
        });
      } catch (err) {
        console.error('Failed to load event', err);
        if (isActive) {
          setError('Could not load this community event.');
          setEvent(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadEvent();

    return () => {
      isActive = false;
    };
  }, [slug, areaLookup]);

  useEffect(() => {
    let isActive = true;
    supabase
      .from('tags')
      .select('id, name, slug')
      .order('name', { ascending: true })
      .then(({ data, error: tagsErr }) => {
        if (!isActive) return;
        if (tagsErr) {
          console.error('Failed to load tags', tagsErr);
          setAvailableTags([]);
          return;
        }
        setAvailableTags(data || []);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    const query = formData.address?.trim();
    if (!query) {
      setAddressSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}&access_token=${geocoderToken}&session_token=${sessionToken.current}&limit=5&proximity=-75.1652,39.9526&bbox=-75.2803,39.8670,-74.9558,40.1379`,
        { signal: controller.signal }
      )
        .then(response => response.json())
        .then(json => {
          if (!Array.isArray(json?.suggestions)) {
            setAddressSuggestions([]);
            return;
          }
          setAddressSuggestions(json.suggestions);
        })
        .catch(() => {
          setAddressSuggestions([]);
        });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [formData.address, geocoderToken, isEditing]);

  const pickSuggestion = useCallback(
    suggestion => {
      if (!suggestion?.mapbox_id) return;
      fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?access_token=${geocoderToken}&session_token=${sessionToken.current}`
      )
        .then(response => response.json())
        .then(json => {
          const feature = json?.features?.[0];
          if (!feature) return;
          const name = feature.properties?.name_preferred || feature.properties?.name || '';
          const context = feature.properties?.place_formatted || '';
          const [lng, lat] = Array.isArray(feature.geometry?.coordinates)
            ? feature.geometry.coordinates
            : [null, null];
          setFormData(prev => ({
            ...prev,
            address: name && context ? `${name}, ${context}` : name || context,
            latitude: typeof lat === 'number' ? lat : prev.latitude,
            longitude: typeof lng === 'number' ? lng : prev.longitude,
          }));
          setAddressSuggestions([]);
          suggestRef.current?.blur?.();
        })
        .catch(() => {
          setAddressSuggestions([]);
        });
    },
    [geocoderToken]
  );

  useEffect(() => {
    if (!event?.id || !eventTags.length) {
      setRelatedByTags([]);
      setRelatedByTagsLookup({});
      return;
    }
    let isActive = true;
    setTagLoading(true);

    async function loadRelatedByTags() {
      try {
        const tagIds = eventTags.map(tag => tag.id).filter(Boolean);
        if (!tagIds.length) {
          setRelatedByTags([]);
          setRelatedByTagsLookup({});
          return;
        }
        const { data: rows, error: relatedErr } = await supabase
          .from('taggings')
          .select('tag_id, taggable_type, taggable_id, tags(name, slug)')
          .in('tag_id', tagIds)
          .in('taggable_type', RELATED_SOURCES)
          .limit(800);
        if (relatedErr) throw relatedErr;
        if (!isActive) return;

        const idsByType = RELATED_SOURCES.reduce((acc, type) => {
          acc[type] = new Set();
          return acc;
        }, {});
        const lookup = {};

        (rows || []).forEach(row => {
          if (!row?.taggable_type || row.taggable_id == null) return;
          if (row.taggable_type === 'big_board_events' && row.taggable_id === event.id) return;
          const key = `${row.taggable_type}:${row.taggable_id}`;
          if (!lookup[key]) lookup[key] = [];
          if (row.tags) lookup[key].push(row.tags);
          idsByType[row.taggable_type]?.add(row.taggable_id);
        });

        const cards = await fetchCardsForIds(idsByType, areaLookup);
        if (!isActive) return;
        const taggedCards = cards.filter(card => card.source_table !== 'big_board_events' || card.id !== event.id);
        setRelatedByTags(sortCardsDeterministically(taggedCards).slice(0, 15));
        setRelatedByTagsLookup(lookup);
      } catch (err) {
        console.error('Failed to load related events by tags', err);
        if (isActive) {
          setRelatedByTags([]);
          setRelatedByTagsLookup({});
        }
      } finally {
        if (isActive) setTagLoading(false);
      }
    }

    loadRelatedByTags();

    return () => {
      isActive = false;
    };
  }, [event?.id, eventTags, areaLookup]);

  useEffect(() => {
    if (!event?.start_date) {
      setRelatedNearby([]);
      setRelatedNearbyLookup({});
      return;
    }
    const areaId = event.area_id != null ? event.area_id : null;
    if (!areaId) {
      setRelatedNearby([]);
      setRelatedNearbyLookup({});
      return;
    }
    let isActive = true;
    setNearbyLoading(true);

    async function loadNearby() {
      try {
        const cards = await fetchEventsByDateAndArea(
          event.start_date,
          areaId,
          {
            table: 'big_board_events',
            id: event.id,
          },
          areaLookup,
        );
        if (!isActive) return;
        const lookup = cards.reduce((acc, card) => {
          const key = `${card.source_table}:${card.id}`;
          acc[key] = card.tags || [];
          return acc;
        }, {});
        setRelatedNearby(sortCardsDeterministically(cards).slice(0, 15));
        setRelatedNearbyLookup(lookup);
      } catch (err) {
        console.error('Failed to load nearby events', err);
        if (isActive) {
          setRelatedNearby([]);
          setRelatedNearbyLookup({});
        }
      } finally {
        if (isActive) setNearbyLoading(false);
      }
    }

    loadNearby();

    return () => {
      isActive = false;
    };
  }, [event?.start_date, event?.id, event?.area_id, areaLookup]);

  const mapEvents = useMemo(() => buildMapEvents(event, event?.neighborhoodName), [event]);

  const startDateLabel = useMemo(() => formatFullDate(event?.start_date), [event?.start_date]);
  const timeLabel = useMemo(
    () => formatTimeRange(event?.start_date || '', event?.start_time || '', event?.end_date || '', event?.end_time || ''),
    [event?.start_date, event?.start_time, event?.end_date, event?.end_time]
  );
  const shortAddress = useMemo(() => extractShortAddress(event?.address || ''), [event?.address]);

  const seoTitle = event?.title || FALLBACK_TITLE;
  const seoDescription = event?.description?.slice(0, 180) || FALLBACK_DESCRIPTION;
  const canonicalUrl = typeof window !== 'undefined' && event?.slug
    ? `${window.location.origin}/big_board_events/${event.slug}`
    : undefined;
  const ogImage = eventImageUrl || undefined;
  const jsonLd = useMemo(() => {
    if (!event) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.title,
      startDate: event.start_date || undefined,
      endDate: event.end_date || undefined,
      location: {
        '@type': 'Place',
        name: shortAddress || 'Philadelphia',
        address: event.address || undefined,
      },
      description: event.description || undefined,
      image: eventImageUrl || undefined,
      url: canonicalUrl || undefined,
    };
  }, [event, shortAddress, eventImageUrl, canonicalUrl]);

  const handleFavorite = useCallback(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (favoriteState?.toggleFavorite) {
      favoriteState.toggleFavorite();
    }
  }, [favoriteState, navigate, user]);

  const startEditing = () => {
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setFormData({
      title: event?.title || '',
      description: event?.description || '',
      link: event?.link || '',
      start_date: event?.start_date || '',
      end_date: event?.end_date || '',
      start_time: event?.start_time || '',
      end_time: event?.end_time || '',
      address: event?.address || '',
      latitude: event?.latitude ?? null,
      longitude: event?.longitude ?? null,
      area_id: event?.area_id ?? null,
    });
    setSelectedTagIds(eventTags.map(tag => tag.id).filter(Boolean));
  };

  const handleFormChange = event => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleTagSelection = tagId => {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      }
      return [...prev, tagId];
    });
  };

  const handleSave = async formEvent => {
    formEvent.preventDefault();
    if (!event?.id) return;
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
        area_id: formData.area_id ?? null,
      };
      const { error: updateErr, data: updated } = await supabase
        .from('big_board_events')
        .update(payload)
        .eq('id', event.id)
        .select()
        .single();
      if (updateErr) throw updateErr;

      await supabase
        .from('taggings')
        .delete()
        .eq('taggable_type', 'big_board_events')
        .eq('taggable_id', event.id);

      if (selectedTagIds.length) {
        const inserts = selectedTagIds.map(tagId => ({
          taggable_type: 'big_board_events',
          taggable_id: event.id,
          tag_id: tagId,
        }));
        await supabase.from('taggings').insert(inserts);
      }

      const updatedTagList = availableTags
        .filter(tag => selectedTagIds.includes(tag.id))
        .map(tag => ({ id: tag.id, name: tag.name, slug: tag.slug }));
      setEventTags(updatedTagList);

      setEvent(prev => ({
        ...prev,
        ...updated,
        neighborhoodName: resolveNeighborhood(updated.area_id, prev?.venueArea, areaLookup),
      }));
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save event updates', err);
      alert('Could not save updates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const { error: deleteErr } = await supabase
        .from('big_board_events')
        .delete()
        .eq('id', event.id);
      if (deleteErr) throw deleteErr;
      navigate('/big-board');
    } catch (err) {
      console.error('Failed to delete event', err);
      alert('Could not delete this event.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isOwner = ownerProfile?.id && user?.id === ownerProfile.id;
  const mapboxToken = getMapboxToken();

  const renderTagPills = () => {
    if (!eventTags.length) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {eventTags.map((tag, index) => (
          <Link
            key={tag.slug || tag.name}
            to={`/tags/${tag.slug}`}
            className={`${TAG_PILL_CLASSES[index % TAG_PILL_CLASSES.length]} rounded-full px-3 py-1 text-sm font-semibold transition hover:opacity-80`}
          >
            #{tag.name}
          </Link>
        ))}
      </div>
    );
  };

  const renderEditActions = () => {
    if (!isOwner) return null;
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-indigo-600">
        {!isEditing && (
          <button type="button" onClick={startEditing} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100">
            <Pencil className="h-4 w-4" />
            Edit event
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-rose-600 transition hover:border-rose-400 hover:bg-rose-100 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-40 text-center text-gray-600">
          <p>Loading community event…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-40 text-center text-gray-600">
          <p>{error || 'This event could not be found.'}</p>
          <Link to="/big-board" className="mt-4 inline-flex items-center rounded-full border border-indigo-600 px-4 py-2 font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white">
            Browse the Big Board
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

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

      <header
        className="sticky z-30 bg-white shadow-sm"
        style={{
          top: `${headerOffset}px`,
          marginLeft: 'calc(50% - 50vw)',
          width: '100vw',
        }}
      >
        <div className="relative border-b border-gray-200 bg-[#f3f5f9]">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#28313e] sm:text-3xl">{event.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <span className="inline-flex items-center gap-2 font-medium text-[#28313e]">
                  <CalendarClock className="h-4 w-4 text-indigo-600" />
                  {startDateLabel}
                </span>
                <span className="text-gray-400">•</span>
                <span className="font-semibold text-indigo-700">{timeLabel}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <span className="inline-flex items-center gap-1 font-semibold text-[#28313e]">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                  {event.neighborhoodName}
                </span>
                {shortAddress && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span>{shortAddress}</span>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{renderTagPills()}</div>
              {ownerProfile && ownerProfile.username && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  {ownerProfile.image ? (
                    <img
                      src={ownerProfile.image}
                      alt="Profile"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle className="h-7 w-7 text-gray-400" />
                  )}
                  <span>
                    Submitted by{' '}
                    <Link to={`/u/${ownerProfile.slug}`} className="font-semibold text-indigo-600 hover:text-indigo-800">
                      @{ownerProfile.username}
                    </Link>
                  </span>
                </div>
              )}
            </div>
            <div className="hidden flex-shrink-0 items-center gap-3 sm:flex">
              <button
                type="button"
                onClick={handleFavorite}
                disabled={favoriteState?.loading}
                className={`inline-flex items-center rounded-full border border-indigo-600 px-5 py-2 font-semibold transition ${
                  favoriteState?.isFavorite
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                {favoriteState?.isFavorite ? FAVORITE_LABELS.active : FAVORITE_LABELS.default}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gray-50 pb-24">
        <div className="mx-auto mt-8 grid max-w-5xl gap-8 px-4 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[#28313e]">About this event</h2>
              {event.description ? (
                <p className="mt-4 whitespace-pre-line text-base text-gray-700">{event.description}</p>
              ) : (
                <p className="mt-4 text-base text-gray-500">Event description coming soon.</p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-indigo-600">
                {event.link && (
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100"
                  >
                    <ExternalLink className="h-4 w-4" /> See original listing
                  </a>
                )}
                {renderEditActions()}
              </div>

              {isEditing && (
                <form onSubmit={handleSave} className="mt-8 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <input
                      name="title"
                      value={formData.title}
                      onChange={handleFormChange}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Event link</label>
                    <input
                      name="link"
                      type="url"
                      value={formData.link}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start date</label>
                      <input
                        name="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={handleFormChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End date</label>
                      <input
                        name="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={handleFormChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start time</label>
                      <input
                        name="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={handleFormChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End time</label>
                      <input
                        name="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={handleFormChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input
                      ref={suggestRef}
                      name="address"
                      value={formData.address}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Start typing an address"
                      autoComplete="off"
                    />
                    {addressSuggestions.length > 0 && (
                      <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {addressSuggestions.map(item => (
                          <li
                            key={item.mapbox_id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => pickSuggestion(item)}
                            className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            {item.name} — {item.full_address || item.place_formatted}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Neighborhood</label>
                    <input
                      name="area_id"
                      type="number"
                      value={formData.area_id ?? ''}
                      onChange={event => {
                        const value = event.target.value;
                        setFormData(prev => ({ ...prev, area_id: value ? Number(value) : null }));
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Area ID"
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Tags</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableTags.map(tag => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTagSelection(tag.id)}
                            className={`${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } rounded-full px-3 py-1 text-sm font-semibold transition`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </article>

            {mapEvents.length > 0 && mapboxToken && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-[#28313e]">Where it&apos;s happening</h2>
                <div className="mt-4 overflow-hidden rounded-2xl">
                  <MonthlyEventsMap events={mapEvents} height={DEFAULT_MAP_HEIGHT} />
                </div>
              </section>
            )}

            {eventImageUrl && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-[#28313e]">Event image</h2>
                <div className="mt-4 overflow-hidden rounded-2xl">
                  <img src={eventImageUrl} alt={event.title} className="h-auto w-full max-h-[560px] rounded-2xl object-cover" />
                </div>
              </section>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#28313e]">Event details</h2>
              <dl className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="flex flex-col">
                  <dt className="font-semibold text-gray-500">Date</dt>
                  <dd>{startDateLabel || 'Date TBA'}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="font-semibold text-gray-500">Time</dt>
                  <dd>{timeLabel || 'Time TBA'}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="font-semibold text-gray-500">Neighborhood</dt>
                  <dd>{event.neighborhoodName}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="font-semibold text-gray-500">Address</dt>
                  <dd>{event.address || 'Address TBA'}</dd>
                </div>
              </dl>
              <div className="mt-6 sm:hidden">
                <button
                  type="button"
                  onClick={handleFavorite}
                  disabled={favoriteState?.loading}
                  className={`inline-flex w-full items-center justify-center rounded-full border border-indigo-600 px-5 py-2 font-semibold transition ${
                    favoriteState?.isFavorite
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {favoriteState?.isFavorite ? FAVORITE_LABELS.active : FAVORITE_LABELS.default}
                </button>
              </div>
            </div>
          </aside>
        </div>

        <section className="mx-auto mt-12 max-w-5xl px-4">
          <h2 className="text-xl font-semibold text-[#28313e]">More events like this</h2>
          {tagLoading ? (
            <p className="mt-4 text-sm text-gray-500">Loading related events…</p>
          ) : relatedByTags.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No similar events listed yet.</p>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {relatedByTags.map(card => {
                const key = `${card.source_table}:${card.id}`;
                const tags = relatedByTagsLookup[key] || [];
                return (
                  <RelatedEventCard
                    key={key}
                    event={card}
                    tags={tags}
                    user={user}
                    navigate={navigate}
                  />
                );
              })}
            </div>
          )}
        </section>

        {event.start_date && (
          <section className="mx-auto mt-12 max-w-5xl px-4">
            <h2 className="text-xl font-semibold text-[#28313e]">
              More happening nearby on {formatMonthDay(toPhillyDate(event.start_date))}
            </h2>
            {nearbyLoading ? (
              <p className="mt-4 text-sm text-gray-500">Loading nearby events…</p>
            ) : relatedNearby.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Nothing else listed nearby yet.</p>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {relatedNearby.map(card => {
                  const key = `${card.source_table}:${card.id}`;
                  const tags = relatedNearbyLookup[key] || [];
                  return (
                    <RelatedEventCard
                      key={key}
                      event={card}
                      tags={tags}
                      user={user}
                      navigate={navigate}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        <div className="mx-auto mt-16 max-w-5xl px-4">
          <SubmitEventSection
            onNext={file => {
              setInitialFlyer(file);
              setModalStartStep(2);
              setShowFlyerModal(true);
            }}
          />
        </div>
      </main>

      <Footer />

      <FloatingAddButton
        onClick={() => {
          setInitialFlyer(null);
          setModalStartStep(1);
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
async function fetchCardsForIds(idsByType, areaLookup) {
  const results = [];
  const eventsIds = Array.from(idsByType.events || []);
  const bigBoardIds = Array.from(idsByType.big_board_events || []);
  const allEventsIds = Array.from(idsByType.all_events || []);
  const groupEventIds = Array.from(idsByType.group_events || []);
  const recurringIds = Array.from(idsByType.recurring_events || []);

  const [eventsRes, bigBoardRes, allEventsRes, groupEventsRes, recurringRes] = await Promise.all([
    eventsIds.length
      ? supabase
          .from('events')
          .select('id, "E Name", "E Description", "E Image", slug, Dates, "End Date", start_time, end_time, area_id')
          .in('id', eventsIds)
      : { data: [], error: null },
    bigBoardIds.length
      ? supabase
          .from('big_board_events')
          .select('id, title, description, slug, start_date, end_date, start_time, end_time, area_id, latitude, longitude, big_board_posts!big_board_posts_event_id_fkey(image_url)')
          .in('id', bigBoardIds)
      : { data: [], error: null },
    allEventsIds.length
      ? supabase
          .from('all_events')
          .select('id, name, description, slug, image, link, start_date, end_date, start_time, end_time, area_id, venue_id(name, slug)')
          .in('id', allEventsIds)
      : { data: [], error: null },
    groupEventIds.length
      ? supabase
          .from('group_events')
          .select('id, title, description, start_date, end_date, start_time, end_time, image_url, area_id, group_id')
          .in('id', groupEventIds)
      : { data: [], error: null },
    recurringIds.length
      ? supabase
          .from('recurring_events')
          .select('id, name, slug, description, address, link, image_url, start_date, end_date, start_time, end_time, rrule, area_id')
          .in('id', recurringIds)
      : { data: [], error: null },
  ]);

  if (eventsRes.error) console.error('events lookup error', eventsRes.error);
  if (bigBoardRes.error) console.error('big board lookup error', bigBoardRes.error);
  if (allEventsRes.error) console.error('all events lookup error', allEventsRes.error);
  if (groupEventsRes.error) console.error('group events lookup error', groupEventsRes.error);
  if (recurringRes.error) console.error('recurring lookup error', recurringRes.error);

  (eventsRes.data || []).forEach(record => {
    results.push(mapTraditionRecord(record, areaLookup));
  });

  (bigBoardRes.data || []).forEach(record => {
    results.push(mapBigBoardRecord(record, areaLookup));
  });

  (allEventsRes.data || []).forEach(record => {
    results.push(mapAllEventRecord(record, areaLookup));
  });

  const groupData = groupEventsRes.data || [];
  let groupSlugMap = {};
  if (groupData.length) {
    const groupIds = [...new Set(groupData.map(ev => ev.group_id).filter(Boolean))];
    if (groupIds.length) {
      const { data: groups } = await supabase
        .from('groups')
        .select('id, slug')
        .in('id', groupIds);
      groupSlugMap = (groups || []).reduce((acc, group) => {
        acc[group.id] = group.slug;
        return acc;
      }, {});
    }
  }

  groupData.forEach(record => {
    results.push(mapGroupEventRecord(record, groupSlugMap, areaLookup));
  });

  (recurringRes.data || []).forEach(record => {
    results.push(mapRecurringRecord(record, areaLookup));
  });

  const tagLookup = await loadTagsForCards(results);
  return results.map(card => {
    const key = `${card.source_table}:${card.id}`;
    return { ...card, tags: tagLookup[key] || [] };
  });
}

async function loadTagsForCards(cards) {
  const idsByType = {};
  cards.forEach(card => {
    if (!card?.source_table || card.id == null) return;
    const key = card.source_table;
    if (!idsByType[key]) idsByType[key] = new Set();
    idsByType[key].add(card.id);
  });
  const entries = Object.entries(idsByType).filter(([, set]) => set.size);
  if (!entries.length) return {};
  const lookup = {};
  await Promise.all(
    entries.map(async ([type, set]) => {
      const ids = Array.from(set);
      const { data, error } = await supabase
        .from('taggings')
        .select('taggable_id, tags(name, slug)')
        .eq('taggable_type', type)
        .in('taggable_id', ids);
      if (error) {
        console.error('tag lookup failed', type, error);
        return;
      }
      (data || []).forEach(row => {
        if (row.taggable_id == null || !row.tags) return;
        const key = `${type}:${row.taggable_id}`;
        if (!lookup[key]) lookup[key] = [];
        lookup[key].push(row.tags);
      });
    })
  );
  return lookup;
}

async function fetchEventsByDateAndArea(dateStr, areaId, exclude, areaLookup) {
  const numericAreaId = Number(areaId);
  if (!Number.isFinite(numericAreaId)) {
    return [];
  }
  const [bigBoardRes, eventsRes, allEventsRes, groupEventsRes, recurringRes] = await Promise.all([
    supabase
      .from('big_board_events')
      .select('id, title, description, slug, start_date, end_date, start_time, end_time, area_id, latitude, longitude, big_board_posts!big_board_posts_event_id_fkey(image_url)')
      .eq('start_date', dateStr)
      .eq('area_id', numericAreaId)
      .limit(80),
    supabase
      .from('events')
      .select('id, "E Name", "E Description", "E Image", slug, Dates, "End Date", start_time, end_time, area_id')
      .eq('Dates', dateStr)
      .eq('area_id', numericAreaId)
      .limit(80),
    supabase
      .from('all_events')
      .select('id, name, description, slug, image, link, start_date, end_date, start_time, end_time, area_id, venue_id(name, slug)')
      .eq('start_date', dateStr)
      .eq('area_id', numericAreaId)
      .limit(80),
    supabase
      .from('group_events')
      .select('id, title, description, start_date, end_date, start_time, end_time, image_url, area_id, group_id')
      .eq('start_date', dateStr)
      .eq('area_id', numericAreaId)
      .limit(80),
    supabase
      .from('recurring_events')
      .select('id, name, slug, description, address, link, image_url, start_date, end_date, start_time, end_time, rrule, area_id')
      .eq('start_date', dateStr)
      .eq('area_id', numericAreaId)
      .limit(80),
  ]);

  const results = [];
  (bigBoardRes.data || []).forEach(record => {
    results.push(mapBigBoardRecord(record, areaLookup));
  });
  (eventsRes.data || []).forEach(record => {
    results.push(mapTraditionRecord(record, areaLookup));
  });
  (allEventsRes.data || []).forEach(record => {
    results.push(mapAllEventRecord(record, areaLookup));
  });

  const groupData = groupEventsRes.data || [];
  let groupSlugMap = {};
  if (groupData.length) {
    const groupIds = [...new Set(groupData.map(ev => ev.group_id).filter(Boolean))];
    if (groupIds.length) {
      const { data: groups } = await supabase
        .from('groups')
        .select('id, slug')
        .in('id', groupIds);
      groupSlugMap = (groups || []).reduce((acc, group) => {
        acc[group.id] = group.slug;
        return acc;
      }, {});
    }
  }
  groupData.forEach(record => {
    results.push(mapGroupEventRecord(record, groupSlugMap, areaLookup));
  });

  (recurringRes.data || []).forEach(record => {
    results.push(mapRecurringRecord(record, areaLookup));
  });

  const filtered = results.filter(card => !(exclude && card.source_table === exclude.table && card.id === exclude.id));
  const tagLookup = await loadTagsForCards(filtered);
  return filtered.map(card => {
    const key = `${card.source_table}:${card.id}`;
    return { ...card, tags: tagLookup[key] || [] };
  });
}
