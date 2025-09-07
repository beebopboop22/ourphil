// src/SeasonalEventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

const SeasonalEventsGrid = () => {
  const [events, setEvents] = useState([]);

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
