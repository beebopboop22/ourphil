import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { useLocation } from 'react-router-dom';

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1350;

function parseDate(dateStr) {
  if (!dateStr) return null;
  const [first] = String(dateStr).split(/through|–|-/);
  const parts = first.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayDate(date) {
  if (!date) return '';
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${weekday} · ${month} ${day}`;
}

function chunkEvents(events, size) {
  const pages = [];
  for (let i = 0; i < events.length; i += size) {
    pages.push(events.slice(i, i + size));
  }
  if (!pages.length) pages.push([]);
  return pages;
}

export default function TraditionsPosterPage() {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const outerRef = useRef(null);
  const captureMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('capture') === '1';
  }, [location.search]);

  useEffect(() => {
    const navEl = document.querySelector('nav');
    if (!navEl) return undefined;
    if (!captureMode) return undefined;
    const previousDisplay = navEl.style.display;
    navEl.style.display = 'none';
    return () => {
      navEl.style.display = previousDisplay;
    };
  }, [captureMode]);

  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      try {
        setLoading(true);
        setError(null);
        const [{ data: areaRows = [], error: areaError }, { data: eventRows = [], error: eventError }] = await Promise.all([
          supabase.from('areas').select('id,name'),
          supabase
            .from('events')
            .select('id,"E Name",slug,Dates,"End Date","E Image","E Description",area_id')
            .order('Dates', { ascending: true }),
        ]);

        if (areaError) throw areaError;
        if (eventError) throw eventError;

        const areaLookup = (areaRows || []).reduce((acc, area) => {
          if (area?.id === undefined || area?.id === null) return acc;
          acc[area.id] = area.name || '';
          return acc;
        }, {});

        const today = startOfDay(new Date());
        const upcoming = (eventRows || [])
          .map(row => {
            const start = parseDate(row.Dates);
            if (!start) return null;
            const end = parseDate(row['End Date']) || start;
            const isActive = start <= today && end >= today;
            if (end < today) return null;
            return {
              id: row.id,
              title: row['E Name']?.trim() || 'Untitled Tradition',
              start,
              end,
              isActive,
              neighborhood: row.area_id ? areaLookup[row.area_id] || 'Philadelphia' : 'Philadelphia',
            };
          })
          .filter(Boolean)
          .sort((a, b) => {
            if (a.isActive !== b.isActive) {
              return a.isActive ? -1 : 1;
            }
            if (a.start.getTime() !== b.start.getTime()) {
              return a.start.getTime() - b.start.getTime();
            }
            return a.title.localeCompare(b.title);
          });

        if (isMounted) {
          setEvents(upcoming);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load traditions poster data', err);
        if (isMounted) {
          setError('Unable to load traditions.');
          setEvents([]);
          setLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (!outerRef.current) return;
      const width = outerRef.current.clientWidth;
      const nextScale = Math.min(1, width / POSTER_WIDTH);
      setScale(nextScale > 0 ? nextScale : 1);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    let observer;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(updateScale);
      if (outerRef.current) {
        observer.observe(outerRef.current);
      }
    }
    return () => {
      window.removeEventListener('resize', updateScale);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  const pages = useMemo(() => chunkEvents(events, 6), [events]);

  const clampStyle = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <div className="min-h-screen w-full bg-[#2b333f] py-10" ref={outerRef}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-16 px-4">
        {loading && <p className="text-center text-white font-normal">Loading traditions…</p>}
        {error && <p className="text-center text-white font-normal">{error}</p>}
        {!loading && !error &&
          pages.map((pageEvents, pageIndex) => {
            const visibleEvents = [...pageEvents];
            const placeholders = Math.max(0, 6 - visibleEvents.length);
            return (
              <div
                key={`poster-${pageIndex}`}
                className="relative"
                style={{
                  width: POSTER_WIDTH * scale,
                  height: POSTER_HEIGHT * scale,
                }}
              >
                <div
                  className="rounded-3xl bg-white shadow-xl"
                  style={{
                    width: POSTER_WIDTH,
                    height: POSTER_HEIGHT,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    overflow: 'hidden',
                  }}
                >
                  <div className="flex h-full flex-col font-sans text-[#2b333f]">
                    <header className="bg-[#2b333f] px-16 pt-16 pb-12 text-white">
                      <p className="text-sm uppercase tracking-[0.3em] font-normal">Our Philly</p>
                      <h1 className="mt-4 text-[64px] leading-tight font-semibold">Philadelphia Traditions</h1>
                      <p className="mt-4 text-2xl font-normal text-white/80">
                        Upcoming classics to screenshot and share.
                      </p>
                    </header>
                    <main className="flex flex-1 flex-col px-16 pb-16 pt-14">
                      <div className="mb-10 flex items-center justify-between text-[#2b333f]">
                        <h2 className="text-2xl font-semibold">Next on the calendar</h2>
                        <span className="text-lg font-normal uppercase tracking-[0.2em] text-[#bf3e35]">
                          {pageEvents.length ? `${Math.min((pageIndex + 1) * 6, events.length)} of ${events.length}` : 'Stay tuned'}
                        </span>
                      </div>
                      <div className="grid h-full flex-1 grid-cols-3 grid-rows-2 gap-10">
                        {visibleEvents.map(event => (
                          <article
                            key={event.id}
                            className="flex flex-col justify-between rounded-2xl border border-[#2b333f1a] bg-white px-10 py-8 shadow-sm"
                            style={{ minHeight: 0 }}
                          >
                            <div>
                              <div className="text-xl font-semibold uppercase tracking-[0.18em] text-[#bf3e35]">
                                {formatDayDate(event.start)}
                              </div>
                              <h3
                                className="mt-6 text-3xl font-semibold leading-snug text-[#2b333f]"
                                style={clampStyle}
                              >
                                {event.title}
                              </h3>
                            </div>
                            <div className="mt-8 text-2xl font-normal text-[#2b333f]">
                              {event.neighborhood || 'Philadelphia'}
                            </div>
                          </article>
                        ))}
                        {Array.from({ length: placeholders }).map((_, idx) => (
                          <div
                            key={`placeholder-${idx}`}
                            className="rounded-2xl border border-transparent bg-transparent"
                          />
                        ))}
                      </div>
                    </main>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
