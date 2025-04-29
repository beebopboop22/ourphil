// src/MonthlyEvents.jsx
import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import {
  getMyEventFavorites,
  addEventFavorite,
  removeEventFavorite,
} from './utils/eventFavorites';
import { Link } from 'react-router-dom';

const MonthlyEvents = () => {
  const { user } = useContext(AuthContext);

  const [events, setEvents] = useState([]);
  const [favMap, setFavMap] = useState({});      // event_id → favorite record id
  const [favCounts, setFavCounts] = useState({}); // event_id → total count
  const [busyFav, setBusyFav] = useState(false);

  // parse a "Dates" string into a JS Date
  const parseDate = (datesStr) => {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    return new Date(first.trim());
  };

  // format start/end into "Apr 1 – Apr 30" or "May 5"
  const formatDisplayDate = (start, end) => {
    const opts = { month: 'short', day: 'numeric' };
    const s = start.toLocaleDateString('en-US', opts);
    const e = end.toLocaleDateString('en-US', opts);
    return end > start ? `${s} – ${e}` : s;
  };

  // 1) fetch & preprocess events
  useEffect(() => {
    (async () => {
      const today = new Date();
      today.setHours(0,0,0,0);

      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          "E Name",
          "E Description",
          Dates,
          "End Date",
          "E Image"
        `)
        .order('Dates', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      const enhanced = data
        .map(e => {
          const start = parseDate(e.Dates);
          const end = parseDate(e['End Date']) || start;
          return {
            ...e,
            start,
            end,
            isActive: start <= today && today <= end,
            displayDate: formatDisplayDate(start, end),
          };
        })
        .filter(e => e.end >= today)
        .slice(0, 12);

      setEvents(enhanced);
    })();
  }, []);

  // 2) load total favorite counts for these event IDs
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
        data.forEach(r => {
          counts[r.event_id] = (counts[r.event_id] || 0) + 1;
        });
        setFavCounts(counts);
      }
    })();
  }, [events]);

  // 3) load this user’s favorites
  useEffect(() => {
    if (!user) {
      setFavMap({});
      return;
    }
    getMyEventFavorites()
      .then(rows => {
        const m = {};
        rows.forEach(r => { m[r.event_id] = r.id; });
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
      setFavMap(m => {
        const next = { ...m };
        delete next[eventId];
        return next;
      });
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId]||1) - 1 }));
    } else {
      const data = await addEventFavorite(eventId);
      setFavMap(m => ({ ...m, [eventId]: data[0].id }));
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId]||0) + 1 }));
    }

    setBusyFav(false);
  };

  if (!events.length) return null;

  return (
    <div className="w-full max-w-screen-xl mx-auto mb-12 px-4">
      <h2 className="text-black text-4xl font-[Barrio] mb-2 text-left">
        Philly Traditions
      </h2>
      <p className="text-gray-600 text-sm mb-4 text-left">
        Iconic city happenings you can take part in
      </p>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 pb-2">
          {events.map(evt => {
            const isFav = Boolean(favMap[evt.id]);
            const count = favCounts[evt.id] || 0;

            return (
              <Link
                key={evt.id}
                to={`/events/${evt.id}`}
                className="relative min-w-[250px] max-w-[250px] bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-105 overflow-hidden flex flex-col h-[360px]"
              >
                {evt.isActive && (
                  <div className="absolute top-2 left-2 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                    🟢 Active
                  </div>
                )}

                {evt['E Image'] && (
                  <img
                    src={evt['E Image']}
                    alt={evt['E Name']}
                    className="w-full h-32 object-cover"
                  />
                )}

                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="text-md font-semibold text-indigo-800 mb-1 truncate text-center">
                    {evt['E Name']}
                  </h3>
                  {evt['E Description'] && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-3 flex-grow">
                      {evt['E Description']}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 text-center">
                    📅 {evt.displayDate}
                  </p>
                </div>

                <div className="bg-gray-100 border-t px-3 py-2 flex items-center justify-center space-x-3">
                  <button
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
    </div>
  );
};

export default MonthlyEvents;
