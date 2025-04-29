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

const HeroLanding = () => {
  const { user } = useContext(AuthContext);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // favorite state
  const [favMap, setFavMap]       = useState({}); // event_id → fav record id
  const [favCounts, setFavCounts] = useState({}); // event_id → count
  const [busyFav, setBusyFav]     = useState(false);

  const parseDate = (datesStr) => {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    return new Date(first.trim());
  };

  const getDisplayDay = (d) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const nd = new Date(d); nd.setHours(0,0,0,0);
    if (nd.getTime() === today.getTime()) return 'TODAY';
    if (nd.getTime() === tomorrow.getTime()) return 'TOMORROW';
    return nd.toLocaleDateString('en-US',{ weekday:'short' }).toUpperCase();
  };

  // 1) fetch events (including slug)
  useEffect(() => {
    (async () => {
      try {
        const today = new Date(); today.setHours(0,0,0,0);
        const { data, error } = await supabase
          .from('events')
          .select(`id, slug, "E Name", Dates, "End Date", "E Image", "E Link", "E Description"`)
          .order('Dates', { ascending: true });
        if (error) throw error;

        const enhanced = data
          .map(e => {
            const start = parseDate(e.Dates);
            const end   = parseDate(e['End Date']) || start;
            return {
              ...e,
              start,
              end,
              isActive: start <= today && today <= end,
            };
          })
          .filter(e => e.end >= today)
          .sort((a,b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return a.start - b.start;
          })
          .slice(0, 15);

        setEvents(enhanced);
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2) load counts
  useEffect(() => {
    if (!events.length) return;
    (async () => {
      const ids = events.map(e => e.id);
      const { data, error } = await supabase
        .from('event_favorites')
        .select('event_id')
        .in('event_id', ids);
      if (!error) {
        const counts = {};
        data.forEach(r => counts[r.event_id] = (counts[r.event_id]||0) + 1);
        setFavCounts(counts);
      }
    })();
  }, [events]);

  // 3) load user favorites
  useEffect(() => {
    if (!user) { setFavMap({}); return; }
    getMyEventFavorites()
      .then(rows => {
        const m = {};
        rows.forEach(r => m[r.event_id] = r.id);
        setFavMap(m);
      })
      .catch(console.error);
  }, [user, events]);

  // 4) toggle heart
  const toggleFav = async (eventId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setBusyFav(true);
    if (favMap[eventId]) {
      await removeEventFavorite(favMap[eventId]);
      setFavMap(m => { const c={...m}; delete c[eventId]; return c; });
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId]||1) - 1 }));
    } else {
      const newFav = await addEventFavorite(eventId);
      setFavMap(m => ({ ...m, [eventId]: newFav.id }));
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId]||0) + 1 }));
    }
    setBusyFav(false);
  };

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-16 px-4 overflow-hidden">
      {/* HUGE Background Illustration */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-2.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0yLnBuZyIsImlhdCI6MTc0NTk1MTY3NiwiZXhwIjozMzI4MTk1MTY3Nn0._vHW37fowO3ttrO9Cvw1cDhQd03r31Tet4RSYKQ48qk"
        alt=""
        className="absolute bottom-1/4 w-1/3 h-full object-contain opacity-100 pointer-events-none"
      />

      <div className="relative max-w-screen-xl mx-auto text-center z-10">
        <h1 className="text-8xl font-[Barrio] font-black mb-1 text-black">
          DIG INTO PHILLY
        </h1>
        <h2 className="text-4xl font-bold text-gray-700 mb-8">
          UPCOMING PHILLY TRADITIONS
        </h2>

        {loading ? (
          <p className="text-center">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="text-center">No upcoming traditions found.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-4">
              {events.map((evt, idx) => {
                const tag = getDisplayDay(evt.start);
                const isFeatured = idx % 4 === 0;
                const widthClass = isFeatured
                  ? 'min-w-[380px] max-w-[380px]'
                  : 'min-w-[260px] max-w-[260px]';

                const startStr = evt.start.toLocaleDateString('en-US',{ month:'short', day:'numeric' });
                const endStr   = evt.end.toLocaleDateString('en-US',{ month:'short', day:'numeric' });
                const displayDate = evt.end > evt.start
                  ? `${startStr} – ${endStr}`
                  : startStr;

                const isFav = Boolean(favMap[evt.id]);
                const count = favCounts[evt.id] || 0;

                return (
                  <Link
                    key={evt.id}
                    to={`/events/${evt.slug}`}
                    className={`relative ${widthClass}
                      bg-gray-50 rounded-2xl shadow-md
                      hover:shadow-xl transition-transform hover:scale-105
                      flex flex-col overflow-hidden`}
                  >
                    {evt.isActive && (
                      <div className="absolute top-2 left-2 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                        🟢 Active
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {tag}
                    </div>

                    {evt['E Image'] && (
                      <img
                        src={evt['E Image']}
                        alt={evt['E Name']}
                        className={`w-full ${isFeatured ? 'h-56' : 'h-44'} object-cover`}
                      />
                    )}
                    <div className="p-3 space-y-1 flex-grow">
                      <h3 className="text-xl md:text-2xl font-bold text-indigo-800 line-clamp-2 text-center">
                        {evt['E Name']}
                      </h3>
                      {evt['E Description'] && (
                        <p className="text-sm md:text-base text-gray-700 line-clamp-3">
                          {evt['E Description']}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 text-center">
                        📅 {displayDate}
                      </p>
                    </div>

                    {/* bottom bar with heart + count */}
                    <div className="bg-gray-100 border-t px-3 py-2 flex items-center justify-center space-x-3">
                      <button
                        type="button"
                        onClick={e => toggleFav(evt.id, e)}
                        disabled={busyFav}
                        className="text-xl"
                      >
                        {isFav ? '❤️' : '🤍'}
                      </button>
                      <span className="font-[Barrio] text-lg text-gray-800">
                        {count}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroLanding;
