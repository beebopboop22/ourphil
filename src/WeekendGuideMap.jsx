import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import mapboxgl from 'mapbox-gl';
import MapGL, { Layer, Marker, Popup, Source } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Link, useNavigate } from 'react-router-dom';
import { applyMapboxToken } from './config/mapboxToken.js';
import { AuthContext } from './AuthProvider.jsx';
import useEventFavorite from './utils/useEventFavorite.js';

const MAPBOX_TOKEN = applyMapboxToken(mapboxgl);

const MAPBOX_STYLE = 'mapbox://styles/mapbox/dark-v11';

const DEFAULT_VIEW = {
  latitude: 39.9526,
  longitude: -75.1652,
  zoom: 11.4,
  bearing: 0,
  pitch: 0,
};

const SOURCE_LABELS = {
  all_events: '',
  events: 'Annual Tradition',
  recurring_events: 'Recurring Event',
  group_events: 'Community Event',
  big_board_events: 'Community Pick',
  sg_events: 'Sports',
};

const EVENT_THEMES = [
  {
    key: 'music',
    label: 'Music & Nightlife',
    emoji: '🎶',
    color: '#f472b6',
    tagSlugs: ['music', 'concerts', 'nightlife', 'dj'],
    keywords: ['dj', 'band', 'set', 'show', 'concert'],
  },
  {
    key: 'arts',
    label: 'Arts & Culture',
    emoji: '🎨',
    color: '#a855f7',
    tagSlugs: ['arts', 'art', 'culture', 'film', 'theater'],
    keywords: ['gallery', 'film', 'exhibit', 'festival', 'museum'],
  },
  {
    key: 'food',
    label: 'Food & Drink',
    emoji: '🍽️',
    color: '#f59e0b',
    tagSlugs: ['nomnomslurp', 'food', 'drink', 'beer', 'wine'],
    keywords: ['dinner', 'brunch', 'tasting', 'brew', 'happy hour'],
  },
  {
    key: 'family',
    label: 'Family & Festivals',
    emoji: '🎡',
    color: '#38bdf8',
    tagSlugs: ['family', 'kids', 'markets', 'holiday'],
    keywords: ['family', 'kid', 'market', 'parade', 'holiday'],
  },
  {
    key: 'outdoors',
    label: 'Outdoors & Active',
    emoji: '🌳',
    color: '#34d399',
    tagSlugs: ['outdoors', 'fitness', 'sports', 'wellness'],
    keywords: ['park', 'run', 'hike', 'yoga', 'ride'],
  },
  {
    key: 'community',
    label: 'Community',
    emoji: '🤝',
    color: '#f97316',
    tagSlugs: ['organize', 'community', 'pride'],
    sources: ['group_events', 'big_board_events'],
    keywords: ['community', 'meetup', 'gather', 'volunteer'],
  },
];

const FALLBACK_THEME = {
  key: 'spotlight',
  label: 'Spotlight',
  emoji: '✨',
  color: '#facc15',
};

const LOGO_MARKER_SIZE = 48;
const LOGO_MARKER_FALLBACK_COLOR = '#bf3d35';

function hasVenueLogo(event) {
  if (!event) return false;
  if (!event.venueImage) return false;
  if (typeof event.venueImage !== 'string') return true;
  return event.venueImage.trim().length > 0;
}

