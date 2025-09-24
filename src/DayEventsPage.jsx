import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { RRule } from 'rrule';
import { FaStar } from 'react-icons/fa';
import { ArrowRight } from 'lucide-react';

import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { getDetailPathForItem } from './utils/eventDetailPaths';
import useEventFavorite from './utils/useEventFavorite';
import { AuthContext } from './AuthProvider';
import {
  PHILLY_TIME_ZONE,
  getWeekendWindow,
  setStartOfDay,
  setEndOfDay,
  getZonedDate,
  formatMonthDay,
  formatWeekdayAbbrev,
  parseISODate,
} from './utils/dateUtils';

// Format a Date to a Philly-local YYYY-MM-DD string (e.g., "2025-09-23")
function toPhillyISODate(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

const FILTER_OPTIONS = [
  { key: 'all', label: 'All events' },
  { key: 'big_board_events', label: 'Submissions' },
  { key: 'events', label: 'Philly traditions' },
  { key: 'all_events', label: 'Local listings' },
  { key: 'recurring_events', label: 'Recurring' },
  { key: 'group_events', label: 'Group events' },
  { key: 'sports', label: 'Sports' },
];

const SOURCE_ORDER = {
  big_board_events: 0,
  events: 1,
  all_events: 2,
  recurring_events: 3,
  group_events: 4,
  sports: 5,
};

function parseISODateInPhilly(str) {
  if (!str) return null;
  const value = typeof str === 'string' ? str.slice(0, 10) : '';
  if (!value) return null;
  return parseISODate(value, PHILLY_TIME_ZONE);
}

function parseDate(datesStr) {
  if (!datesStr) return null;
  const [first] = datesStr.split(/through|–|-/);
  const parts = first.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
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
  const [allEventsRes, traditionsRes, groupEventsRes, recurringRes, bigBoardEvents, sportsEvents] = await Promise.all([
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
        venue_id(name, slug)
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
        slug
      `)
      .order('Dates', { ascending: true }),
    supabase
      .from('group_events')
      .select(`
        *,
        groups(Name, imag, slug)
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
        image_url
      `)
      .eq('is_active', true),
    fetchBigBoardEvents(),
    fetchSportsEvents(),
  ]);

  if (allEventsRes.error) throw allEventsRes.error;
  if (traditionsRes.error) throw traditionsRes.error;
  if (groupEventsRes.error) throw groupEventsRes.error;
  if (recurringRes.error) throw recurringRes.error;

  return {
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

function collectEventsForRange(rangeStart, rangeEnd, baseData) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const rangeDays = [];
  const rangeDay = toPhillyISODate(rangeStart);
  const cursor = setStartOfDay(cloneDate(rangeStart));
  while (cursor.getTime() <= rangeEnd.getTime()) {
    rangeDays.push(toPhillyISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const todayKey = rangeDay;
  const startingToday = (baseData.allEvents || []).filter(
    evt => (evt.start_date || '').slice(0, 10) === todayKey
  );
  console.info('[DayEventsPage] all_events starting today', {
    todayKey,
    count: startingToday.length,
    sample: startingToday.slice(0, 5).map(e => ({
      id: e.id,
      name: e.name,
      start_date: e.start_date,
      end_date: e.end_date,
    })),
  });

  const bigBoard = (baseData.bigBoard || [])
    .map(ev => {
      const start = parseISODateInPhilly(ev.start_date);
      const end = parseISODateInPhilly(ev.end_date || ev.start_date) || start;
      if (!start) return null;
      return {
        ...ev,
        startDate: start,
        endDate: end,
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd))
    .map(ev => {
      const detailPath = getDetailPathForItem(ev);
      return {
        id: `big-${ev.id}`,
        title: ev.title,
        description: ev.description,
        startDate: ev.startDate,
        endDate: ev.endDate,
        start_time: ev.start_time,
        imageUrl: ev.imageUrl,
        badges: ['Submission'],
        detailPath,
        source: 'big_board_events',
        source_table: 'big_board_events',
        favoriteId: ev.id,
      };
    });

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
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd))
    .map(ev => ({
      ...ev,
      badges: ['Tradition'],
      detailPath: getDetailPathForItem({ ...ev, isTradition: true }),
      source: 'events',
      source_table: 'events',
      favoriteId: ev.sourceId,
    }));

  const beforeMap = (baseData.allEvents || []).length;

  const allMapped = (baseData.allEvents || [])
    .map(evt => {
      const startKey = (evt.start_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
      const endKey = ((evt.end_date || evt.start_date) || '').slice(0, 10) || startKey;
      const [ys, ms, ds] = startKey.split('-').map(Number);
      const [ye, me, de] = endKey.split('-').map(Number);
      const startDate = new Date(ys, ms - 1, ds);
      const endDate = new Date(ye, me - 1, de);
      return {
        id: `event-${evt.id}`,
        sourceId: evt.id,
        title: evt.name,
        description: evt.description,
        imageUrl: evt.image || '',
        startKey,
        endKey,
        startDate,
        endDate,
        start_time: evt.start_time,
        end_time: evt.end_time,
        slug: evt.slug,
        venues: evt.venue_id,
      };
    })
    .filter(Boolean);

  const afterMap = allMapped.length;

  const overlapping = allMapped.filter(ev => rangeDays.some(day => ev.startKey <= day && ev.endKey >= day));
  const afterOverlap = overlapping.length;

  const limitedSpan = overlapping.filter(ev => {
    const spanDays = Math.floor((new Date(ev.endKey) - new Date(ev.startKey)) / MS_PER_DAY) + 1;
    return spanDays <= 10;
  });
  const afterSpan = limitedSpan.length;

  console.info('[DayEventsPage] all_events counts', {
    beforeMap,
    afterMap,
    afterOverlap,
    afterSpan,
  });

  const singleDayEvents = limitedSpan.map(ev => ({
    ...ev,
    badges: ['Listed Event'],
    detailPath: getDetailPathForItem(ev),
    source: 'all_events',
    source_table: 'all_events',
    favoriteId: ev.sourceId,
  }));

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
        const isoDate = startDate.toISOString().slice(0, 10);
        return {
          id: `${series.id}::${isoDate}`,
          title: series.name,
          description: series.description,
          imageUrl: series.image_url || '',
          startDate,
          endDate: startDate,
          start_time: series.start_time,
          slug: series.slug,
          address: series.address,
          badges: ['Recurring'],
          detailPath: getDetailPathForItem({
            id: `${series.id}::${isoDate}`,
            slug: series.slug,
            start_date: isoDate,
            isRecurring: true,
          }),
          source: 'recurring_events',
          source_table: 'recurring_events',
          favoriteId: series.id,
        };
      });
    } catch (err) {
      console.error('rrule parse error', err);
      return [];
    }
  });

  const groupEvents = (baseData.groupEvents || [])
    .map(evt => {
      const start = parseISODateInPhilly((evt.start_date || '').slice(0, 10));
      if (!start) return null;
      const end = parseISODateInPhilly((evt.end_date || '').slice(0, 10)) || start;
      const groupRecord = Array.isArray(evt.groups) ? evt.groups[0] : evt.groups;
      const detailPath = getDetailPathForItem({
        ...evt,
        group_slug: groupRecord?.slug,
        isGroupEvent: true,
      });
      return {
        id: `group-${evt.id}`,
        title: evt.title,
        description: evt.description,
        imageUrl: groupRecord?.imag || '',
        startDate: start,
        endDate: end,
        start_time: evt.start_time,
        badges: ['Group Event'],
        detailPath,
        source: 'group_events',
        source_table: 'group_events',
        favoriteId: evt.id,
        group: groupRecord,
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd));

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
        endDate: start,
        start_time: evt.start_time,
        badges: ['Sports'],
        externalUrl: evt.url,
        source: 'sports',
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd));

  const combined = [
    ...bigBoard,
    ...traditions,
    ...singleDayEvents,
    ...recurring,
    ...groupEvents,
    ...sports,
  ].sort((a, b) => {
    const orderDiff = (SOURCE_ORDER[a.source] ?? 99) - (SOURCE_ORDER[b.source] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    const dateDiff = a.startDate - b.startDate;
    if (dateDiff !== 0) return dateDiff;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  const countsBySource = combined.reduce((acc, evt) => {
    acc[evt.source] = (acc[evt.source] || 0) + 1;
    return acc;
  }, {});

  return {
    events: combined,
    total: combined.length,
    traditions: countsBySource.events || 0,
    countsBySource,
  };
}

function formatEventTiming(event, now) {
  const eventDate = setStartOfDay(new Date(event.startDate));
  const diffMs = eventDate.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return `Today${event.start_time ? ` · ${formatTime(event.start_time)}` : ''}`;
  }
  if (diffDays === 1) {
    return `Tomorrow${event.start_time ? ` · ${formatTime(event.start_time)}` : ''}`;
  }
  const weekday = formatWeekdayAbbrev(event.startDate, PHILLY_TIME_ZONE);
  return `${weekday}${event.start_time ? ` · ${formatTime(event.start_time)}` : ''}`;
}

function formatSummary(rangeKey, total, traditions, start, end) {
  if (total === 0) return 'No events listed yet — check back soon!';
  const base =
    rangeKey === 'weekend'
      ? `${total} event${total === 1 ? '' : 's'} this weekend`
      : `${total} event${total === 1 ? '' : 's'} on ${formatMonthDay(start, PHILLY_TIME_ZONE)}`;
  if (traditions > 0) {
    return `${base}, including ${traditions} Philly tradition${traditions === 1 ? '' : 's'}!`;
  }
  return `${base}!`;
}

function FavoriteState({ eventId, sourceTable, children }) {
  const state = useEventFavorite({ event_id: eventId, source_table: sourceTable });
  return children(state);
}

function EventListItem({ event, now }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const label = formatEventTiming(event, now);
  const badges = event.badges || [];
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};
  const containerClass = event.detailPath
    ? 'block rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
    : 'rounded-2xl border border-gray-200 bg-white shadow-sm';

  const actions = event.source_table ? (
    <FavoriteState eventId={event.favoriteId} sourceTable={event.source_table}>
      {({ isFavorite, toggleFavorite, loading }) => (
        <button
          type="button"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (!user) {
              navigate('/login');
              return;
            }
            toggleFavorite();
          }}
          disabled={loading}
          className={`border border-indigo-600 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            isFavorite
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
          }`}
        >
          {isFavorite ? 'In the Plans' : 'Add to Plans'}
        </button>
      )}
    </FavoriteState>
  ) : event.externalUrl ? (
    <a
      href={event.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="border border-indigo-600 rounded-full px-4 py-2 text-sm font-semibold text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors text-center"
    >
      Get Tickets
    </a>
  ) : null;

  return (
    <Wrapper {...wrapperProps} className={containerClass}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between p-4 md:p-6">
        <div className="flex items-start gap-4 w-full">
          <div className="hidden sm:block flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
            {event.imageUrl && (
              <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">{label}</span>
              {badges.map(badge => (
                <span
                  key={badge}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                    badge === 'Tradition'
                      ? 'bg-yellow-100 text-yellow-800'
                      : badge === 'Submission'
                      ? 'bg-purple-100 text-purple-800'
                      : badge === 'Sports'
                      ? 'bg-green-100 text-green-800'
                      : badge === 'Recurring'
                      ? 'bg-blue-100 text-blue-800'
                      : badge === 'Group Event'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {badge === 'Tradition' && <FaStar className="text-yellow-500" />}
                  {badge}
                </span>
              ))}
            </div>
            <h3 className="mt-2 text-lg font-bold text-gray-800 break-words">{event.title}</h3>
            {event.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{event.description}</p>
            )}
            {event.venues?.name && (
              <p className="mt-1 text-sm text-gray-500">at {event.venues.name}</p>
            )}
            {event.address && !event.venues?.name && (
              <p className="mt-1 text-sm text-gray-500">at {event.address}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-col items-stretch gap-2 md:w-40">{actions}</div>}
      </div>
    </Wrapper>
  );
}

function getRangeMetadata(view, nowInPhilly) {
  const today = setStartOfDay(cloneDate(nowInPhilly));
  if (!view || view === 'today') {
    return {
      key: 'today',
      start: today,
      end: setEndOfDay(cloneDate(today)),
    };
  }
  if (view === 'tomorrow') {
    const start = cloneDate(today);
    start.setDate(start.getDate() + 1);
    return {
      key: 'tomorrow',
      start,
      end: setEndOfDay(cloneDate(start)),
    };
  }
  if (view === 'weekend') {
    const { start, end } = getWeekendWindow(nowInPhilly, PHILLY_TIME_ZONE);
    return {
      key: 'weekend',
      start: setStartOfDay(cloneDate(start)),
      end: setEndOfDay(cloneDate(end)),
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(view || '')) {
    const parsed = parseISODateInPhilly(view);
    if (parsed) {
      return {
        key: 'custom',
        start: setStartOfDay(parsed),
        end: setEndOfDay(cloneDate(parsed)),
        iso: view,
      };
    }
  }
  return {
    key: 'today',
    start: today,
    end: setEndOfDay(cloneDate(today)),
  };
}

function formatRangeLabel(rangeKey, start, end) {
  if (rangeKey === 'weekend') {
    return `${formatMonthDay(start, PHILLY_TIME_ZONE)} – ${formatMonthDay(end, PHILLY_TIME_ZONE)}`;
  }
  return formatMonthDay(start, PHILLY_TIME_ZONE);
}

export default function DayEventsPage() {
  const { view } = useParams();
  const navigate = useNavigate();
  const nowInPhilly = useMemo(() => getZonedDate(new Date(), PHILLY_TIME_ZONE), []);
  const range = useMemo(() => getRangeMetadata(view, nowInPhilly), [view, nowInPhilly]);
  const [selectedDate, setSelectedDate] = useState(range.start);
  const [activeFilter, setActiveFilter] = useState('all');
  const [baseData, setBaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSelectedDate(range.start);
  }, [range.start]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchBaseData();
        if (!cancelled) {
          console.info('[DayEventsPage] base counts', {
            all: (data?.allEvents || []).length,
            traditions: (data?.traditions || []).length,
            group: (data?.groupEvents || []).length,
            recurring: (data?.recurring || []).length,
            big: (data?.bigBoard || []).length,
            sports: (data?.sports || []).length,
          });
          setBaseData(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading events', err);
        if (!cancelled) {
          setError('We had trouble loading events. Please try again soon.');
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
  }, []);

  const detailed = useMemo(() => {
    if (!baseData) {
      return { events: [], total: 0, traditions: 0, countsBySource: {} };
    }
    return collectEventsForRange(range.start, range.end, baseData);
  }, [baseData, range.start, range.end]);

  useEffect(() => {
    if (activeFilter === 'all') return;
    if ((detailed.countsBySource?.[activeFilter] || 0) === 0) {
      setActiveFilter('all');
    }
  }, [activeFilter, detailed.countsBySource]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return detailed.events;
    return detailed.events.filter(evt => evt.source === activeFilter);
  }, [activeFilter, detailed.events]);

  const headline = useMemo(() => {
    switch (range.key) {
      case 'tomorrow':
        return 'Events Tomorrow in Philadelphia';
      case 'weekend':
        return 'Events This Weekend in Philadelphia';
      case 'custom':
        return `Events on ${formatRangeLabel('custom', range.start, range.end)} in Philadelphia`;
      default:
        return 'Events Today in Philadelphia';
    }
  }, [range.key, range.start, range.end]);

  const summary = useMemo(
    () => formatSummary(range.key, detailed.total, detailed.traditions, range.start, range.end),
    [range.key, detailed.total, detailed.traditions, range.start, range.end]
  );

  const pageTitle = useMemo(() => {
    switch (range.key) {
      case 'tomorrow':
        return 'Events in Philly Tomorrow';
      case 'weekend':
        return 'Events in Philly This Weekend';
      case 'custom':
        return `Events in Philly on ${formatRangeLabel('custom', range.start, range.end)}`;
      default:
        return 'Events in Philly Today';
    }
  }, [range.key, range.start, range.end]);

  const metaDescription = detailed.total
    ? `Browse ${detailed.total} event${detailed.total === 1 ? '' : 's'} ${
        range.key === 'weekend'
          ? 'this weekend'
          : range.key === 'tomorrow'
          ? 'tomorrow'
          : range.key === 'custom'
          ? `on ${formatRangeLabel('custom', range.start, range.end)}`
          : 'today'
      } in Philadelphia.`
    : 'No events found for this date in Philadelphia.';

  const handleDatePick = date => {
    if (!date) return;
    setSelectedDate(date);
    const iso = date.toISOString().slice(0, 10);
    navigate(`/${iso}`);
  };

  const quickLinks = [
    { key: 'today', label: 'Today', href: '/today' },
    { key: 'tomorrow', label: 'Tomorrow', href: '/tomorrow' },
    { key: 'weekend', label: 'This Weekend', href: '/weekend' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
      </Helmet>
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">All events for</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-[#28313e]">{headline}</h1>
            <p className="mt-3 text-sm sm:text-base text-gray-600">{summary}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-gray-500">
              {formatRangeLabel(range.key, range.start, range.end)}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <div className="flex flex-wrap justify-center gap-2">
                {quickLinks.map(link => (
                  <Link
                    key={link.key}
                    to={link.href}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition ${
                      range.key === link.key
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
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

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {FILTER_OPTIONS.map(option => {
              const count = option.key === 'all' ? detailed.total : detailed.countsBySource?.[option.key] || 0;
              const disabled = option.key !== 'all' && count === 0;
              const isActive = activeFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveFilter(option.key)}
                  disabled={disabled}
                  className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                  {option.key === 'all' ? ` (${detailed.total})` : count ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>

          <div className="mt-10 space-y-4">
            {loading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                    <div className="mt-4 h-6 w-3/4 bg-gray-200 animate-pulse rounded" />
                    <div className="mt-2 h-4 w-full bg-gray-200 animate-pulse rounded" />
                  </div>
                ))
              : filteredEvents.length > 0
              ? filteredEvents.map(event => <EventListItem key={event.id} event={event} now={nowInPhilly} />)
              : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
                    {activeFilter === 'all'
                      ? 'No events listed yet — check back soon!'
                      : 'No events match this filter. Try another option.'}
                  </div>
                )}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Back to Make Your Philly Plans
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

