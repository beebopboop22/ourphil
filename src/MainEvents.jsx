import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { RRule } from 'rrule';
import { FaStar } from 'react-icons/fa';
import { ArrowRight } from 'lucide-react';

import Navbar from './Navbar';
import Footer from './Footer';
import FeaturedTraditionHero from './FeaturedTraditionHero';
import RecentActivity from './RecentActivity';
import NewsletterSection from './NewsletterSection';
import { supabase } from './supabaseClient';
import { getDetailPathForItem } from './utils/eventDetailPaths';
import {
  PHILLY_TIME_ZONE,
  getWeekendWindow,
  setStartOfDay,
  setEndOfDay,
  getZonedDate,
  formatMonthDay,
  formatWeekdayAbbrev,
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

function parseISODateLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
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
        image_url,
        start_date,
        start_time,
        end_time,
        end_date,
        slug,
        venue_id,
        venues:venue_id (name, slug)
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
      const start = parseISODateLocal(ev.start_date);
      const end = parseISODateLocal(ev.end_date || ev.start_date) || start;
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
      };
    });

  const traditions = (baseData.traditions || [])
    .map(row => {
      const start = parseDate(row.Dates);
      if (!start) return null;
      const end = parseDate(row['End Date']) || start;
      return {
        id: `trad-${row.id}`,
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
    }));

  const singleDayEvents = (baseData.allEvents || [])
    .map(evt => {
      const rawStart = (evt.start_date || '').slice(0, 10);
      const start = parseISODateLocal(rawStart);
      if (!start) return null;
      return {
        id: `event-${evt.id}`,
        title: evt.name,
        description: evt.description,
        imageUrl: evt.image_url || evt.image || '',
        startDate: start,
        start_time: evt.start_time,
        slug: evt.slug,
        venues: evt.venues,
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.startDate, rangeStart, rangeEnd))
    .map(ev => ({
      ...ev,
      detailPath: getDetailPathForItem(ev),
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
        };
      });
    } catch (err) {
      console.error('rrule parse error', err);
      return [];
    }
  });

  const groupEvents = (baseData.groupEvents || [])
    .map(evt => {
      const start = parseISODateLocal((evt.start_date || '').slice(0, 10));
      if (!start) return null;
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
        start_time: evt.start_time,
        badges: ['Group Event'],
        detailPath,
      };
    })
    .filter(Boolean)
    .filter(ev => eventOverlapsRange(ev.startDate, ev.startDate, rangeStart, rangeEnd));

  const sports = (baseData.sports || [])
    .map(evt => {
      const start = parseISODateLocal(evt.start_date);
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
    .filter(ev => eventOverlapsRange(ev.startDate, ev.startDate, rangeStart, rangeEnd));

  const combined = [
    ...bigBoard,
    ...traditions,
    ...singleDayEvents,
    ...recurring,
    ...groupEvents,
    ...sports,
  ].sort((a, b) => a.startDate - b.startDate || (a.start_time || '').localeCompare(b.start_time || ''));

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

function EventCard({ event, now }) {
  const label = formatCardTimestamp(event, now);

  const content = (
    <div className="flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden h-full">
      {event.imageUrl ? (
        <img src={event.imageUrl} alt={event.title} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-indigo-50" aria-hidden />
      )}
      <div className="flex-1 flex flex-col gap-3 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">{label}</div>
        <h3 className="text-lg font-bold text-gray-800">{event.title}</h3>
        {event.description && (
          <p className="text-sm text-gray-600 line-clamp-3">{event.description}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 text-xs font-semibold text-indigo-700">
          {event.badges?.map(badge => (
            <span key={badge} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
              {badge === 'Tradition' && <FaStar className="text-yellow-500" />}
              {badge}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  if (event.detailPath) {
    return (
      <Link to={event.detailPath} className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
        {content}
      </Link>
    );
  }

  if (event.externalUrl) {
    return (
      <a
        href={event.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        {content}
      </a>
    );
  }

  return <div className="block">{content}</div>;
}

function EventsSection({ config, data, loading, rangeStart, rangeEnd, now }) {
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
          : data.items.map(event => <EventCard key={event.id} event={event} now={now} />)}
      </div>
    </section>
  );
}

export default function MainEvents() {
  const navigate = useNavigate();
  const todayInPhilly = useMemo(() => setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)), []);
  const tomorrowInPhilly = useMemo(() => {
    const t = cloneDate(todayInPhilly);
    t.setDate(t.getDate() + 1);
    return t;
  }, [todayInPhilly]);
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

  const handleDatePick = date => {
    if (!date) return;
    setSelectedDate(date);
    const iso = date.toISOString().slice(0, 10);
    navigate(`/${iso}`);
  };

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
            <h1 className="mt-4 text-4xl sm:text-5xl font-[Barrio] font-black text-indigo-900">
              Philly Days, Organized
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-gray-600">
              We pulled together today’s highlights, a sneak peek at tomorrow, and the standout picks shaping the weekend.
              Want another day? Jump straight to the full listings.
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
            />
          ))}
        </div>

        <div className="mt-20 space-y-16">
          <RecentActivity />
          <NewsletterSection />
        </div>
      </main>
      <Footer />
    </div>
  );
}
