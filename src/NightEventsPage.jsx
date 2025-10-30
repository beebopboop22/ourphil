import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Map, { Marker, Popup } from 'react-map-gl';
import { RRule } from 'rrule';
import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { getMapboxToken } from './config/mapboxToken.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  PHILLY_TIME_ZONE,
  getZonedDate,
  setStartOfDay,
  setEndOfDay,
  parseEventDateValue,
  getWeekendWindow,
  overlaps,
} from './utils/dateUtils';

const MINUTES_AFTER_FIVE_PM = 17 * 60;

const FILTER_OPTIONS = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This Weekend' },
  { id: 'date', label: 'Pick a Date' },
];

function formatTimeLabel(timeStr) {
  if (!timeStr) return null;
  const [hoursStr, minutesStr = '00'] = timeStr.split(':');
  const hours = Number.parseInt(hoursStr, 10);
  if (Number.isNaN(hours)) return null;
  const minutes = minutesStr.padStart(2, '0');
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.';
  const normalized = hours % 12 || 12;
  return `${normalized}:${minutes} ${suffix}`;
}

function parseMinutes(timeStr) {
  if (!timeStr) return null;
  const [hoursStr, minutesStr = '00'] = timeStr.split(':');
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10) || 0;
  if (Number.isNaN(hours) || hours < 0 || hours > 23) return null;
  return hours * 60 + minutes;
}

function getRangeForFilter(filterId, customDate) {
  const zonedNow = getZonedDate(new Date(), PHILLY_TIME_ZONE);
  const today = setStartOfDay(zonedNow);

  if (filterId === 'tomorrow') {
    const start = setStartOfDay(new Date(today));
    start.setDate(start.getDate() + 1);
    return { start, end: setEndOfDay(new Date(start)) };
  }

  if (filterId === 'weekend') {
    const weekend = getWeekendWindow(zonedNow, PHILLY_TIME_ZONE);
    return { start: weekend.start, end: weekend.end };
  }

  if (filterId === 'date' && customDate) {
    const base = getZonedDate(customDate, PHILLY_TIME_ZONE);
    const start = setStartOfDay(base);
    return { start, end: setEndOfDay(new Date(start)) };
  }

  const start = today;
  return { start, end: setEndOfDay(new Date(today)) };
}

function normalizeEvent(row, source) {
  const startRaw =
    row.start_date || row.startDate || row['E Start Date'] || row.Dates || row['Start Date'];
  const endRaw = row.end_date || row.endDate || row['End Date'] || startRaw;
  const startDate = parseEventDateValue(startRaw, PHILLY_TIME_ZONE);
  const endDateBase = parseEventDateValue(endRaw, PHILLY_TIME_ZONE) || startDate;
  if (!startDate || !endDateBase) return null;
  const endDate = setEndOfDay(new Date(endDateBase));

  const start_time =
    row.start_time || row.time || row['Start Time'] || row['E Start Time'] || null;
  const latitudeRaw = row.latitude ?? row.lat ?? row.venue?.latitude ?? row.venues?.latitude;
  const longitudeRaw = row.longitude ?? row.lng ?? row.venue?.longitude ?? row.venues?.longitude;
  const latitude =
    latitudeRaw !== undefined && latitudeRaw !== null ? Number.parseFloat(latitudeRaw) : null;
  const longitude =
    longitudeRaw !== undefined && longitudeRaw !== null ? Number.parseFloat(longitudeRaw) : null;
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  const detailPath = getDetailPathForItem({
    ...row,
    source_table: source,
    start_date: row.start_date || startRaw,
    slug: row.slug,
  });

  const title =
    row.title || row.name || row['E Name'] || row['Name'] || row.event_name || 'Untitled Event';
  const description = row.description || row['E Description'] || '';

  let imageUrl = row.imageUrl || row.image_url || row['E Image'] || row.image || '';
  if (row.big_board_posts?.[0]?.image_url && !imageUrl) {
    const { data } = supabase.storage.from('big-board').getPublicUrl(row.big_board_posts[0].image_url);
    imageUrl = data?.publicUrl || '';
  }

  return {
    id: `${source}-${row.id}`,
    source_table: source,
    raw: row,
    title,
    description,
    imageUrl,
    startDate,
    endDate,
    start_time,
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    detailPath,
  };
}

