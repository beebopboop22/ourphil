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
import { Helmet } from 'react-helmet';
import { RRule } from 'rrule';
import { supabase } from './supabaseClient.js';
import { applyMapboxToken } from './config/mapboxToken.js';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthProvider.jsx';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import FloatingAddButton from './FloatingAddButton.jsx';
import PostFlyerModal from './PostFlyerModal.jsx';
import LoginPromptModal from './LoginPromptModal.jsx';
import useEventFavorite from './utils/useEventFavorite.js';
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
  all_events: '',
  events: 'Annual Tradition',
  recurring_events: 'Recurring Event',
  group_events: 'Community Event',
  big_board_events: 'Community Pick',
};

const NO_LOCATION_GROUP_LABELS = {
  events: 'Annual Traditions',
  recurring_events: 'Recurring Events',
  group_events: 'Group Events',
  big_board_events: 'Community Picks',
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

const TAG_PILL_STYLES = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

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

function sortEventsByStart(events) {
  return [...events].sort((a, b) => {
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
}

function getEventBadgeLabel(event) {
  if (!event) return '';
  return SOURCE_LABELS[event.source_table] || '';
}

function getNoLocationLabel(event) {
  if (!event) return 'More to map';
  const label = NO_LOCATION_GROUP_LABELS[event.source_table];
  if (label) return label;
  return 'More to map';
}

function TagPills({ tags, limit = 2, variant = 'link', className = '' }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }
  const displayed = tags.slice(0, limit);
  const remaining = tags.length - displayed.length;
  const isPlain = variant === 'plain';
  const baseChipClass = isPlain
    ? [
        'inline-flex items-center rounded-full border border-gray-200 bg-gray-100/80 px-2 py-0.5',
        'text-xs font-semibold text-gray-700',
      ].join(' ')
    : [
        'inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5',
        'text-xs font-semibold text-gray-700 transition hover:border-[#bf3d35] hover:text-[#bf3d35]',
      ].join(' ');
  const moreChipClass = isPlain
    ? [
        'inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5',
        'text-xs font-semibold text-gray-500',
      ].join(' ')
    : [
        'inline-flex items-center rounded-full border border-dashed border-gray-300 px-2 py-0.5',
        'text-xs font-semibold text-gray-500',
      ].join(' ');
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {displayed.map(tag => {
        const label = tag?.name || tag?.slug;
        if (!label) return null;
        const content = <span className="text-xs font-semibold">#{label}</span>;
        if (variant === 'link' && tag?.slug) {
          return (
            <Link
              key={tag.slug}
              to={`/tags/${tag.slug}`}
              className={baseChipClass}
            >
              {content}
            </Link>
          );
        }
        return (
          <span
            key={label}
            className={baseChipClass}
          >
            {content}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className={moreChipClass}>
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

  const badgeLabel = getEventBadgeLabel(event);
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
              <TagPills tags={event?.tags} className="mt-3" />
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

function buildClusterProperties() {
  return CLUSTER_THEMES.reduce((acc, theme) => {
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

function combineDateAndTime(dateValue, timeValue) {
  const baseDate = parseEventDateValue(dateValue);
  if (!baseDate) return null;
  const result = new Date(baseDate);
  if (!timeValue) {
    return result;
  }
  const [hourPart = '0', minutePart = '0', secondPart = '0'] = timeValue.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = Number(secondPart);
  if (Number.isFinite(hour) && Number.isFinite(minute)) {
    result.setHours(hour, minute, Number.isFinite(second) ? second : 0, 0);
  }
  return result;
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
    favoriteId: row.id ? String(row.id) : null,
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
    venueImage: joinedVenue?.image_url || '',
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
    favoriteId: row.id ? String(row.id) : null,
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
    venueImage: '',
    detailPath,
    tags: [],
  };
}

function normalizeRecurringEvent(row, occurrenceDate) {
  if (!row) return null;

  let startDate = parseEventDateValue(row.start_date);
  let endDate = parseEventDateValue(row.end_date || row.start_date) || startDate;
  let occurrenceIso = null;

  if (occurrenceDate instanceof Date && !Number.isNaN(occurrenceDate.getTime())) {
    const zoned = setStartOfDay(new Date(occurrenceDate));
    startDate = zoned;
    endDate = zoned;
    occurrenceIso = toISODate(zoned);
  }

  const fallbackStartIso = row.start_date || null;
  const fallbackEndIso = row.end_date || row.start_date || null;
  const startIso = occurrenceIso || fallbackStartIso;
  const endIso = occurrenceIso || fallbackEndIso;
  const occurrenceReference = occurrenceIso || fallbackStartIso;

  const detailPath = getDetailPathForItem({
    ...row,
    source_table: 'recurring_events',
    isRecurring: true,
    start_date: startIso,
    occurrence_date: occurrenceReference,
    occurrenceDate: occurrenceReference,
  });

  return {
    id: occurrenceIso ? `recurring_events-${row.id}-${occurrenceIso}` : `recurring_events-${row.id}`,
    taggableId: row.id ? String(row.id) : null,
    favoriteId: row.id ? String(row.id) : null,
    source_table: 'recurring_events',
    sourceLabel: SOURCE_LABELS.recurring_events,
    title: row.name || 'Recurring event',
    description: row.description || '',
    image: row.image_url || '',
    link: row.link || '',
    slug: row.slug || null,
    startDate,
    endDate,
    start_date: startIso,
    end_date: endIso,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    venueName: row.address || '',
    venueSlug: row.venue_slug || null,
    venueImage: '',
    detailPath,
    tags: [],
    rrule: row.rrule || '',
    occurrenceDate: occurrenceReference,
  };
}

function expandRecurringEventOccurrences(row, windowStart, windowEnd) {
  if (!row) return [];

  if (!row.rrule) {
    const normalized = normalizeRecurringEvent(row);
    return normalized ? [normalized] : [];
  }

  try {
    const options = RRule.parseString(row.rrule);
    const dtstart = combineDateAndTime(row.start_date, row.start_time);
    if (dtstart) {
      options.dtstart = dtstart;
    }
    if (!options.until && !options.count && row.end_date) {
      const until = combineDateAndTime(row.end_date, row.end_time) || parseEventDateValue(row.end_date);
      if (until) {
        until.setHours(23, 59, 59, 999);
        options.until = until;
      }
    }

    const rule = new RRule(options);
    const occurrences = rule.between(windowStart, windowEnd, true);
    if (!occurrences.length) {
      const fallback = normalizeRecurringEvent(row);
      return fallback ? [fallback] : [];
    }

    return occurrences.map(occurrence => normalizeRecurringEvent(row, occurrence));
  } catch (err) {
    console.error('Recurring event expansion error', err);
    const fallback = normalizeRecurringEvent(row);
    return fallback ? [fallback] : [];
  }
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
    favoriteId: row.id ? String(row.id) : null,
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
    venueImage: '',
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
  const eventLatitude = parseNumber(row.latitude);
  const eventLongitude = parseNumber(row.longitude);
  return {
    id: `big_board_events-${row.id}`,
    taggableId: row.id ? String(row.id) : null,
    favoriteId: row.id ? String(row.id) : null,
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
    latitude: eventLatitude != null ? eventLatitude : null,
    longitude: eventLongitude != null ? eventLongitude : null,
    venueName: row.address || '',
    venueSlug: null,
    venueImage: '',
    detailPath,
    tags: [],
  };
}

function buildGeoJson(features, logoLocationKeys = null) {
  const brandedLocations = logoLocationKeys instanceof Set ? logoLocationKeys : null;
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

function LabsMapPage({ clusterEvents = true, embedded = false, initialDatePreset = 'today' } = {}) {
  const { user } = useContext(AuthContext);
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [datePreset, setDatePreset] = useState(() => initialDatePreset);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [limitToMap, setLimitToMap] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedLocationKey, setSelectedLocationKey] = useState(null);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(0);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const mapRef = useRef(null);
  const clusteringEnabled = clusterEvents !== false;

  useEffect(() => {
    setDatePreset(initialDatePreset);
  }, [initialDatePreset]);

  useEffect(() => {
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

        const bigBoardQuery = supabase
          .from('big_board_events')
          .select(`
            id,
            title,
            description,
            link,
            slug,
            address,
            start_date,
            end_date,
            start_time,
            end_time,
            latitude,
            longitude,
            big_board_posts!big_board_posts_event_id_fkey (
              image_url
            )
          `)
          .order('start_date', { ascending: true })
          .limit(400);

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
              venues:venue_id ( name, slug, latitude, longitude, image_url )
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
          bigBoardQuery,
        ]);

        if (allEventsRes.error) throw allEventsRes.error;
        if (legacyRes.error) throw legacyRes.error;
        if (recurringRes.error) throw recurringRes.error;
        if (groupRes.error) throw groupRes.error;
        if (bigBoardRes.error) throw bigBoardRes.error;

        const normalized = [
          ...(allEventsRes.data || []).map(normalizeAllEvent).filter(Boolean),
          ...(legacyRes.data || []).map(normalizeLegacyEvent).filter(Boolean),
          ...(recurringRes.data || [])
            .flatMap(row => expandRecurringEventOccurrences(row, today, horizon))
            .filter(Boolean),
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
          const themed = bounded.map(event => {
            const theme = resolveEventTheme(event);
            return {
              ...event,
              themeKey: theme.key,
              themeLabel: theme.label,
              themeEmoji: theme.emoji,
              themeColor: theme.color,
            };
          });
          setEvents(themed);
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
  }, []);

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
    for (const [key, group] of groups.entries()) {
      groups.set(key, sortEventsByStart(group));
    }
    return groups;
  }, [eventsWithLocation]);

  const { logoEvents, logoLocationKeys } = useMemo(() => {
    const branded = [];
    const keys = new Set();
    for (const [key, eventsAtLocation] of eventsByLocation.entries()) {
      const brandedEvent = eventsAtLocation.find(hasVenueLogo);
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

  const eventIndex = useMemo(() => {
    const map = new Map();
    eventsWithLocation.forEach(event => {
      map.set(event.id, event);
    });
    return map;
  }, [eventsWithLocation]);

  const selectedLocationEvents = useMemo(() => {
    if (!selectedLocationKey) return [];
    const eventsAtLocation = eventsByLocation.get(selectedLocationKey);
    return eventsAtLocation ? eventsAtLocation : [];
  }, [eventsByLocation, selectedLocationKey]);

  const selectEvent = useCallback(
    event => {
      if (!event) {
        setSelectedEvent(null);
        setSelectedLocationKey(null);
        setSelectedLocationIndex(0);
        return;
      }
      setSelectedEvent(event);
      const key = getLocationKey(event);
      setSelectedLocationKey(key);
      if (key) {
        const eventsAtLocation = eventsByLocation.get(key) || [event];
        const position = eventsAtLocation.findIndex(item => item.id === event.id);
        setSelectedLocationIndex(position >= 0 ? position : 0);
      } else {
        setSelectedLocationIndex(0);
      }
    },
    [eventsByLocation],
  );

  useEffect(() => {
    if (!selectedEvent) {
      if (selectedLocationKey !== null) {
        setSelectedLocationKey(null);
      }
      if (selectedLocationIndex !== 0) {
        setSelectedLocationIndex(0);
      }
      return;
    }
    const key = getLocationKey(selectedEvent);
    if (key !== selectedLocationKey) {
      setSelectedLocationKey(key);
    }
    if (!key) {
      if (selectedLocationIndex !== 0) {
        setSelectedLocationIndex(0);
      }
      return;
    }
    const eventsAtLocation = eventsByLocation.get(key) || [];
    if (!eventsAtLocation.length) {
      setSelectedEvent(null);
      setSelectedLocationKey(null);
      setSelectedLocationIndex(0);
      return;
    }
    const eventPosition = eventsAtLocation.findIndex(item => item.id === selectedEvent.id);
    if (eventPosition === -1) {
      setSelectedEvent(eventsAtLocation[0]);
      setSelectedLocationIndex(0);
      return;
    }
    if (eventPosition !== selectedLocationIndex) {
      setSelectedLocationIndex(eventPosition);
    }
  }, [selectedEvent, eventsByLocation, selectedLocationKey, selectedLocationIndex]);

  const handleCycleSelectedEvent = useCallback(
    direction => {
      if (!selectedLocationEvents.length) return;
      const total = selectedLocationEvents.length;
      const delta = direction === 'next' ? 1 : -1;
      const nextIndex = (selectedLocationIndex + delta + total) % total;
      const nextEvent = selectedLocationEvents[nextIndex];
      if (nextEvent) {
        selectEvent(nextEvent);
      }
    },
    [selectedLocationEvents, selectedLocationIndex, selectEvent],
  );

  useEffect(() => {
    if (selectedEvent && !eventIndex.has(selectedEvent.id)) {
      selectEvent(null);
    }
  }, [eventIndex, selectedEvent, selectEvent]);

  const selectedEventUrl = selectedEvent?.detailPath || selectedEvent?.link || null;
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
      const label = getNoLocationLabel(event);
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

  const focusEventOnMap = useCallback(
    event => {
      if (!event) return;
      selectEvent(event);
      if (event.latitude == null || event.longitude == null) {
        return;
      }
      setViewState(current => ({
        ...current,
        longitude: event.longitude,
        latitude: event.latitude,
        zoom: Math.max(current.zoom, 13),
        transitionDuration: 400,
      }));
    },
    [selectEvent, setViewState],
  );

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
    setDatePreset(initialDatePreset);
    setCustomStart('');
    setCustomEnd('');
  }, [initialDatePreset]);

  const handleOpenEventModal = useCallback(() => {
    if (user) {
      setShowFlyerModal(true);
    } else {
      setShowLoginPrompt(true);
    }
  }, [user, setShowFlyerModal, setShowLoginPrompt]);

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

      if (clusteringEnabled) {
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
      }

      const eventId = feature.properties?.eventId;
      if (!eventId) return;
      const selected = eventIndex.get(eventId);
      if (selected) {
        selectEvent(selected);
      }
    },
    [clusteringEnabled, eventIndex, selectEvent],
  );

  const handleLogoMarkerClick = useCallback((eventData, markerEvent) => {
    markerEvent?.originalEvent?.stopPropagation?.();
    selectEvent(eventData);
  }, [selectEvent]);

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

  const mapSection = (
    <>
      <section
        className={`mx-auto ${embedded ? 'mt-0' : 'mt-10'} max-w-7xl px-6`}
        id={embedded ? undefined : 'map'}
      >
        <div className="rounded-3xl border border-[#f3c7b8] bg-white/80 p-6 shadow-xl shadow-[#29313f]/5 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition ${
                      datePreset === option.id
                        ? 'bg-[#bf3d35] text-white shadow-lg shadow-[#bf3d35]/30'
                        : 'bg-[#f7e5de] text-[#29313f] hover:bg-[#f2cfc3]'
                    }`}
                    onClick={() => setDatePreset(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {datePreset === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-[#4a5568]">
                  <label className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-xs text-[#bf3d35]">Start</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={event => setCustomStart(event.target.value)}
                      className="rounded-xl border border-[#f3c7b8] bg-white px-3 py-2 text-sm text-[#29313f] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#bf3d35]/30"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-xs text-[#bf3d35]">End</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={event => setCustomEnd(event.target.value)}
                      className="rounded-xl border border-[#f3c7b8] bg-white px-3 py-2 text-sm text-[#29313f] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#bf3d35]/30"
                    />
                  </label>
                </div>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#bf3d35]/80">
                Active range · {activeRangeLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Search events or venues"
                  className="w-72 rounded-full border border-[#f3c7b8] bg-white px-5 py-3 text-sm text-[#29313f] placeholder:text-[#9ba3b2] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#29313f]/20"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#9ba3b2]">⌕</span>
              </div>
              <button
                type="button"
                onClick={handleClearFilters}
                className="rounded-full border border-[#29313f]/10 bg-[#2b333f] px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#242a33]"
              >
                Clear filters
              </button>
            </div>
          </div>

          {tagOptions.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#29313f]/60">Tag filters</p>
              <div className="flex flex-wrap gap-2">
                {tagOptions.slice(0, 24).map((tag, index) => {
                  const baseStyle = TAG_PILL_STYLES[index % TAG_PILL_STYLES.length];
                  const isSelected = selectedTags.includes(tag.slug);
                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => handleToggleTag(tag.slug)}
                      className={`${baseStyle} flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold transition hover:opacity-85 ${
                        isSelected ? 'ring-2 ring-offset-2 ring-[#29313f]' : 'ring-1 ring-transparent'
                      }`}
                      aria-pressed={isSelected}
                      title={`${tag.count} events tagged #${tag.name?.toLowerCase() || tag.slug}`}
                    >
                      #{(tag.name || tag.slug).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[#4a5568]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={limitToMap}
                onChange={event => setLimitToMap(event.target.checked)}
                className="h-4 w-4 rounded border-[#f3c7b8] text-[#bf3d35] focus:ring-[#bf3d35]"
              />
              Limit to current map view
            </label>
            <button
              type="button"
              onClick={handleLocateMe}
              className="inline-flex items-center gap-2 rounded-full border border-[#bf3d35]/40 bg-white px-4 py-2 text-sm font-semibold text-[#bf3d35] transition hover:border-[#bf3d35] hover:bg-[#bf3d35]/10"
            >
              Near me
            </button>
            {geoError && <span className="text-xs text-rose-500">{geoError}</span>}
            {!limitToMap && (
              <span className="basis-full text-xs text-[#9ba3b2]">
                Keep this toggled off to let the map surface surprises beyond the current frame.
              </span>
            )}
          </div>
        </div>
      </section>

      <section
        className={`mx-auto ${embedded ? 'mt-8' : 'mt-10'} grid max-w-7xl gap-6 px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`}
      >
        <div className="space-y-6">
          <div className="relative h-[520px] overflow-hidden rounded-3xl border border-[#1d2432] bg-[#101722] shadow-2xl shadow-[#101722]/40">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#bf3d35]/15 via-transparent to-[#0b1120]" aria-hidden="true" />
            {MAPBOX_TOKEN ? (
              <>
                <MapGL
                  {...viewState}
                  ref={mapRef}
                  onMove={handleMove}
                  mapStyle={MAPBOX_STYLE}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  onLoad={handleMapLoad}
                  interactiveLayerIds={
                    clusteringEnabled
                      ? [
                          CLUSTER_LAYER.id,
                          CLUSTER_ICON_LAYER.id,
                          UNCLUSTERED_LAYER.id,
                          UNCLUSTERED_EMOJI_LAYER.id,
                        ]
                      : [UNCLUSTERED_LAYER.id, UNCLUSTERED_EMOJI_LAYER.id]
                  }
                  onClick={handleMapClick}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Source
                    id="labs-events"
                    type="geojson"
                    data={geoJson}
                    {...(clusteringEnabled
                      ? {
                          cluster: true,
                          clusterMaxZoom: 14,
                          clusterRadius: 32,
                          clusterProperties: CLUSTER_PROPERTIES,
                        }
                      : { cluster: false })}
                  >
                    <Layer {...HEATMAP_LAYER} />
                    {clusteringEnabled && <Layer {...CLUSTER_HALO_LAYER} />}
                    {clusteringEnabled && <Layer {...CLUSTER_LAYER} />}
                    {clusteringEnabled && <Layer {...CLUSTER_ICON_LAYER} />}
                    {clusteringEnabled && <Layer {...CLUSTER_COUNT_LAYER} />}
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
                        className="group relative flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label={event.venueName ? `${event.venueName} details` : event.title}
                        style={{ width: LOGO_MARKER_SIZE, height: LOGO_MARKER_SIZE }}
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
                          alt={event.venueName ? `${event.venueName} logo` : `${event.title} logo`}
                          className="relative h-full w-full rounded-full border-2 border-white bg-white object-cover shadow-lg"
                          loading="lazy"
                        />
                      </button>
                    </Marker>
                  ))}
                  {selectedEvent && selectedEvent.latitude != null && selectedEvent.longitude != null && (
                    <Popup
                      longitude={selectedEvent.longitude}
                      latitude={selectedEvent.latitude}
                      anchor="top"
                      closeOnClick={false}
                      onClose={() => selectEvent(null)}
                      maxWidth="320px"
                      className="labs-map-popup"
                    >
                      <div className="space-y-3 text-gray-900">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            {getEventBadgeLabel(selectedEvent) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#d9e9ea] px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-[#004C55]">
                                {getEventBadgeLabel(selectedEvent)}
                              </span>
                            ) : null}
                            <h3 className="text-lg font-semibold leading-snug text-[#29313f]">
                              {selectedEventUrl ? (
                                selectedEvent?.detailPath ? (
                                  <Link
                                    to={selectedEventUrl}
                                    className="transition hover:text-[#bf3d35]"
                                  >
                                    {selectedEvent.title}
                                  </Link>
                                ) : (
                                  <a
                                    href={selectedEventUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="transition hover:text-[#bf3d35]"
                                  >
                                    {selectedEvent.title}
                                  </a>
                                )
                              ) : (
                                selectedEvent.title
                              )}
                            </h3>
                            {selectedEvent.themeEmoji && selectedEvent.themeLabel && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#29313f]">
                                <span>{selectedEvent.themeEmoji}</span>
                                <span>{selectedEvent.themeLabel}</span>
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => selectEvent(null)}
                            className="-mr-1 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-2xl font-light text-gray-500 shadow-sm ring-1 ring-inset ring-white/70 transition hover:bg-white hover:text-[#29313f]"
                            aria-label="Close event details"
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </div>
                        {selectedLocationEvents.length > 1 && (
                          <div className="flex items-center justify-between gap-2 rounded-xl bg-[#f1f5f9] px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#475569]">
                            <button
                              type="button"
                              onClick={() => handleCycleSelectedEvent('prev')}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-base text-[#29313f] shadow-sm transition hover:bg-[#e2e8f0]"
                              aria-label="Show previous event at this venue"
                            >
                              ‹
                            </button>
                            <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-widest text-[#475569]">
                              {selectedLocationIndex + 1} of {selectedLocationEvents.length} events here
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCycleSelectedEvent('next')}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-base text-[#29313f] shadow-sm transition hover:bg-[#e2e8f0]"
                              aria-label="Show next event at this venue"
                            >
                              ›
                            </button>
                          </div>
                        )}
                        <p className="text-sm text-gray-600">
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
                        <TagPills tags={selectedEvent.tags} variant="plain" />
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
                      </div>
                    </Popup>
                  )}
                </MapGL>
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-[#0f172a] text-center text-sm font-medium text-white/80">
                Map view unavailable — missing Mapbox access token.
              </div>
            )}
            {loading && MAPBOX_TOKEN && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/70 backdrop-blur-sm">
                <span className="text-sm font-semibold text-white">Loading events…</span>
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-[#f3c7b8] bg-white/90 p-6 shadow-lg shadow-[#29313f]/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#29313f]">
                Events lighting up the map <span className="text-sm text-[#7c889d]">({sortedMapEvents.length})</span>
              </h2>
              {!limitToMap && bounds && (
                <span className="text-xs font-semibold uppercase tracking-wide text-[#9ba3b2]">Showing the full Philly radius</span>
              )}
            </div>
            <ul className="mt-4 space-y-4">
              {sortedMapEvents.map(event => (
                <MapEventRow key={event.id} event={event} onHighlight={focusEventOnMap} />
              ))}
              {!sortedMapEvents.length && !loading && (
                <li className="rounded-xl border border-dashed border-[#f3c7b8] bg-[#fdf4ef] p-6 text-center text-sm text-[#9ba3b2]">
                  No events match these filters yet—try widening the dates or removing a tag.
                </li>
              )}
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[#d9e0ec] bg-white/90 p-6 shadow-lg shadow-[#29313f]/10">
            <h2 className="text-xl font-semibold text-[#29313f]">
              Still gathering addresses <span className="text-sm text-[#7c889d]">({eventsWithoutLocation.length})</span>
            </h2>
            <p className="mt-1 text-sm text-[#4a5568]">
              These events were submitted without an exact venue. Add a location and they'll move onto the map within minutes.
            </p>
            <div className="mt-4 space-y-6">
              {groupedNoLocation.map(([label, items]) => (
                <div key={label} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-[#9ba3b2]">{label}</h3>
                  <ul className="space-y-3">
                    {items.map(item => (
                      <li key={item.id} className="rounded-xl border border-dashed border-[#d9e0ec] bg-[#f5f7fb] p-3">
                        <p className="text-sm font-semibold text-[#29313f]">{item.title}</p>
                        <p className="text-xs text-[#4a5568]">{formatDateRange(item)}</p>
                        {(item.detailPath || item.link) && (
                          <a
                            href={item.detailPath || item.link}
                            className="mt-1 inline-flex text-xs font-semibold text-[#bf3d35] hover:text-[#a2322c]"
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
                <p className="rounded-xl border border-dashed border-[#d9e0ec] bg-[#f5f7fb] p-4 text-sm text-[#4a5568]">
                  Everything in this range has a map location. 🎉
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-700 shadow">
              <p className="font-semibold">We hit a snag loading events.</p>
              <p className="mt-1 opacity-80">{error.message || 'Unknown error'}</p>
            </div>
          )}
        </aside>
      </section>
    </>
  );

  if (embedded) {
    return <div className="w-full">{mapSection}</div>;
  }

  return (
    <div className="min-h-screen bg-[#fdf7f2] text-[#29313f]">
      <Helmet>
        <title>Philadelphia Event Map | Our Philly</title>
        <meta
          name="description"
          content="Track festivals, neighborhood happenings, and community events in Philadelphia on a live map curated by Our Philly."
        />
        <link rel="canonical" href="https://www.ourphilly.org/map" />
      </Helmet>
      <Navbar />
      <main className="pt-28 pb-16 lg:pt-32">
        <section className="relative">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#f5d4cb]/60 via-transparent to-transparent" aria-hidden="true" />
          <div className="mx-auto max-w-7xl px-6">
            <div className="relative overflow-hidden rounded-3xl border border-[#f4c9bc] bg-white/70 p-10 shadow-xl shadow-[#bf3d35]/10 backdrop-blur-md lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#bf3d35]">Community Event Map</p>
                <h1 className="mt-4 text-4xl font-black leading-tight text-[#29313f] sm:text-5xl lg:text-6xl">
                  See what&apos;s happening across Philly
                </h1>
                <p className="mt-4 text-base leading-relaxed text-[#4a5568] sm:text-lg">
                  Browse festivals, block parties, and neighborhood meetups shared by organizers across the city. Add yours to help more neighbors discover it.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleOpenEventModal}
                    className="inline-flex items-center gap-2 rounded-full bg-[#bf3d35] px-6 py-3 text-sm font-semibold uppercase tracking-widest text-white shadow-lg shadow-[#bf3d35]/30 transition hover:-translate-y-0.5 hover:bg-[#a2322c]"
                  >
                    Add your event to the map
                  </button>
                  <a
                    href="#map"
                    className="inline-flex items-center gap-2 rounded-full border border-[#29313f]/20 bg-white/80 px-6 py-3 text-sm font-semibold text-[#29313f] transition hover:border-[#29313f] hover:bg-[#29313f]/10"
                  >
                    Jump to map <span aria-hidden="true">↓</span>
                  </a>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[#4a5568]">
                  <img
                    src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhillyCircle(web)%20(1).png"
                    alt="Our Philly skyline logo"
                    className="h-12 w-12 rounded-full border border-[#29313f]/10 bg-white object-cover"
                  />
                  <span>Built by neighbors. Updated daily with community submissions.</span>
                </div>
              </div>
              <div className="relative mt-10 flex items-center justify-center lg:mt-0">
                <div className="absolute inset-0 bg-gradient-to-br from-[#fbe0d6] via-transparent to-[#d7e4f7] blur-3xl" aria-hidden="true" />
                <div className="relative flex flex-col items-center gap-6">
                  <img
                    src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png"
                    alt="Illustration of the Our Philly heart"
                    className="h-52 w-52 object-contain drop-shadow-xl"
                  />
                  <div className="rounded-2xl border border-[#29313f]/10 bg-[#2b333f] px-6 py-4 text-center shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f0e5d0]">Our Philly</p>
                    <p className="mt-2 text-lg font-semibold text-white">Neighborhood spotlights</p>
                    <p className="mt-1 text-sm text-[#f0e5d0]/80">Events on the map are featured in our guides, newsletters, and Instagram.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl px-6">
          <div className="flex items-start gap-3 rounded-2xl border border-[#f3c7b8] bg-white/80 p-5 text-sm text-[#4a5568] shadow">
            <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#bf3d35]/10 text-lg text-[#bf3d35]">ℹ️</span>
            <p>
              Not every submission includes an address yet. Events without map pins appear in the “Still gathering addresses” list below—organizers can add a venue to get featured on the map instantly.
            </p>
          </div>
        </section>

        {mapSection}

      </main>
      <FloatingAddButton onClick={handleOpenEventModal} />
      <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} />
      {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
      <Footer />
    </div>
  );
}

export default LabsMapPage;
