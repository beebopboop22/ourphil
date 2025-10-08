// src/HeroLanding.jsx
import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link, useNavigate } from 'react-router-dom';
import useEventFavorite from './utils/useEventFavorite';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

export default function HeroLanding({ fullWidth = false }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const parseDate = datesStr => {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    const parts = first.trim().split('/');
    if (parts.length !== 3) return null;
    const [m, d, y] = parts.map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt) ? null : dt;
  };

  const formatTime = timeStr => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (!parts.length) return '';
    let hours = parseInt(parts[0], 10);
    if (Number.isNaN(hours)) return '';
    const minutes = (parts[1] ?? '00').padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const getBubble = (start, isActive) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isActive) return { text: 'Today', color: 'bg-green-500', pulse: false };
    const diff = Math.floor((start - today) / (1000 * 60 * 60 * 24));
    if (diff === 1) return { text: 'Tomorrow!', color: 'bg-blue-500', pulse: false };
    const weekday = start.toLocaleDateString('en-US', { weekday: 'long' });
    if (diff > 1 && diff < 7) return { text: `This ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false };
    if (diff >= 7 && diff < 14) return { text: `Next ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false };
    return { text: weekday, color: 'bg-[#ba3d36]', pulse: false };
  };

  const isThisWeekend = date => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const fri = new Date(today); fri.setDate(today.getDate() + ((5 - dow + 7) % 7));
    const sun = new Date(today); sun.setDate(today.getDate() + ((0 - dow + 7) % 7));
    fri.setHours(0, 0, 0, 0); sun.setHours(23, 59, 59, 999);
    return date >= fri && date <= sun;
  };

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('events')
        .select(`id, slug, "E Name", Dates, "End Date", "E Image", start_time`)
        .order('Dates', { ascending: true });
      if (error) {
        console.error('Error loading events:', error);
        setLoading(false);
        return;
      }
      const enhanced = data
        .map(e => {
          const start = parseDate(e.Dates);
          if (!start) return null;
          const end   = e['End Date'] ? parseDate(e['End Date']) : start;
          if (!end) return null;
          return {
            ...e,
            start,
            end,
            isActive: start <= today && today <= end,
          };
        })
        .filter(e => e && e.end >= today)
        .sort((a, b) =>
          a.isActive === b.isActive
            ? a.start - b.start
            : a.isActive ? -1 : 1
        )
        .slice(0, 15);
      setEvents(enhanced);
      setLoading(false);
    })();
  }, []);

  return (
    <section className={`relative w-full bg-white border-b border-gray-200 py-16 overflow-hidden ${fullWidth ? 'px-0' : 'px-4 sm:px-6 lg:px-8'}`}>
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1%20copy-min.png"
        alt=""
        role="presentation"
        loading="lazy"
        className="absolute top-0 w-1/4 h-full object-contain pointer-events-none"
      />

      <div className="relative z-20">
        <div className={`mx-auto max-w-screen-xl ${fullWidth ? 'px-4' : ''}`}>
          <div className="mb-10 space-y-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">
              City traditions
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#28313e]">
              Upcoming Festivals, Fairs, and Philly Traditions
            </h2>
            <p className="max-w-2xl text-sm text-gray-600 sm:text-base">
              Line up your calendar with the parades, cultural festivals, and can't-miss Philly traditions happening soon.
            </p>
          </div>

          {loading ? (
            <p className="text-left text-gray-600">Loading…</p>
          ) : !events.length ? (
            <p className="text-left text-gray-600">No upcoming traditions.</p>
          ) : (
            <div className="overflow-x-auto pb-4 scrollbar-hide">
              <div className="flex gap-4">
                {events.map(evt => {
                  const { text, color, pulse } = getBubble(evt.start, evt.isActive);
                  const showWeekendBadge =
                    isThisWeekend(evt.start) && [5, 6, 0].includes(evt.start.getDay());
                  const timeLabel = formatTime(evt.start_time);

                  return (
                    <FavoriteState
                      key={evt.id}
                      event_id={evt.id}
                      source_table="events"
                    >
                      {({ isFavorite, toggleFavorite, loading }) => {
                        const handleToggle = async e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!user) {
                            navigate('/login');
                            return;
                          }
                          await toggleFavorite();
                        };
                        return (
                          <div className="w-[260px] flex-shrink-0">
                            <Link
                              to={getDetailPathForItem(evt) || '/'}
                              className={`relative block h-[380px] rounded-2xl overflow-hidden shadow-lg transition ${isFavorite ? 'ring-2 ring-indigo-600' : ''}`}
                            >
                              <img
                                src={evt['E Image']}
                                alt={evt['E Name']}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />

                              {showWeekendBadge && (
                                <span className="absolute top-3 left-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full z-20">
                                  Weekend Pick
                                </span>
                              )}

                              {isFavorite && (
                                <div className="absolute top-3 right-3 bg-indigo-600 text-white text-xs px-2 py-1 rounded z-20">
                                  In the plans!
                                </div>
                              )}

                              <h3 className="absolute bottom-16 left-4 right-4 text-center text-white text-3xl font-[Barrio] font-bold z-20 leading-tight">
                                {evt['E Name']}
                              </h3>

                              <span
                                className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 ${color} text-white text-base font-bold px-6 py-1 rounded-full whitespace-nowrap min-w-[6rem] ${pulse ? 'animate-pulse' : ''} z-20`}
                              >
                                {text}
                              </span>
                            </Link>
                            {timeLabel && (
                              <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                                {timeLabel}
                              </p>
                            )}
                            <button
                              onClick={handleToggle}
                              disabled={loading}
                              className={`mt-2 w-full border border-indigo-600 rounded-md py-2 font-semibold transition-colors ${
                                isFavorite
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              {isFavorite ? 'In the Plans' : 'Add to Plans'}
                            </button>
                          </div>
                        );
                      }}
                    </FavoriteState>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