async function fetchNightBaseData() {
  const [traditionsRes, allEventsRes, bigBoardRes, groupEventsRes, recurringRes] = await Promise.all([
    supabase
      .from('events')
      .select('id,"E Name","E Description",Dates,"End Date","E Image",slug,start_time,latitude,longitude')
      .order('Dates', { ascending: true }),
    supabase
      .from('all_events')
      .select(
        'id,name,description,image,start_date,start_time,end_date,end_time,slug,venue_id(name,slug)'
      )
      .order('start_date', { ascending: true }),
    supabase
      .from('big_board_events')
      .select(
        'id,title,description,start_date,start_time,end_date,end_time,slug,latitude,longitude,big_board_posts!big_board_posts_event_id_fkey(image_url)'
      )
      .order('start_date', { ascending: true }),
    supabase
      .from('group_events')
      .select('id,title,description,image_url,start_date,start_time,end_date,end_time,slug,latitude,longitude,groups(id,slug,Name,imag)')
      .order('start_date', { ascending: true }),
    supabase
      .from('recurring_events')
      .select('id,name,description,start_date,start_time,end_date,end_time,slug,address,latitude,longitude,rrule')
      .eq('is_active', true),
  ]);

  const errors = [traditionsRes.error, allEventsRes.error, bigBoardRes.error, groupEventsRes.error, recurringRes.error].filter(Boolean);
  if (errors.length) {
    throw errors[0];
  }

  const events = [];

  (traditionsRes.data || []).forEach(row => {
    const event = normalizeEvent(row, 'events');
    if (event) events.push(event);
  });

  (allEventsRes.data || []).forEach(row => {
    const event = normalizeEvent(
      {
        ...row,
        venues: row.venue_id ? { ...row.venue_id } : null,
      },
      'all_events',
    );
    if (event) events.push(event);
  });

  (bigBoardRes.data || []).forEach(row => {
    const event = normalizeEvent(row, 'big_board_events');
    if (event) events.push(event);
  });

  (groupEventsRes.data || []).forEach(row => {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const event = normalizeEvent(
      {
        ...row,
        title: row.title,
        group,
        imageUrl: row.image_url || group?.imag || '',
        slug: row.slug || row.id,
      },
      'group_events',
    );
    if (event) events.push(event);
  });

  (recurringRes.data || []).forEach(row => {
    if (!row.rrule) return;
    const occurrences = expandRecurringSeries(row);
    occurrences.forEach(instance => {
      const event = normalizeEvent(instance, 'recurring_events');
      if (event) events.push(event);
    });
  });

  return events;
}

function expandRecurringSeries(series) {
  try {
    const opts = RRule.parseString(series.rrule);
    opts.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
    if (series.end_date) {
      opts.until = new Date(`${series.end_date}T23:59:59`);
    }
    const rule = new RRule(opts);
    const horizonStart = new Date();
    const horizonEnd = new Date();
    horizonEnd.setMonth(horizonEnd.getMonth() + 1);
    const dates = rule.between(horizonStart, horizonEnd, true);
    return dates.map(date => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      return {
        ...series,
        id: `${series.id}-${dateStr}`,
        start_date: dateStr,
        end_date: dateStr,
      };
    });
  } catch (error) {
    console.error('Failed to expand recurring series', series.id, error);
    return [];
  }
}

