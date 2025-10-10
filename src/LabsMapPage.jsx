import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import mapboxgl from 'mapbox-gl';
import MapGL, { Layer, Popup, Source } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient.js';
import { applyMapboxToken } from './config/mapboxToken.js';
import {
  getWeekendWindow,
  overlaps,
  parseEventDateValue,
  setEndOfDay,
  setStartOfDay,
} from './utils/dateUtils.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';

const MAPBOX_TOKEN = applyMapboxToken(mapboxgl);

const MAPBOX_STYLE = 'mapbox://styles/mapbox/dark-v11';
const DEFAULT_VIEW = {
  latitude: 39.9526,
  longitude: -75.1652,
  zoom: 11.4,
  bearing: 0,
  pitch: 0,
};
const HORIZON_DAYS = 60;

const SOURCE_LABELS = {
  all_events: 'All Events',
  events: 'Editorial Calendar',
  recurring_events: 'Recurring',
  group_events: 'Group Events',
  big_board_events: 'Big Board',
};

const CLUSTER_LAYER = {
  id: 'labs-map-clusters',
  type: 'circle',
  source: 'labs-events',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#22d3ee',
      10,
      '#6366f1',
      30,
      '#a855f7',
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      18,
      10,
      24,
      30,
      32,
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#0f172a',
  },
};

const CLUSTER_COUNT_LAYER = {
  id: 'labs-map-cluster-count',
  type: 'symbol',
  source: 'labs-events',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12,
  },
  paint: {
    'text-color': '#ffffff',
  },
};

const UNCLUSTERED_LAYER = {
  id: 'labs-map-unclustered',
  type: 'circle',
  source: 'labs-events',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#facc15',
    'circle-radius': 8,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#111827',
  },
};

const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'weekend', label: 'This Weekend' },
  { id: 'custom', label: 'Custom' },
];

