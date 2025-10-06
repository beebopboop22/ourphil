import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { RRule } from 'rrule';
import { FaStar } from 'react-icons/fa';
import { ArrowRight, Filter, Sparkles, XCircle } from 'lucide-react';

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

const SOURCE_ORDER = {
  big_board_events: 0,
  events: 1,
  all_events: 2,
  recurring_events: 3,
  group_events: 4,
  sports: 5,
};

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
        <h2 className="text-lg font-semibold text-center mb-6">Select Tags</h2>
        <div className="flex flex-wrap gap-3 mb-6">
          {tags.map((tag, index) => {
            const isActive = selectedTags.includes(tag.slug);
            const cls = isActive ? pillStyles[index % pillStyles.length] : 'bg-gray-200 text-gray-700';
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => onToggle(tag.slug, !isActive)}
                className={`${cls} px-4 py-2 rounded-full text-sm font-semibold transition`}
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
            className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition"
          >
            Done
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-2xl text-gray-400 hover:text-gray-600"
          aria-label="Close filters"
        >
          &times;
        </button>
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
  const rangeDay = toPhillyISODate(rangeStart);
  const cursor = setStartOfDay(cloneDate(rangeStart));
  while (cursor.getTime() <= rangeEnd.getTime()) {
    rangeDays.push(toPhillyISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

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
        start_time: row.start_time || null,
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

  const filteredAllEvents = (baseData.allEvents || [])
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
        venues: evt.venues,
      };
    })
    .filter(Boolean)
    .filter(ev =>
      rangeDays.some(day => {
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

  const singleDayEvents = filteredAllEvents.map(ev => ({
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

function EventListItem({ event, now, tags = [], variant = 'default' }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const label = formatEventTiming(event, now);
  const badges = event.badges || [];
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};
  const baseContainerClass =
    variant === 'featured'
      ? 'rounded-2xl border-2 border-amber-400 bg-white shadow-md'
      : 'rounded-2xl border border-gray-200 bg-white shadow-sm';
  const interactiveContainerClass =
    variant === 'featured'
      ? 'block rounded-2xl border-2 border-amber-400 bg-white shadow-md hover:shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500'
      : 'block rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
  const containerClass = event.detailPath ? interactiveContainerClass : baseContainerClass;

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
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.slice(0, 3).map((tag, index) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    className={`${pillStyles[index % pillStyles.length]} px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-80`}
                    onClick={e => e.stopPropagation()}
                  >
                    #{tag.name}
                  </Link>
                ))}
                {tags.length > 3 && <span className="text-xs text-gray-500">+{tags.length - 3} more</span>}
              </div>
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
  const [baseData, setBaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [allTags, setAllTags] = useState([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(range.start);
  }, [range.start]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rangeStartDay = toPhillyISODate(range.start);
        const rangeEndDay = toPhillyISODate(range.end);
        const data = await fetchBaseData(rangeStartDay, rangeEndDay);
        if (!cancelled) {
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
  }, [range.start, range.end]);

  const detailed = useMemo(() => {
    if (!baseData) {
      return { events: [], total: 0, traditions: 0, countsBySource: {} };
    }
    return collectEventsForRange(range.start, range.end, baseData);
  }, [baseData, range.start, range.end]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('tags')
      .select('name, slug')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Tag load error', error);
          setAllTags([]);
        } else {
          setAllTags(data || []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const idsByType = detailed.events.reduce((acc, event) => {
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
          res.data?.forEach(row => {
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
  }, [detailed.events]);

  const filteredEvents = useMemo(() => {
    if (!selectedTags.length) return detailed.events;
    return detailed.events.filter(event => {
      if (!event.source_table || !event.favoriteId) return false;
      const key = `${event.source_table}:${event.favoriteId}`;
      const tagsForEvent = tagMap[key] || [];
      if (!tagsForEvent.length) return false;
      return tagsForEvent.some(tag => selectedTags.includes(tag.slug));
    });
  }, [selectedTags, detailed.events, tagMap]);

  const featuredEvents = useMemo(() => {
    const seenGroups = new Set();
    return filteredEvents.filter(event => {
      if (!event.isFeaturedGroup) return false;
      const group = event.group || {};
      const slug = typeof group.slug === 'string' ? group.slug.toLowerCase() : '';
      const name = typeof group.Name === 'string' ? group.Name.trim().toLowerCase() : '';
      const key = slug || name || '__unknown__';
      if (seenGroups.has(key)) return false;
      seenGroups.add(key);
      return true;
    });
  }, [filteredEvents]);

  const featuredEventIds = useMemo(() => new Set(featuredEvents.map(event => event.id)), [featuredEvents]);

  const regularEvents = useMemo(
    () => filteredEvents.filter(event => !featuredEventIds.has(event.id)),
    [filteredEvents, featuredEventIds]
  );

  const totalVisibleEvents = featuredEvents.length + regularEvents.length;

  const getEventTags = event => {
    if (!event.source_table || !event.favoriteId) return [];
    const key = `${event.source_table}:${event.favoriteId}`;
    return tagMap[key] || [];
  };

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

  const handleTagToggle = (slug, shouldSelect) => {
    setSelectedTags(prev => {
      if (shouldSelect) {
        if (prev.includes(slug)) return prev;
        return [...prev, slug];
      }
      return prev.filter(tag => tag !== slug);
    });
  };

  const hasSelectedTags = selectedTags.length > 0;

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
      <main className="flex-1 pt-28 pb-16 sm:pt-32">
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

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Popular tags:</span>
            {popularTags.map((tag, index) => {
              const isActive = selectedTags.includes(tag.slug);
              return (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => handleTagToggle(tag.slug, !isActive)}
                  className={`${pillStyles[index % pillStyles.length]} px-3 py-1 rounded-full text-sm font-semibold shadow transition ${
                    isActive ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                  }`}
                >
                  #{tag.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 shadow transition hover:bg-indigo-600 hover:text-white"
            >
              <Filter className="h-4 w-4" />
              {`Filters${hasSelectedTags ? ` (${selectedTags.length})` : ''}`}
            </button>
            {hasSelectedTags && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <XCircle className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          <TagFilterModal
            open={isFiltersOpen}
            tags={allTags}
            selectedTags={selectedTags}
            onToggle={handleTagToggle}
            onClose={() => setIsFiltersOpen(false)}
          />

          <div className="mt-10 space-y-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                  <div className="mt-4 h-6 w-3/4 bg-gray-200 animate-pulse rounded" />
                  <div className="mt-2 h-4 w-full bg-gray-200 animate-pulse rounded" />
                </div>
              ))
            ) : (
              <>
                {featuredEvents.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                      <p className="text-sm font-semibold uppercase tracking-[0.35em]">Featured Events</p>
                    </div>
                    <div className="space-y-4">
                      {featuredEvents.map(event => (
                        <EventListItem
                          key={event.id}
                          event={event}
                          now={nowInPhilly}
                          tags={getEventTags(event)}
                          variant="featured"
                        />
                      ))}
                    </div>
                    <div
                      aria-hidden="true"
                      className="mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-amber-200 to-transparent"
                    />
                  </section>
                )}
                {regularEvents.length > 0 && (
                  <div className="space-y-4">
                    {regularEvents.map(event => (
                      <EventListItem
                        key={event.id}
                        event={event}
                        now={nowInPhilly}
                        tags={getEventTags(event)}
                      />
                    ))}
                  </div>
                )}
                {totalVisibleEvents === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
                    {hasSelectedTags
                      ? 'No events match the selected tags. Try clearing a filter.'
                      : 'No events listed yet — check back soon!'}
                  </div>
                )}
              </>
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