function partitionNightEvents(events, rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) {
    return { timed: [], untimed: [] };
  }
  const timed = [];
  const untimed = [];

  events.forEach(event => {
    if (!overlaps(event.startDate, event.endDate, rangeStart, rangeEnd)) {
      return;
    }
    const minutes = parseMinutes(event.start_time);
    if (minutes === null) {
      untimed.push(event);
      return;
    }
    if (minutes >= MINUTES_AFTER_FIVE_PM) {
      timed.push(event);
    }
  });

  timed.sort((a, b) => {
    const startDiff = a.startDate - b.startDate;
    if (startDiff !== 0) return startDiff;
    const aMinutes = parseMinutes(a.start_time) || 0;
    const bMinutes = parseMinutes(b.start_time) || 0;
    return aMinutes - bMinutes;
  });

  untimed.sort((a, b) => a.startDate - b.startDate);

  return { timed, untimed };
}

function NightModeMap({ events }) {
  const token = getMapboxToken();
  const valid = useMemo(
    () => events.filter(evt => Number.isFinite(evt.latitude) && Number.isFinite(evt.longitude)),
    [events],
  );
  const [viewState, setViewState] = useState({
    latitude: 39.9526,
    longitude: -75.1652,
    zoom: 12,
  });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!valid.length) return;
    const avgLat = valid.reduce((sum, evt) => sum + evt.latitude, 0) / valid.length;
    const avgLng = valid.reduce((sum, evt) => sum + evt.longitude, 0) / valid.length;
    setViewState(view => ({ ...view, latitude: avgLat, longitude: avgLng }));
  }, [valid]);

  if (!token || !valid.length) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-900/40 shadow-[0_0_80px_rgba(99,102,241,0.25)]" style={{ height: 420 }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {valid.map(evt => (
          <Marker
            key={evt.id}
            longitude={evt.longitude}
            latitude={evt.latitude}
            anchor="bottom"
            onClick={event => {
              event.originalEvent.stopPropagation();
              setSelected(evt);
            }}
          >
            <span className="relative block h-5 w-5">
              <span className="absolute inset-0 rounded-full bg-indigo-400 opacity-70 blur-[2px]" />
              <span className="absolute inset-1 rounded-full bg-indigo-200" />
            </span>
          </Marker>
        ))}
        {selected && (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            anchor="top"
            closeOnClick={false}
            focusAfterOpen
            onClose={() => setSelected(null)}
            className="night-popup"
          >
            <div className="space-y-1 text-sm">
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400">Night Event</p>
              <h4 className="text-base font-semibold text-slate-900">{selected.title}</h4>
              {selected.start_time && (
                <p className="text-xs font-medium text-slate-700">
                  Starts at {formatTimeLabel(selected.start_time)}
                </p>
              )}
              {selected.detailPath && (
                <a
                  href={selected.detailPath}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  View details
                  <span aria-hidden>→</span>
                </a>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

export default function NightEventsPage() {
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('tonight');
  const [customDate, setCustomDate] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchNightBaseData()
      .then(events => {
        if (!active) return;
        setAllEvents(events);
        setLoading(false);
      })
      .catch(err => {
        console.error('Night events load failed', err);
        if (!active) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const range = useMemo(() => getRangeForFilter(filter, customDate), [filter, customDate]);

  const { timed, untimed } = useMemo(
    () => partitionNightEvents(allEvents, range.start, range.end),
    [allEvents, range.start, range.end],
  );

  const subtitle = useMemo(() => {
    const zonedNow = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
    });

    if (filter === 'tomorrow') {
      const tomorrow = new Date(zonedNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return `Night events for ${formatter.format(tomorrow)}`;
    }
    if (filter === 'weekend') {
      const weekend = getWeekendWindow(zonedNow, PHILLY_TIME_ZONE);
      return `Night events between ${formatter.format(weekend.start)} and ${formatter.format(weekend.end)}`;
    }
    if (filter === 'date' && customDate) {
      return `Night events for ${formatter.format(customDate)}`;
    }
    return `Night events for ${formatter.format(zonedNow)}`;
  }, [filter, customDate]);

  return (
    <div className="min-h-screen bg-[#05060f] text-white">
      <Helmet>
        <title>Philly Night Mode Events – After Dark Things To Do</title>
        <meta
          name="description"
          content="Explore Philadelphia events after 5 p.m. with a dark-mode map, glowing highlights, and late-night picks from Our Philly."
        />
        <link rel="canonical" href="https://ourphilly.org/nights" />
      </Helmet>
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-24">
        <header className="space-y-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/50 bg-indigo-500/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-indigo-300">
            🌙 Night Mode
          </span>
          <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
            Philly Nights After Five
          </h1>
          <p className="text-base text-indigo-200 md:text-lg">{subtitle}</p>
        </header>

        <section className="flex flex-col items-center gap-4 rounded-3xl border border-indigo-900/40 bg-[#0d1020]/80 p-6 shadow-[0_0_80px_rgba(79,70,229,0.25)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {FILTER_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={`
                  rounded-full px-5 py-2 text-sm font-semibold transition
                  ${
                    filter === option.id
                      ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.6)]'
                      : 'bg-white/5 text-indigo-200 hover:bg-white/10'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
          {filter === 'date' && (
            <div className="flex items-center gap-3 text-sm text-indigo-100">
              <span>Choose a date:</span>
              <DatePicker
                selected={customDate}
                onChange={date => setCustomDate(date)}
                className="rounded-lg border border-indigo-500/40 bg-[#05060f] px-3 py-2 text-indigo-100"
                calendarClassName="!bg-[#0d1020] !text-white"
                dayClassName={() => '!text-white'}
                popperClassName="night-datepicker"
              />
            </div>
          )}
        </section>

        {loading && (
          <div className="rounded-3xl border border-indigo-900/40 bg-[#0d1020]/70 p-10 text-center text-indigo-200">
            Loading Philly night events…
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center text-red-200">
            Something went wrong while loading night events. Please try again later.
          </div>
        )}

        {!loading && !error && (
          <>
            <NightModeMap events={timed} />

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-white">After 5 p.m. Highlights</h2>
                <span className="text-sm text-indigo-200">{timed.length} late-night picks</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {timed.map(event => (
                  <article
                    key={event.id}
                    className="group relative overflow-hidden rounded-2xl border border-indigo-900/40 bg-[#0b0f1d]/90 p-6 shadow-[0_0_40px_rgba(79,70,229,0.25)] transition hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(129,140,248,0.45)]"
                  >
                    <div className="flex flex-col gap-4">
                      {event.imageUrl && (
                        <div className="overflow-hidden rounded-xl border border-indigo-900/40">
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="h-48 w-full object-cover transition duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
                          Starts at {formatTimeLabel(event.start_time)}
                        </p>
                        <h3 className="text-2xl font-semibold text-white">{event.title}</h3>
                        {event.detailPath && (
                          <a
                            href={event.detailPath}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-300 transition hover:text-indigo-100"
                          >
                            View details
                            <span aria-hidden>→</span>
                          </a>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm leading-relaxed text-indigo-200/80 line-clamp-4">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
                {!timed.length && (
                  <div className="col-span-full rounded-2xl border border-indigo-900/40 bg-[#0d1020]/70 p-10 text-center text-indigo-200">
                    No night events found for this range. Try another day.
                  </div>
                )}
              </div>
            </section>

            {!!untimed.length && (
              <section className="space-y-5">
                <h2 className="text-2xl font-semibold text-indigo-200">Events With No Start Time</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {untimed.map(event => (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-indigo-900/40 bg-[#080b19]/90 p-5 shadow-[0_0_30px_rgba(79,70,229,0.2)]"
                    >
                      <h3 className="text-xl font-semibold text-white">{event.title}</h3>
                      <p className="mt-2 text-sm text-indigo-200/80">
                        We couldn't find a start time, but it's happening during your selected window.
                      </p>
                      {event.detailPath && (
                        <a
                          href={event.detailPath}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-300 hover:text-indigo-100"
                        >
                          View details
                          <span aria-hidden>→</span>
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

