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
import { Link } from 'react-router-dom';
import { applyMapboxToken } from './config/mapboxToken.js';

const MAPBOX_TOKEN = applyMapboxToken(mapboxgl);
const MAPBOX_STYLE = 'mapbox://styles/mapbox/dark-v11';
const DEFAULT_VIEW = {
  latitude: 39.9526,
  longitude: -75.1652,
  zoom: 11.4,
  bearing: 0,
  pitch: 0,
};

const SOURCE_ID = 'weekend-events';

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

const CLUSTER_THEMES = EVENT_THEMES;

function buildClusterProperties() {
  return CLUSTER_THEMES.reduce((acc, theme) => {
    acc[`${theme.key}Count`] = [
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
  if (!CLUSTER_THEMES.length) {
    return FALLBACK_THEME[valueKey];
  }

  const letArgs = [];
  CLUSTER_THEMES.forEach(theme => {
    letArgs.push(`count_${theme.key}`);
    letArgs.push(['coalesce', ['get', `${theme.key}Count`], 0]);
  });

  letArgs.push('maxCount');
  const [firstTheme, ...restThemes] = CLUSTER_THEMES;
  letArgs.push(
    restThemes.reduce(
      (acc, theme) => ['max', acc, ['var', `count_${theme.key}`]],
      ['var', `count_${firstTheme.key}`],
    ),
  );

  const caseExpression = ['case', ['<=', ['var', 'maxCount'], 0], FALLBACK_THEME[valueKey]];
  CLUSTER_THEMES.forEach(theme => {
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
  id: 'weekend-map-heatmap',
  type: 'heatmap',
  source: SOURCE_ID,
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
  id: 'weekend-map-cluster-halo',
  type: 'circle',
  source: SOURCE_ID,
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
  id: 'weekend-map-clusters',
  type: 'circle',
  source: SOURCE_ID,
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
  id: 'weekend-map-cluster-icon',
  type: 'symbol',
  source: SOURCE_ID,
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
  id: 'weekend-map-cluster-count',
  type: 'symbol',
  source: SOURCE_ID,
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
  id: 'weekend-map-unclustered',
  type: 'circle',
  source: SOURCE_ID,
  filter: ['!', ['has', 'point_count']],
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
  id: 'weekend-map-unclustered-glow',
  type: 'circle',
  source: SOURCE_ID,
  filter: ['!', ['has', 'point_count']],
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
  id: 'weekend-map-unclustered-emoji',
  type: 'symbol',
  source: SOURCE_ID,
  filter: ['all', ['!', ['has', 'point_count']], ['has', 'themeEmoji']],
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

const INTERACTIVE_LAYERS = [
  CLUSTER_LAYER.id,
  CLUSTER_ICON_LAYER.id,
  UNCLUSTERED_LAYER.id,
  UNCLUSTERED_EMOJI_LAYER.id,
];

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  const seen = new Set();
  const normalized = [];
  rawTags.forEach(entry => {
    if (!entry) return;
    const candidate = Array.isArray(entry) ? entry[0] : entry;
    if (!candidate) return;
    const slug = candidate.slug || candidate.name;
    if (!slug) return;
    const key = String(slug).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({
      slug: key,
      name: candidate.name || candidate.slug || slug,
    });
  });
  return normalized;
}

function resolveEventTheme(event, normalizedTags) {
  const tags = Array.isArray(normalizedTags) ? normalizedTags : normalizeTags(event.tags);
  const tagStrings = tags.map(tag => tag.slug);
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

function buildGeoJson(events) {
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
        themeColor: event.themeColor || null,
        themeEmoji: event.themeEmoji || null,
      },
    })),
  };
}

function formatDateRange(event) {
  if (!event?.startDate) return 'Date TBA';
  const startLabel = dayFormatter.format(event.startDate);
  if (event.endDate && event.endDate.getTime() !== event.startDate.getTime()) {
    const endLabel = dayFormatter.format(event.endDate);
    return `${startLabel} – ${endLabel}`;
  }
  return startLabel;
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

function getEventBadgeLabel(event) {
  if (!event) return '';
  const label = SOURCE_LABELS[event.source_table];
  return label || '';
}

function TagPills({ tags }) {
  const normalized = normalizeTags(tags);
  if (!normalized.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {normalized.slice(0, 3).map(tag => (
        <span
          key={tag.slug}
          className="inline-flex items-center rounded-full border border-gray-200 bg-white/90 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-widest text-[#475569]"
        >
          #{tag.name.toLowerCase()}
        </span>
      ))}
      {normalized.length > 3 && (
        <span className="inline-flex items-center rounded-full border border-dashed border-gray-200 bg-white/60 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
          +{normalized.length - 3}
        </span>
      )}
    </div>
  );
}

function WeekendEventsMap({ events = [] }) {
  const mapRef = useRef(null);
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const eventsWithLocation = useMemo(() => {
    return events
      .map(event => {
        if (!event) return null;
        const latitude = toFiniteNumber(event.latitude ?? event.lat ?? event.venues?.latitude);
        const longitude = toFiniteNumber(event.longitude ?? event.lng ?? event.venues?.longitude);
        if (latitude == null || longitude == null) return null;
        const id = event.id != null ? String(event.id) : event.slug != null ? String(event.slug) : null;
        if (!id) return null;
        const tags = normalizeTags(event.tags);
        const theme = resolveEventTheme(event, tags);
        return {
          ...event,
          id,
          latitude,
          longitude,
          tags,
          themeKey: theme.key,
          themeColor: theme.color,
          themeEmoji: theme.emoji,
        };
      })
      .filter(Boolean);
  }, [events]);

  const eventIndex = useMemo(() => {
    const map = new Map();
    eventsWithLocation.forEach(event => {
      map.set(event.id, event);
    });
    return map;
  }, [eventsWithLocation]);

  const geoJson = useMemo(() => buildGeoJson(eventsWithLocation), [eventsWithLocation]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (!eventIndex.has(selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [selectedEventId, eventIndex]);

  useEffect(() => {
    if (!eventsWithLocation.length) return;
    const mapInstance = mapRef.current?.getMap?.();
    if (!mapInstance?.fitBounds) return;
    const [first] = eventsWithLocation;
    const bounds = new mapboxgl.LngLatBounds(
      [first.longitude, first.latitude],
      [first.longitude, first.latitude],
    );
    eventsWithLocation.slice(1).forEach(event => {
      bounds.extend([event.longitude, event.latitude]);
    });
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const padding = width < 640 ? 40 : 72;
    try {
      mapInstance.fitBounds(bounds, {
        padding,
        duration: 650,
        maxZoom: 14,
      });
    } catch (error) {
      // Ignore fit errors caused by zero-width bounds.
    }
  }, [eventsWithLocation]);

  const selectedEvent = selectedEventId ? eventIndex.get(selectedEventId) : null;

  const handleMove = useCallback(event => {
    setViewState(event.viewState);
  }, []);

  const handleMapClick = useCallback(
    event => {
      const feature = event.features?.[0];
      if (!feature) return;
      const mapInstance = mapRef.current?.getMap?.();
      if (!mapInstance) return;

      const clusterId = feature.properties?.cluster_id;
      if (clusterId != null) {
        const source = mapInstance.getSource(SOURCE_ID);
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
      const key = String(eventId);
      const eventData = eventIndex.get(key);
      if (!eventData) return;
      setSelectedEventId(key);
      setViewState(current => ({
        ...current,
        longitude: eventData.longitude,
        latitude: eventData.latitude,
        zoom: Math.max(current.zoom, 13.2),
        transitionDuration: 400,
      }));
    },
    [eventIndex],
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="relative h-[520px] overflow-hidden rounded-3xl border border-[#1d2432] bg-[#101722] shadow-2xl shadow-[#101722]/40">
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a] text-center text-sm font-medium text-white/80">
          Map view unavailable — missing Mapbox access token.
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[520px] overflow-hidden rounded-3xl border border-[#1d2432] bg-[#101722] shadow-2xl shadow-[#101722]/40">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#bf3d35]/15 via-transparent to-[#0b1120]"
        aria-hidden="true"
      />
      <MapGL
        {...viewState}
        ref={mapRef}
        onMove={handleMove}
        mapStyle={MAPBOX_STYLE}
        mapboxAccessToken={MAPBOX_TOKEN}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
      >
        <Source
          id={SOURCE_ID}
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
        {selectedEvent && (
          <Popup
            longitude={selectedEvent.longitude}
            latitude={selectedEvent.latitude}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setSelectedEventId(null)}
            offset={24}
            maxWidth="320px"
            className="rounded-2xl"
          >
            <div className="space-y-2 text-left">
              {(() => {
                const badge = getEventBadgeLabel(selectedEvent);
                if (!badge) return null;
                return (
                  <span className="inline-flex items-center rounded-full bg-[#bf3d35]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#bf3d35]">
                    {badge}
                  </span>
                );
              })()}
              <h3 className="text-lg font-semibold leading-tight text-white">
                {selectedEvent.detailUrl ? (
                  selectedEvent.detailUrl.startsWith('/') ? (
                    <Link to={selectedEvent.detailUrl} className="hover:text-[#facc15]">
                      {selectedEvent.title || selectedEvent.name}
                    </Link>
                  ) : (
                    <a
                      href={selectedEvent.detailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#facc15]"
                    >
                      {selectedEvent.title || selectedEvent.name}
                    </a>
                  )
                ) : (
                  selectedEvent.title || selectedEvent.name
                )}
              </h3>
              <p className="text-sm text-[#e2e8f0]">
                {formatDateRange(selectedEvent)}
                {selectedEvent.start_time && (
                  <>
                    {' '}
                    · {formatTimeLabel(selectedEvent.start_time)}
                  </>
                )}
              </p>
              {(selectedEvent.venueName || selectedEvent.venues?.name || selectedEvent.groupName) && (
                <p className="text-xs uppercase tracking-[0.3em] text-[#94a3b8]">
                  {selectedEvent.venueName || selectedEvent.venues?.name || selectedEvent.groupName}
                </p>
              )}
              <TagPills tags={selectedEvent.tags} />
            </div>
          </Popup>
        )}
      </MapGL>
      {!eventsWithLocation.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/70 text-center text-sm font-medium text-white/80 backdrop-blur-sm">
          No events with map locations match these filters yet — check back soon.
        </div>
      )}
    </div>
  );
}

export default WeekendEventsMap;