function getLocationKey(event) {
  if (!event) return null;
  const { latitude, longitude } = event;
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat.toFixed(6)}|${lon.toFixed(6)}`;
}

function buildClusterProperties() {
  return EVENT_THEMES.reduce((acc, theme) => {
    const propertyName = `${theme.key}Count`;
    acc[propertyName] = [
      '+',
      [
        'case',
        ['==', ['get', 'themeKey'], theme.key],
        1,
        0,
      ],
    ];
    return acc;
  }, {});
}

function buildDominantThemeExpression(valueKey) {
  if (!EVENT_THEMES.length) {
    return FALLBACK_THEME[valueKey];
  }

  const letArgs = [];
  EVENT_THEMES.forEach(theme => {
    letArgs.push(`count_${theme.key}`);
    letArgs.push(['coalesce', ['get', `${theme.key}Count`], 0]);
  });

  letArgs.push('maxCount');
  const [firstTheme, ...restThemes] = EVENT_THEMES;
  letArgs.push(
    restThemes.reduce(
      (acc, theme) => ['max', acc, ['var', `count_${theme.key}`]],
      ['var', `count_${firstTheme.key}`],
    ),
  );

  const caseExpression = ['case', ['<=', ['var', 'maxCount'], 0], FALLBACK_THEME[valueKey]];
  EVENT_THEMES.forEach(theme => {
    caseExpression.push(['==', ['var', `count_${theme.key}`], ['var', 'maxCount']]);
    caseExpression.push(theme[valueKey]);
  });
  caseExpression.push(FALLBACK_THEME[valueKey]);

  return ['let', ...letArgs, caseExpression];
}

const CLUSTER_PROPERTIES = buildClusterProperties();
const CLUSTER_COLOR_EXPRESSION = buildDominantThemeExpression('color');
const CLUSTER_EMOJI_EXPRESSION = buildDominantThemeExpression('emoji');

const HEATMAP_LAYER = {
  id: 'labs-map-heatmap',
  type: 'heatmap',
  source: 'labs-events',
  maxzoom: 12,
  paint: {
    'heatmap-weight': [
      'case',
      ['all', ['has', 'themeKey'], ['has', 'themeColor']],
      0.65,
      0.4,
    ],
    'heatmap-intensity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      6,
      0.55,
      12,
      0.95,
    ],
    'heatmap-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      18,
      10,
      32,
      12,
      42,
    ],
    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.12, 10, 0.08, 12, 0.025],
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(15, 23, 42, 0)',
      0.2,
      'rgba(56, 189, 248, 0.14)',
      0.4,
      'rgba(129, 140, 248, 0.18)',
      0.6,
      'rgba(244, 114, 182, 0.22)',
      0.8,
      'rgba(250, 204, 21, 0.24)',
      1,
      'rgba(251, 191, 36, 0.26)',
    ],
  },
};

const CLUSTER_HALO_LAYER = {
  id: 'labs-map-cluster-halo',
  type: 'circle',
  source: 'labs-events',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': CLUSTER_COLOR_EXPRESSION,
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      20,
      12,
      30,
      15,
      38,
    ],
    'circle-blur': 0.45,
    'circle-opacity': 0.16,
  },
};

const CLUSTER_LAYER = {
  id: 'labs-map-clusters',
  type: 'circle',
  source: 'labs-events',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': CLUSTER_COLOR_EXPRESSION,
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      12,
      11,
      18,
      14,
      26,
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#111827',
    'circle-opacity': 0.68,
  },
};

const CLUSTER_ICON_LAYER = {
  id: 'labs-map-cluster-icon',
  type: 'symbol',
  source: 'labs-events',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': CLUSTER_EMOJI_EXPRESSION,
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      18,
      12,
      24,
      14,
      28,
    ],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': '#f8fafc',
    'text-halo-color': '#1e293b',
    'text-halo-width': 1.2,
  },
};

const CLUSTER_COUNT_LAYER = {
  id: 'labs-map-cluster-count',
  type: 'symbol',
  source: 'labs-events',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      16,
      12,
      20,
      14,
      24,
    ],
    'text-offset': [0, 1.15],
    'text-anchor': 'top',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-allow-overlap': true,
  },
  paint: {
    'text-color': '#f8fafc',
    'text-halo-color': '#1e293b',
    'text-halo-width': 1.6,
  },
};

const UNCLUSTERED_LAYER = {
  id: 'labs-map-unclustered',
  type: 'circle',
  source: 'labs-events',
  filter: [
    'all',
    ['!', ['has', 'point_count']],
    ['!', ['boolean', ['get', 'hasVenueImage'], false]],
  ],
  paint: {
    'circle-color': ['coalesce', ['get', 'themeColor'], FALLBACK_THEME.color],
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      9,
      5,
      12,
      7,
      15,
      9,
    ],
    'circle-stroke-width': 1.1,
    'circle-stroke-color': '#111827',
    'circle-opacity': 0.52,
  },
};

const UNCLUSTERED_GLOW_LAYER = {
  id: 'labs-map-unclustered-glow',
  type: 'circle',
  source: 'labs-events',
  filter: [
    'all',
    ['!', ['has', 'point_count']],
    ['!', ['boolean', ['get', 'hasVenueImage'], false]],
  ],
  paint: {
    'circle-color': ['coalesce', ['get', 'themeColor'], FALLBACK_THEME.color],
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      9,
      14,
      12,
      18,
      15,
      22,
    ],
    'circle-opacity': 0.12,
    'circle-blur': 0.8,
  },
};

const UNCLUSTERED_EMOJI_LAYER = {
  id: 'labs-map-unclustered-emoji',
  type: 'symbol',
  source: 'labs-events',
  filter: [
    'all',
    ['!', ['has', 'point_count']],
    ['has', 'themeEmoji'],
    ['!', ['boolean', ['get', 'hasVenueImage'], false]],
  ],
  layout: {
    'text-field': ['get', 'themeEmoji'],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      9,
      18,
      12,
      22,
      15,
      26,
    ],
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': '#f8fafc',
    'text-halo-color': '#1e293b',
    'text-halo-width': 1.2,
  },
};

function resolveEventTheme(event) {
  const tagStrings = (event?.tags || [])
    .map(tag => (tag?.slug || tag?.name || '').toLowerCase())
    .filter(Boolean);
  const searchable = `${event?.title || ''} ${event?.description || ''}`.toLowerCase();
  const source = event?.source_table;

  for (const theme of EVENT_THEMES) {
    const matchesTag = theme.tagSlugs?.some(slug => tagStrings.includes(slug));
    if (matchesTag) return theme;

    const matchesSource = theme.sources?.includes(source);
    if (matchesSource) return theme;

    const matchesKeyword = theme.keywords?.some(keyword => searchable.includes(keyword));
    if (matchesKeyword) return theme;
  }

  return FALLBACK_THEME;
}

function buildGeoJson(events, logoLocationKeys = null) {
  const brandedLocations = logoLocationKeys instanceof Set ? logoLocationKeys : null;
  return {
    type: 'FeatureCollection',
    features: events.map(event => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [event.longitude, event.latitude],
      },
      properties: {
        eventId: event.id,
        themeKey: event.themeKey || null,
        themeEmoji: event.themeEmoji || null,
        themeColor: event.themeColor || null,
        hasVenueImage:
          (brandedLocations && brandedLocations.has(getLocationKey(event))) || hasVenueLogo(event),
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

function TagPills({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }
  const displayed = tags.slice(0, 2);
  const remaining = tags.length - displayed.length;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {displayed.map(tag => {
        const label = tag?.name || tag?.slug;
        if (!label) return null;
        const content = <span className="text-xs font-semibold">#{label}</span>;
        if (tag?.slug) {
          return (
            <Link
              key={tag.slug}
              to={`/tags/${tag.slug}`}
              className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 transition hover:border-[#bf3d35] hover:text-[#bf3d35]"
            >
              {content}
            </Link>
          );
        }
        return (
          <span
            key={label}
            className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100/80 px-2 py-0.5 text-xs font-semibold text-gray-700"
          >
            {content}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs font-semibold text-gray-500">
          +{remaining} more
        </span>
      )}
    </div>
  );
}

function MapEventRow({ event, onHighlight }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event?.favoriteId,
    source_table: event?.source_table,
  });

  const handleHighlight = useCallback(() => {
    if (typeof onHighlight === 'function') {
      onHighlight(event);
    }
  }, [event, onHighlight]);

  const badgeLabel = event?.badgeLabel || SOURCE_LABELS[event?.source_table] || '';
  const Wrapper = event?.detailPath
    ? Link
    : event?.link
    ? 'a'
    : 'div';
  const wrapperProps = {};
  if (event?.detailPath) {
    wrapperProps.to = event.detailPath;
  } else if (event?.link) {
    wrapperProps.href = event.link;
    wrapperProps.target = '_blank';
    wrapperProps.rel = 'noopener noreferrer';
  } else {
    wrapperProps.role = 'button';
    wrapperProps.tabIndex = 0;
    wrapperProps.onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleHighlight();
      }
    };
  }

  const handleAddToPlans = useCallback(
    e => {
      e.preventDefault();
      e.stopPropagation();
      if (!event?.favoriteId || !event?.source_table) {
        return;
      }
      if (!user) {
        navigate('/login');
        return;
      }
      toggleFavorite();
    },
    [event?.favoriteId, event?.source_table, navigate, toggleFavorite, user],
  );

  const titleClassName = `mt-2 font-semibold text-[#29313f] transition-colors group-hover:text-[#bf3d35] ${
    event?.source_table === 'recurring_events' ? 'text-base' : 'text-lg'
  }`;

  return (
    <li>
      <Wrapper
        {...wrapperProps}
        onMouseEnter={handleHighlight}
        onFocus={handleHighlight}
        onClick={handleHighlight}
        className="group block rounded-2xl border border-[#f3c7b8] bg-white/90 shadow-sm shadow-[#bf3d35]/5 transition hover:-translate-y-0.5 hover:border-[#bf3d35] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#29313f]"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex w-full items-start gap-4">
            <div className="hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-[#f4e5df] sm:block">
              {event?.image && (
                <img src={event.image} alt={event?.title || ''} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {badgeLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#d9e9ea] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#004C55]">
                  {badgeLabel}
                </span>
              ) : null}
              <h3 className={titleClassName}>
                {event?.title}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {formatDateRange(event)}
                {event?.start_time && (
                  <>
                    {' '}
                    · {formatTimeLabel(event.start_time)}
                  </>
                )}
              </p>
              <TagPills tags={event?.tags} />
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {event?.favoriteId && event?.source_table ? (
              <button
                type="button"
                onClick={handleAddToPlans}
                disabled={loading}
                className={`rounded-full border border-indigo-600 px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 whitespace-nowrap ${
                  isFavorite
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
            ) : null}
          </div>
        </div>
      </Wrapper>
    </li>
  );
}

