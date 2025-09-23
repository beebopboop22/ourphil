import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { RRule } from 'rrule';
import { FaStar } from 'react-icons/fa';
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
import FeaturedTraditionHero from './FeaturedTraditionHero';
import RecentActivity from './RecentActivity';
import HeroLanding from './HeroLanding';
import TaggedEventScroller from './TaggedEventsScroller';
import RecurringEventsScroller from './RecurringEventsScroller';
import SavedEventsScroller from './SavedEventsScroller';
import FloatingAddButton from './FloatingAddButton';
import PostFlyerModal from './PostFlyerModal';
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
  formatWeekdayAbbrev,
  formatMonthName,
  formatMonthYear,
  indexToMonthSlug,
  parseISODate,
} from './utils/dateUtils';

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
];

const taggedScrollerConfigs = [
  {
    slug: 'birds',
    eyebrow: 'Seasonal Tag',
    headline: 'Next in #Birds',
  },
  {
    slug: 'arts',
    eyebrow: 'Tag highlight',
    headline: 'Next in Arts',
    description: 'Plot out gallery walks, performances, and creative nights across the city.',
  },
  {
    slug: 'nomnomslurp',
    eyebrow: 'Tag highlight',
    headline: 'Next in #NomNomSlurp',
    description: 'Keep tabs on pop-ups, tastings, and foodie meetups worth savoring next.',
  },
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

function buildEventsForRange(rangeStart, rangeEnd, baseData, limit = 4) {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

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
        venues: evt.venue_id,
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
        };
      });
    } catch (err) {
      console.error('rrule parse error', err);
      return [];
    }
  }).sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

  const groupEvents = (baseData.groupEvents || [])
    .map(evt => {
      const start = parseISODateInPhilly((evt.start_date || '').slice(0, 10));
      if (!start) return null;
      const groupRecord = Array.isArray(evt.groups) ? evt.groups[0] : evt.groups;
      const detailPath = getDetailPathForItem({
        ...evt,
        group_slug: groupRecord?.slug,
        isGroupEvent: true,
      });
      return {
        id: `group-${evt.id}`,
        sourceId: evt.id,
        title: evt.title,
        description: evt.description,
        imageUrl: groupRecord?.imag || '',
        startDate: start,
        start_time: evt.start_time,
        badges: ['Group Event'],
        detailPath,
        source_table: 'group_events',
        favoriteId: evt.id,
      };
    })
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

