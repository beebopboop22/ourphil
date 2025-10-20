import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Helmet } from 'react-helmet';
import { RRule } from 'rrule';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import { supabase } from './supabaseClient.js';
import { EventListItem } from './DayEventsPage.jsx';
import useAreaLookup from './utils/useAreaLookup.js';
import { getMapboxToken } from './config/mapboxToken.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  PHILLY_TIME_ZONE,
  parseISODate,
  getWeekendWindow,
  setStartOfDay,
  setEndOfDay,
  getZonedDate,
} from './utils/dateUtils.js';

const DEFAULT_VIEW_STATE = {
  latitude: 39.9526,
  longitude: -75.1652,
  zoom: 12,
};

function parseDateField(value) {
  if (!value) return null;
  const [first] = value.split(/through|–|-/);
  if (!first) return null;
  const parts = first.trim().split('/').map(Number);
  if (parts.length !== 3) return null;
  const [month, day, year] = parts;
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseISODateLocal(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some(Number.isNaN)) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODateString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseNumber(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function calculateCenter(events) {
  if (!events.length) {
    return DEFAULT_VIEW_STATE;
  }
  const points = events
    .map(evt => ({
      latitude: parseNumber(evt.latitude),
      longitude: parseNumber(evt.longitude),
    }))
    .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (!points.length) {
    return DEFAULT_VIEW_STATE;
  }
  const { latitude, longitude } = points.reduce(
    (acc, point) => {
      acc.latitude += point.latitude;
      acc.longitude += point.longitude;
      return acc;
    },
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: latitude / points.length,
    longitude: longitude / points.length,
    zoom: 12,
  };
}

function eventWithinBounds(event, bounds) {
  if (!bounds) return true;
  const lat = parseNumber(event.latitude);
  const lon = parseNumber(event.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return (
    lon >= bounds.west &&
    lon <= bounds.east &&
    lat >= bounds.south &&
    lat <= bounds.north
  );
}

function formatPopupDate(event) {
  if (!event?.startDate) return '';
  const start = event.startDate;
  const end = event.endDate || start;
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (end && end.getTime() !== start.getTime()) {
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }
  return startLabel;
}

function normalizeTradition(row) {
  if (!row) return null;
  const startDate = parseDateField(row.Dates);
  const endDate = parseDateField(row['End Date']) || startDate;
  return {
    id: `events-${row.id}`,
    taggableId: row.id,
    favoriteId: row.id,
    source_table: 'events',
    title: row['E Name'] || 'Philadelphia tradition',
    description: row['E Description'] || '',
    imageUrl: row['E Image'] || '',
    startDate,
    endDate,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    detailPath: getDetailPathForItem({ ...row, slug: row.slug }),
    badges: ['Tradition'],
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    area_id: row.area_id != null ? row.area_id : null,
  };
}

function normalizeBigBoard(row) {
  if (!row) return null;
  const startDate = parseISODateLocal(row.start_date);
  const endDate = parseISODateLocal(row.end_date || row.start_date) || startDate;
  let imageUrl = row.image_url || '';
  const storageKey = row.big_board_posts?.[0]?.image_url;
  if (!imageUrl && storageKey) {
    const { data } = supabase.storage.from('big-board').getPublicUrl(storageKey);
    imageUrl = data?.publicUrl || '';
  }
  return {
    id: `big-board-${row.id}`,
    taggableId: row.id,
    favoriteId: row.id,
    source_table: 'big_board_events',
    title: row.title || 'Community submission',
    description: row.description || '',
    imageUrl,
    startDate,
    endDate,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    detailPath: getDetailPathForItem({ ...row, isBigBoard: true }),
    badges: ['Submission'],
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    area_id: row.area_id != null ? row.area_id : null,
    address: row.address || '',
    externalUrl: row.link || null,
  };
}

function normalizeGroupEvent(row, groupSlugMap = {}) {
  if (!row) return null;
  const startDate = parseISODateLocal(row.start_date);
  const endDate = parseISODateLocal(row.end_date || row.start_date) || startDate;
  let imageUrl = row.image_url || '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    const { data } = supabase.storage.from('big-board').getPublicUrl(imageUrl);
    imageUrl = data?.publicUrl || '';
  }
  const groupSlug = groupSlugMap[row.group_id] || row.groups?.slug || null;
  return {
    id: `group-${row.id}`,
    taggableId: row.id,
    favoriteId: row.id,
    source_table: 'group_events',
    title: row.title || 'Group event',
    description: row.description || '',
    imageUrl,
    startDate,
    endDate,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    detailPath: getDetailPathForItem({ ...row, group_slug: groupSlug, isGroupEvent: true }),
    badges: ['Group Event'],
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    area_id: row.area_id != null ? row.area_id : null,
  };
}

function normalizeAllEvent(row) {
  if (!row) return null;
  const startDate = parseISODateLocal(row.start_date);
  const endDate = parseISODateLocal(row.end_date || row.start_date) || startDate;
  const venue = Array.isArray(row.venues) ? row.venues[0] : row.venues;
  const detailPath = getDetailPathForItem({
    ...row,
    venues: venue ? { name: venue.name, slug: venue.slug } : null,
    venue_slug: venue?.slug || null,
  });
  const venueLatitude = parseNumber(venue?.latitude);
  const venueLongitude = parseNumber(venue?.longitude);
  const venueAreaId = venue?.area_id != null ? venue.area_id : null;
  return {
    id: `all-${row.id}`,
    taggableId: row.id,
    favoriteId: row.id,
    source_table: 'all_events',
    title: row.name || 'Philadelphia event',
    description: row.description || '',
    imageUrl: row.image || '',
    startDate,
    endDate,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    detailPath,
    badges: [],
    latitude: parseNumber(row.latitude) ?? venueLatitude,
    longitude: parseNumber(row.longitude) ?? venueLongitude,
    area_id: row.area_id != null ? row.area_id : venueAreaId,
    venues: venue ? { name: venue.name, slug: venue.slug } : null,
    externalUrl: row.link || null,
  };
}

function normalizeRecurringInstance(series, date) {
  if (!series || !date) return null;
  const occurrence = new Date(date);
  occurrence.setHours(0, 0, 0, 0);
  const isoDate = toISODateString(occurrence);
  return {
    id: `recurring-${series.id}-${isoDate}`,
    taggableId: series.id,
    favoriteId: series.id,
    source_table: 'recurring_events',
    title: series.name || 'Recurring event',
    description: series.description || '',
    imageUrl: series.image_url || '',
    startDate: occurrence,
    endDate: occurrence,
    start_time: series.start_time || null,
    end_time: series.end_time || null,
    detailPath: `/series/${series.slug}/${isoDate}`,
    badges: ['Recurring'],
    latitude: parseNumber(series.latitude),
    longitude: parseNumber(series.longitude),
    area_id: series.area_id != null ? series.area_id : null,
    address: series.address || '',
    externalUrl: series.link || null,
    isRecurring: true,
  };
}

function expandRecurringSeries(seriesList) {
  if (!Array.isArray(seriesList)) return [];
  const now = new Date();
  return seriesList.flatMap(series => {
    if (!series?.rrule || !series?.start_date) return [];
    const options = RRule.parseString(series.rrule);
    const startTime = series.start_time || '00:00:00';
    const dtstart = new Date(`${series.start_date}T${startTime}`);
    if (Number.isNaN(dtstart.getTime())) return [];
    options.dtstart = dtstart;
    if (series.end_date) {
      options.until = new Date(`${series.end_date}T23:59:59`);
    }
    const rule = new RRule(options);
    const upcoming = [];
    let next = rule.after(now, true);
    for (let i = 0; next && i < 5; i += 1) {
      upcoming.push(new Date(next));
      next = rule.after(next, false);
    }
    return upcoming.map(date => normalizeRecurringInstance(series, date)).filter(Boolean);
  });
}

function normalizeSportsEvent(event) {
  if (!event) return null;
  const dt = new Date(event.datetime_local);
  if (Number.isNaN(dt.getTime())) return null;
  const performers = event.performers || [];
  const home = performers.find(p => p.home_team) || performers[0] || {};
  const away = performers.find(p => p.id !== home.id) || {};
  const title =
    event.short_title ||
    `${(home.name || '').replace(/^Philadelphia\s+/i, '')} vs ${(away.name || '').replace(/^Philadelphia\s+/i, '')}`;
  const venue = event.venue || {};
  const latitude = parseNumber(venue.location?.lat);
  const longitude = parseNumber(venue.location?.lon);
  return {
    id: `sports-${event.id}`,
    taggableId: null,
    favoriteId: null,
    source_table: null,
    title,
    description: '',
    imageUrl: home.image || away.image || '',
    startDate: dt,
    endDate: dt,
    start_time: event.datetime_local ? event.datetime_local.slice(11, 16) : null,
    end_time: null,
    detailPath: null,
    badges: ['Sports'],
    latitude,
    longitude,
    area_id: null,
    externalUrl: event.url || null,
  };
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
        `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=50&sort=datetime_local.asc&client_id=${clientId}`,
      );
      if (!response.ok) continue;
      const json = await response.json();
      events.push(...(json.events || []));
    }
    return events.map(normalizeSportsEvent).filter(Boolean);
  } catch (error) {
    console.error('Failed to load sports events', error);
    return [];
  }
}