function toISODate(date) {
  const copy = new Date(date);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, '0');
  const day = String(copy.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function formatTimeLabel(time) {
  if (!time) return '';
  const parts = time.split(':');
  const hourPart = parts[0];
  const minutePart = parts[1] || '00';
  let hour = Number(hourPart);
  if (!Number.isFinite(hour)) return '';
  const minutes = minutePart.slice(0, 2);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minutes} ${suffix}`;
}

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function formatDateRange(event) {
  if (!event?.startDate) return 'Date TBA';
  const startLabel = dayFormatter.format(event.startDate);
  if (event.endDate && event.endDate.getTime() !== event.startDate.getTime()) {
    const endLabel = dayFormatter.format(event.endDate);
    return `${startLabel} – ${endLabel}`;
  }
  return startLabel;
}

function normalizeAllEvent(row) {
  if (!row) return null;
  const startDate = parseEventDateValue(row.start_date);
  const endDate = parseEventDateValue(row.end_date || row.start_date) || startDate;
  const latitude = parseNumber(row.latitude);
  const longitude = parseNumber(row.longitude);
  const joinedVenue = Array.isArray(row.venues) ? row.venues[0] : row.venues;
  const venueLatitude = parseNumber(joinedVenue?.latitude);
  const venueLongitude = parseNumber(joinedVenue?.longitude);
  const resolvedLatitude = latitude != null ? latitude : venueLatitude;
  const resolvedLongitude = longitude != null ? longitude : venueLongitude;
  const venueName = joinedVenue?.name || '';
  const venueSlug = joinedVenue?.slug || null;
  const detailPath = getDetailPathForItem({
    ...row,
    source_table: 'all_events',
    venues: joinedVenue || row.venues,
  });
  return {
    id: `all_events-${row.id}`,
    taggableId: row.id ? String(row.id) : null,
    source_table: 'all_events',
    sourceLabel: SOURCE_LABELS.all_events,
    title: row.name || 'Untitled event',
    description: row.description || '',
    image: row.image || '',
    link: row.link || '',
    slug: row.slug || null,
    startDate,
    endDate,
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    latitude: resolvedLatitude,
    longitude: resolvedLongitude,
    venueId: row.venue_id ?? null,
    venueName,
    venueSlug,
    detailPath,
    tags: [],
  };
}

function normalizeLegacyEvent(row) {
  if (!row) return null;
  const startDate = parseEventDateValue(row.Dates);
  const endDate = parseEventDateValue(row['End Date']) || startDate;
  const detailPath = getDetailPathForItem({
    ...row,
    isTradition: true,
    source_table: 'events',
  });
  return {
    id: `events-${row.id}`,
    taggableId: row.id ? String(row.id) : null,
    source_table: 'events',
    sourceLabel: SOURCE_LABELS.events,
    title: row['E Name'] || 'Untitled event',
    description: row['E Description'] || '',
    image: row['E Image'] || '',
    link: row['E Link'] || row.link || '',
    slug: row.slug || null,
    startDate,
    endDate,
    start_date: row.Dates || null,
    end_date: row['End Date'] || null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    venueName: '',
    venueSlug: null,
    detailPath,
    tags: [],
  };
}

function normalizeRecurringEvent(row) {
  if (!row) return null;
  const startDate = parseEventDateValue(row.start_date);
  const endDate = parseEventDateValue(row.end_date || row.start_date) || startDate;
  const detailPath = getDetailPathForItem({
    ...row,
    source_table: 'recurring_events',
    isRecurring: true,
  });
  return {
    id: `recurring_events-${row.id}`,
    taggableId: row.id ? String(row.id) : null,
    source_table: 'recurring_events',
    sourceLabel: SOURCE_LABELS.recurring_events,
    title: row.name || 'Recurring event',
    description: row.description || '',
    image: row.image_url || '',
    link: row.link || '',
    slug: row.slug || null,
    startDate,
    endDate,
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    venueName: row.address || '',
    venueSlug: row.venue_slug || null,
    detailPath,
    tags: [],
  };
}

function normalizeGroupEvent(row) {
  if (!row) return null;
  const startDate = parseEventDateValue(row.start_date);
  const endDate = parseEventDateValue(row.end_date || row.start_date) || startDate;
  const detailPath = getDetailPathForItem({
    ...row,
    source_table: 'group_events',
    isGroupEvent: true,
  });
  return {
    id: `group_events-${row.id}`,
    taggableId: row.id ? String(row.id) : null,
    source_table: 'group_events',
    sourceLabel: SOURCE_LABELS.group_events,
    title: row.title || 'Group event',
    description: row.description || '',
    image: row.image_url || '',
    link: row.link || '',
    slug: row.slug || null,
    startDate,
    endDate,
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    venueName:
      row.groups?.Name ||
      row.location ||
      row.address ||
      row.groups?.name ||
      '',
    venueSlug: row.groups?.slug || null,
    detailPath,
    tags: [],
  };
}

function normalizeBigBoardEvent(row) {
  if (!row) return null;
  const startDate = parseEventDateValue(row.start_date);
  const endDate = parseEventDateValue(row.end_date || row.start_date) || startDate;
  const detailPath = getDetailPathForItem({
    ...row,
    source_table: 'big_board_events',
    isBigBoard: true,
  });
  let image = row.image_url || '';
  const storageKey = row.big_board_posts?.[0]?.image_url;
  if (!image && storageKey) {
    const {
      data: { publicUrl } = {},
    } = supabase.storage.from('big-board').getPublicUrl(storageKey);
    image = publicUrl || '';
  }
  return {
    id: `big_board_events-${row.id}`,
    taggableId: row.id ? String(row.id) : null,
    source_table: 'big_board_events',
    sourceLabel: SOURCE_LABELS.big_board_events,
    title: row.title || 'Big Board submission',
    description: row.description || '',
    image,
    link: row.link || '',
    slug: row.slug || null,
    startDate,
    endDate,
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    venueName: row.address || '',
    venueSlug: null,
    detailPath,
    tags: [],
  };
}

function buildGeoJson(features) {
  return {
    type: 'FeatureCollection',
    features: features.map(event => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [event.longitude, event.latitude],
      },
      properties: {
        eventId: event.id,
      },
    })),
  };
}

function withinBounds(event, bounds) {
  if (!bounds) return true;
  const { north, south, east, west } = bounds;
  if (event.longitude == null || event.latitude == null) return false;
  if (event.longitude < west || event.longitude > east) return false;
  if (event.latitude < south || event.latitude > north) return false;
  return true;
}

function LabsMapPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [datePreset, setDatePreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [limitToMap, setLimitToMap] = useState(true);
  const [bounds, setBounds] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const mapRef = useRef(null);

  useEffect(() => {
    function checkAccess() {
      try {
        return globalThis.localStorage?.getItem('labs:map-enabled') === 'true';
      } catch {
        return false;
      }
    }

    setHasAccess(checkAccess());

    function handleKey(event) {
      if (!event.shiftKey) return;
      if (event.key === 'M') {
        try {
          globalThis.localStorage?.setItem('labs:map-enabled', 'true');
        } catch {}
        setHasAccess(true);
      }
      if (event.key === 'U') {
        try {
          globalThis.localStorage?.removeItem('labs:map-enabled');
        } catch {}
        setHasAccess(false);
      }
    }

    globalThis.addEventListener?.('keydown', handleKey);
    return () => {
      globalThis.removeEventListener?.('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    if (!hasAccess) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const today = setStartOfDay(new Date());
        const horizon = setEndOfDay(new Date(today));
        horizon.setDate(horizon.getDate() + HORIZON_DAYS);
        const startIso = toISODate(today);
        const endIso = toISODate(horizon);

        const [allEventsRes, legacyRes, recurringRes, groupRes, bigBoardRes] = await Promise.all([
          supabase
            .from('all_events')
            .select(`
              id,
              name,
              description,
              link,
              image,
              start_date,
              end_date,
              start_time,
              end_time,
              slug,
              latitude,
              longitude,
              venue_id,
              venues:venue_id ( name, slug, latitude, longitude )
            `)
            .gte('start_date', startIso)
            .lte('start_date', endIso)
            .order('start_date', { ascending: true })
            .limit(1000),
          supabase
            .from('events')
            .select(`
              id,
              "E Name",
              "E Description",
              "E Image",
              "E Link",
              Dates,
              "End Date",
              slug,
              start_time,
              end_time,
              latitude,
              longitude
            `)
            .limit(400),
          supabase
            .from('recurring_events')
            .select(`
              id,
              name,
              description,
              address,
              link,
              slug,
              start_date,
              end_date,
              start_time,
              end_time,
              rrule,
              image_url,
              latitude,
              longitude
            `)
            .eq('is_active', true)
            .limit(400),
          supabase
            .from('group_events')
            .select(`
              id,
              title,
              description,
              image_url,
              start_date,
              end_date,
              start_time,
              end_time,
              slug,
              link,
              latitude,
              longitude,
              groups:group_id ( Name, slug )
            `)
            .gte('start_date', startIso)
            .lte('start_date', endIso)
            .limit(400),
          supabase
            .from('big_board_events')
            .select(`
              id,
              title,
              description,
              link,
              slug,
              start_date,
              end_date,
              start_time,
              end_time,
              latitude,
              longitude,
              big_board_posts!big_board_posts_event_id_fkey ( image_url )
            `)
            .limit(400),
        ]);

        if (allEventsRes.error) throw allEventsRes.error;
        if (legacyRes.error) throw legacyRes.error;
        if (recurringRes.error) throw recurringRes.error;
        if (groupRes.error) throw groupRes.error;
        if (bigBoardRes.error) throw bigBoardRes.error;

        const normalized = [
          ...(allEventsRes.data || []).map(normalizeAllEvent).filter(Boolean),
          ...(legacyRes.data || []).map(normalizeLegacyEvent).filter(Boolean),
          ...(recurringRes.data || []).map(normalizeRecurringEvent).filter(Boolean),
          ...(groupRes.data || []).map(normalizeGroupEvent).filter(Boolean),
          ...(bigBoardRes.data || []).map(normalizeBigBoardEvent).filter(Boolean),
        ];

        const idsByTable = normalized.reduce((acc, event) => {
          if (!event?.taggableId || !event.source_table) return acc;
          if (!acc[event.source_table]) {
            acc[event.source_table] = new Set();
          }
          acc[event.source_table].add(event.taggableId);
          return acc;
        }, {});

        const taggingEntries = Object.entries(idsByTable).filter(([, idSet]) =>
          idSet && idSet.size > 0,
        );

        const taggingResults = await Promise.all(
          taggingEntries.map(([table, idSet]) =>
            supabase
              .from('taggings')
              .select('taggable_id, tags:tags(name, slug)')
              .eq('taggable_type', table)
              .in('taggable_id', Array.from(idSet)),
          ),
        );

        const tagMap = new Map();
        taggingResults.forEach((result, index) => {
          if (result.error) {
            console.error('Failed to load taggings', result.error);
            return;
          }
          const [table] = taggingEntries[index] || [];
          (result.data || []).forEach(({ taggable_id, tags }) => {
            if (!taggable_id || !tags) return;
            const mapKey = `${table}:${taggable_id}`;
            const entry = tagMap.get(mapKey) || [];
            entry.push({ slug: tags?.slug || null, name: tags?.name || null });
            tagMap.set(mapKey, entry);
          });
        });

        const enriched = normalized.map(event => {
          const mapKey = `${event.source_table}:${event.taggableId}`;
          const tags = (tagMap.get(mapKey) || []).filter(tag => tag.slug || tag.name);
          return { ...event, tags };
        });

        const bounded = enriched.filter(event => {
          if (!event?.startDate || !event?.endDate) return false;
          if (event.endDate < today) return false;
          if (event.startDate > horizon) return false;
          return true;
        });

        if (!cancelled) {
          setEvents(bounded);
        }
      } catch (err) {
        console.error('Labs map load failed', err);
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [hasAccess]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    const today = setStartOfDay(new Date());
    if (datePreset === 'weekend') {
      const weekend = getWeekendWindow(today);
      return {
        rangeStart: weekend.start,
        rangeEnd: weekend.end,
      };
    }
    if (datePreset === 'custom') {
      const start = customStart ? parseEventDateValue(customStart) : today;
      const end = customEnd
        ? setEndOfDay(parseEventDateValue(customEnd))
        : setEndOfDay(start);
      return {
        rangeStart: start,
        rangeEnd: end,
      };
    }
    return {
      rangeStart: today,
      rangeEnd: setEndOfDay(new Date(today)),
    };
  }, [datePreset, customStart, customEnd]);

  const searchValue = searchTerm.trim().toLowerCase();

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (!event) return false;
      if (!event.startDate || !event.endDate) {
        return false;
      }
      if (rangeStart && rangeEnd) {
        if (!overlaps(event.startDate, event.endDate, rangeStart, rangeEnd)) {
          return false;
        }
      }
      if (searchValue) {
        const haystack = `${event.title || ''} ${event.venueName || ''} ${event.description || ''}`
          .toLowerCase();
        if (!haystack.includes(searchValue)) {
          return false;
        }
      }
      if (selectedTags.length) {
        const tagSlugs = (event.tags || [])
          .map(tag => tag?.slug)
          .filter(Boolean);
        if (!tagSlugs.some(slug => selectedTags.includes(slug))) {
          return false;
        }
      }
      if (limitToMap && bounds && event.latitude != null && event.longitude != null) {
        if (!withinBounds(event, bounds)) {
          return false;
        }
      }
      return true;
    });
  }, [events, rangeStart, rangeEnd, searchValue, selectedTags, limitToMap, bounds]);

  const eventsWithLocation = filteredEvents.filter(
    event => event.latitude != null && event.longitude != null,
  );
  const eventsWithoutLocation = filteredEvents.filter(
    event => event.latitude == null || event.longitude == null,
  );

  const geoJson = useMemo(() => buildGeoJson(eventsWithLocation), [eventsWithLocation]);

  const eventIndex = useMemo(() => {
    const map = new Map();
    eventsWithLocation.forEach(event => {
      map.set(event.id, event);
    });
    return map;
  }, [eventsWithLocation]);

  useEffect(() => {
    if (selectedEvent && !eventIndex.has(selectedEvent.id)) {
      setSelectedEvent(null);
    }
  }, [eventIndex, selectedEvent]);

  const tagOptions = useMemo(() => {
    const counts = new Map();
    filteredEvents.forEach(event => {
      (event.tags || []).forEach(tag => {
        if (!tag?.slug) return;
        const key = tag.slug;
        if (!counts.has(key)) {
          counts.set(key, { slug: tag.slug, name: tag.name || tag.slug, count: 0 });
        }
        counts.get(key).count += 1;
      });
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  const groupedNoLocation = useMemo(() => {
    const groups = new Map();
    eventsWithoutLocation.forEach(event => {
      const label = SOURCE_LABELS[event.source_table] || 'Other';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(event);
    });
    groups.forEach(list => {
      list.sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return a.startDate - b.startDate;
      });
    });
    return Array.from(groups.entries());
  }, [eventsWithoutLocation]);

  const sortedMapEvents = useMemo(() => {
    return [...eventsWithLocation].sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return a.startDate - b.startDate;
    });
  }, [eventsWithLocation]);

  const handleToggleTag = useCallback(slug => {
    setSelectedTags(current =>
      current.includes(slug)
        ? current.filter(item => item !== slug)
        : [...current, slug],
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedTags([]);
    setDatePreset('today');
    setCustomStart('');
    setCustomEnd('');
  }, []);

  const updateBounds = useCallback(map => {
    if (!map) return;
    const bbox = map.getBounds?.();
    if (!bbox) return;
    setBounds({
      north: bbox.getNorth(),
      south: bbox.getSouth(),
      east: bbox.getEast(),
      west: bbox.getWest(),
    });
  }, []);

  const handleMove = useCallback(event => {
    setViewState(event.viewState);
    updateBounds(event.target);
  }, [updateBounds]);

  const handleMapLoad = useCallback(event => {
    updateBounds(event.target);
  }, [updateBounds]);

  const handleMapClick = useCallback(
    event => {
      const feature = event.features?.[0];
      if (!feature) return;
      const map = mapRef.current?.getMap?.() || mapRef.current;
      if (!map) return;

      const clusterId = feature.properties?.cluster_id;
      if (clusterId != null) {
        const source = map.getSource('labs-events');
        if (source?.getClusterExpansionZoom) {
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            setViewState(current => ({
              ...current,
              longitude: feature.geometry.coordinates[0],
              latitude: feature.geometry.coordinates[1],
              zoom,
              transitionDuration: 400,
            }));
          });
        }
        return;
      }

      const eventId = feature.properties?.eventId;
      if (!eventId) return;
      const selected = eventIndex.get(eventId);
      if (selected) {
        setSelectedEvent(selected);
      }
    },
    [eventIndex],
  );

  const handleLocateMe = useCallback(() => {
    setGeoError('');
    if (!navigator?.geolocation) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setViewState(current => ({
          ...current,
          latitude,
          longitude,
          zoom: Math.max(current.zoom, 13),
          transitionDuration: 600,
        }));
      },
      err => {
        setGeoError(err.message || 'Unable to determine your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const activeRangeLabel = useMemo(() => {
    if (!rangeStart || !rangeEnd) return '';
    const start = dayFormatter.format(rangeStart);
    const end = dayFormatter.format(rangeEnd);
    return start === end ? start : `${start} – ${end}`;
  }, [rangeStart, rangeEnd]);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Helmet>
          <title>Labs Map Preview</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Labs access required</h1>
          <p className="text-slate-400">
            This map view is hidden for internal testing. Press <span className="font-semibold">Shift + M</span> to
            enable it on this device, or contact the team for access.
          </p>
          <p className="text-sm text-slate-500">
            To clear access, press <span className="font-semibold">Shift + U</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Helmet>
        <title>Labs · Event Map</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Labs</p>
          <h1 className="mt-2 text-3xl font-semibold">Map-first event explorer</h1>
          <p className="mt-1 text-sm text-slate-400">
            Internal prototype that combines all event feeds on a single map. Filters update instantly as you pan
            around Philadelphia.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition border ${
                      datePreset === option.id
                        ? 'bg-emerald-400/20 border-emerald-400 text-emerald-200'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    onClick={() => setDatePreset(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {datePreset === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <label className="flex items-center gap-2">
                    <span>Start</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={event => setCustomStart(event.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span>End</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={event => setCustomEnd(event.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
                    />
                  </label>
                </div>
              )}
              <p className="text-xs uppercase tracking-wider text-slate-500">Active range · {activeRangeLabel}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Search events or venues"
                  className="w-72 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </div>
              <button
                type="button"
                onClick={handleClearFilters}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Clear filters
              </button>
            </div>
          </div>

          {tagOptions.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Category tags</p>
              <div className="flex flex-wrap gap-2">
                {tagOptions.slice(0, 24).map(tag => (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => handleToggleTag(tag.slug)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      selectedTags.includes(tag.slug)
                        ? 'bg-emerald-400/20 border-emerald-400 text-emerald-100'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {tag.name} <span className="text-slate-500">· {tag.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={limitToMap}
                onChange={event => setLimitToMap(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800"
              />
              Limit to current map view
            </label>
            <button
              type="button"
              onClick={handleLocateMe}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-emerald-400 hover:text-emerald-100"
            >
              Near me
            </button>
            {geoError && <span className="text-xs text-rose-400">{geoError}</span>}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="relative h-[520px] overflow-hidden rounded-2xl border border-slate-800 shadow-lg">
              {MAPBOX_TOKEN ? (
                <MapGL
                  {...viewState}
                  ref={mapRef}
                  onMove={handleMove}
                  mapStyle={MAPBOX_STYLE}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  onLoad={handleMapLoad}
                  interactiveLayerIds={[CLUSTER_LAYER.id, UNCLUSTERED_LAYER.id]}
                  onClick={handleMapClick}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Source id="labs-events" type="geojson" data={geoJson} cluster clusterMaxZoom={14} clusterRadius={50}>
                    <Layer {...CLUSTER_LAYER} />
                    <Layer {...CLUSTER_COUNT_LAYER} />
                    <Layer {...UNCLUSTERED_LAYER} />
                  </Source>
                  {selectedEvent && selectedEvent.latitude != null && selectedEvent.longitude != null && (
                    <Popup
                      longitude={selectedEvent.longitude}
                      latitude={selectedEvent.latitude}
                      anchor="top"
                      closeOnClick={false}
                      onClose={() => setSelectedEvent(null)}
                      maxWidth="320px"
                      className="labs-map-popup"
                    >
                      <div className="space-y-3 text-slate-900">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-widest text-emerald-600">
                              {SOURCE_LABELS[selectedEvent.source_table] || 'Event'}
                            </p>
                            <h3 className="text-lg font-semibold leading-snug text-slate-900">
                              {selectedEvent.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedEvent(null)}
                            className="-mr-2 -mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Close event details"
                          >
                            ×
                          </button>
                        </div>
                        <p className="text-sm text-slate-600">
                          {formatDateRange(selectedEvent)}
                          {selectedEvent.start_time && (
                            <>
                              {' '}
                              · {formatTimeLabel(selectedEvent.start_time)}
                            </>
                          )}
                        </p>
                        {selectedEvent.venueName && (
                          <p className="text-sm text-slate-600">@ {selectedEvent.venueName}</p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {(selectedEvent.tags || []).map(tag => (
                            <span
                              key={`${selectedEvent.id}-${tag.slug || tag.name}`}
                              className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            >
                              {tag.name || tag.slug}
                            </span>
                          ))}
                        </div>
                        {(selectedEvent.detailPath || selectedEvent.link) && (
                          <a
                            href={selectedEvent.detailPath || selectedEvent.link}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            View details →
                          </a>
                        )}
                      </div>
                    </Popup>
                  )}
                </MapGL>
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-950/60 text-center text-sm text-slate-300">
                  Map view unavailable — missing Mapbox access token.
                </div>
              )}
              {loading && MAPBOX_TOKEN && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur">
                  <span className="text-sm font-medium text-slate-200">Loading events…</span>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-100">
                  Events with map location <span className="text-sm text-slate-500">({sortedMapEvents.length})</span>
                </h2>
                {!limitToMap && bounds && (
                  <span className="text-xs text-slate-500">Showing all events regardless of map view</span>
                )}
              </div>
              <ul className="mt-4 space-y-4">
                {sortedMapEvents.map(event => (
                  <li key={event.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-500">
                          {SOURCE_LABELS[event.source_table] || 'Event'}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-left text-lg font-semibold text-slate-100 hover:text-emerald-200"
                          onClick={() => {
                            setSelectedEvent(event);
                            setViewState(current => ({
                              ...current,
                              longitude: event.longitude,
                              latitude: event.latitude,
                              zoom: Math.max(current.zoom, 13),
                              transitionDuration: 400,
                            }));
                          }}
                        >
                          {event.title}
                        </button>
                        <p className="text-sm text-slate-400">
                          {formatDateRange(event)}
                          {event.start_time && (
                            <>
                              {' '}
                              · {formatTimeLabel(event.start_time)}
                            </>
                          )}
                        </p>
                        {event.venueName && (
                          <p className="text-sm text-slate-500">@ {event.venueName}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 text-sm text-right text-slate-400">
                        {(event.detailPath || event.link) && (
                          <a
                            href={event.detailPath || event.link}
                            className="text-emerald-300 hover:text-emerald-200"
                          >
                            Open details →
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
                {!sortedMapEvents.length && !loading && (
                  <li className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
                    No events match these filters yet.
                  </li>
                )}
              </ul>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Events with no location <span className="text-sm text-slate-500">({eventsWithoutLocation.length})</span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                These items are missing coordinates. Once we capture venues we can promote them onto the map.
              </p>
              <div className="mt-4 space-y-6">
                {groupedNoLocation.map(([label, items]) => (
                  <div key={label} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">{label}</h3>
                    <ul className="space-y-3">
                      {items.map(item => (
                        <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                          <p className="text-sm font-medium text-slate-100">{item.title}</p>
                          <p className="text-xs text-slate-500">{formatDateRange(item)}</p>
                          {(item.detailPath || item.link) && (
                            <a
                              href={item.detailPath || item.link}
                              className="mt-1 inline-flex text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                            >
                              View details →
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {!groupedNoLocation.length && !loading && (
                  <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-500">
                    Everything in this range has a map location. 🎉
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                <p className="font-semibold">We hit a snag loading events.</p>
                <p className="mt-1 opacity-80">{error.message || 'Unknown error'}</p>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

export default LabsMapPage;
