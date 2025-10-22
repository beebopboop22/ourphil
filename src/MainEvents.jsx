import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { RRule } from 'rrule';
import {
  ArrowRight,
  CalendarRange,
  Sparkles,
  UtensilsCrossed,
  Music,
  Palette,
  HeartPulse,
  Users,
  ArrowUpRight,
  MapPin,
} from 'lucide-react';

import Navbar from './Navbar';
import Footer from './Footer';
import RecentActivity from './RecentActivity';
import FloatingAddButton from './FloatingAddButton';
import PostFlyerModal from './PostFlyerModal';
import TopQuickLinks from './TopQuickLinks';
import { supabase } from './supabaseClient';
import { getDetailPathForItem } from './utils/eventDetailPaths';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import { COMMUNITY_REGIONS } from './communityIndexData.js';
import {
  PHILLY_TIME_ZONE,
  getWeekendWindow,
  setStartOfDay,
  setEndOfDay,
  getZonedDate,
  formatMonthDay,
  formatLongWeekday,
  formatMonthName,
  formatMonthYear,
  indexToMonthSlug,
  parseISODate,
  parseEventDateValue,
} from './utils/dateUtils';
import { fetchWeekendEventCount } from './utils/weekendEventCount';

const SECTION_CONFIGS = [
  {
    key: 'today',
    headline: 'Events Today in Philadelphia',
    cta: 'View all events for today',
    href: '/today',
  },
  {
    key: 'tomorrow',
    headline: 'Events Tomorrow in Philadelphia',
    cta: 'View all events for tomorrow',
    href: '/tomorrow',
  },
  {
    key: 'weekend',
    headline: 'This Weekend in Philadelphia',
    cta: 'View all events this weekend',
    href: '/weekend',
  },
  {
    key: 'traditions',
    eyebrow: 'City traditions',
    headline: 'Upcoming Festivals, Fairs, and Philly Traditions',
    cta: 'More traditions',
    href: 'https://www.ourphilly.org/philadelphia-events-october-2025/',
    external: true,
    getSummary: () =>
      "Line up your calendar with the parades, cultural festivals, and can't-miss Philly traditions happening soon.",
  },
];

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

const startOfWeek = (() => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
})();

const endOfWeek = (() => {
  const end = new Date(startOfWeek);
  end.setDate(end.getDate() + 6);
  return end;
})();

function parseDate(datesStr) {
  if (!datesStr) return null;
  const [first] = datesStr.split(/through|–|-/);
  const parts = first.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseISODateInPhilly(str) {
  if (!str) return null;
  const value = typeof str === 'string' ? str.slice(0, 10) : '';
  if (!value) return null;
  return parseISODate(value, PHILLY_TIME_ZONE);
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

function cloneDate(date) {
  return new Date(date.getTime());
}

function formatFeaturedCommunityDateLabel(startDateInput, options = {}) {
  if (!startDateInput) return '';
  const startDate =
    startDateInput instanceof Date
      ? startDateInput
      : parseISODateInPhilly(startDateInput);
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return '';
  }

  let { endDate: endDateInput, isActive } = options;
  if (endDateInput && !(endDateInput instanceof Date)) {
    endDateInput = parseISODateInPhilly(endDateInput);
  }
  const endDate =
    endDateInput && !Number.isNaN(endDateInput?.getTime()) ? endDateInput : startDate;

  const isMultiDay = endDate.getTime() > startDate.getTime();

  const nowInPhilly = getZonedDate(new Date(), PHILLY_TIME_ZONE);
  const today = setStartOfDay(nowInPhilly);
  const eventDay = setStartOfDay(cloneDate(startDate));
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (isActive && isMultiDay) {
    return `Thru ${formatMonthDay(endDate, PHILLY_TIME_ZONE)}`;
  }

  const monthDay = formatMonthDay(eventDay, PHILLY_TIME_ZONE);

  if (diffDays === 0) {
    return `Today, ${monthDay}`;
  }

  if (diffDays === 1) {
    return `Tomorrow, ${monthDay}`;
  }

  const startOfWeekInPhilly = setStartOfDay(cloneDate(today));
  startOfWeekInPhilly.setDate(startOfWeekInPhilly.getDate() - startOfWeekInPhilly.getDay());
  const endOfWeekInPhilly = setEndOfDay(cloneDate(startOfWeekInPhilly));
  endOfWeekInPhilly.setDate(endOfWeekInPhilly.getDate() + 6);

  const weekday = formatLongWeekday(eventDay, PHILLY_TIME_ZONE);
  const prefix =
    eventDay.getTime() >= startOfWeekInPhilly.getTime() && eventDay.getTime() <= endOfWeekInPhilly.getTime()
      ? 'This '
      : '';

  return `${prefix}${weekday}, ${monthDay}`;
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
    const all = [];
    for (const slug of teamSlugs) {
      const res = await fetch(
        `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=50&sort=datetime_local.asc&client_id=${clientId}`
      );
      const json = await res.json();
      all.push(...(json.events || []));
    }
    return all.map(event => {
      const dt = new Date(event.datetime_local);
      const performers = event.performers || [];
      const home = performers.find(p => p.home_team) || performers[0] || {};
      const away = performers.find(p => p.id !== home.id) || {};
      const title =
        event.short_title ||
        `${(home.name || '').replace(/^Philadelphia\s+/, '')} vs ${(away.name || '').replace(/^Philadelphia\s+/, '')}`;
      return {
        id: `sg-${event.id}`,
        slug: String(event.id),
        title,
        start_date: dt.toISOString().slice(0, 10),
        start_time: dt.toTimeString().slice(0, 5),
        imageUrl: home.image || away.image || '',
        url: event.url,
        isSports: true,
      };
    });
  } catch (err) {
    console.error('Error fetching sports events', err);
    return [];
  }
}

async function fetchBigBoardEvents() {
  const { data, error } = await supabase
    .from('big_board_events')
    .select(`
      id,
      title,
      description,
      start_date,
      start_time,
      end_time,
      end_date,
      slug,
      area_id,
      big_board_posts!big_board_posts_event_id_fkey (image_url)
    `)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => {
    const storageKey = row.big_board_posts?.[0]?.image_url;
    let imageUrl = '';
    if (storageKey) {
      const {
        data: { publicUrl },
      } = supabase.storage.from('big-board').getPublicUrl(storageKey);
      imageUrl = publicUrl;
    }
    return {
      ...row,
      imageUrl,
      isBigBoard: true,
    };
  });
}

