import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const HEART_URL = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png';
const CARD_HEIGHT = 'calc((100vh - 120px - 48px) / 5)';

const FALLBACK_BACKGROUNDS = [
  'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,0,0,0.2))',
  'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(0,0,0,0.35))',
];

const toStartOfDay = date => {
  if (!date) return null;
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const parseTraditionDate = raw => {
  if (!raw || typeof raw !== 'string') return null;
  const [first] = raw.split(/through|–|—|-/i);
  if (!first) return null;
  const parts = first.trim().split('/');
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAbsoluteDate = date => {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const formatRelativeLabel = date => {
  if (!date) return '';
  const today = toStartOfDay(new Date());
  const eventDay = toStartOfDay(date);
  if (!eventDay) return '';
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000);
  const weekdayLong = eventDay.toLocaleDateString('en-US', { weekday: 'long' });

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7) return `This ${weekdayLong}`;
  if (diffDays >= 7 && diffDays < 14) return `Next ${weekdayLong}`;
  if (diffDays >= 14 && diffDays < 35) return weekdayLong;

  return formatAbsoluteDate(eventDay);
};

const normalizeDescription = text => {
  if (!text) return 'Details coming soon.';
  return text.replace(/\s+/g, ' ').trim();
};

const chooseFallback = index => FALLBACK_BACKGROUNDS[index % FALLBACK_BACKGROUNDS.length];

export default function TraditionsListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const today = toStartOfDay(new Date());
        const { data, error } = await supabase
          .from('events')
          .select('id, slug, "E Name", Dates, "End Date", "E Image", "E Description", "Neighborhood"')
          .order('Dates', { ascending: true });
        if (error) throw error;
        const upcoming = (data || [])
          .map(row => {
            const startDate = parseTraditionDate(row.Dates);
            if (!startDate) return null;
            const rawEnd = row['End Date'] ? parseTraditionDate(row['End Date']) : null;
            const endDate = rawEnd || startDate;
            if (!endDate) return null;
            if (toStartOfDay(endDate).getTime() < today.getTime()) return null;
            const name = row['E Name']?.trim() || 'Untitled Tradition';
            const neighborhood = row['Neighborhood']?.trim() || '';
            const displayNeighborhood = neighborhood || 'Philadelphia';
            const image = row['E Image']?.trim() || '';
            const description = normalizeDescription(row['E Description']);
            const relativeLabel = formatRelativeLabel(startDate);
            const fallbackLabel = formatAbsoluteDate(startDate);
            const displayLabel = relativeLabel || fallbackLabel;
            return {
              id: row.id,
              name,
              image,
              startDate,
              endDate,
              displayLabel,
              captionLabel: relativeLabel || fallbackLabel,
              neighborhood: displayNeighborhood,
              description,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.startDate - b.startDate)
          .slice(0, 20);
        if (isMounted) {
          setEvents(upcoming);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load traditions list', err);
        if (isMounted) {
          setEvents([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const copyBlock = useMemo(
    () =>
      events
        .map(evt => `${evt.name} — ${evt.captionLabel} — ${evt.neighborhood} — ${evt.description}`)
        .join('\n'),
    [events],
  );

  return (
    <div className="min-h-screen bg-[#bf3e35] text-white">
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <img
            src={HEART_URL}
            alt=""
            className="absolute -top-40 -right-24 w-[480px] opacity-10 select-none"
            style={{ filter: 'grayscale(100%)', transform: 'rotate(-12deg)' }}
            loading="lazy"
          />
        </div>
        <div className="relative z-10 mx-auto max-w-md px-4 pt-10 pb-8">
          <header className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-white/80">Our Philly</p>
            <h1 className="mt-2 text-3xl font-[Barrio] leading-tight">Traditions List</h1>
            <p className="mt-1 text-sm text-white/80">Screenshot the stack below to drop into Instagram stories.</p>
          </header>

          {loading ? (
            <p className="text-center text-white/80">Loading traditions…</p>
          ) : !events.length ? (
            <p className="text-center text-white/80">No upcoming traditions just yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((evt, index) => (
                <div
                  key={evt.id}
                  className="group relative overflow-hidden rounded-3xl shadow-xl transition-all duration-200 ease-out"
                  style={{ minHeight: CARD_HEIGHT, height: CARD_HEIGHT }}
                >
                  {evt.image ? (
                    <img
                      src={evt.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ background: chooseFallback(index) }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/55 transition-colors duration-200 group-hover:bg-black/45 group-active:bg-black/60" />
                  <div className="relative flex h-full flex-col justify-end px-5 py-5">
                    <h2 className="text-xl font-semibold leading-tight tracking-tight text-white line-clamp-2 drop-shadow-md">
                      {evt.name}
                    </h2>
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                      {evt.displayLabel}
                    </p>
                    <p className="mt-1 text-sm text-white/80">{evt.neighborhood}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && events.length > 0 && (
            <section className="mt-10 rounded-3xl bg-white/10 p-5">
              <h2 className="text-lg font-semibold text-white">Copy-ready list</h2>
              <p className="mt-1 text-sm text-white/70">
                Tap and hold to copy into your Instagram caption block.
              </p>
              <pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
                {copyBlock}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
