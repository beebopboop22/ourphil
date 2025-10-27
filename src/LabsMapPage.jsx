import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Helmet } from 'react-helmet';
import { RRule } from 'rrule';
import { supabase } from './supabaseClient.js';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthProvider.jsx';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import FloatingAddButton from './FloatingAddButton.jsx';
import PostFlyerModal from './PostFlyerModal.jsx';
import LoginPromptModal from './LoginPromptModal.jsx';
import { MapPin } from 'lucide-react';
import useEventFavorite from './utils/useEventFavorite.js';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import MapEventDetailPanel from './components/MapEventDetailPanel.jsx';
import {
  getWeekendWindow,
  overlaps,
  parseEventDateValue,
  setEndOfDay,
  setStartOfDay,
} from './utils/dateUtils.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
const HORIZON_DAYS = 60;

const SOURCE_LABELS = {
  all_events: '',
  events: 'Annual Tradition',
  recurring_events: 'Recurring Event',
  group_events: 'Community Event',
  big_board_events: 'Community Pick',
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

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
});


function getEventBadgeLabel(event) {
  if (!event) return '';
  return SOURCE_LABELS[event.source_table] || '';
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

function buildTimingLabelForEvent(event) {
  if (!event?.startDate) {
    return 'Upcoming';
  }
  const startDay = setStartOfDay(new Date(event.startDate));
  const endDay = event?.endDate ? setStartOfDay(new Date(event.endDate)) : startDay;
  if (endDay.getTime() !== startDay.getTime()) {
    return `Runs thru ${monthDayFormatter.format(endDay)}`;
  }
  const today = setStartOfDay(new Date());
  const diffDays = Math.round((startDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = event?.start_time ? ` · ${formatTimeLabel(event.start_time)}` : '';
  if (diffDays === 0) {
    return `Today${timeLabel}`;
  }
  if (diffDays === 1) {
    return `Tomorrow${timeLabel}`;
  }
  return `${weekdayFormatter.format(startDay)} ${monthDayFormatter.format(startDay)}${timeLabel}`;
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

  const timingLabel = buildTimingLabelForEvent(event);
  const dateRangeText = formatDateRange(event);
  const description = event?.description ? event.description.trim() : '';
  const areaLabel = event?.areaName || '';
  const venueLabel = event?.venueName || event?.address || '';
  const badgeLabel = getEventBadgeLabel(event);
  const badgeClasses =
    event?.source_table === 'events'
      ? 'bg-yellow-100 text-yellow-800'
      : event?.source_table === 'recurring_events'
      ? 'bg-blue-100 text-blue-800'
      : event?.source_table === 'group_events'
      ? 'bg-emerald-100 text-emerald-800'
      : event?.source_table === 'big_board_events'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-slate-100 text-slate-700';

  const seenTags = new Set();
  const uniqueTags = (event?.tags || []).reduce((acc, tag) => {
    const slug = tag?.slug;
    if (!slug || seenTags.has(slug)) {
      return acc;
    }
    seenTags.add(slug);
    acc.push(tag);
    return acc;
  }, []);
  const shownTags = uniqueTags.slice(0, 3);
  const extraCount = Math.max(0, uniqueTags.length - shownTags.length);

  const containerClass = `group block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
    isFavorite ? 'ring-2 ring-indigo-600' : ''
  }`;

  return (
    <li>
      <Wrapper
        {...wrapperProps}
        onMouseEnter={handleHighlight}
        onFocus={handleHighlight}
        onClick={handleHighlight}
        className={containerClass}
      >
        <div className="flex flex-col gap-4 p-4 sm:p-6 sm:flex-row sm:items-stretch">
          <div className="w-full flex-shrink-0 sm:w-48">
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
              {event?.image ? (
                <img src={event.image} alt={event?.title || ''} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold">
              {timingLabel && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 uppercase tracking-wide text-indigo-800">
                  {timingLabel}
                </span>
              )}
              {areaLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  {areaLabel}
                </span>
              )}
              {badgeLabel && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 uppercase tracking-wide ${badgeClasses}`}>
                  {badgeLabel}
                </span>
              )}
              {isFavorite && event?.favoriteId && event?.source_table && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 uppercase tracking-wide text-white">
                  In the Plans
                </span>
              )}
            </div>
            <div>
              <h3 className="break-words text-xl font-semibold text-[#28313e]">{event?.title}</h3>
              {dateRangeText && <p className="mt-1 text-sm text-gray-500">{dateRangeText}</p>}
              {description && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{description}</p>}
              {venueLabel && <p className="mt-1 text-sm text-gray-500">{venueLabel}</p>}
            </div>
            {shownTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {shownTags.map((tag, index) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    onClick={e => e.stopPropagation()}
                    className={`${TAG_PILL_STYLES[index % TAG_PILL_STYLES.length]} rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                  >
                    #{tag.name || tag.slug}
                  </Link>
                ))}
                {extraCount > 0 && <span className="text-xs text-gray-500">+{extraCount} more</span>}
              </div>
            )}
          </div>
          {event?.favoriteId && event?.source_table ? (
            <div className="flex flex-col items-stretch justify-center gap-2 sm:w-44">
              <button
                type="button"
                onClick={handleAddToPlans}
                disabled={loading}
                className={`w-full rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  isFavorite
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
            </div>
          ) : null}
        </div>
      </Wrapper>
    </li>
  );
}

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

function formatMapTime(time) {
  if (!time) return '';
  const [hourPart = '0', minutePart = '00'] = time.split(':');
  let hours = Number(hourPart);
  if (!Number.isFinite(hours)) return '';
  const minutes = minutePart.slice(0, 2);
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function getSourceBadge(sourceTable) {
  switch (sourceTable) {
    case 'events':
      return 'Tradition';
    case 'big_board_events':
      return 'Submission';
    case 'group_events':
      return 'Group Event';
    case 'recurring_events':
      return 'Recurring';
    case 'sports':
      return 'Sports';
    case 'all_events':
    default:
      return 'Listed Event';
  }
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
  const venueAreaId = joinedVenue?.area_id != null ? joinedVenue.area_id : null;
  const areaId = row.area_id != null ? row.area_id : venueAreaId;
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
    area_id: areaId != null ? areaId : null,
    venue_area_id: venueAreaId != null ? venueAreaId : null,
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
  const areaId = row.area_id != null ? row.area_id : null;
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
    area_id: areaId,
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
  const areaId = row.area_id != null ? row.area_id : null;

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
    area_id: areaId,
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
  const areaId = row.area_id != null ? row.area_id : null;
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
    area_id: areaId,
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
  const areaId = row.area_id != null ? row.area_id : null;
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
    area_id: areaId,
  };
}

function LabsMapPage() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [datePreset, setDatePreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedMapEventId, setSelectedMapEventId] = useState(null);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

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
            area_id,
            big_board_posts!big_board_posts_event_id_fkey (
              image_url
            )
          `)
          .order('start_date', { ascending: true })
          .limit(400);

        const areasPromise = supabase.from('areas').select('id,name');

        const [areasRes, allEventsRes, legacyRes, recurringRes, groupRes, bigBoardRes] = await Promise.all([
          areasPromise,
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
              area_id,
              venue_id,
              venues:venue_id ( name, slug, latitude, longitude, image_url, area_id )
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
              longitude,
              area_id
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
              longitude,
              area_id
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
              area_id,
              groups:group_id ( Name, slug )
            `)
            .gte('start_date', startIso)
            .lte('start_date', endIso)
            .limit(400),
          bigBoardQuery,
        ]);

        if (areasRes.error) throw areasRes.error;
        if (allEventsRes.error) throw allEventsRes.error;
        if (legacyRes.error) throw legacyRes.error;
        if (recurringRes.error) throw recurringRes.error;
        if (groupRes.error) throw groupRes.error;
        if (bigBoardRes.error) throw bigBoardRes.error;

        const areaEntries = (areasRes.data || [])
          .filter(area => area && area.id != null && area.name)
          .map(area => [String(area.id), area.name]);
        const nextAreaLookup = Object.fromEntries(areaEntries);

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
          const withAreas = bounded.map(event => {
            const eventAreaId = event.area_id != null ? String(event.area_id) : null;
            const venueAreaId = event.venue_area_id != null ? String(event.venue_area_id) : null;
            const primaryAreaId = eventAreaId || venueAreaId;
            const areaName = primaryAreaId
              ? nextAreaLookup[primaryAreaId] || event.areaName || null
              : event.areaName || null;
            return {
              ...event,
              area_id: primaryAreaId,
              venue_area_id: venueAreaId,
              areaName,
            };
          });

          const themed = withAreas.map(event => {
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
      return true;
    });
  }, [events, rangeStart, rangeEnd, searchValue, selectedTags]);

  const eventsWithLocation = filteredEvents.filter(
    event => event.latitude != null && event.longitude != null,
  );

  const mapEvents = useMemo(() => {
    return eventsWithLocation
      .map(event => {
        if (event.latitude == null || event.longitude == null) {
          return null;
        }
        const seenTags = new Set();
        const mapTags = [];
        (event.tags || []).forEach(tag => {
          if (!tag) return;
          const slug = tag.slug || tag.slug_id || null;
          if (!slug || seenTags.has(slug)) return;
          seenTags.add(slug);
          mapTags.push({ slug, name: tag.name || tag.tag_name || slug });
        });
        const sourceBadge = getSourceBadge(event.source_table);
        const timeLabel =
          event.timeLabel ||
          (event.start_time && event.end_time
            ? `${formatMapTime(event.start_time)} – ${formatMapTime(event.end_time)}`
            : event.start_time
            ? formatMapTime(event.start_time)
            : null);
        const imageUrl = event.image || event.image_url || event.venueImage || '';

        return {
          id: event.id,
          title: event.title,
          description: event.description || '',
          imageUrl,
          startDate: event.startDate,
          endDate: event.endDate,
          start_time: event.start_time,
          end_time: event.end_time,
          timeLabel,
          detailPath: event.detailPath || null,
          areaName: event.areaName || null,
          area: event.area || null,
          address: event.address || null,
          venueName: event.venueName || null,
          latitude: event.latitude,
          longitude: event.longitude,
          mapTags,
          badges: sourceBadge ? [sourceBadge] : [],
          source_table: event.source_table || null,
          favoriteId: event.favoriteId || null,
          externalUrl: event.externalUrl || event.link || null,
          source: event.source || null,
        };
      })
      .filter(Boolean);
  }, [eventsWithLocation]);

  useEffect(() => {
    if (!selectedMapEventId) return;
    const exists = mapEvents.some(event => event.id === selectedMapEventId);
    if (!exists) {
      setSelectedMapEventId(null);
    }
  }, [mapEvents, selectedMapEventId]);

  const selectedMapEvent = useMemo(
    () => mapEvents.find(event => event.id === selectedMapEventId) || null,
    [mapEvents, selectedMapEventId],
  );

  const handleMapEventSelect = useCallback(event => {
    setSelectedMapEventId(event?.id || null);
  }, []);

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

  const sortedMapEvents = useMemo(() => {
    return [...eventsWithLocation].sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return a.startDate - b.startDate;
    });
  }, [eventsWithLocation]);

  const focusEventOnMap = useCallback(event => {
    if (!event) {
      setSelectedMapEventId(null);
      return;
    }
    setSelectedMapEventId(event.id || null);
  }, []);

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
    setSelectedMapEventId(null);
  }, []);

  const handleOpenEventModal = useCallback(() => {
    if (user) {
      setShowFlyerModal(true);
    } else {
      setShowLoginPrompt(true);
    }
  }, [user, setShowFlyerModal, setShowLoginPrompt]);

  const activeRangeLabel = useMemo(() => {
    if (!rangeStart || !rangeEnd) return '';
    const start = dayFormatter.format(rangeStart);
    const end = dayFormatter.format(rangeEnd);
    return start === end ? start : `${start} – ${end}`;
  }, [rangeStart, rangeEnd]);

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
        {mapEvents.length > 0 && (
          <section id="map" className="mx-auto max-w-7xl px-6 pt-8">
            <div className="relative">
              <MonthlyEventsMap
                events={mapEvents}
                height={560}
                variant="panel"
                onSelectEvent={handleMapEventSelect}
                selectedEventId={selectedMapEventId}
              />

              {selectedMapEvent && (
                <div className="absolute inset-y-0 left-0 hidden lg:flex lg:items-stretch lg:justify-start lg:p-4 lg:pl-6 xl:pl-8 z-20">
                  <div className="pointer-events-auto flex h-full w-full max-w-sm">
                    <MapEventDetailPanel
                      event={selectedMapEvent}
                      onClose={() => setSelectedMapEventId(null)}
                      variant="desktop"
                    />
                  </div>
                </div>
              )}

              <div
                className={`absolute inset-x-4 bottom-4 z-20 flex justify-center lg:hidden ${selectedMapEvent ? 'pointer-events-auto' : 'pointer-events-none'}`}
              >
                <div
                  className={`pointer-events-auto w-full max-w-md transform-gpu transition-all duration-300 ${selectedMapEvent ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
                >
                  {selectedMapEvent && (
                    <MapEventDetailPanel
                      event={selectedMapEvent}
                      onClose={() => setSelectedMapEventId(null)}
                      variant="mobile"
                    />
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-6 pt-8">
          <div className="rounded-3xl border border-[#f3c7b8] bg-white/90 p-6 shadow-xl shadow-[#29313f]/10">
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
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pt-10">
          <div className="rounded-3xl border border-[#f3c7b8] bg-white/90 p-6 shadow-xl shadow-[#29313f]/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#29313f]">
                Events lighting up the map <span className="text-sm text-[#7c889d]">({sortedMapEvents.length})</span>
              </h2>
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
            {error && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-700 shadow">
                <p className="font-semibold">We hit a snag loading events.</p>
                <p className="mt-1 opacity-80">{error.message || 'Unknown error'}</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <FloatingAddButton onClick={handleOpenEventModal} />
      <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} />
      {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
      <Footer />
    </div>
  );
}

export default LabsMapPage;