async function buildTagMap(events) {
  const idsByType = events.reduce((acc, event) => {
    if (!event?.source_table || !event.taggableId) return acc;
    const type = event.source_table;
    if (!acc[type]) acc[type] = new Set();
    acc[type].add(event.taggableId);
    return acc;
  }, {});
  const entries = Object.entries(idsByType).filter(([, ids]) => ids.size > 0);
  if (!entries.length) return {};
  const results = await Promise.all(
    entries.map(([type, ids]) =>
      supabase
        .from('taggings')
        .select('taggable_id,tags(name,slug)')
        .eq('taggable_type', type)
        .in('taggable_id', Array.from(ids)),
    ),
  );
  const map = {};
  results.forEach(({ data, error }, index) => {
    if (error) {
      console.error('Failed to load tags for events', error);
      return;
    }
    const type = entries[index][0];
    (data || []).forEach(row => {
      if (!row?.taggable_id || !row.tags) return;
      const key = `${type}:${row.taggable_id}`;
      if (!map[key]) map[key] = [];
      map[key].push(row.tags);
    });
  });
  return map;
}

async function fetchTagData(slug) {
  const { data: tag, error: tagError } = await supabase
    .from('tags')
    .select('*')
    .eq('slug', slug)
    .single();
  if (tagError) throw tagError;
  if (!tag) return { tag: null, events: [], tagMap: {} };

  const { data: taggings, error: taggingError } = await supabase
    .from('taggings')
    .select('taggable_type,taggable_id')
    .eq('tag_id', tag.id);
  if (taggingError) throw taggingError;

  const idsByType = taggings.reduce((acc, row) => {
    if (!row?.taggable_type || row.taggable_id == null) return acc;
    const type = row.taggable_type;
    if (!acc[type]) acc[type] = new Set();
    acc[type].add(row.taggable_id);
    return acc;
  }, {});

  const groupIds = Array.from(idsByType.group_events || []);
  const groupSlugMap = {};
  if (groupIds.length) {
    const { data: groups, error: groupError } = await supabase
      .from('groups')
      .select('id,slug')
      .in('id', groupIds);
    if (!groupError) {
      (groups || []).forEach(group => {
        if (!group?.id) return;
        groupSlugMap[group.id] = group.slug || null;
      });
    }
  }

  const queries = await Promise.all([
    idsByType.events?.size
      ? supabase
          .from('events')
          .select('id,"E Name","E Description","E Image",Dates,"End Date",start_time,end_time,slug,latitude,longitude,area_id')
          .in('id', Array.from(idsByType.events))
      : { data: [] },
    idsByType.big_board_events?.size
      ? supabase
          .from('big_board_events')
          .select(
            `id,title,description,link,slug,address,start_date,end_date,start_time,end_time,latitude,longitude,area_id,big_board_posts!big_board_posts_event_id_fkey(image_url)`,
          )
          .in('id', Array.from(idsByType.big_board_events))
      : { data: [] },
    idsByType.group_events?.size
      ? supabase
          .from('group_events')
          .select(
            'id,title,description,image_url,start_date,end_date,start_time,end_time,group_id,latitude,longitude,area_id,groups:group_id(slug)',
          )
          .in('id', Array.from(idsByType.group_events))
      : { data: [] },
    idsByType.all_events?.size
      ? supabase
          .from('all_events')
          .select(
            'id,name,description,link,image,start_date,end_date,start_time,end_time,slug,latitude,longitude,area_id,venues:venue_id(name,slug,latitude,longitude,area_id)',
          )
          .in('id', Array.from(idsByType.all_events))
      : { data: [] },
    idsByType.recurring_events?.size
      ? supabase
          .from('recurring_events')
          .select(
            'id,name,description,address,link,slug,start_date,end_date,start_time,end_time,rrule,image_url,latitude,longitude,area_id',
          )
          .in('id', Array.from(idsByType.recurring_events))
      : { data: [] },
  ]);

  const [traditionsRes, bigBoardRes, groupRes, allEventsRes, recurringRes] = queries;

  const events = [
    ...(traditionsRes.data || []).map(normalizeTradition).filter(Boolean),
    ...(bigBoardRes.data || []).map(normalizeBigBoard).filter(Boolean),
    ...(groupRes.data || []).map(row => normalizeGroupEvent(row, groupSlugMap)).filter(Boolean),
    ...(allEventsRes.data || []).map(normalizeAllEvent).filter(Boolean),
    ...expandRecurringSeries(recurringRes.data || []),
  ];

  const tagMap = await buildTagMap(events);

  return { tag, events, tagMap };
}