async function fetchBaseData() {
  const [areasRes, allEventsRes, traditionsRes, groupEventsRes, recurringRes, bigBoardEvents, sportsEvents] = await Promise.all([
    supabase.from('areas').select('id,name'),
    supabase
      .from('all_events')
      .select(`
        id,
        name,
        description,
        link,
        image,
        start_date,
        start_time,
        end_time,
        end_date,
        slug,
        area_id,
        venue_id(area_id, name, slug)
      `)
      .order('start_date', { ascending: true }),
    supabase
      .from('events')
      .select(`
        id,
        "E Name",
        "E Description",
        Dates,
        "End Date",
        "E Image",
        slug,
        start_time,
        area_id
      `)
      .order('Dates', { ascending: true }),
    supabase
      .from('group_events')
      .select(`
        *,
        groups(Name, imag, slug, status)
      `)
      .order('start_date', { ascending: true }),
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
        area_id
      `)
      .eq('is_active', true),
    fetchBigBoardEvents(),
    fetchSportsEvents(),
  ]);

  if (areasRes.error) throw areasRes.error;
  if (allEventsRes.error) throw allEventsRes.error;
  if (traditionsRes.error) throw traditionsRes.error;
  if (groupEventsRes.error) throw groupEventsRes.error;
  if (recurringRes.error) throw recurringRes.error;

  return {
    areaLookup: Object.fromEntries((areasRes.data || []).map(area => [area.id, area.name])),
    allEvents: allEventsRes.data || [],
    traditions: traditionsRes.data || [],
    groupEvents: groupEventsRes.data || [],
    recurring: recurringRes.data || [],
    bigBoard: bigBoardEvents,
    sports: sportsEvents,
  };
}

function eventOverlapsRange(start, end, rangeStart, rangeEnd) {
  return start <= rangeEnd && end >= rangeStart;
}

function mapGroupEventToCard(evt, areaLookup = {}) {
  const start = parseISODateInPhilly((evt.start_date || '').slice(0, 10));
  if (!start) return null;
  const groupRecord = Array.isArray(evt.groups) ? evt.groups[0] : evt.groups;
  const group = groupRecord
    ? {
        name: groupRecord.Name || groupRecord.name || '',
        slug: groupRecord.slug || '',
        image: groupRecord.imag || groupRecord.image || '',
        status: groupRecord.status || '',
      }
    : null;
  const rawImage = evt.image_url || evt.image || '';
  let imageUrl = '';
  if (rawImage) {
    if (rawImage.startsWith('http')) {
      imageUrl = rawImage;
    } else {
      const { data } = supabase.storage.from('big-board').getPublicUrl(rawImage);
      imageUrl = data?.publicUrl || '';
    }
  } else if (group?.image) {
    imageUrl = group.image;
  }
  const detailPath = getDetailPathForItem({
    ...evt,
    group_slug: group?.slug,
    isGroupEvent: true,
  });
  return {
    id: `group-${evt.id}`,
    sourceId: evt.id,
    title: evt.title,
    description: evt.description,
    imageUrl,
    startDate: start,
    start_time: evt.start_time,
    address: evt.address,
    badges: ['Group Event'],
    detailPath,
    source_table: 'group_events',
    favoriteId: evt.id,
    group,
    areaName: evt.area_id ? areaLookup[evt.area_id] || null : null,
  };
}

function buildEventsForRange(rangeStart, rangeEnd, baseData, limit = 4) {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const areaLookup = baseData.areaLookup || {};

  const bigBoard = (baseData.bigBoard || [])
    .map(ev => {
      const start = parseISODateInPhilly(ev.start_date);
      const end = parseISODateInPhilly(ev.end_date || ev.start_date) || start;
      return start
        ? {
            ...ev,
            startDate: start,
            endDate: end,
            badges: ['Submission'],
          }
        : null;
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd))
    .map(ev => {
      const detailPath = getDetailPathForItem(ev);
      return {
        id: `big-${ev.id}`,
        title: ev.title,
        description: ev.description,
        imageUrl: ev.imageUrl,
        startDate: ev.startDate,
        start_time: ev.start_time,
        badges: ['Submission'],
        detailPath,
        source_table: 'big_board_events',
        favoriteId: ev.id,
        areaName: ev.area_id ? areaLookup[ev.area_id] || null : null,
      };
    })
    .sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

  const traditions = (baseData.traditions || [])
    .map(row => {
      const start = parseDate(row.Dates);
      if (!start) return null;
      const end = parseDate(row['End Date']) || start;
      return {
        id: `trad-${row.id}`,
        sourceId: row.id,
        title: row['E Name'],
        description: row['E Description'],
        imageUrl: row['E Image'] || '',
        startDate: start,
        endDate: end,
        slug: row.slug,
        isTradition: true,
        start_time: row.start_time ?? row.time ?? row['Start Time'] ?? null,
        areaName: row.area_id ? areaLookup[row.area_id] || null : null,
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd))
    .map(ev => ({
      ...ev,
      badges: ['Tradition'],
      detailPath: getDetailPathForItem(ev),
      source_table: 'events',
      favoriteId: ev.sourceId,
    }));

  const singleDayEvents = (baseData.allEvents || [])
    .map(evt => {
      const rawStart = (evt.start_date || '').slice(0, 10);
      const start = parseISODateInPhilly(rawStart);
      if (!start) return null;
      const end = parseISODateInPhilly((evt.end_date || '').slice(0, 10)) || start;
      const venue = evt.venue_id;
      const venueAreaId = Array.isArray(venue) ? venue[0]?.area_id : venue?.area_id;
      const areaName =
        (evt.area_id && areaLookup[evt.area_id]) || (venueAreaId && areaLookup[venueAreaId]) || null;
      return {
        id: `event-${evt.id}`,
        sourceId: evt.id,
        title: evt.name,
        description: evt.description,
        imageUrl: evt.image || '',
        startDate: start,
        endDate: end,
        start_time: evt.start_time,
        slug: evt.slug,
        venues: venue,
        areaName,
        area_id: evt.area_id,
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd))
    .map(ev => ({
      ...ev,
      detailPath: getDetailPathForItem(ev),
      source_table: 'all_events',
      favoriteId: ev.sourceId,
    }))
    .sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

  const recurring = (baseData.recurring || []).flatMap(series => {
    try {
      const opts = RRule.parseString(series.rrule);
      opts.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
      if (series.end_date) {
        opts.until = new Date(`${series.end_date}T23:59:59`);
      }
      const rule = new RRule(opts);
      const occurrences = rule.between(rangeStart, rangeEnd, true);
      return occurrences.map(occurrence => {
        const startDate = new Date(occurrence);
        return {
          id: `${series.id}::${startDate.toISOString().slice(0, 10)}`,
          title: series.name,
          description: series.description,
          imageUrl: series.image_url || '',
          startDate,
          start_time: series.start_time,
          slug: series.slug,
          address: series.address,
          isRecurring: true,
          badges: ['Recurring'],
          detailPath: getDetailPathForItem({
            id: `${series.id}::${startDate.toISOString().slice(0, 10)}`,
            slug: series.slug,
            start_date: startDate.toISOString().slice(0, 10),
            isRecurring: true,
          }),
          source_table: 'recurring_events',
          favoriteId: series.id,
          areaName: series.area_id ? areaLookup[series.area_id] || null : null,
          area_id: series.area_id,
        };
      });
    } catch (err) {
      console.error('rrule parse error', err);
      return [];
    }
  }).sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

  const groupEvents = (baseData.groupEvents || [])
    .map(evt => mapGroupEventToCard(evt, areaLookup))
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.startDate, rangeStart, rangeEnd))
    .sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

  const sports = (baseData.sports || [])
    .map(evt => {
      const start = parseISODateInPhilly(evt.start_date);
      if (!start) return null;
      return {
        id: evt.id,
        title: evt.title,
        description: '',
        imageUrl: evt.imageUrl || '',
        startDate: start,
        start_time: evt.start_time,
        badges: ['Sports'],
        detailPath: getDetailPathForItem({ slug: evt.slug, isSports: true }),
        externalUrl: evt.url,
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.startDate, rangeStart, rangeEnd))
    .sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

  const traditionsOrdered = [...traditions].sort(
    (a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || '')
  );
  const combined = [
    ...bigBoard,
    ...traditionsOrdered,
    ...singleDayEvents,
    ...recurring,
    ...groupEvents,
    ...sports,
  ];

  return {
    items: combined.slice(0, limit),
    total: combined.length,
    traditions: traditions.length,
  };
}

function buildTraditionsSection(baseData, rangeStart, rangeEnd, limit = 8) {
  const startBoundary = rangeStart
    ? setStartOfDay(cloneDate(rangeStart))
    : setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE));
  const endBoundary = rangeEnd ? setEndOfDay(cloneDate(rangeEnd)) : null;
  const areaLookup = baseData.areaLookup || {};

  const traditions = (baseData.traditions || [])
    .map(row => {
      const start = parseDate(row.Dates);
      if (!start) return null;
      const end = parseDate(row['End Date']) || start;
      return {
        id: `trad-${row.id}`,
        sourceId: row.id,
        title: row['E Name'],
        description: row['E Description'],
        imageUrl: row['E Image'] || '',
        startDate: start,
        endDate: end,
        slug: row.slug,
        start_time: row.start_time ?? row.time ?? row['Start Time'] ?? null,
        areaName: row.area_id ? areaLookup[row.area_id] || null : null,
      };
    })
    .filter(Boolean)
    .map(evt => ({
      ...evt,
      isActive:
        evt.startDate.getTime() <= startBoundary.getTime() &&
        startBoundary.getTime() <= evt.endDate.getTime(),
    }))
    .filter(evt => {
      const startsBeforeEnd = endBoundary ? evt.startDate <= endBoundary : true;
      const endsAfterStart = evt.endDate >= startBoundary;
      return startsBeforeEnd && endsAfterStart;
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      return a.startDate - b.startDate;
    });

  const mapped = traditions.map(evt => ({
    ...evt,
    start_date: evt.startDate,
    badges: ['Tradition'],
    detailPath: getDetailPathForItem(evt),
    source_table: 'events',
    favoriteId: evt.sourceId,
  }));

  return {
    items: mapped.slice(0, limit),
    total: mapped.length,
    traditions: mapped.length,
  };
}

function buildFeaturedCommunities(baseData, referenceStart, limit = 4) {
  const startBoundary = referenceStart
    ? setStartOfDay(cloneDate(referenceStart))
    : setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE));
  const areaLookup = baseData.areaLookup || {};
  const events = (baseData.groupEvents || [])
    .map(evt => mapGroupEventToCard(evt, areaLookup))
    .filter(event => event && event.group?.status === 'home')
    .filter(event => event.startDate >= startBoundary)
    .sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

  if (!events.length) {
    return [];
  }

  const grouped = new Map();
  events.forEach(event => {
    const group = event.group;
    if (!group) return;
    const key = group.slug || group.name;
    if (!key) return;
    if (!grouped.has(key)) {
      grouped.set(key, { group, events: [] });
    }
    grouped.get(key).events.push(event);
  });

  return Array.from(grouped.values()).map(({ group, events: groupEvents }) => ({
    group,
    items: groupEvents.slice(0, limit),
    total: groupEvents.length,
  }));
}

function formatRangeLabel(key, start, end) {
  if (key === 'weekend') {
    return `${formatMonthDay(start, PHILLY_TIME_ZONE)} – ${formatMonthDay(end, PHILLY_TIME_ZONE)}`;
  }
  return formatMonthDay(start, PHILLY_TIME_ZONE);
}

function formatSummary(config, total, traditions, start, end) {
  if (total === 0) return 'No events listed yet — check back soon!';
  const base =
    config.key === 'weekend'
      ? `${total} event${total === 1 ? '' : 's'} this weekend`
      : `${total} event${total === 1 ? '' : 's'} on ${formatMonthDay(start, PHILLY_TIME_ZONE)}`;
  if (traditions > 0) {
    return `${base}, including ${traditions} Philly tradition${traditions === 1 ? '' : 's'}!`;
  }
  return `${base}!`;
}

function EventCard({ event, tags = [], showDatePill = false, showDayAndDate = false }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event.favoriteId,
    source_table: event.source_table,
  });

  const canFavorite = Boolean(event.favoriteId && event.source_table && !event.externalUrl);
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};
  const badges = event.badges || [];
  const tagList = tags || [];
  const timeLabel = event.start_time ? formatTime(event.start_time) : '';
  const parseEventDateValueSafely = value => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      return parseISODateInPhilly(value);
    }
    return null;
  };
  const startDate = parseEventDateValueSafely(event.start_date || event.startDate);
  const endDate = parseEventDateValueSafely(event.end_date || event.endDate) || startDate;
  const todayInPhilly = useMemo(() => setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)), []);
  let isActive = typeof event.isActive === 'boolean' ? event.isActive : false;
  if (!isActive && startDate && endDate) {
    const startOfEvent = setStartOfDay(cloneDate(startDate));
    const endOfEvent = setEndOfDay(cloneDate(endDate));
    const todayMs = todayInPhilly.getTime();
    isActive = startOfEvent.getTime() <= todayMs && todayMs <= endOfEvent.getTime();
  }
  const datePillLabel = showDatePill
    ? formatFeaturedCommunityDateLabel(startDate, { endDate, isActive })
    : '';
  const dayDateLabel =
    showDayAndDate && startDate
      ? `${formatLongWeekday(startDate, PHILLY_TIME_ZONE)}, ${formatMonthDay(
          startDate,
          PHILLY_TIME_ZONE
        )}`
      : '';

  const areaLabel =
    [event.areaName, event.area?.name]
      .map(candidate => (typeof candidate === 'string' ? candidate.trim() : ''))
      .find(Boolean) || null;

  const handleFavoriteClick = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite();
  };

  const card = (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-md transition duration-200 hover:-translate-y-1 hover:shadow-xl ${
        isFavorite && canFavorite ? 'ring-2 ring-indigo-600' : ''
      }`}
    >
      {areaLabel && (
        <div
          className="flex items-center justify-center gap-1 bg-[#28313e] px-3 py-1 text-xs font-semibold leading-none text-white"
          title={areaLabel}
        >
          <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="truncate">{areaLabel}</span>
        </div>
      )}
      <div className="relative h-40 w-full overflow-hidden bg-gray-100">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-500">
            Photo coming soon
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {datePillLabel && (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-semibold text-indigo-900 shadow-sm backdrop-blur">
            {datePillLabel}
          </div>
        )}
        {isFavorite && canFavorite && (
          <div className="absolute right-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow">
            In the plans!
          </div>
        )}
        {badges.includes('Tradition') && (
          <div className="absolute inset-x-0 bottom-0 bg-yellow-400 text-center text-xs font-bold uppercase tracking-wide text-yellow-900">
            Tradition
          </div>
        )}
        {badges.includes('Submission') && (
          <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-center text-xs font-bold uppercase tracking-wide text-white">
            Submission
          </div>
        )}
        {badges.includes('Group Event') && !badges.includes('Submission') && (
          <div className="absolute inset-x-0 bottom-0 bg-emerald-500 text-center text-xs font-bold uppercase tracking-wide text-white">
            Group Event
          </div>
        )}
        {badges.includes('Sports') && (
          <div className="absolute inset-x-0 bottom-0 bg-green-500 text-center text-xs font-bold uppercase tracking-wide text-white">
            Sports
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-4 text-center">
        <div className="flex w-full flex-1 flex-col items-center">
          {dayDateLabel && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              {dayDateLabel}
            </p>
          )}
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{event.title}</h3>
          {event.venues?.name ? (
            <p className="mt-1 text-sm text-gray-600">at {event.venues.name}</p>
          ) : event.address ? (
            <p className="mt-1 text-sm text-gray-600">{event.address}</p>
          ) : null}
          {timeLabel && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{timeLabel}</p>}
        </div>

        {tagList.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {tagList.slice(0, 3).map((tag, index) => (
              <button
                key={tag.slug}
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/tags/${tag.slug}`);
                }}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                  TAG_PILL_STYLES[index % TAG_PILL_STYLES.length]
                }`}
              >
                #{tag.name}
              </button>
            ))}
            {tagList.length > 3 && (
              <span className="text-xs text-gray-500">+{tagList.length - 3} more</span>
            )}
          </div>
        )}

        <div className="mt-4 w-full">
          {event.externalUrl ? (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
              onClick={e => e.stopPropagation()}
            >
              Get Tickets
            </a>
          ) : canFavorite ? (
            <button
              type="button"
              onClick={handleFavoriteClick}
              disabled={loading}
              className={`inline-flex w-full items-center justify-center rounded-md border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
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
    </div>
  );

  if (event.detailPath) {
    return (
      <Wrapper
        {...wrapperProps}
        className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
      >
        {card}
      </Wrapper>
    );
  }

  return <div className="block h-full">{card}</div>;
}

function EventsSection({ config, data, loading, rangeStart, rangeEnd, tagMap }) {
  const summaryText = loading
    ? 'Loading events…'
    : config.getSummary
    ? config.getSummary({ data, rangeStart, rangeEnd })
    : formatSummary(config, data.total, data.traditions, rangeStart, rangeEnd);

  const CtaComponent = config.external ? 'a' : Link;

  return (
    <section className="mt-16">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          {config.eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">{config.eyebrow}</p>
          )}
          <h2
            className={`text-2xl sm:text-3xl font-bold text-[#28313e] ${config.eyebrow ? 'mt-2' : ''}`}
          >
            {config.headline}
          </h2>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">{summaryText}</p>
        </div>
        <CtaComponent
          {...(config.external
            ? { href: config.href, target: '_blank', rel: 'noopener noreferrer' }
            : { to: config.href })}
          className="inline-flex items-center gap-2 self-start md:self-auto px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-full shadow hover:bg-indigo-700 transition"
        >
          {config.cta}
          <ArrowRight className="w-4 h-4" />
        </CtaComponent>
      </div>
      <div className="mt-8">
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-[16rem] flex-shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-shrink"
                >
                  <div className="h-[18rem] w-full rounded-2xl bg-gray-100 animate-pulse" />
                </div>
              ))
            : data.items.map(event => {
                const tagKey =
                  event.favoriteId && event.source_table
                    ? `${event.source_table}:${event.favoriteId}`
                    : null;
                const eventTags = tagKey && tagMap ? tagMap[tagKey] || [] : [];
                return (
                  <div
                    key={event.id}
                    className="w-[16rem] flex-shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-shrink"
                  >
                    <EventCard
                      event={event}
                      tags={eventTags}
                      showDatePill={config.key === 'featured-community' || config.key === 'traditions'}
                    />
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
}

function PlansSection({ loading, events, summary, user }) {
  const previewEvents = useMemo(() => events.slice(0, 4), [events]);
  const hasEvents = previewEvents.length > 0;
  const profileLinkTarget = user ? '/profile' : '/login';
  const profileLinkLabel = user ? 'See more plans on your profile' : 'Log in to see your plans';

  return (
    <section className="mt-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Saved agenda</p>
          <h2 className="mt-2 text-2xl font-bold text-[#28313e] sm:text-3xl">Your Upcoming Plans</h2>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">{summary}</p>
        </div>
        <Link
          to={profileLinkTarget}
          className="inline-flex items-center gap-2 self-start rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
        >
          {profileLinkLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-8">
        {loading ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="w-[16rem] flex-shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-shrink">
                <div className="h-[18rem] w-full animate-pulse rounded-2xl bg-gray-100" />
              </div>
            ))}
          </div>
        ) : hasEvents ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
            {previewEvents.map(event => {
              const key = `${event.source_table || 'event'}:${event.id || event.slug}`;
              return (
                <div key={key} className="w-[16rem] flex-shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-shrink">
                  <EventCard event={event} showDayAndDate />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-8 text-center text-sm text-indigo-900 sm:text-base">
            {user ? (
              <>
                You haven't added any plans yet.{' '}
                <Link to="/today" className="font-semibold text-indigo-700 underline">
                  Browse today's events
                </Link>{' '}
                to add your first plan.
              </>
            ) : (
              <>
                <Link to="/signup" className="font-semibold text-indigo-700 underline">
                  Sign up
                </Link>{' '}
                or{' '}
                <Link to="/login" className="font-semibold text-indigo-700 underline">
                  log in
                </Link>{' '}
                to start saving events to your plans.
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function MainEvents() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const todayInPhilly = useMemo(() => setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)), []);
  const tomorrowInPhilly = useMemo(() => {
    const t = cloneDate(todayInPhilly);
    t.setDate(t.getDate() + 1);
    return t;
  }, [todayInPhilly]);
  const nowInPhilly = useMemo(() => getZonedDate(new Date(), PHILLY_TIME_ZONE), []);
  const currentMonthName = useMemo(() => formatMonthName(nowInPhilly, PHILLY_TIME_ZONE), [nowInPhilly]);
  const currentMonthYearLabel = useMemo(() => formatMonthYear(nowInPhilly, PHILLY_TIME_ZONE), [nowInPhilly]);
  const currentMonthSlug = useMemo(() => indexToMonthSlug(nowInPhilly.getMonth() + 1), [nowInPhilly]);
  const currentYear = nowInPhilly.getFullYear();
  const traditionsHref = currentMonthSlug
    ? `/philadelphia-events-${currentMonthSlug}-${currentYear}/`
    : '/philadelphia-events/';
  const monthlyGuidePaths = useMemo(
    () => ({
      family: currentMonthSlug
        ? `/family-friendly-events-in-philadelphia-${currentMonthSlug}-${currentYear}/`
        : '/family-friendly-events-in-philadelphia/',
      arts: currentMonthSlug
        ? `/arts-culture-events-in-philadelphia-${currentMonthSlug}-${currentYear}/`
        : '/arts-culture-events-in-philadelphia/',
      food: currentMonthSlug
        ? `/food-drink-events-in-philadelphia-${currentMonthSlug}-${currentYear}/`
        : '/food-drink-events-in-philadelphia/',
      fitness: currentMonthSlug
        ? `/fitness-events-in-philadelphia-${currentMonthSlug}-${currentYear}/`
        : '/fitness-events-in-philadelphia/',
      music: currentMonthSlug
        ? `/music-events-in-philadelphia-${currentMonthSlug}-${currentYear}/`
        : '/music-events-in-philadelphia/',
    }),
    [currentMonthSlug, currentYear]
  );
  const otherGuides = useMemo(
    () => [
      {
        key: 'weekend',
        title: 'This Weekend in Philadelphia',
        description: 'Plan a perfect Philly weekend with festivals, markets, and neighborhood gems.',
        href: '/this-weekend-in-philadelphia/',
        icon: CalendarRange,
        iconLabel: 'Weekend guide',
        iconBg: 'bg-pink-500/20 text-pink-100',
      },
      {
        key: 'traditions',
        title: currentMonthName ? `${currentMonthName}'s Traditions` : 'Monthly Traditions',
        description: 'Signature festivals and perennial favorites happening across the city this month.',
        href: traditionsHref,
        icon: Sparkles,
        iconLabel: 'Traditions guide',
        iconBg: 'bg-amber-500/20 text-amber-100',
      },
      {
        key: 'family',
        title: `Family-Friendly – ${currentMonthYearLabel}`,
        description: 'Storytimes, hands-on workshops, and kid-approved outings for the whole crew.',
        href: monthlyGuidePaths.family,
        icon: Users,
        iconLabel: 'Family guide',
        iconBg: 'bg-sky-500/20 text-sky-100',
      },
      {
        key: 'arts',
        title: `Arts & Culture – ${currentMonthYearLabel}`,
        description: 'Gallery nights, theater picks, and creative showcases to inspire your month.',
        href: monthlyGuidePaths.arts,
        icon: Palette,
        iconLabel: 'Arts guide',
        iconBg: 'bg-purple-500/20 text-purple-100',
      },
      {
        key: 'food',
        title: `Food & Drink – ${currentMonthYearLabel}`,
        description: "Pop-ups, tastings, and happy hours to savor the city's flavor.",
        href: monthlyGuidePaths.food,
        icon: UtensilsCrossed,
        iconLabel: 'Food guide',
        iconBg: 'bg-orange-500/20 text-orange-100',
      },
      {
        key: 'fitness',
        title: `Fitness & Wellness – ${currentMonthYearLabel}`,
        description: 'Group workouts, mindful meetups, and movement-forward community gatherings.',
        href: monthlyGuidePaths.fitness,
        icon: HeartPulse,
        iconLabel: 'Fitness guide',
        iconBg: 'bg-emerald-500/20 text-emerald-100',
      },
      {
        key: 'music',
        title: `Music – ${currentMonthYearLabel}`,
        description: 'Concerts, festivals, and intimate shows to soundtrack your month.',
        href: monthlyGuidePaths.music,
        icon: Music,
        iconLabel: 'Music guide',
        iconBg: 'bg-indigo-500/20 text-indigo-100',
      },
    ],
    [currentMonthName, currentMonthYearLabel, monthlyGuidePaths, traditionsHref]
  );
  const communityGuideCards = useMemo(() => {
    const iconStyles = ['bg-white/20 text-white'];
    return COMMUNITY_REGIONS.map((region, index) => ({
      key: region.key,
      title: region.name,
      href: `/${region.slug}/`,
      icon: MapPin,
      iconLabel: `${region.name} community index`,
      iconBg: iconStyles[index % iconStyles.length],
    }));
  }, []);
  const [areaLookup, setAreaLookup] = useState({});
  const [savedEvents, setSavedEvents] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const savedPlansDescription = useMemo(() => {
    if (loadingSaved) {
      return 'Loading your saved plans…';
    }
    if (!user) {
      return (
        <>
          <Link to="/signup" className="text-indigo-600 underline">
            Sign up
          </Link>{' '}
          or{' '}
          <Link to="/login" className="text-indigo-600 underline">
            log in
          </Link>{' '}
          to start saving events to your plans.
        </>
      );
    }
    if (!savedEvents.length) {
      return (
        <>
          You haven't added any plans yet.{' '}
          <Link to="/today" className="text-indigo-600 underline">
            Browse today's events
          </Link>{' '}
          to start planning.
        </>
      );
    }
    if (savedEvents.length === 1) {
      return "Here's the next event on your calendar.";
    }
    return `A quick look at the next ${Math.min(savedEvents.length, 4)} events you've saved.`;
  }, [loadingSaved, user, savedEvents.length]);
  const { start: weekendStart, end: weekendEnd } = useMemo(
    () => getWeekendWindow(new Date(), PHILLY_TIME_ZONE),
    []
  );

  const traditionsRangeEnd = useMemo(() => {
    const end = cloneDate(todayInPhilly);
    end.setDate(end.getDate() + 60);
    return end;
  }, [todayInPhilly]);

  const rangeMeta = useMemo(
    () => ({
      today: { start: todayInPhilly, end: setEndOfDay(cloneDate(todayInPhilly)) },
      tomorrow: {
        start: setStartOfDay(cloneDate(tomorrowInPhilly)),
        end: setEndOfDay(cloneDate(tomorrowInPhilly)),
      },
      weekend: { start: setStartOfDay(cloneDate(weekendStart)), end: setEndOfDay(cloneDate(weekendEnd)) },
      traditions: {
        start: setStartOfDay(cloneDate(todayInPhilly)),
        end: setEndOfDay(cloneDate(traditionsRangeEnd)),
      },
    }),
    [todayInPhilly, tomorrowInPhilly, weekendStart, weekendEnd, traditionsRangeEnd]
  );

  const [sections, setSections] = useState({
    today: { items: [], total: 0, traditions: 0 },
    tomorrow: { items: [], total: 0, traditions: 0 },
    weekend: { items: [], total: 0, traditions: 0 },
    traditions: { items: [], total: 0, traditions: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [tagMap, setTagMap] = useState({});
  const [featuredCommunities, setFeaturedCommunities] = useState([]);
  const [weekendGuideCount, setWeekendGuideCount] = useState(null);
  const [weekendGuideLoading, setWeekendGuideLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const baseData = await fetchBaseData();
        if (cancelled) return;
        setAreaLookup(baseData.areaLookup || {});
        setSections({
          today: buildEventsForRange(rangeMeta.today.start, rangeMeta.today.end, baseData),
          tomorrow: buildEventsForRange(rangeMeta.tomorrow.start, rangeMeta.tomorrow.end, baseData),
          weekend: buildEventsForRange(rangeMeta.weekend.start, rangeMeta.weekend.end, baseData),
          traditions: buildTraditionsSection(
            baseData,
            rangeMeta.traditions.start,
            rangeMeta.traditions.end
          ),
        });
        setFeaturedCommunities(buildFeaturedCommunities(baseData, rangeMeta.today.start));
        setError(null);
      } catch (err) {
        console.error('Error loading events', err);
        if (!cancelled) {
          setError('We had trouble loading events. Please try again soon.');
          setFeaturedCommunities([]);
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
  }, [rangeMeta]);

  useEffect(() => {
    let cancelled = false;
    setWeekendGuideLoading(true);
    fetchWeekendEventCount(weekendStart, weekendEnd)
      .then(count => {
        if (!cancelled) {
          setWeekendGuideCount(count);
          setWeekendGuideLoading(false);
        }
      })
      .catch(err => {
        console.error('Error loading weekend event count', err);
        if (!cancelled) {
          setWeekendGuideCount(null);
          setWeekendGuideLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [weekendStart, weekendEnd]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSavedEvents([]);
      setLoadingSaved(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setLoadingSaved(true);
      try {
        const { data: favs, error: favError } = await supabase
          .from('event_favorites')
          .select('event_id,event_int_id,event_uuid,source_table')
          .eq('user_id', user.id);
        if (favError) throw favError;

        const idsByTable = {};
        (favs || []).forEach(record => {
          const table = record.source_table;
          let id;
          if (table === 'all_events') id = record.event_int_id;
          else if (table === 'events') id = record.event_id;
          else id = record.event_uuid;
          if (!id) return;
          idsByTable[table] = idsByTable[table] || [];
          idsByTable[table].push(id);
        });

        const aggregated = [];
        if (idsByTable.all_events?.length) {
          const { data } = await supabase
            .from('all_events')
            .select('id,name,slug,image,start_date,area_id,venues:venue_id(area_id,slug)')
            .in('id', idsByTable.all_events);
          data?.forEach(row => {
            aggregated.push({
              id: row.id,
              slug: row.slug,
              title: row.name,
              image: row.image,
              imageUrl: row.image,
              start_date: row.start_date,
              source_table: 'all_events',
              favoriteId: row.id,
              venues: row.venues,
              area_id: row.area_id,
              areaName: row.area_id ? areaLookup[row.area_id] || null : null,
            });
          });
        }
        if (idsByTable.events?.length) {
          const { data } = await supabase
            .from('events')
            .select('id,slug,"E Name","E Image",Dates,"End Date",start_time,area_id')
            .in('id', idsByTable.events);
          data?.forEach(row => {
            aggregated.push({
              id: row.id,
              slug: row.slug,
              title: row['E Name'],
              image: row['E Image'],
              imageUrl: row['E Image'],
              start_date: row.Dates,
              end_date: row['End Date'],
              start_time: row.start_time ?? row['Start Time'] ?? null,
              source_table: 'events',
              favoriteId: row.id,
              area_id: row.area_id,
              areaName: row.area_id ? areaLookup[row.area_id] || null : null,
            });
          });
        }
        if (idsByTable.big_board_events?.length) {
          const { data } = await supabase
            .from('big_board_events')
            .select('id,slug,title,start_date,start_time,area_id,big_board_posts!big_board_posts_event_id_fkey(image_url)')
            .in('id', idsByTable.big_board_events);
          data?.forEach(event => {
            let imageUrl = '';
            const storageKey = event.big_board_posts?.[0]?.image_url || '';
            if (storageKey) {
              const {
                data: { publicUrl },
              } = supabase.storage.from('big-board').getPublicUrl(storageKey);
              imageUrl = publicUrl;
            }
            aggregated.push({
              id: event.id,
              slug: event.slug,
              title: event.title,
              start_date: event.start_date,
              start_time: event.start_time,
              imageUrl,
              source_table: 'big_board_events',
              favoriteId: event.id,
              area_id: event.area_id,
              areaName: event.area_id ? areaLookup[event.area_id] || null : null,
            });
          });
        }
        if (idsByTable.group_events?.length) {
          const { data } = await supabase
            .from('group_events')
            .select('id,slug,title,start_date,start_time,area_id,groups(imag,slug)')
            .in('id', idsByTable.group_events);
          data?.forEach(event => {
            aggregated.push({
              id: event.id,
              slug: event.slug,
              title: event.title,
              start_date: event.start_date,
              start_time: event.start_time,
              image: event.groups?.imag || '',
              imageUrl: event.groups?.imag || '',
              group: event.groups,
              source_table: 'group_events',
              favoriteId: event.id,
              area_id: event.area_id,
              areaName: event.area_id ? areaLookup[event.area_id] || null : null,
            });
          });
        }
        if (idsByTable.recurring_events?.length) {
          const { data } = await supabase
            .from('recurring_events')
            .select('id,slug,name,start_date,start_time,end_date,rrule,image_url,area_id')
            .in('id', idsByTable.recurring_events);
          data?.forEach(series => {
            aggregated.push({
              id: series.id,
              slug: series.slug,
              title: series.name,
              start_date: series.start_date,
              start_time: series.start_time,
              end_date: series.end_date,
              imageUrl: series.image_url,
              rrule: series.rrule,
              source_table: 'recurring_events',
              favoriteId: series.id,
              area_id: series.area_id,
              areaName: series.area_id ? areaLookup[series.area_id] || null : null,
            });
          });
        }

        const parseSavedDate = value => {
          if (!value) return null;
          if (value instanceof Date) {
            return setStartOfDay(getZonedDate(value, PHILLY_TIME_ZONE));
          }
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            let candidate = trimmed;
            if (/through/i.test(candidate) || /–/.test(candidate) || /—/.test(candidate)) {
              candidate = candidate.split(/through|–|—/i)[0];
            }
            if (candidate.includes(' - ')) {
              candidate = candidate.split(' - ')[0];
            }
            const isoMatch = candidate.match(/\d{4}-\d{2}-\d{2}/);
            if (isoMatch) {
              return parseISODate(isoMatch[0], PHILLY_TIME_ZONE);
            }
            return parseEventDateValue(candidate, PHILLY_TIME_ZONE);
          }
          return null;
        };

        const upcoming = aggregated
          .map(item => {
            const record = { ...item };
            let start = parseSavedDate(record.start_date);
            let end = parseSavedDate(record.end_date) || start;
            let nextDate = start;

            if (record.source_table === 'recurring_events' && record.rrule && record.start_date) {
              try {
                const opts = RRule.parseString(record.rrule);
                opts.dtstart = new Date(`${record.start_date}T${record.start_time || '00:00'}`);
                if (record.end_date) {
                  opts.until = new Date(`${record.end_date}T23:59:59`);
                }
                const rule = new RRule(opts);
                const nextOccurrence = rule.after(new Date(todayInPhilly), true);
                if (nextOccurrence) {
                  const zoned = setStartOfDay(getZonedDate(nextOccurrence, PHILLY_TIME_ZONE));
                  start = zoned;
                  nextDate = zoned;
                  record.start_date = zoned.toISOString().slice(0, 10);
                }
              } catch (recurringErr) {
                console.error('Error parsing saved recurring event', recurringErr);
              }
            }

            record.__startDate = start;
            record.__endDate = end;
            record.__nextDate = nextDate;
            return record;
          })
          .filter(record => {
            const { __startDate: start, __endDate: end, __nextDate: next } = record;
            if (record.source_table === 'recurring_events' && next) {
              return next >= todayInPhilly;
            }
            if (start && start >= todayInPhilly) return true;
            if (end && end >= todayInPhilly) return true;
            return false;
          })
          .sort((a, b) => {
            const aDate = a.__nextDate || a.__startDate || a.__endDate || new Date(8640000000000000);
            const bDate = b.__nextDate || b.__startDate || b.__endDate || new Date(8640000000000000);
            return aDate - bDate;
          })
          .map(({ __startDate, __endDate, __nextDate, ...rest }) => rest)
          .map(event => ({
            ...event,
            imageUrl: event.imageUrl || event.image || '',
            favoriteId: event.favoriteId || event.id || null,
            detailPath: getDetailPathForItem(event),
          }));

        if (!cancelled) {
          setSavedEvents(upcoming);
        }
      } catch (err) {
        console.error('Error loading saved events', err);
        if (!cancelled) {
          setSavedEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSaved(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, todayInPhilly, areaLookup]);

  const handleDatePick = date => {
    if (!date) return;
    setSelectedDate(date);
    const iso = date.toISOString().slice(0, 10);
    navigate(`/${iso}`);
  };

  const displayedEvents = useMemo(() => {
    const base = [
      ...sections.today.items,
      ...sections.tomorrow.items,
      ...sections.weekend.items,
      ...sections.traditions.items,
    ];
    featuredCommunities.forEach(section => {
      if (section?.items?.length) {
        base.push(...section.items);
      }
    });
    return base;
  }, [
    sections.today.items,
    sections.tomorrow.items,
    sections.weekend.items,
    sections.traditions.items,
    featuredCommunities,
  ]);

  useEffect(() => {
    if (!displayedEvents.length) {
      setTagMap({});
      return;
    }
    const idsByType = displayedEvents.reduce((acc, event) => {
      if (!event?.source_table || !event.favoriteId) return acc;
      const table = event.source_table;
      acc[table] = acc[table] || new Set();
      acc[table].add(event.favoriteId);
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
        const results = await Promise.all(
          entries.map(([table, ids]) =>
            supabase
              .from('taggings')
              .select('taggable_id, tags:tags(name, slug)')
              .eq('taggable_type', table)
              .in('taggable_id', Array.from(ids))
          )
        );
        if (cancelled) return;
        const nextMap = {};
        results.forEach((res, index) => {
          const table = entries[index][0];
          if (res.error) {
            console.error('Failed to load taggings for type', table, res.error);
            return;
          }
          res.data?.forEach(row => {
            if (!row?.tags) return;
            const key = `${table}:${row.taggable_id}`;
            if (!nextMap[key]) nextMap[key] = [];
            nextMap[key].push(row.tags);
          });
        });
        setTagMap(nextMap);
      } catch (err) {
        console.error('Error loading taggings', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayedEvents]);

  const quickLinksLoading = loading || weekendGuideLoading;
  const quickLinksCount =
    typeof weekendGuideCount === 'number' ? weekendGuideCount : sections.weekend.total;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Helmet>
        <title>Make Your Philly Plans | Our Philly</title>
        <meta
          name="description"
          content="Plan today, tomorrow, and this weekend in Philadelphia with the latest submissions, traditions, and standout events."
        />
      </Helmet>
      <Navbar />
      <div className="pt-24 sm:pt-28">
        <TopQuickLinks
          weekendCount={quickLinksCount}
          weekendHref="/this-weekend-in-philadelphia/"
          loading={quickLinksLoading}
          className="mb-0"
        />
      </div>
      <main className="flex-1 pb-16">
        <div className="container mx-auto px-4 pt-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Make Your Philly Plans</p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-[Barrio] font-black text-indigo-900">Pick Your Dates</h1>
            <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-gray-600">
              Search today, tomorrow...any day.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <span className="text-sm font-semibold text-gray-700">Search another date:</span>
              <DatePicker
                selected={selectedDate}
                onChange={handleDatePick}
                dateFormat="MMMM d, yyyy"
                className="px-4 py-2 border-2 border-indigo-600 rounded-full text-sm font-semibold text-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-500"
                calendarClassName="rounded-xl shadow-lg"
                popperClassName="z-50"
              />
            </div>
            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}
          </div>

          {SECTION_CONFIGS.map(config => (
            <React.Fragment key={config.key}>
              <EventsSection
                config={config}
                data={sections[config.key]}
                loading={loading}
                rangeStart={rangeMeta[config.key].start}
                rangeEnd={rangeMeta[config.key].end}
                tagMap={tagMap}
              />
              {config.key === 'today' && (
                <PlansSection
                  loading={loadingSaved}
                  events={savedEvents}
                  summary={savedPlansDescription}
                  user={user}
                />
              )}
            </React.Fragment>
          ))}
          {featuredCommunities.map((section, index) => {
            if (!section?.items?.length) {
              return null;
            }
            const featuredGroupName = section.group?.name || '';
            const featuredGroupSlug = section.group?.slug || '';
            const featuredSummaryName = featuredGroupName || 'this community';
            const sectionKey = `featured-community-${featuredGroupSlug || featuredGroupName || index}`;
            return (
              <EventsSection
                key={sectionKey}
                config={{
                  key: 'featured-community',
                  eyebrow: 'Featured community',
                  headline: featuredGroupName
                    ? `Upcoming with ${featuredGroupName}`
                    : 'Featured Community Events',
                  cta: featuredGroupSlug
                    ? `See more from ${featuredGroupName}`
                    : 'Explore more communities',
                  href: featuredGroupSlug ? `/groups/${featuredGroupSlug}` : '/groups',
                  getSummary: ({ data }) => {
                    const total = data?.total || 0;
                    const shown = data?.items?.length || 0;
                    if (total === 0) {
                      return 'No upcoming events yet — check back soon!';
                    }
                    if (total <= shown) {
                      return `Showing ${total} upcoming event${total === 1 ? '' : 's'} from ${featuredSummaryName}.`;
                    }
                    return `Showing ${shown} of ${total} upcoming events from ${featuredSummaryName}.`;
                  },
                }}
                data={section}
                loading={loading}
                rangeStart={rangeMeta.today.start}
                rangeEnd={rangeMeta.weekend.end}
                tagMap={tagMap}
              />
            );
          })}
        </div>

        <div className="mt-16 flex flex-col gap-0">
          <RecentActivity />

          <section
            aria-labelledby="other-guides-heading"
            className="overflow-hidden bg-slate-900 text-white -mt-px"
            style={{ marginInline: 'calc(50% - 50vw)', width: '100vw' }}
          >
            <div className="px-6 pb-10 pt-6 sm:px-10 sm:pt-8">
              <div className="mx-auto flex max-w-screen-xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3 text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                    Other guides to explore
                  </p>
                  <h2 id="other-guides-heading" className="text-2xl font-semibold sm:text-3xl">
                    Other Our Philly guides
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">
                    Find the roundup that fits your mood—from monthly traditions to family-friendly picks and late-night shows.
                  </p>
                </div>
                <Link
                  to="/all-guides/"
                  className="inline-flex items-center gap-2 self-start rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Browse all guides
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent"
                />
                <div className="overflow-x-auto pb-10">
                  <div className="flex gap-4 px-6 sm:px-10 snap-x snap-mandatory">
                {otherGuides.map(guide => {
                  const Icon = guide.icon;
                  return (
                    <Link
                      key={guide.key}
                      to={guide.href}
                      className="group relative flex min-h-[180px] min-w-[240px] flex-shrink-0 flex-col justify-between rounded-2xl border border-white/10 bg-white/10 p-5 text-left shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white snap-start"
                    >
                      <div className="flex items-start gap-4">
                        <span className={`inline-flex items-center justify-center rounded-xl p-3 ${guide.iconBg}`}>
                          <Icon className="h-6 w-6" aria-hidden="true" />
                          <span className="sr-only">{guide.iconLabel}</span>
                        </span>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-white">{guide.title}</h3>
                          <p className="text-sm leading-5 text-indigo-100">{guide.description}</p>
                        </div>
                      </div>
                      <span className="mt-6 inline-flex items-center text-sm font-semibold text-indigo-100 transition group-hover:text-white">
                        Explore guide
                        <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        </div>

        <section
          aria-labelledby="community-indexes-heading"
          className="overflow-hidden bg-[#bf3d35] text-white"
          style={{ marginInline: 'calc(50% - 50vw)', width: '100vw' }}
        >
          <div className="px-6 pb-10 pt-8 sm:px-10">
            <div className="mx-auto flex max-w-screen-xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">In Your Area</p>
                <h2 id="community-indexes-heading" className="text-2xl font-semibold sm:text-3xl">
                  Community Indexes
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                  Explore our community indexes to discover groups and upcoming traditions in your area.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#bf3d35] via-[#bf3d35]/80 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#bf3d35] via-[#bf3d35]/80 to-transparent"
            />
            <div className="overflow-x-auto pb-10">
              <div className="flex gap-4 px-6 sm:px-10 snap-x snap-mandatory">
                {communityGuideCards.map(card => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.key}
                      to={card.href}
                      className="group relative flex min-h-[160px] min-w-[210px] flex-shrink-0 flex-col justify-between rounded-2xl border border-white/10 bg-white/10 p-5 text-left shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white snap-start"
                    >
                      <div className="flex items-start gap-4">
                        <span className={`inline-flex items-center justify-center rounded-xl p-3 ${card.iconBg}`}>
                          <Icon className="h-6 w-6" aria-hidden="true" />
                          <span className="sr-only">{card.iconLabel}</span>
                        </span>
                        <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                      </div>
                      <span className="mt-6 inline-flex items-center text-sm font-semibold text-white/80 transition group-hover:text-white">
                        Explore groups & traditions
                        <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

      </main>
      <FloatingAddButton onClick={() => setShowFlyerModal(true)} />
      <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} />
      <Footer />
    </div>
  );
}
