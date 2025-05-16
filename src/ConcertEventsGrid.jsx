// src/ConcertEventsGrid.jsx
import React, { useEffect, useState } from 'react';

const ConcertEventsGrid = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Compute difference in days between eventDate and today
  const dayDiff = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = eventDate - today;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  // Returns the label for the badge
  const getDisplayDay = (eventDate) => {
    const diff = dayDiff(eventDate);
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'TOMORROW';

    const weekday = eventDate
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();

    // days 2–6 ahead are "THIS X", 7+ are "NEXT X"
    const prefix = diff > 1 && diff < 7 ? 'THIS' : 'NEXT';
    return `${prefix} ${weekday}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://api.seatgeek.com/2/events?taxonomies.name=concert&venue.city=Philadelphia&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
        );
        const data = await res.json();
        setEvents(data.events || []);
      } catch (err) {
        console.error('Error fetching concerts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="w-full max-w-screen-xl mx-auto mb-12 px-4">
      <h2 className="text-black text-4xl font-[Barrio] mb-2 text-left">CONCERTS</h2>
      <p className="text-gray-600 text-sm mb-4 text-left">
        Live music all over the city — here's what's next
      </p>

      {loading ? (
        <p>Loading concerts…</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-2">
            {events.map(evt => {
              const eventDate  = new Date(evt.datetime_local);
              const diff       = dayDiff(eventDate);
              const displayDay = getDisplayDay(eventDate);

              // choose badge color
              const bgColor =
                diff === 0 ? 'bg-green-500' :
                diff === 1 ? 'bg-blue-500' :
                'bg-gray-500';

              return (
                <a
                  key={evt.id}
                  href={evt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative min-w-[280px] max-w-[280px] bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-105 overflow-hidden flex flex-col"
                >
                  <div className="relative">
                    <img
                      src={evt.performers?.[0]?.image || 'https://via.placeholder.com/300'}
                      alt={evt.short_title}
                      className="w-full h-36 object-cover"
                    />

                    {/* Day badge */}
                    <div
                      className={`
                        absolute top-2 left-2 text-white text-sm font-bold
                        px-3 py-0.5 rounded-full whitespace-nowrap shadow-md z-10
                        ${bgColor}
                      `}
                    >
                      {displayDay}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-grow">
                    <h3 className="text-md font-semibold text-indigo-800 mb-1 truncate">
                      {evt.short_title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      📅 {eventDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day:   'numeric',
                      })}
                    </p>
                    {evt.stats?.lowest_price && (
                      <p className="text-xs text-yellow-600 font-medium mt-1">
                        🎟️ From ${evt.stats.lowest_price}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      📍 {evt.venue?.name}, {evt.venue?.city}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcertEventsGrid;
