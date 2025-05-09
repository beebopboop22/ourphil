// src/SeasonalEventsGrid.jsx
import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import {
  getMySeasonalFavorites,
  addSeasonalFavorite,
  removeSeasonalFavorite,
} from './utils/seasonalFavorites';

const SeasonalEventsGrid = () => {
  const { user } = useContext(AuthContext);

  const [events, setEvents] = useState([]);
  const [favMap, setFavMap] = useState({});
  const [favCounts, setFavCounts] = useState({});
  const [busyFavAction, setBusyFavAction] = useState(false);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('seasonal_events')
        .select('id, slug, name, start_date, end_date, image_url')
        .gte('end_date', today)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error loading seasonal events:', error);
      } else {
        setEvents(data);
      }
    })();
  }, []);

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

  const toggleFav = async (eventId) => {
    if (!user) return;
    setBusyFavAction(true);

    if (favMap[eventId]) {
      await removeSeasonalFavorite(favMap[eventId]);
      setFavMap(m => { const c = { ...m }; delete c[eventId]; return c; });
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId] || 1) - 1 }));
    } else {
      const inserted = await addSeasonalFavorite(eventId);
      setFavMap(m => ({ ...m, [eventId]: inserted.id }));
      setFavCounts(c => ({ ...c, [eventId]: (c[eventId] || 0) + 1 }));
    }

    setBusyFavAction(false);
  };

  if (!events.length) return null;

  return (
    <section className="w-full max-w-screen-xl mx-auto py-12 px-4">
      <h2 className="text-4xl font-[Barrio] text-gray-800 mb-4 text-left">
        OPEN FOR THE SEASON
      </h2>
      <p className=" text-left mb-4 text-gray-600">
          Beer gardens, parks and other stuff here for the season.
        </p>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-6">
          {events.map(evt => {
            const now = new Date();
            const startDate = new Date(evt.start_date);
            const isOpen = now >= startDate;

            const tagText = isOpen
              ? 'Open'
              : `Opens ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            const tagColor = isOpen ? 'bg-green-500' : 'bg-yellow-500';

            const isFav = Boolean(favMap[evt.id]);
            const count = favCounts[evt.id] || 0;

            return (
              <Link
                key={evt.id}
                to={`/seasonal/${evt.slug}`}
                className="relative w-[260px] h-[360px] flex-shrink-0 rounded-2xl shadow-lg overflow-hidden"
              >
                {/* Full-cover image */}
                {evt.image_url && (
                  <img
                    src={evt.image_url}
                    alt={evt.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/30" />

                {/* “Open” tag */}
                <div
                  className={`absolute top-3 left-3 px-2 py-1 text-xs font-bold text-white rounded-full ${tagColor}`}
                >
                  {tagText}
                </div>

                {/* Heart + count aligned */}
                <div className="absolute top-3 right-3 flex items-center space-x-1 z-20">
                  <button
                    onClick={e => { 
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      toggleFav(evt.id);
                    }}
                    disabled={busyFavAction}
                    className="text-2xl text-white"
                    aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                  >
                    {isFav ? '❤️' : '🤍'}
                  </button>
                  {count > 0 && (
                    <span className="text-sm font-semibold text-white">
                      {count}
                    </span>
                  )}
                </div>

                {/* Event name */}
                <h3 className="absolute bottom-4 left-4 right-4 text-center text-white text-3xl font-bold z-20 leading-tight drop-shadow">
                  {evt.name}
                </h3>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SeasonalEventsGrid;
