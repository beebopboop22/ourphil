import React, { useEffect, useMemo, useState } from 'react';
import Navbar from './Navbar';
import { supabase } from './supabaseClient';

const LOGO_URL = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';
const POSTER_BG = '#fff5e6';
const ACCENT_DEEP = '#004c55';
const ACCENT_WARM = '#ff7b54';
const ACCENT_SOFT = '#fcd34d';

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

function normalizeTime(value) {
  if (!value) return null;
  const [hoursStr, minutesStr = '00'] = `${value}`.split(':');
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10) || 0;
  if (Number.isNaN(hours)) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const headingRangeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
});

function formatDateRange(start, end) {
  if (!start) return '';
  if (!end || start.toDateString() === end.toDateString()) {
    return weekdayFormatter.format(start);
  }
  const startLabel = monthFormatter.format(start);
  const endLabel = monthFormatter.format(end);
  return `${startLabel} – ${endLabel}`;
}

function formatHeadingRange(events) {
  if (!events.length) return '';
  const first = events[0].start;
  const last = events[events.length - 1].start;
  if (!first) return '';
  if (!last || first.toDateString() === last.toDateString()) {
    return headingRangeFormatter.format(first);
  }
  return `${headingRangeFormatter.format(first)} – ${headingRangeFormatter.format(last)}`;
}

function formatTimeRange(startTime, endTime) {
  if (!startTime) return '';
  const start = normalizeTime(startTime);
  if (!start) return '';
  const options = { hour: 'numeric', minute: '2-digit' };
  const startLabel = start.toLocaleTimeString('en-US', options).toLowerCase();
  if (!endTime) {
    return startLabel;
  }
  const end = normalizeTime(endTime);
  if (!end) return startLabel;
  const endLabel = end.toLocaleTimeString('en-US', options).toLowerCase();
  return `${startLabel} – ${endLabel}`;
}

function getRelativeLabel(date) {
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(date);
  eventDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return 'Happening now';
  if (diffDays < 7) {
    return eventDay.toLocaleDateString('en-US', { weekday: 'long' });
  }
  if (diffDays < 30) {
    return `In ${diffDays} days`;
  }
  const weeks = Math.round(diffDays / 7);
  if (weeks <= 8) {
    return `In ${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  const months = Math.round(diffDays / 30);
  return `In ${months} month${months === 1 ? '' : 's'}`;
}

function buildBlurb(description) {
  if (!description) return '';
  const singleLine = description.replace(/\s+/g, ' ').trim();
  if (!singleLine) return '';
  const sentenceMatch = singleLine.match(/[^.!?]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= 140) {
    return sentenceMatch[0].trim();
  }
  if (singleLine.length <= 140) {
    return singleLine;
  }
  return `${singleLine.slice(0, 137).trim()}…`;
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
        const { data, error: fetchError } = await supabase
          .from('events')
          .select(`
            id,
            slug,
            "E Name",
            "E Description",
            "E Image",
            Dates,
            "End Date",
            start_time,
            end_time,
            address
          `)
          .order('Dates', { ascending: true })
          .limit(60);

        if (fetchError) throw fetchError;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const processed = (data || [])
          .map(item => {
            const start = parseDate(item.Dates);
            const end = item['End Date'] ? parseDate(item['End Date']) : start;
            if (!start) return null;
            return {
              id: item.id,
              name: item['E Name'] || 'Untitled Tradition',
              description: item['E Description'] || '',
              image: item['E Image'] || '',
              start,
              end,
              startTime: item.start_time || '',
              endTime: item.end_time || '',
              address: item.address || '',
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
    const trimmed = events.slice(0, 27);
    return chunkEvents(trimmed, 9);
  }, [events]);

  return (
    <div className="min-h-screen bg-[#f4efe6]">
      <Navbar />
      <div
        className="px-4 pb-16"
        style={{ paddingTop: navHeight ? navHeight + 24 : 24 }}
      >
        <div className="max-w-6xl mx-auto space-y-12">
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
            return (
              <div
                key={`poster-${pageIndex}`}
                className="relative mx-auto w-full max-w-[900px] aspect-[4/5] rounded-[36px] shadow-2xl border-[6px]"
                style={{
                  background: POSTER_BG,
                  borderColor: ACCENT_DEEP,
                }}
              >
                <div className="absolute inset-0">
                  <div
                    className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20"
                    style={{ background: ACCENT_WARM }}
                  />
                  <div
                    className="absolute -bottom-16 -left-12 w-64 h-64 rounded-full opacity-10"
                    style={{ background: ACCENT_SOFT }}
                  />
                </div>
                <div className="relative h-full flex flex-col">
                  <div className="flex items-start justify-between px-10 pt-10">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/80 border-2 border-white rounded-full p-2 shadow">
                        <img src={LOGO_URL} alt="Our Philly" className="w-14 h-14 object-contain" crossOrigin="anonymous" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.32em] font-semibold" style={{ color: ACCENT_DEEP }}>
                          Our Philly Traditions
                        </p>
                        <h1
                          className="text-4xl font-[Barrio] leading-tight text-[#1f2937]"
                        >
                          Save These Philly Traditions
                        </h1>
                        <p className="mt-1 text-sm font-medium text-[#4b5563]">
                          Screenshot + share @ourphillydotorg
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {headingRange && (
                        <span
                          className="inline-block px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] rounded-full"
                          style={{ background: ACCENT_DEEP, color: '#fff' }}
                        >
                          {headingRange}
                        </span>
                      )}
                      <span
                        className="inline-flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.32em] px-3 py-1 rounded-full"
                        style={{ background: '#fff', color: ACCENT_DEEP, border: `1px solid ${ACCENT_DEEP}` }}
                      >
                        Page {pageIndex + 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 px-10 pb-6 pt-6">
                    <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {pageEvents.map(event => {
                        const relativeLabel = getRelativeLabel(event.start);
                        const dateLabel = formatDateRange(event.start, event.end);
                        const timeLabel = formatTimeRange(event.startTime, event.endTime);
                        const blurb = buildBlurb(event.description);
                        return (
                          <div
                            key={event.id}
                            className="relative flex h-full flex-col justify-between rounded-3xl border bg-white/80 p-5 shadow-sm"
                            style={{ borderColor: `${ACCENT_DEEP}20` }}
                          >
                            <div>
                              {relativeLabel && (
                                <span
                                  className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]"
                                  style={{ background: `${ACCENT_WARM}1a`, color: ACCENT_WARM }}
                                >
                                  {relativeLabel}
                                </span>
                              )}
                              <h2 className="mt-3 text-lg font-bold leading-snug text-[#111827]">
                                {event.name}
                              </h2>
                              <div className="mt-2 text-sm font-semibold text-[#004c55]">
                                {dateLabel}
                              </div>
                              {timeLabel && (
                                <div className="text-xs uppercase tracking-[0.28em] text-[#6b7280] mt-1">
                                  {timeLabel}
                                </div>
                              )}
                              {blurb && (
                                <p
                                  className="mt-3 text-sm leading-snug text-[#374151]"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 4,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {blurb}
                                </p>
                              )}
                            </div>
                            {event.address && (
                              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.32em] text-[#9ca3af]">
                                {event.address}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-10 pb-10">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.32em]" style={{ color: ACCENT_DEEP }}>
                      <span>ourphilly.org</span>
                      <span>#phillytraditions</span>
                    </div>
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

