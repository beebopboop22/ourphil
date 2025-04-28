// src/SeasonalEventsGrid.jsx
import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import {
  getMySeasonalFavorites,
  addSeasonalFavorite,
  removeSeasonalFavorite,
} from './utils/seasonalFavorites';

const SeasonalEventsGrid = () => {
  const { user } = useContext(AuthContext);

  const [events, setEvents]               = useState([]);
  const [favMap, setFavMap]               = useState({}); // event_id → fav record id
  const [favCounts, setFavCounts]         = useState({}); // event_id → count
  const [busyFavAction, setBusyFavAction] = useState(false);

  // 1) load all upcoming seasonal events
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0,10);
      const { data, error } = await supabase
        .from('seasonal_events')
        .select('id, name, description, start_date, end_date, link, image_url')
        .gte('end_date', today)       // only those not yet ended
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error loading seasonal events:', error);
      } else {
        setEvents(data);
      }
    })();
  }, []);

  // 2) load total favorite counts for these events
  useEffect(() => {
    if (!events.length) return;
    (async () => {
      const ids = events.map(e => e.id);
      const { data, error } = await supabase
        .from('seasonal_event_favorites')
        .select('seasonal_event_id')
        .in('seasonal_event_id', ids);

      if (error) {
        console.error('Error loading event favorite counts:', error);
      } else {
        const counts = {};
        data.forEach(r => {
          counts[r.seasonal_event_id] = (counts[r.seasonal_event_id] || 0) + 1;
        });
        setFavCounts(counts);
      }
    })();
  }, [events]);

  // 3) load this user’s existing favorites
  useEffect(() => {
    if (!user) {
      setFavMap({});
      return;
    }
    getMySeasonalFavorites()
      .then(rows => {
        const m = {};
        rows.forEach(r => { m[r.seasonal_event_id] = r.id; });
        setFavMap(m);
      })
      .catch(console.error);
  }, [user, events]);

  // 4) toggle favorite
  const toggleFav = async (eventId) => {
    if (!user) return;
    setBusyFavAction(true);

    if (favMap[eventId]) {
      await removeSeasonalFavorite(favMap[eventId]);
      setFavMap(m => { const c = {...m}; delete c[eventId]; return c; });
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId]||1) - 1 }));
    } else {
      const inserted = await addSeasonalFavorite(eventId);
      setFavMap(m => ({ ...m, [eventId]: inserted.id }));
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId]||0) + 1 }));
    }

    setBusyFavAction(false);
  };

  if (!events.length) return null;

  return (
    <section className="w-full max-w-screen-xl mx-auto py-12 px-4">
      <h2 className="text-4xl font-[Barrio] text-gray-800 mb-4 text-center">
        OPEN FOR THE SEASON
      </h2>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4">
          {events.map(evt => {
            const displayRange = evt.end_date && evt.end_date !== evt.start_date
              ? `${new Date(evt.start_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${new Date(evt.end_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
              : new Date(evt.start_date).toLocaleDateString('en-US',{month:'short',day:'numeric'});

            const isFav = Boolean(favMap[evt.id]);
            const count = favCounts[evt.id] || 0;

            return (
              <a
                key={evt.id}
                href={evt.link}
                target="_blank"
                rel="noopener noreferrer"
                className="relative w-[260px] flex-shrink-0 bg-white rounded-xl shadow-md overflow-hidden flex flex-col"
              >
                {evt.image_url && (
                  <img
                    src={evt.image_url}
                    alt={evt.name}
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="p-3 flex-grow flex flex-col">
                  <h3 className="text-lg font-bold text-indigo-800 mb-1 line-clamp-2">
                    {evt.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2 flex-grow line-clamp-3">
                    {evt.description}
                  </p>
                </div>
                <div className="bg-gray-100 border-t px-3 py-2 flex items-center justify-center space-x-2">
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFav(evt.id); }}
                    disabled={busyFavAction}
                    className="text-xl"
                  >
                    {isFav ? '❤️' : '🤍'}
                  </button>
                  <span className="font-[Barrio] text-base text-gray-800">
                    {count}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SeasonalEventsGrid;
