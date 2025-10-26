import React, { useEffect, useMemo, useState } from 'react';
import Navbar from './Navbar';
import { supabase } from './supabaseClient';

const LOGO_URL = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';
const BRAND_NAVY = '#2b333f';
const BRAND_RED = '#bf3e35';
const BRAND_CREAM = '#f5f1ea';

function parseDate(value) {
  if (!value) return null;
  const [first] = `${value}`.split(/through|\u2013|–|-/);
  if (!first) return null;
  const cleaned = first.trim();
  const parts = cleaned.split('/').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [month, day, year] = parts;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

const headingRangeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
});

const dateRangeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
});

function formatDateRange(start, end) {
  if (!start) return '';
  if (!end || start.toDateString() === end.toDateString()) {
    return dateRangeFormatter.format(start);
  }
  const startLabel = dateRangeFormatter.format(start);
  const endLabel = dateRangeFormatter.format(end);
  return `${startLabel} – ${endLabel}`;
}

function formatHeadingRange(events) {
  if (!events.length) return '';
  const first = events[0].start;
  const last = events[events.length - 1].end || events[events.length - 1].start;
  if (!first) return '';
  if (!last || first.toDateString() === last.toDateString()) {
    return headingRangeFormatter.format(first);
  }
  return `${headingRangeFormatter.format(first)} – ${headingRangeFormatter.format(last)}`;
}

function chunkEvents(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export default function TraditionsPoster() {
  const [navHeight, setNavHeight] = useState(0);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const nav = document.querySelector('nav');
    if (!nav) return undefined;
    const updateHeight = () => setNavHeight(nav.offsetHeight || 0);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(nav);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [areasRes, eventsRes] = await Promise.all([
          supabase.from('areas').select('id,name'),
          supabase
            .from('events')
            .select('
              id,
              "E Name",
              Dates,
              "End Date",
              area_id
            ')
            .order('Dates', { ascending: true }),
        ]);

        if (areasRes.error) throw areasRes.error;
        if (eventsRes.error) throw eventsRes.error;

        const areaLookup = {};
        (areasRes.data || []).forEach(area => {
          if (area?.id === undefined || area?.id === null) return;
          areaLookup[area.id] = area.name || '';
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const processed = (eventsRes.data || [])
          .map(item => {
            const start = parseDate(item.Dates);
            const end = item['End Date'] ? parseDate(item['End Date']) : start;
            if (!start) return null;
            return {
              id: item.id,
              name: item['E Name'] || 'Untitled Tradition',
              start,
              end,
              area: item.area_id ? areaLookup[item.area_id] || '' : '',
              dayLabel: start ? weekdayFormatter.format(start).toUpperCase() : '',
              dateLabel: formatDateRange(start, end),
            };
          })
          .filter(Boolean)
          .filter(evt => evt.end && evt.end >= today)
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        if (!isMounted) return;
        setEvents(processed);
      } catch (err) {
        console.error('Failed to load traditions poster events', err);
        if (isMounted) {
          setError('Unable to load traditions right now.');
          setEvents([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const posterPages = useMemo(() => {
    if (!events.length) return [];
    const trimmed = events.slice(0, 18);
    return chunkEvents(trimmed, 6);
  }, [events]);

  return (
    <div className="min-h-screen bg-[#ece9e4]">
      <Navbar />
      <div
        className="px-4 pb-16"
        style={{ paddingTop: navHeight ? navHeight + 24 : 24 }}
      >
        <div className="mx-auto max-w-6xl space-y-12">
          {loading && (
            <div className="text-center text-gray-600">Loading poster…</div>
          )}
          {error && !loading && (
            <div className="text-center text-red-600 font-semibold">{error}</div>
          )}
          {!loading && !error && !posterPages.length && (
            <div className="text-center text-gray-600">No upcoming traditions to show right now.</div>
          )}
          {posterPages.map((pageEvents, pageIndex) => {
            const headingRange = formatHeadingRange(pageEvents);
            const totalPages = posterPages.length;
            return (
              <div
                key={`poster-${pageIndex}`}
                className="relative mx-auto w-full max-w-[900px] aspect-[4/5] overflow-hidden rounded-[40px] border-[8px] shadow-2xl"
                style={{
                  background: BRAND_CREAM,
                  borderColor: BRAND_NAVY,
                }}
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute -top-24 -left-24 h-64 w-64 rounded-full opacity-10"
                    style={{ background: BRAND_NAVY }}
                  />
                  <div
                    className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full opacity-15"
                    style={{ background: BRAND_RED }}
                  />
                </div>
                <div className="relative flex h-full flex-col px-10 pb-10 pt-12">
                  <div className="flex items-start justify-between gap-8">
                    <div className="flex items-center gap-5">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/90 shadow-lg">
                        <img
                          src={LOGO_URL}
                          alt="Our Philly logo"
                          className="h-12 w-12 object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <div>
                        <p
                          className="text-xs font-semibold uppercase tracking-[0.32em]"
                          style={{ color: BRAND_RED }}
                        >
                          Our Philly Traditions
                        </p>
                        <h1
                          className="mt-1 text-4xl font-[Barrio] leading-tight"
                          style={{ color: BRAND_NAVY }}
                        >
                          Traditions Worth Posting
                        </h1>
                        {headingRange && (
                          <p
                            className="mt-2 text-sm font-semibold uppercase tracking-[0.18em]"
                            style={{ color: BRAND_NAVY }}
                          >
                            {headingRange}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="max-w-[220px] text-right">
                      <p
                        className="text-sm font-semibold uppercase tracking-[0.28em]"
                        style={{ color: BRAND_RED }}
                      >
                        Share the City
                      </p>
                      <p className="mt-2 text-xs font-medium text-[#575d67]">
                        Screenshot each page and post to Instagram @ourphillydotorg to help friends plan their week.
                      </p>
                    </div>
                  </div>

                  <div className="mt-10 flex-1">
                    <div className="grid h-full grid-cols-3 grid-rows-2 gap-5">
                      {pageEvents.map(event => (
                        <div
                          key={event.id}
                          className="flex h-full min-h-[190px] flex-col justify-between rounded-3xl border border-[#2b333f1f] bg-white/95 p-6 shadow-sm"
                        >
                          <div>
                            {event.dayLabel && (
                              <span
                                className="text-[11px] font-semibold uppercase tracking-[0.32em]"
                                style={{ color: BRAND_RED }}
                              >
                                {event.dayLabel}
                              </span>
                            )}
                            <h2
                              className="mt-3 text-xl font-semibold leading-snug"
                              style={{
                                color: BRAND_NAVY,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {event.name}
                            </h2>
                          </div>
                          <div className="mt-6 flex flex-col gap-3 text-sm font-semibold" style={{ color: BRAND_NAVY }}>
                            <span>{event.dateLabel}</span>
                            {event.area && (
                              <span
                                className="inline-flex items-center self-start rounded-full border border-[#bf3e3555] bg-[#bf3e3510] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]"
                                style={{ color: BRAND_RED }}
                              >
                                {event.area}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="mt-8 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.32em]"
                    style={{ color: BRAND_NAVY }}
                  >
                    <span>ourphilly.org</span>
                    <span>
                      Page {pageIndex + 1}
                      {totalPages > 1 ? ` / ${totalPages}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