function focusOnEvent(mapRef, event) {
  if (!mapRef?.current || !event) return;
  const { latitude, longitude } = event;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }
  mapRef.current.flyTo({
    center: [longitude, latitude],
    zoom: 13,
    speed: 0.7,
    curve: 1.4,
  });
}

function WeekendGuideMap({ events = [], loading = false }) {
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const [bounds, setBounds] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedLocationKey, setSelectedLocationKey] = useState(null);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(0);
  const mapRef = useRef(null);

  const themedEvents = useMemo(() => {
    return events.map(event => {
      if (!event) return event;
      const theme = resolveEventTheme(event);
      return {
        ...event,
        themeKey: theme.key,
        themeEmoji: theme.emoji,
        themeColor: theme.color,
        themeLabel: theme.label,
      };
    });
  }, [events]);

  const eventsWithLocation = useMemo(
    () =>
      themedEvents.filter(
        event => Number.isFinite(event?.latitude) && Number.isFinite(event?.longitude),
      ),
    [themedEvents],
  );

  const eventsByLocation = useMemo(() => {
    const groups = new Map();
    eventsWithLocation.forEach(event => {
      const key = getLocationKey(event);
      if (!key) return;
      const existing = groups.get(key);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(key, [event]);
      }
    });
    for (const [key, grouped] of groups.entries()) {
      grouped.sort((a, b) => {
        const aTime = a?.startDate instanceof Date ? a.startDate.getTime() : 0;
        const bTime = b?.startDate instanceof Date ? b.startDate.getTime() : 0;
        if (aTime !== bTime) return aTime - bTime;
        const aTitle = (a?.title || '').toLowerCase();
        const bTitle = (b?.title || '').toLowerCase();
        if (aTitle < bTitle) return -1;
        if (aTitle > bTitle) return 1;
        const aId = a?.id ? String(a.id) : '';
        const bId = b?.id ? String(b.id) : '';
        return aId.localeCompare(bId);
      });
      groups.set(key, grouped);
    }
    return groups;
  }, [eventsWithLocation]);

  const { logoEvents, logoLocationKeys } = useMemo(() => {
    const branded = [];
    const keys = new Set();
    for (const [key, grouped] of eventsByLocation.entries()) {
      const brandedEvent = grouped.find(hasVenueLogo);
      if (brandedEvent) {
        branded.push(brandedEvent);
        keys.add(key);
      }
    }
    return { logoEvents: branded, logoLocationKeys: keys };
  }, [eventsByLocation]);

  const geoJson = useMemo(
    () => buildGeoJson(eventsWithLocation, logoLocationKeys),
    [eventsWithLocation, logoLocationKeys],
  );

  useEffect(() => {
    if (!eventsWithLocation.length) {
      setViewState(DEFAULT_VIEW);
      return;
    }
    const avg = eventsWithLocation.reduce(
      (acc, event) => {
        acc.lat += event.latitude;
        acc.lng += event.longitude;
        return acc;
      },
      { lat: 0, lng: 0 },
    );
    const next = {
      latitude: avg.lat / eventsWithLocation.length,
      longitude: avg.lng / eventsWithLocation.length,
      zoom: eventsWithLocation.length > 1 ? 11.6 : 13,
      bearing: 0,
      pitch: 0,
    };
    setViewState(current => ({ ...current, ...next }));
  }, [eventsWithLocation]);

  useEffect(() => {
    if (!selectedEvent || !mapRef.current) return;
    const mapInstance = mapRef.current.getMap?.();
    const mapBounds = mapInstance?.getBounds?.();
    if (!mapBounds) return;
    setBounds({
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    });
  }, [selectedEvent]);

  const handleMove = useCallback(({ viewState: nextViewState }) => {
    setViewState(nextViewState);
    const mapInstance = mapRef.current?.getMap?.();
    const mapBounds = mapInstance?.getBounds?.();
    if (!mapBounds) return;
    setBounds({
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    });
  }, []);

  const eventIndex = useMemo(() => {
    const map = new Map();
    eventsWithLocation.forEach(event => {
      map.set(event.id, event);
    });
    return map;
  }, [eventsWithLocation]);

  const selectedLocationEvents = useMemo(() => {
    if (!selectedLocationKey) return [];
    const grouped = eventsByLocation.get(selectedLocationKey);
    return grouped ? grouped : [];
  }, [eventsByLocation, selectedLocationKey]);

  const selectedEventUrl = selectedEvent?.detailPath || selectedEvent?.link || '';

  const handleMapLoad = useCallback(() => {
    const mapInstance = mapRef.current?.getMap?.();
    if (!mapInstance) return;
    const mapBounds = mapInstance.getBounds();
    setBounds({
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    });
  }, []);

  const handleMapClick = useCallback(event => {
    const features = event?.features || [];
    const clusterFeature = features.find(f => f.layer?.id === CLUSTER_LAYER.id);
    if (clusterFeature && mapRef.current) {
      const clusterId = clusterFeature.properties?.cluster_id;
      const mapInstance = mapRef.current.getMap?.();
      if (mapInstance && typeof clusterId === 'number') {
        mapInstance.getSource('labs-events')?.getClusterExpansionZoom?.(
          clusterId,
          (err, zoom) => {
            if (err) return;
            mapInstance.easeTo({
              center: clusterFeature.geometry.coordinates,
              zoom,
              duration: 600,
            });
          },
        );
      }
    }
  }, []);

  const handleMarkerClick = useCallback(
    (eventId, markerEvent) => {
      markerEvent?.originalEvent?.stopPropagation?.();
      const eventData = eventIndex.get(eventId);
      if (!eventData) return;
      focusOnEvent(mapRef, eventData);
      setSelectedEvent(eventData);
      setSelectedLocationKey(getLocationKey(eventData));
      setSelectedLocationIndex(0);
    },
    [eventIndex],
  );

  const handleLogoMarkerClick = useCallback(
    (eventData, markerEvent) => {
      markerEvent?.stopPropagation?.();
      focusOnEvent(mapRef, eventData);
      setSelectedEvent(eventData);
      setSelectedLocationKey(getLocationKey(eventData));
      setSelectedLocationIndex(0);
    },
    [],
  );

  const handleHighlight = useCallback(
    eventData => {
      if (!eventData) return;
      focusOnEvent(mapRef, eventData);
      setSelectedEvent(eventData);
      setSelectedLocationKey(getLocationKey(eventData));
      setSelectedLocationIndex(0);
    },
    [],
  );

  const handleCycleLocation = useCallback(direction => {
    const items = selectedLocationEvents;
    if (!items.length) return;
    setSelectedLocationIndex(index => {
      const nextIndex = (index + direction + items.length) % items.length;
      const nextEvent = items[nextIndex];
      if (nextEvent) {
        focusOnEvent(mapRef, nextEvent);
        setSelectedEvent(nextEvent);
      }
      return nextIndex;
    });
  }, [selectedLocationEvents]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="mt-10 rounded-3xl border border-[#1d2432] bg-[#0f172a] p-6 text-center text-sm font-medium text-white/80">
        Map view unavailable — missing Mapbox access token.
      </div>
    );
  }

  const sortedMapEvents = Array.from(eventsWithLocation)
    .filter(event => withinBounds(event, bounds))
    .sort((a, b) => {
      const aTime = a?.startDate instanceof Date ? a.startDate.getTime() : 0;
      const bTime = b?.startDate instanceof Date ? b.startDate.getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      const aTitle = (a?.title || '').toLowerCase();
      const bTitle = (b?.title || '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    });

  return (
    <section className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="relative h-[520px] overflow-hidden rounded-3xl border border-[#1d2432] bg-[#101722] shadow-2xl shadow-[#101722]/40">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#bf3d35]/15 via-transparent to-[#0b1120]" aria-hidden="true" />
          <MapGL
            {...viewState}
            ref={mapRef}
            onMove={handleMove}
            mapStyle={MAPBOX_STYLE}
            mapboxAccessToken={MAPBOX_TOKEN}
            onLoad={handleMapLoad}
            interactiveLayerIds={[CLUSTER_LAYER.id, CLUSTER_ICON_LAYER.id, UNCLUSTERED_LAYER.id, UNCLUSTERED_EMOJI_LAYER.id]}
            onClick={handleMapClick}
            style={{ width: '100%', height: '100%' }}
          >
            <Source
              id="labs-events"
              type="geojson"
              data={geoJson}
              cluster
              clusterMaxZoom={14}
              clusterRadius={32}
              clusterProperties={CLUSTER_PROPERTIES}
            >
              <Layer {...HEATMAP_LAYER} />
              <Layer {...CLUSTER_HALO_LAYER} />
              <Layer {...CLUSTER_LAYER} />
              <Layer {...CLUSTER_ICON_LAYER} />
              <Layer {...CLUSTER_COUNT_LAYER} />
              <Layer {...UNCLUSTERED_GLOW_LAYER} />
              <Layer {...UNCLUSTERED_LAYER} />
              <Layer {...UNCLUSTERED_EMOJI_LAYER} />
            </Source>
            {logoEvents.map(event => (
              <Marker
                key={`logo-${event.id}`}
                longitude={event.longitude}
                latitude={event.latitude}
                anchor="bottom"
              >
                <button
                  type="button"
                  onClick={markerEvent => handleLogoMarkerClick(event, markerEvent)}
                  className="group relative flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{ width: LOGO_MARKER_SIZE, height: LOGO_MARKER_SIZE }}
                  aria-label={event.venueName ? `${event.venueName} details` : event.title}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-full opacity-60 blur-md transition group-hover:opacity-80"
                    style={{
                      backgroundColor: event.themeColor || LOGO_MARKER_FALLBACK_COLOR,
                    }}
                  />
                  <img
                    src={event.venueImage}
                    alt=""
                    className="h-full w-full rounded-full border-2 border-white object-cover shadow-lg"
                  />
                </button>
              </Marker>
            ))}
            {eventsWithLocation.map(event => {
              const key = `marker-${event.id}`;
              if (logoLocationKeys.has(getLocationKey(event))) {
                return null;
              }
              return (
                <Marker
                  key={key}
                  longitude={event.longitude}
                  latitude={event.latitude}
                  anchor="bottom"
                  onClick={markerEvent => handleMarkerClick(event.id, markerEvent)}
                >
                  <button
                    type="button"
                    className="group relative flex h-10 w-10 -translate-y-2 items-center justify-center rounded-full bg-[#1e293b]/80 text-white shadow-lg shadow-[#0f172a]/60 transition hover:-translate-y-3"
                    aria-label={event.title}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {event.themeEmoji || '✨'}
                    </span>
                  </button>
                </Marker>
              );
            })}
            {selectedEvent ? (
              <Popup
                longitude={selectedEvent.longitude}
                latitude={selectedEvent.latitude}
                anchor="top"
                closeOnClick={false}
                onClose={() => {
                  setSelectedEvent(null);
                  setSelectedLocationKey(null);
                  setSelectedLocationIndex(0);
                }}
                className="max-w-xs"
              >
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#bf3d35]">
                    {selectedEvent.themeEmoji}
                    <span>{selectedEvent.themeLabel || selectedEvent.themeKey}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#29313f] leading-snug">
                    {selectedEvent.title}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {formatDateRange(selectedEvent)}
                    {selectedEvent.start_time && (
                      <>
                        {' '}
                        · {formatTimeLabel(selectedEvent.start_time)}
                      </>
                    )}
                  </p>
                  {selectedEvent.venueName && (
                    <p className="text-sm text-gray-600">@ {selectedEvent.venueName}</p>
                  )}
                  <TagPills tags={selectedEvent.tags} />
                  {selectedEventUrl && (
                    selectedEvent?.detailPath ? (
                      <Link
                        to={selectedEventUrl}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#29313f] hover:text-[#bf3d35]"
                      >
                        View details →
                      </Link>
                    ) : (
                      <a
                        href={selectedEventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#29313f] hover:text-[#bf3d35]"
                      >
                        View details →
                      </a>
                    )
                  )}
                  {selectedLocationEvents.length > 1 && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <button
                        type="button"
                        onClick={() => handleCycleLocation(-1)}
                        className="rounded-full border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-[#bf3d35] hover:text-[#bf3d35]"
                      >
                        Prev
                      </button>
                      <span>
                        {selectedLocationIndex + 1} of {selectedLocationEvents.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCycleLocation(1)}
                        className="rounded-full border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-[#bf3d35] hover:text-[#bf3d35]"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            ) : null}
          </MapGL>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/70 backdrop-blur-sm">
              <span className="text-sm font-semibold text-white">Loading events…</span>
            </div>
          )}
        </div>
      </div>
      <aside className="space-y-4">
        <div className="rounded-3xl border border-[#f3c7b8] bg-white/90 p-6 shadow-lg shadow-[#29313f]/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[#29313f]">
              Events lighting up the map <span className="text-sm text-[#7c889d]">({sortedMapEvents.length})</span>
            </h2>
          </div>
          <ul className="mt-4 space-y-4">
            {sortedMapEvents.map(event => (
              <MapEventRow key={event.id} event={event} onHighlight={handleHighlight} />
            ))}
            {!sortedMapEvents.length && !loading && (
              <li className="rounded-xl border border-dashed border-[#f3c7b8] bg-[#fdf4ef] p-6 text-center text-sm text-[#9ba3b2]">
                No events with map locations match these filters yet—try another tag or day.
              </li>
            )}
          </ul>
        </div>
      </aside>
    </section>
  );
}

export default WeekendGuideMap;