function formatCardTimestamp(event, now) {
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

function EventCard({ event, now, tags = [] }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const label = formatCardTimestamp(event, now);
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event.favoriteId,
    source_table: event.source_table,
  });

  const canFavorite = Boolean(event.favoriteId && event.source_table && !event.externalUrl);
  const Wrapper = event.detailPath ? Link : 'div';
  const wrapperProps = event.detailPath ? { to: event.detailPath } : {};
  const badges = event.badges || [];
  const tagList = tags || [];

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
      className={`flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-lg ${
        isFavorite && canFavorite ? 'ring-2 ring-indigo-600' : ''
      }`}
    >
      <div className="relative h-48 w-full bg-indigo-50">
        {event.imageUrl && (
          <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
        )}
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
          {label}
        </div>
        {isFavorite && canFavorite && (
          <div className="absolute right-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow">
            In the plans!
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <h3 className="text-lg font-bold text-gray-900">{event.title}</h3>
        {event.description && (
          <p className="mt-2 line-clamp-3 text-sm text-gray-600">{event.description}</p>
        )}
        {event.venues?.name ? (
          <p className="mt-2 text-sm text-gray-500">at {event.venues.name}</p>
        ) : event.address ? (
          <p className="mt-2 text-sm text-gray-500">{event.address}</p>
        ) : null}

        {badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map(badge => (
              <span
                key={badge}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
              >
                {badge === 'Tradition' && <FaStar className="text-yellow-500" />}
                {badge}
              </span>
            ))}
          </div>
        )}

        {tagList.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tagList.slice(0, 3).map(tag => (
              <button
                key={tag.slug}
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/tags/${tag.slug}`);
                }}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                #{tag.name}
              </button>
            ))}
            {tagList.length > 3 && (
              <span className="text-xs text-gray-500">+{tagList.length - 3} more</span>
            )}
          </div>
        )}

        <div className="mt-auto pt-5">
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

function EventsSection({ config, data, loading, rangeStart, rangeEnd, now, tagMap }) {
  return (
    <section className="mt-16">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#28313e]">{config.headline}</h2>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            {loading ? 'Loading events…' : formatSummary(config, data.total, data.traditions, rangeStart, rangeEnd)}
          </p>
        </div>
        <Link
          to={config.href}
          className="inline-flex items-center gap-2 self-start md:self-auto px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-full shadow hover:bg-indigo-700 transition"
        >
          {config.cta}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
            ))
          : data.items.map(event => {
              const tagKey =
                event.favoriteId && event.source_table
                  ? `${event.source_table}:${event.favoriteId}`
                  : null;
              const eventTags = tagKey && tagMap ? tagMap[tagKey] || [] : [];
              return <EventCard key={event.id} event={event} now={now} tags={eventTags} />;
            })}
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
          <Link to="/login" className="text-indigo-600 underline">
            Log in
          </Link>{' '}
          to add events to your plans.
        </>
      );
    }
    if (!savedEvents.length) {
      return "You don't have any plans yet! Add some to get started.";
    }
    return 'A quick look at the events you have coming up next.';
  }, [loadingSaved, user, savedEvents.length]);
  const { start: weekendStart, end: weekendEnd } = useMemo(
    () => getWeekendWindow(new Date(), PHILLY_TIME_ZONE),
    []
  );

  const rangeMeta = useMemo(
    () => ({
      today: { start: todayInPhilly, end: setEndOfDay(cloneDate(todayInPhilly)) },
      tomorrow: {
        start: setStartOfDay(cloneDate(tomorrowInPhilly)),
        end: setEndOfDay(cloneDate(tomorrowInPhilly)),
      },
      weekend: { start: setStartOfDay(cloneDate(weekendStart)), end: setEndOfDay(cloneDate(weekendEnd)) },
    }),
    [todayInPhilly, tomorrowInPhilly, weekendStart, weekendEnd]
  );

  const [sections, setSections] = useState({
    today: { items: [], total: 0, traditions: 0 },
    tomorrow: { items: [], total: 0, traditions: 0 },
    weekend: { items: [], total: 0, traditions: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [tagMap, setTagMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const baseData = await fetchBaseData();
        if (cancelled) return;
        setSections({
          today: buildEventsForRange(rangeMeta.today.start, rangeMeta.today.end, baseData),
          tomorrow: buildEventsForRange(rangeMeta.tomorrow.start, rangeMeta.tomorrow.end, baseData),
          weekend: buildEventsForRange(rangeMeta.weekend.start, rangeMeta.weekend.end, baseData),
        });
        setError(null);
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
  }, [rangeMeta]);

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
            .select('id,name,slug,image,start_date,venues:venue_id(slug)')
            .in('id', idsByTable.all_events);
          data?.forEach(row => {
            aggregated.push({
              id: row.id,
              slug: row.slug,
              title: row.name,
              image: row.image,
              start_date: row.start_date,
              source_table: 'all_events',
              venues: row.venues,
            });
          });
        }
        if (idsByTable.events?.length) {
          const { data } = await supabase
            .from('events')
            .select('id,slug,"E Name","E Image",Dates,"End Date"')
            .in('id', idsByTable.events);
          data?.forEach(row => {
            aggregated.push({
              id: row.id,
              slug: row.slug,
              title: row['E Name'],
              image: row['E Image'],
              start_date: row.Dates,
              end_date: row['End Date'],
              source_table: 'events',
            });
          });
        }
        if (idsByTable.big_board_events?.length) {
          const { data } = await supabase
            .from('big_board_events')
            .select('id,slug,title,start_date,start_time,big_board_posts!big_board_posts_event_id_fkey(image_url)')
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
            });
          });
        }
        if (idsByTable.group_events?.length) {
          const { data } = await supabase
            .from('group_events')
            .select('id,slug,title,start_date,start_time,groups(imag,slug)')
            .in('id', idsByTable.group_events);
          data?.forEach(event => {
            aggregated.push({
              id: event.id,
              slug: event.slug,
              title: event.title,
              start_date: event.start_date,
              start_time: event.start_time,
              image: event.groups?.imag || '',
              group: event.groups,
              source_table: 'group_events',
            });
          });
        }
        if (idsByTable.recurring_events?.length) {
          const { data } = await supabase
            .from('recurring_events')
            .select('id,slug,name,start_date,start_time,end_date,rrule,image_url')
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
              source_table: 'recurring_events',
            });
          });
        }

        if (!cancelled) {
          setSavedEvents(aggregated);
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
  }, [user]);

  const handleDatePick = date => {
    if (!date) return;
    setSelectedDate(date);
    const iso = date.toISOString().slice(0, 10);
    navigate(`/${iso}`);
  };

  const displayedEvents = useMemo(
    () => [...sections.today.items, ...sections.tomorrow.items, ...sections.weekend.items],
    [sections.today.items, sections.tomorrow.items, sections.weekend.items]
  );

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
      <FeaturedTraditionHero />
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
          <EventsSection
            key={config.key}
            config={config}
            data={sections[config.key]}
            loading={loading}
            rangeStart={rangeMeta[config.key].start}
            rangeEnd={rangeMeta[config.key].end}
            now={todayInPhilly}
            tagMap={tagMap}
          />
        ))}
        </div>

        <div className="mt-20">
          <RecentActivity />
        </div>

        <section
          aria-labelledby="other-guides-heading"
          className="overflow-hidden bg-slate-900 text-white"
          style={{ marginInline: 'calc(50% - 50vw)', width: '100vw' }}
        >
          <div className="px-6 pb-10 pt-8 sm:px-10">
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

        <section className="w-full max-w-screen-xl mx-auto mt-12 mb-12 px-4">
          <div className="space-y-3 text-left mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Saved agenda</p>
            <h2 className="text-black text-4xl font-[Barrio] text-left">Your Upcoming Plans</h2>
            <p className="text-sm text-gray-600 sm:text-base">{savedPlansDescription}</p>
          </div>
          {!loadingSaved && user && savedEvents.length > 0 && (
            <>
              <SavedEventsScroller events={savedEvents} />
              <p className="text-gray-600 mt-2">
                <Link to="/profile" className="text-indigo-600 underline">
                  See more plans on your profile
                </Link>
              </p>
            </>
          )}
        </section>

        <HeroLanding fullWidth />
        {taggedScrollerConfigs.map(({ slug, eyebrow, headline, description }) => (
          <TaggedEventScroller
            key={slug}
            tags={[slug]}
            fullWidth
            header={
              <Link
                to={`/tags/${slug}`}
                className="block w-full max-w-screen-xl mx-auto px-4 mb-6 space-y-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {eyebrow && (
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">{eyebrow}</p>
                )}
                <h2 className="text-3xl sm:text-4xl font-bold text-[#28313e]">{headline}</h2>
                {description && (
                  <p className="text-sm text-gray-600 sm:text-base">{description}</p>
                )}
              </Link>
            }
          />
        ))}

        <RecurringEventsScroller
          windowStart={startOfWeek}
          windowEnd={endOfWeek}
          eventType="open_mic"
          header={(
            <div className="max-w-screen-xl mx-auto px-4 space-y-3 text-left mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Weekly regulars</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#28313e]">Karaoke, Bingo, Open Mics & Other Weeklies</h2>
              <p className="text-sm text-gray-600 sm:text-base">
                Drop into rotating open mics, karaoke nights, and game sessions that come back every week.
              </p>
            </div>
          )}
        />
      </main>
      <FloatingAddButton onClick={() => setShowFlyerModal(true)} />
      <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} />
      <Footer />
    </div>
  );
}