function getEventKey(event) {
  if (!event) return null;
  if (event.source_table && event.taggableId != null) {
    return `${event.source_table}:${event.taggableId}`;
  }
  return event.id ? `evt:${event.id}` : null;
}

export default function TagPage() {
  const params = useParams();
  const slug = (params.slug || '').replace(/^#/, '');
  const areaLookup = useAreaLookup();
  const mapboxToken = getMapboxToken();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tag, setTag] = useState(null);
  const [baseEvents, setBaseEvents] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sportsEvents, setSportsEvents] = useState([]);

  const [dateFilter, setDateFilter] = useState(() => {
    const value = searchParams.get('date');
    return value === 'today' || value === 'weekend' || value === 'custom' ? value : 'weekend';
  });
  const [customStart, setCustomStart] = useState(() => searchParams.get('start') || '');
  const [customEnd, setCustomEnd] = useState(() => searchParams.get('end') || '');
  const [selectedArea, setSelectedArea] = useState(() => searchParams.get('area') || '');
  const [selectedTags, setSelectedTags] = useState(() => {
    const value = searchParams.get('tags');
    return value ? value.split(',').filter(Boolean) : [];
  });
  const [limitToMap, setLimitToMap] = useState(() => searchParams.get('limit') === 'map');
  const [locationQuery, setLocationQuery] = useState(() => searchParams.get('loc') || '');

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [userMovedMap, setUserMovedMap] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const mapRef = useRef(null);
  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchTagData(slug)
      .then(async ({ tag: fetchedTag, events, tagMap: loadedTagMap }) => {
        if (!active) return;
        setTag(fetchedTag);
        setBaseEvents(events);
        setTagMap(loadedTagMap);
        if (slug === 'sports') {
          const sports = await fetchSportsEvents();
          if (active) setSportsEvents(sports);
        } else {
          setSportsEvents([]);
        }
      })
      .catch(err => {
        console.error('Failed to load tag data', err);
        if (active) {
          setError('We had trouble loading this tag. Please try again later.');
          setTag(null);
          setBaseEvents([]);
          setTagMap({});
          setSportsEvents([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!tag) return;
    setSelectedTags(prev => {
      if (prev.length) return prev;
      return [tag.slug];
    });
  }, [tag]);

  useEffect(() => {
    const paramsToSet = new URLSearchParams();
    paramsToSet.set('date', dateFilter);
    if (dateFilter === 'custom') {
      if (customStart) paramsToSet.set('start', customStart);
      if (customEnd) paramsToSet.set('end', customEnd);
    }
    if (selectedArea) paramsToSet.set('area', selectedArea);
    if (selectedTags.length) paramsToSet.set('tags', selectedTags.join(','));
    if (limitToMap) paramsToSet.set('limit', 'map');
    if (locationQuery) paramsToSet.set('loc', locationQuery);
    setSearchParams(paramsToSet, { replace: true });
  }, [dateFilter, customStart, customEnd, selectedArea, selectedTags, limitToMap, locationQuery, setSearchParams]);

  const tagOptions = useMemo(() => {
    const map = new Map();
    if (tag?.slug) {
      map.set(tag.slug, tag.name || tag.slug);
    }
    Object.values(tagMap).forEach(list => {
      (list || []).forEach(entry => {
        if (!entry?.slug) return;
        if (!map.has(entry.slug)) {
          map.set(entry.slug, entry.name || entry.slug);
        }
      });
    });
    return Array.from(map.entries()).map(([slugValue, name]) => ({ slug: slugValue, name }));
  }, [tag, tagMap]);

  const weekendWindow = useMemo(() => getWeekendWindow(new Date(), PHILLY_TIME_ZONE), []);
  const todayStart = useMemo(() => setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)), []);
  const todayEnd = useMemo(() => setEndOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)), []);

  const decoratedEvents = useMemo(() => {
    const events = [...baseEvents, ...sportsEvents].map(event => {
      const areaName = event.area_id != null ? areaLookup[event.area_id] || null : null;
      return {
        ...event,
        areaName,
      };
    });
    return events
      .filter(event => {
        const start = event.startDate;
        const end = event.endDate || start;
        if (!start && !end) return false;
        const startTime = start ? start.getTime() : Number.NEGATIVE_INFINITY;
        const endTime = end ? end.getTime() : Number.NEGATIVE_INFINITY;
        return endTime >= todayStart.getTime();
      })
      .sort((a, b) => {
        const aTime = a.startDate ? a.startDate.getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.startDate ? b.startDate.getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [areaLookup, baseEvents, sportsEvents, todayStart]);

  const filteredEvents = useMemo(() => {
    let events = decoratedEvents;

    let rangeStart = null;
    let rangeEnd = null;
    if (dateFilter === 'today') {
      rangeStart = todayStart;
      rangeEnd = todayEnd;
    } else if (dateFilter === 'weekend') {
      rangeStart = weekendWindow.start;
      rangeEnd = weekendWindow.end;
    } else if (dateFilter === 'custom') {
      const parsedStart = customStart ? parseISODate(customStart, PHILLY_TIME_ZONE) : null;
      const parsedEnd = customEnd ? parseISODate(customEnd, PHILLY_TIME_ZONE) : null;
      rangeStart = parsedStart || null;
      rangeEnd = parsedEnd ? setEndOfDay(parsedEnd) : null;
    }

    if (rangeStart || rangeEnd) {
      events = events.filter(event => {
        const start = event.startDate;
        const end = event.endDate || start;
        if (!start && !end) return false;
        if (rangeStart && end && end.getTime() < rangeStart.getTime()) return false;
        if (rangeEnd && start && start.getTime() > rangeEnd.getTime()) return false;
        return true;
      });
    }

    if (selectedArea) {
      events = events.filter(event => String(event.area_id || '') === selectedArea);
    }

    if (locationQuery.trim()) {
      const needle = locationQuery.trim().toLowerCase();
      events = events.filter(event => (event.areaName || '').toLowerCase().includes(needle));
    }

    if (selectedTags.length) {
      events = events.filter(event => {
        const key = getEventKey(event);
        const extraTags = key && tagMap[key] ? tagMap[key] : [];
        const tagSet = new Set(
          extraTags
            .filter(t => t?.slug)
            .map(t => t.slug),
        );
        if (tag?.slug) {
          tagSet.add(tag.slug);
        }
        return selectedTags.every(slugValue => tagSet.has(slugValue));
      });
    }

    if (limitToMap && mapBounds) {
      events = events.filter(event => eventWithinBounds(event, mapBounds));
    }

    return events;
  }, [
    customEnd,
    customStart,
    dateFilter,
    decoratedEvents,
    limitToMap,
    locationQuery,
    mapBounds,
    selectedArea,
    selectedTags,
    tag,
    tagMap,
    todayEnd,
    todayStart,
    weekendWindow.end,
    weekendWindow.start,
  ]);

  useEffect(() => {
    if (!mapboxToken) return;
    const withCoordinates = filteredEvents.filter(
      event => Number.isFinite(parseNumber(event.latitude)) && Number.isFinite(parseNumber(event.longitude)),
    );
    if (!withCoordinates.length) return;
    if (userMovedMap) return;
    const center = calculateCenter(withCoordinates);
    setViewState(prev => ({ ...prev, ...center }));
  }, [filteredEvents, mapboxToken, userMovedMap]);

  const updateBounds = useCallback(() => {
    const mapInstance = mapRef.current?.getMap?.() || mapRef.current;
    if (!mapInstance?.getBounds) return;
    const bounds = mapInstance.getBounds();
    setMapBounds({
      west: bounds.getWest(),
      east: bounds.getEast(),
      south: bounds.getSouth(),
      north: bounds.getNorth(),
    });
  }, []);

  const handleMove = useCallback(event => {
    setViewState(event.viewState);
    setUserMovedMap(true);
  }, []);

  const handleMoveEnd = useCallback(() => {
    updateBounds();
  }, [updateBounds]);

  useEffect(() => {
    if (limitToMap) {
      updateBounds();
    }
  }, [limitToMap, updateBounds]);

  useEffect(() => {
    setUserMovedMap(false);
  }, [
    dateFilter,
    customStart,
    customEnd,
    selectedArea,
    limitToMap,
    locationQuery,
    selectedTags.join(','),
  ]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return filteredEvents.find(event => event.id === selectedEventId) || null;
  }, [filteredEvents, selectedEventId]);

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
        setViewState(prev => ({ ...prev, latitude, longitude, zoom: Math.max(prev.zoom, 13) }));
        setUserMovedMap(true);
        setIsLocating(false);
        setGeoError('');
        setTimeout(updateBounds, 300);
      },
      err => {
        setIsLocating(false);
        setGeoError(err.message || 'We could not determine your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [isLocating, updateBounds]);

  const areaOptions = useMemo(() => {
    return Object.entries(areaLookup)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [areaLookup]);

  const now = useMemo(() => new Date(), []);

  const mapReady = Boolean(mapboxToken);

  const emptyState = filteredEvents.length === 0;

  return (
    <>
      <Helmet>
        <title>{tag ? `#${tag.name} events in Philadelphia | Our Philly` : 'Philadelphia events | Our Philly'}</title>
        <meta
          name="description"
          content={
            tag
              ? `Discover upcoming #${tag.name} events, mapped and ready to plan with Our Philly.`
              : 'Discover upcoming Philadelphia events on Our Philly.'
          }
        />
      </Helmet>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 pt-[92px]">
          <section className="bg-white shadow-sm">
            <div className="relative mx-auto max-w-[min(1100px,100%)] px-4 pb-4 pt-2">
              <div className="relative h-[360px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                {mapReady ? (
                  <Map
                    ref={mapRef}
                    {...viewState}
                    onMove={handleMove}
                    onMoveEnd={handleMoveEnd}
                    onLoad={updateBounds}
                    mapStyle="mapbox://styles/mapbox/light-v11"
                    mapboxAccessToken={mapboxToken}
                    style={{ width: '100%', height: '100%' }}
                  >
                {filteredEvents
                      .map(event => {
                        const latitude = parseNumber(event.latitude);
                        const longitude = parseNumber(event.longitude);
                        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                          return null;
                        }
                        return (
                          <Marker
                            key={event.id}
                            latitude={latitude}
                            longitude={longitude}
                            anchor="bottom"
                            onClick={e => {
                              e.originalEvent.stopPropagation();
                              setSelectedEventId(event.id);
                            }}
                          >
                            <span
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white shadow"
                              aria-label={event.title}
                            >
                              ●
                            </span>
                          </Marker>
                        );
                      })}
                    {selectedEvent && Number.isFinite(parseNumber(selectedEvent.latitude)) && Number.isFinite(parseNumber(selectedEvent.longitude)) && (
                      <Popup
                        latitude={Number(selectedEvent.latitude)}
                        longitude={Number(selectedEvent.longitude)}
                        anchor="top"
                        closeOnClick={false}
                        onClose={() => setSelectedEventId(null)}
                        className="text-sm"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Upcoming Event</p>
                          <p className="text-base font-semibold text-slate-900">{selectedEvent.title}</p>
                          <p className="text-xs text-slate-600">{formatPopupDate(selectedEvent)}</p>
                          {selectedEvent.detailPath && (
                            <a
                              href={selectedEvent.detailPath}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              View details
                              <span aria-hidden="true">→</span>
                            </a>
                          )}
                        </div>
                      </Popup>
                    )}
                  </Map>
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-600">
                    Map view unavailable — missing Mapbox access token.
                  </div>
                )}
                <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={isLocating}
                    className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-indigo-500/60 bg-white px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLocating ? 'Locating…' : 'Near me'}
                  </button>
                  {geoError && (
                    <span className="pointer-events-auto rounded-full bg-white/90 px-3 py-1 font-medium text-rose-500 shadow">
                      {geoError}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-slate-200 bg-white/95">
            <div className="mx-auto max-w-[min(1100px,100%)] px-4 py-4">
              {tag && (
                <h1 className="mb-3 text-xl font-semibold text-slate-900">#{tag.name} around Philadelphia</h1>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {['today', 'weekend', 'custom'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDateFilter(option)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        dateFilter === option
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {option === 'today' ? 'Today' : option === 'weekend' ? 'Weekend' : 'Custom'}
                    </button>
                  ))}
                </div>
                {dateFilter === 'custom' && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start</span>
                      <input
                        type="date"
                        value={customStart}
                        onChange={event => setCustomStart(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">End</span>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={event => setCustomEnd(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </label>
                  </div>
                )}
                <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
                  <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:inline">Neighborhood</span>
                  <select
                    value={selectedArea}
                    onChange={event => setSelectedArea(event.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">All neighborhoods</option>
                    {areaOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={limitToMap}
                    onChange={event => setLimitToMap(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Limit to map view
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {tagOptions.map((tagOption, index) => {
                  const isActive = selectedTags.includes(tagOption.slug);
                  return (
                    <button
                      key={tagOption.slug}
                      type="button"
                      onClick={() => {
                        setSelectedTags(current => {
                          if (current.includes(tagOption.slug)) {
                            return current.filter(slugValue => slugValue !== tagOption.slug);
                          }
                          return [...current, tagOption.slug];
                        });
                      }}
                      className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      #{tagOption.name}
                    </button>
                  );
                })}
              </div>
              {geoError && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <label className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">ZIP / Neighborhood</span>
                    <input
                      type="text"
                      value={locationQuery}
                      onChange={event => setLocationQuery(event.target.value)}
                      placeholder="Try 19107 or Fishtown"
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200/50"
                    />
                  </label>
                </div>
              )}
            </div>
          </section>

          <section className="mx-auto max-w-[min(1100px,100%)] px-4 py-8">
            {loading ? (
              <div className="py-20 text-center text-slate-500">Loading events…</div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-rose-600 shadow-sm">
                <p className="text-base font-semibold">{error}</p>
              </div>
            ) : !tag ? (
              <div className="py-20 text-center text-slate-500">We couldn’t find this tag.</div>
            ) : emptyState ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-600 shadow-sm">
                <p className="text-lg font-semibold text-slate-900">No events match these filters just yet.</p>
                <p className="mt-3">Try widening the search to see more options around Philadelphia.</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedArea('')}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Show all neighborhoods
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter('custom');
                      setCustomStart('');
                      setCustomEnd('');
                    }}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Expand the dates
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTags(tag ? [tag.slug] : [])}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Reset tag filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredEvents.map(event => {
                  const key = getEventKey(event);
                  const extraTags = key && tagMap[key] ? tagMap[key] : [];
                  const tagList = [];
                  const seen = new Set();
                  extraTags
                    .filter(t => t?.slug)
                    .forEach(t => {
                      if (seen.has(t.slug)) return;
                      seen.add(t.slug);
                      tagList.push({ slug: t.slug, name: t.name || t.slug });
                    });
                  if (tag?.slug && !seen.has(tag.slug)) {
                    tagList.push({ slug: tag.slug, name: tag.name });
                  }
                  return (
                    <EventListItem key={event.id} event={event} now={now} tags={tagList} />
                  );
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
