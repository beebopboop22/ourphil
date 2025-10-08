import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RRule } from 'rrule';
import { FaStar } from 'react-icons/fa';
import { Filter, XCircle } from 'lucide-react';

import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { getDetailPathForItem } from './utils/eventDetailPaths';
import useEventFavorite from './utils/useEventFavorite';
import { AuthContext } from './AuthProvider';
import {
  getZonedDate,
  setStartOfDay,
  setEndOfDay,
  PHILLY_TIME_ZONE,
  formatMonthDay,
  formatWeekdayAbbrev,
  parseISODate,
} from './utils/dateUtils';

const SEARCH_WINDOW_DAYS = 60;

const popularTags = [
  { slug: 'nomnomslurp', label: 'nomnomslurp' },
  { slug: 'markets', label: 'markets' },
  { slug: 'music', label: 'music' },
  { slug: 'family', label: 'family' },
  { slug: 'arts', label: 'arts' },
];

const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

const SOURCE_ORDER = {
  big_board_events: 0,
  events: 1,
  all_events: 2,
  recurring_events: 3,
  group_events: 4,
  sports: 5,
};

function toPhillyISODate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PHILLY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

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

function TagFilterModal({ open, tags, selectedTags, onToggle, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="mb-6 text-center text-lg font-semibold">Select Tags</h2>
        <div className="mb-6 flex flex-wrap gap-3">
          {tags.map((tag, index) => {
            const isActive = selectedTags.includes(tag.slug);
            const cls = isActive ? pillStyles[index % pillStyles.length] : 'bg-gray-200 text-gray-700';
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => onToggle(tag.slug, !isActive)}
                className={`${cls} rounded-full px-4 py-2 text-sm font-semibold transition`}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
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
      if (!res.ok) continue;
      const json = await res.json();
      all.push(...(json.events || []));
    }
    return all.map((event) => {
      const dt = new Date(event.datetime_local);
      const performers = event.performers || [];
      const home = performers.find((p) => p.home_team) || performers[0] || {};
      const away = performers.find((p) => p.id !== home.id) || {};
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
  return (data || []).map((row) => {
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

async function fetchBaseData(rangeStartDay, rangeEndDay) {
  const startFilter = rangeStartDay || null;
  const endFilter = rangeEndDay || rangeStartDay || null;

  let allEventsQuery = supabase
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
        venue_id,
        venues:venue_id(name, slug)
      `);

  if (startFilter && endFilter) {
    allEventsQuery = allEventsQuery
      .lte('start_date', endFilter)
      .or(
        `and(end_date.is.null,start_date.gte.${startFilter},start_date.lte.${endFilter}),` +
          `end_date.gte.${startFilter}`
      );
  }

  allEventsQuery = allEventsQuery.order('start_date', { ascending: true }).limit(5000);

  const [allEventsRes, traditionsRes, groupEventsRes, recurringRes, bigBoardEvents, sportsEvents] = await Promise.all([
    allEventsQuery,
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
        start_time
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
  const cursor = setStartOfDay(cloneDate(rangeStart));
  while (cursor.getTime() <= rangeEnd.getTime()) {
    rangeDays.push(toPhillyISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const bigBoard = (baseData.bigBoard || [])
    .map((ev) => {
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
    .filter((ev) => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd))
    .map((ev) => ({
      id: `big-${ev.id}`,
      title: ev.title,
      description: ev.description,
      startDate: ev.startDate,
      endDate: ev.endDate,
      start_time: ev.start_time,
      imageUrl: ev.imageUrl,
      detailPath: getDetailPathForItem(ev),
      source: 'big_board_events',
      source_table: 'big_board_events',
      favoriteId: ev.id,
      badges: ['Submission'],
    }));

  const traditions = (baseData.traditions || [])
    .map((row) => {
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
        start_time: row.start_time || null,
      };
    })
    .filter(Boolean)
    .filter((ev) => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd))
    .map((ev) => ({
      ...ev,
      badges: ['Tradition'],
      detailPath: getDetailPathForItem({ ...ev, isTradition: true }),
      source: 'events',
      source_table: 'events',
      favoriteId: ev.sourceId,
    }));

  const filteredAllEvents = (baseData.allEvents || [])
    .map((evt) => {
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
        venues: evt.venues,
      };
    })
    .filter(Boolean)
    .filter((ev) =>
      rangeDays.some((day) => {
        const isStartDay = ev.startKey === day;
        const inRange = ev.startKey <= day && ev.endKey >= day;
        const startMs = Date.parse(ev.startKey);
        const endMs = Date.parse(ev.endKey);
        const spanMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;
        const spanDays = Math.floor(spanMs / MS_PER_DAY) + 1;
        const shortOrSingle = spanDays <= 10;
        return isStartDay || (inRange && shortOrSingle);
      })
    );

  const singleDayEvents = filteredAllEvents.map((ev) => ({
    ...ev,
    badges: ['Listed Event'],
    detailPath: getDetailPathForItem(ev),
    source: 'all_events',
    source_table: 'all_events',
    favoriteId: ev.sourceId,
  }));

  const recurring = (baseData.recurring || []).flatMap((series) => {
    try {
      const opts = RRule.parseString(series.rrule);
      opts.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
      if (series.end_date) {
        opts.until = new Date(`${series.end_date}T23:59:59`);
      }
      const rule = new RRule(opts);
      const occurrences = rule.between(rangeStart, rangeEnd, true);
      return occurrences.map((occurrence) => {
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
    .map((evt) => {
      const start = parseISODateInPhilly((evt.start_date || '').slice(0, 10));
      if (!start) return null;
      const end = parseISODateInPhilly((evt.end_date || '').slice(0, 10)) || start;
      const groupRecord = Array.isArray(evt.groups) ? evt.groups[0] : evt.groups;
      const groupStatus = typeof groupRecord?.status === 'string' ? groupRecord.status.toLowerCase() : '';
      const isFeaturedGroup = groupStatus === 'home';
      const badges = ['Group Event'];
      if (isFeaturedGroup) {
        badges.push('Featured');
      }
      const detailPath = getDetailPathForItem({
        ...evt,
        group_slug: groupRecord?.slug,
        isGroupEvent: true,
      });
      let imageUrl = '';
      const rawImage = evt.image_url || evt.image || '';
      if (rawImage) {
        if (rawImage.startsWith('http')) {
          imageUrl = rawImage;
        } else {
          const { data } = supabase.storage.from('big-board').getPublicUrl(rawImage);
          imageUrl = data?.publicUrl || '';
        }
      } else if (groupRecord?.imag) {
        imageUrl = groupRecord.imag;
      }
      return {
        id: `group-${evt.id}`,
        title: evt.title,
        description: evt.description,
        imageUrl,
        startDate: start,
        endDate: end,
        start_time: evt.start_time,
        badges,
        detailPath,
        source: 'group_events',
        source_table: 'group_events',
        favoriteId: evt.id,
        group: groupRecord,
        isFeaturedGroup,
        groupStatus: groupRecord?.status || '',
      };
    })
    .filter(Boolean)
    .filter((ev) => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd));

  const sports = (baseData.sports || [])
    .map((evt) => {
      const start = parseISODateInPhilly(evt.start_date);
      if (!start) return null;
      return {
        id: `sports-${evt.id}`,
        title: evt.title,
        description: evt.short_title || evt.title,
        imageUrl: evt.imageUrl || '',
        startDate: start,
        endDate: start,
        start_time: evt.start_time,
        externalUrl: evt.url,
        source: 'sports',
        badges: ['Sports'],
      };
    })
    .filter(Boolean)
    .filter((ev) => eventOverlapsRange(ev.startDate, ev.endDate, rangeStart, rangeEnd));

  const combined = [...bigBoard, ...traditions, ...singleDayEvents, ...recurring, ...groupEvents, ...sports].sort((a, b) => {
    const orderDiff = (SOURCE_ORDER[a.source] ?? 99) - (SOURCE_ORDER[b.source] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    const dateDiff = a.startDate - b.startDate;
    if (dateDiff !== 0) return dateDiff;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  return {
    events: combined,
  };
}

function formatEventTiming(event, now) {
  if (!event?.startDate) return '';
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const todayStart = setStartOfDay(new Date(now));
  const start = setStartOfDay(new Date(event.startDate));
  const end = event.endDate ? setStartOfDay(new Date(event.endDate)) : start;
  const effectiveStart = start.getTime() < todayStart.getTime() ? todayStart : start;
  const diffDays = Math.round((effectiveStart.getTime() - todayStart.getTime()) / MS_PER_DAY);
  const weekday = formatWeekdayAbbrev(effectiveStart, PHILLY_TIME_ZONE);
  const monthDay = formatMonthDay(effectiveStart, PHILLY_TIME_ZONE);

  let label;
  if (diffDays === 0) {
    label = `Today · ${monthDay}`;
  } else if (diffDays === 1) {
    label = `Tomorrow · ${monthDay}`;
  } else if (diffDays > 1 && diffDays <= 6) {
    label = `This ${weekday} · ${monthDay}`;
  } else {
    label = `${weekday}, ${monthDay}`;
  }

  if (event.start_time) {
    label += ` · ${formatTime(event.start_time)}`;
  }

  if (end.getTime() > start.getTime()) {
    const endWeekday = formatWeekdayAbbrev(end, PHILLY_TIME_ZONE);
    const endMonthDay = formatMonthDay(end, PHILLY_TIME_ZONE);
    label += ` · Ends ${endWeekday}, ${endMonthDay}`;
  }

  return label;
}

function FavoriteState({ eventId, sourceTable, children }) {
  const state = useEventFavorite({ event_id: eventId, source_table: sourceTable });
  return children(state);
}

function EventListItem({ event, now, tags = [] }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const label = formatEventTiming(event, now);
  const badges = event.badges || [];
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};
  const containerClass = event.detailPath
    ? 'block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
    : 'block rounded-2xl border border-gray-200 bg-white shadow-sm';

  const actions = event.source_table ? (
    <FavoriteState eventId={event.favoriteId} sourceTable={event.source_table}>
      {({ isFavorite, toggleFavorite, loading }) => (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!user) {
              navigate('/login');
              return;
            }
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
  ) : event.externalUrl ? (
    <a
      href={event.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
      onClick={(e) => e.stopPropagation()}
    >
      Get Tickets
    </a>
  ) : null;

  return (
    <Wrapper {...wrapperProps} className={containerClass}>
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex w-full items-start gap-4">
          <div className="hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:block">
            {event.imageUrl && (
              <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{label}</span>
              {badges.map((badge) => (
                <span
                  key={badge}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
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
                      : badge === 'Featured'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {badge === 'Tradition' && <FaStar className="text-yellow-500" />}
                  {badge}
                </span>
              ))}
            </div>
            <h3 className="mt-2 break-words text-lg font-bold text-gray-800">{event.title}</h3>
            {event.description && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{event.description}</p>
            )}
            {event.venues?.name && (
              <p className="mt-1 text-sm text-gray-500">at {event.venues.name}</p>
            )}
            {event.address && !event.venues?.name && (
              <p className="mt-1 text-sm text-gray-500">at {event.address}</p>
            )}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.slice(0, 3).map((tag) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    #{tag.name}
                  </Link>
                ))}
                {tags.length > 3 && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    +{tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </Wrapper>
  );
}

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [baseData, setBaseData] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState('all');

  const todayInPhilly = useMemo(() => {
    const now = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    return setStartOfDay(now);
  }, []);

  const rangeEnd = useMemo(() => {
    const end = new Date(todayInPhilly);
    end.setDate(end.getDate() + SEARCH_WINDOW_DAYS);
    return setEndOfDay(end);
  }, [todayInPhilly]);

  const rangeStartKey = useMemo(() => toPhillyISODate(todayInPhilly), [todayInPhilly]);
  const rangeEndKey = useMemo(() => toPhillyISODate(rangeEnd), [rangeEnd]);

  useEffect(() => {
    setSelectedTags([]);
    setSelectedDateKey('all');
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (!query) {
      setBaseData(null);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchBaseData(rangeStartKey, rangeEndKey);
        if (!cancelled) {
          setBaseData(data);
        }
      } catch (err) {
        console.error('Search load error', err);
        if (!cancelled) {
          setError('Something went wrong while searching. Please try again.');
          setBaseData(null);
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
  }, [query, rangeStartKey, rangeEndKey]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('tags')
      .select('name, slug')
      .order('name', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          console.error('Tag load error', loadError);
          setAllTags([]);
        } else {
          setAllTags(data || []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const detailed = useMemo(() => {
    if (!baseData) return { events: [] };
    return collectEventsForRange(todayInPhilly, rangeEnd, baseData);
  }, [baseData, todayInPhilly, rangeEnd]);

  const normalizedQuery = query.toLowerCase();

  const matchedEvents = useMemo(() => {
    if (!normalizedQuery || !detailed.events.length) return [];
    return detailed.events.filter((event) => {
      const haystacks = [
        event.title,
        event.description,
        event.group?.Name,
        event.group?.name,
        event.venues?.name,
      ];
      return haystacks.some((value) =>
        typeof value === 'string' ? value.toLowerCase().includes(normalizedQuery) : false
      );
    });
  }, [detailed.events, normalizedQuery]);

  useEffect(() => {
    const idsByType = matchedEvents.reduce((acc, event) => {
      if (!event?.source_table || !event.favoriteId) return acc;
      const table = event.source_table;
      if (!acc[table]) acc[table] = new Set();
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
        const responses = await Promise.all(
          entries.map(([table, ids]) =>
            supabase
              .from('taggings')
              .select('taggable_id, tags:tags(name, slug)')
              .eq('taggable_type', table)
              .in('taggable_id', Array.from(ids))
          )
        );
        if (cancelled) return;
        const next = {};
        responses.forEach((res, index) => {
          const table = entries[index][0];
          if (res.error) {
            console.error('Failed to load taggings for', table, res.error);
            return;
          }
          res.data?.forEach((row) => {
            if (!row?.tags) return;
            const key = `${table}:${row.taggable_id}`;
            if (!next[key]) next[key] = [];
            next[key].push(row.tags);
          });
        });
        setTagMap(next);
      } catch (err) {
        console.error('Error loading taggings', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchedEvents]);

  const getEventTags = (event) => {
    if (!event?.source_table || !event.favoriteId) return [];
    return tagMap[`${event.source_table}:${event.favoriteId}`] || [];
  };

  const dateOptions = useMemo(() => {
    const seen = new Map();
    const todayKey = toPhillyISODate(todayInPhilly);

    matchedEvents.forEach((event) => {
      if (!event.startDate) return;
      const start = setStartOfDay(new Date(event.startDate));
      const end = event.endDate ? setStartOfDay(new Date(event.endDate)) : start;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        const day = setStartOfDay(new Date(cursor));
        const normalized = day < todayInPhilly ? todayInPhilly : day;
        const key = toPhillyISODate(normalized);
        if (key >= todayKey && !seen.has(key)) {
          seen.set(key, normalized);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return Array.from(seen.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, date]) => ({ key, date }));
  }, [matchedEvents, todayInPhilly]);

  const eventsAfterDate = useMemo(() => {
    if (selectedDateKey === 'all') return matchedEvents;
    const target = parseISODate(selectedDateKey, PHILLY_TIME_ZONE);
    if (!target) return matchedEvents;

    return matchedEvents.filter((event) => {
      if (!event.startDate) return false;
      const start = setStartOfDay(new Date(event.startDate));
      const end = event.endDate ? setStartOfDay(new Date(event.endDate)) : start;
      const effectiveStart = start < todayInPhilly ? todayInPhilly : start;

      if (target.getTime() === effectiveStart.getTime()) {
        return true;
      }

      return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
    });
  }, [matchedEvents, selectedDateKey, todayInPhilly]);

  const eventsAfterTags = useMemo(() => {
    if (!selectedTags.length) return eventsAfterDate;
    return eventsAfterDate.filter((event) => {
      const tags = getEventTags(event);
      if (!tags.length) return false;
      return tags.some((tag) => selectedTags.includes(tag.slug));
    });
  }, [eventsAfterDate, selectedTags, tagMap]);

  const sortedEvents = useMemo(() => {
    return [...eventsAfterTags].sort((a, b) => {
      const dateDiff = (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0);
      if (dateDiff !== 0) return dateDiff;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
  }, [eventsAfterTags]);

  const hasFilters = selectedTags.length > 0 || selectedDateKey !== 'all';

  const pageTitle = query ? `Search results for "${query}" | Our Philly` : 'Search events | Our Philly';

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Helmet>
        <title>{pageTitle}</title>
        {query && <meta name="robots" content="noindex" />}
      </Helmet>
      <Navbar />
      <main className="flex-1 pb-16 pt-32 sm:pt-40">
        <div className="mx-auto w-full max-w-6xl px-4">
          <header className="text-center">
            <h1 className="text-4xl font-[Barrio] text-[#28313e]">Search Our Philly</h1>
            {query ? (
              <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
                Showing upcoming events that match <span className="font-semibold">“{query}”</span>.
              </p>
            ) : (
              <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
                Use the search bar above to explore upcoming festivals, markets, and happenings around Philadelphia.
              </p>
            )}
          </header>

          <div className="mt-10 flex flex-wrap items-center justify-end gap-2">
            {hasFilters && (
              <button
                onClick={() => {
                  setSelectedTags([]);
                  setSelectedDateKey('all');
                }}
                className="text-sm text-gray-500 hover:underline"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => setIsFiltersOpen(true)}
              className="flex items-center gap-1 rounded-full border-2 border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 shadow-lg"
            >
              <Filter className="h-4 w-4" />
              {`Filters${selectedTags.length ? ` (${selectedTags.length})` : ''}`}
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-2">
            <button
              type="button"
              onClick={() => setSelectedDateKey('all')}
              className={`flex-shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold shadow-lg transition-colors ${
                selectedDateKey === 'all'
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              All Dates
            </button>
            {dateOptions.map(({ key, date }) => {
              const isActive = selectedDateKey === key;
              const label = `${formatWeekdayAbbrev(date, PHILLY_TIME_ZONE)}, ${formatMonthDay(date, PHILLY_TIME_ZONE)}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDateKey(key)}
                  className={`flex-shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold shadow-lg transition-colors ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-2">
            <span className="flex-shrink-0 text-sm font-semibold text-gray-700">Popular tags:</span>
            {popularTags.map((tag, index) => {
              const isActive = selectedTags.includes(tag.slug);
              const cls = pillStyles[index % pillStyles.length];
              return (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => {
                    setSelectedTags((prev) =>
                      isActive ? prev.filter((slug) => slug !== tag.slug) : [...prev, tag.slug]
                    );
                  }}
                  className={`${cls} flex-shrink-0 rounded-full px-3 py-1 text-sm font-semibold shadow-lg transition ${
                    isActive ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                  }`}
                >
                  #{tag.label}
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="flex-shrink-0 text-gray-500 hover:text-gray-700"
                aria-label="Clear selected tags"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
          </div>

          <TagFilterModal
            open={isFiltersOpen}
            tags={allTags}
            selectedTags={selectedTags}
            onToggle={(slug, checked) => {
              setSelectedTags((prev) => (checked ? [...prev, slug] : prev.filter((tag) => tag !== slug)));
            }}
            onClose={() => setIsFiltersOpen(false)}
          />

          <section className="mt-12 space-y-6">
            {loading && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm">
                Searching events…
              </div>
            )}

            {error && !loading && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">{error}</div>
            )}

            {!loading && !error && query && sortedEvents.length === 0 && (
              <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">No upcoming events found</h2>
                  <p className="mt-2 text-gray-600">
                    We couldn’t find any upcoming events that match “{query}”. Try a different keyword or explore our curated
                    guides below.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Link
                    to="/all-guides/"
                    className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-center font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100"
                  >
                    Explore Our Guides
                  </Link>
                  <Link
                    to="/this-weekend-in-philadelphia/"
                    className="rounded-xl border border-pink-100 bg-pink-50 px-5 py-4 text-center font-semibold text-pink-700 transition hover:border-pink-200 hover:bg-pink-100"
                  >
                    This Weekend in Philadelphia
                  </Link>
                </div>
              </div>
            )}

            {!loading && !error && sortedEvents.length > 0 && (
              <div className="flex flex-col gap-4">
                {sortedEvents.map((event) => (
                  <EventListItem key={event.id} event={event} now={todayInPhilly} tags={getEventTags(event)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
