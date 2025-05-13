// src/HeroLanding.jsx

import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import {
  getMyEventFavorites,
  addEventFavorite,
  removeEventFavorite,
} from './utils/eventFavorites';

export default function HeroLanding() {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favMap, setFavMap] = useState({});
  const [favCounts, setFavCounts] = useState({});
  const [busyFav, setBusyFav] = useState(false);

  // parse "MM/DD/YYYY …" into a Date
  const parseDate = (datesStr) => {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    const [m, d, y] = first.trim().split('/');
    return new Date(+y, +m - 1, +d);
  };

  // returns { text, color, pulse } for the bubble under the name
  const getBubble = (start, isActive) => {
    if (isActive) {
      return { text: 'ON NOW', color: 'bg-green-500', pulse: true };
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff = Math.floor((start - today) / (1000 * 60 * 60 * 24));
    const dayName = start
      .toLocaleDateString('en-US', { weekday: 'short' })
      .toUpperCase();
    const prefix = diff < 7 ? 'This ' : 'Next ';
    return { text: `${prefix}${dayName}`, color: '', pulse: false };
  };

  // determine if a date is THIS weekend (Fri-Sun of this week)
  const isThisWeekend = (date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dayOfWeek = today.getDay(); // 0=Sun,1=Mon...6=Sat
    // calculate this week's Friday
    const daysToFri = (5 - dayOfWeek + 7) % 7;
    const fri = new Date(today);
    fri.setDate(today.getDate() + daysToFri);
    // this week's Sunday
    const daysToSun = (0 - dayOfWeek + 7) % 7;
    const sun = new Date(today);
    sun.setDate(today.getDate() + daysToSun);
    // normalize
    fri.setHours(0,0,0,0);
    sun.setHours(23,59,59,999);
    return date >= fri && date <= sun;
  };

  // load events
  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const { data, error } = await supabase
        .from('events')
        .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
        .order('Dates', { ascending: true });
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const enhanced = data
        .map(e => {
          const start = parseDate(e.Dates);
          const end = e['End Date'] ? parseDate(e['End Date']) : start;
          return { ...e, start, end, isActive: start <= today && today <= end };
        })
        .filter(e => e.end >= today)
        .sort((a,b) => a.isActive === b.isActive
          ? a.start - b.start
          : (a.isActive ? -1 : 1))
        .slice(0,15);
      setEvents(enhanced);
      setLoading(false);
    })();
  }, []);

  // load favorite counts
  useEffect(() => {
    if (!events.length) return;
    (async () => {
      const ids = events.map(e => e.id);
      const { data } = await supabase
        .from('event_favorites')
        .select('event_id')
        .in('event_id', ids);
      const counts = {};
      data.forEach(r => counts[r.event_id] = (counts[r.event_id]||0) + 1);
      setFavCounts(counts);
    })();
  }, [events]);

  // load user favorites
  useEffect(() => {
    if (!user) {
      setFavMap({});
      return;
    }
    getMyEventFavorites()
      .then(rows => {
        const map = {};
        rows.forEach(r => map[r.event_id] = r.id);
        setFavMap(map);
      })
      .catch(console.error);
  }, [user, events]);

  // toggle heart
  const toggleFav = async (id, e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return;
    setBusyFav(true);
    if (favMap[id]) {
      await removeEventFavorite(favMap[id]);
      setFavMap(m => { const c = {...m}; delete c[id]; return c; });
      setFavCounts(c => ({ ...c, [id]: (c[id]||1) - 1 }));
    } else {
      const { id: newId } = await addEventFavorite(id);
      setFavMap(m => ({ ...m, [id]: newId }));
      setFavCounts(c => ({ ...c, [id]: (c[id]||0) + 1 }));
    }
    setBusyFav(false);
  };

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-16 px-4 overflow-hidden">
      {/* Background graphic */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//OurPhilly-CityHeart-1%20copy-min.png"
        alt=""
        className="absolute top-0 w-1/4 h-full object-contain pointer-events-none"
      />

      <div className="relative max-w-screen-xl mx-auto z-20">
        <h2 className="text-4xl font-[Barrio] font-bold text-gray-700 mb-2">
          THIS WEEK & SOON
        </h2>
        <p className="text-gray-600 mb-6">
          POPULAR TRADITIONS & ANNUAL EVENTS
        </p>

        {loading ? (
          <p className="text-center">Loading…</p>
        ) : !events.length ? (
          <p className="text-center">No upcoming traditions.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-4">
              {events.map(evt => {
                const { text, color, pulse } = getBubble(evt.start, evt.isActive);
                const count = favCounts[evt.id] || 0;
                const isFav = Boolean(favMap[evt.id]);
                const showWeekendBadge = isThisWeekend(evt.start) && [5,6,0].includes(evt.start.getDay());

                return (
                  <Link
                    key={evt.id}
                    to={`/events/${evt.slug}`}
                    className="relative w-[260px] h-[380px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg"
                  >
                    {/* cover image */}
                    <img
                      src={evt['E Image']}
                      alt={evt['E Name']}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />

                    {/* Weekend Pick badge only if this weekend */}
                    {showWeekendBadge && (
                      <span className="absolute top-3 left-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full z-20">
                        Weekend Pick
                      </span>
                    )}

                    {/* favorite heart */}
                    <button
                      onClick={e => toggleFav(evt.id, e)}
                      disabled={busyFav}
                      className="absolute top-3 right-3 text-2xl text-white z-20"
                      aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                    >
                      {isFav ? '❤️' : '🤍'}
                    </button>
                    {count > 0 && (
                      <span className="absolute top-10 right-3 text-sm font-semibold text-white z-20">
                        {count}
                      </span>
                    )}

                    {/* event name */}
                    <h3 className="absolute bottom-16 left-4 right-4 text-center text-white text-3xl font-bold z-20 leading-tight">
                      {evt['E Name']}
                    </h3>

                    {/* bubble under name */}
                    {evt.isActive ? (
                      <span
                        className={`
                          absolute bottom-6 left-1/2 transform -translate-x-1/2
                          bg-green-500 text-white text-base font-bold px-4 py-1 rounded-full animate-pulse z-20
                        `}
                      >
                        ON NOW
                      </span>
                    ) : (
                      <span
                        className={`
                          absolute bottom-6 left-1/2 transform -translate-x-1/2
                          bg-[#ba3d36] text-white text-base font-bold px-4 py-1 rounded-full z-20
                        `}
                      >
                        {text}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
