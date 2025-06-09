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

  const parseDate = datesStr => {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    const [m, d, y] = first.trim().split('/');
    return new Date(+y, +m - 1, +d);
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
        .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
        .order('Dates', { ascending: true });
      if (error) {
        console.error('Error loading events:', error);
        setLoading(false);
        return;
      }
      const enhanced = data
        .map(e => {
          const start = parseDate(e.Dates);
          const end   = e['End Date'] ? parseDate(e['End Date']) : start;
          return {
            ...e,
            start,
            end,
            isActive: start <= today && today <= end,
          };
        })
        .filter(e => e.end >= today)
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

  useEffect(() => {
    if (!events.length) return;
    (async () => {
      const ids = events.map(e => e.id);
      const { data } = await supabase
        .from('event_favorites')
        .select('event_id')
        .in('event_id', ids);
      const counts = {};
      data.forEach(r => (counts[r.event_id] = (counts[r.event_id] || 0) + 1));
      setFavCounts(counts);
    })();
  }, [events]);

  useEffect(() => {
    if (!user) {
      setFavMap({});
      return;
    }
    getMyEventFavorites()
      .then(rows => {
        const map = {};
        rows.forEach(r => { map[r.event_id] = r.id });
        setFavMap(map);
      })
      .catch(console.error);
  }, [user, events]);

  const toggleFav = async (id, e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return;
    setBusyFav(true);
    if (favMap[id]) {
      await removeEventFavorite(favMap[id]);
      setFavMap(m => { const c = { ...m }; delete c[id]; return c; });
      setFavCounts(c => ({ ...c, [id]: (c[id] || 1) - 1 }));
    } else {
      const { id: newId } = await addEventFavorite(id);
      setFavMap(m => ({ ...m, [id]: newId }));
      setFavCounts(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
    }
    setBusyFav(false);
  };

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-16 px-4 overflow-hidden">
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1%20copy-min.png"
        alt=""
        className="absolute top-0 w-1/4 h-full object-contain pointer-events-none"
      />

      <div className="relative max-w-screen-xl mx-auto text-center z-20">
        {/* inline header + button */}
        <div className="flex   justify-between mb-6">
          <h2 className="text-2xl sm:text-4xl font-medium font-bold text-gray-700">
            Upcoming Annual Philly Traditions
          </h2>
         
        </div>

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
                const showWeekendBadge =
                  isThisWeekend(evt.start) && [5, 6, 0].includes(evt.start.getDay());

                return (
                  <Link
                    key={evt.id}
                    to={`/events/${evt.slug}`}
                    className="relative w-[260px] h-[380px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg"
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

                    <h3 className="absolute bottom-16 left-4 right-4 text-center text-white text-3xl font-[Barrio] font-bold z-20 leading-tight">
                      {evt['E Name']}
                    </h3>

                    <span
                      className={`
                        absolute bottom-6 left-1/2 transform -translate-x-1/2
                        ${color} text-white text-base font-bold px-6 py-1 rounded-full
                        whitespace-nowrap min-w-[6rem]
                        ${pulse ? 'animate-pulse' : ''} z-20
                      `}
                    >
                      {text}
                    </span>
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
