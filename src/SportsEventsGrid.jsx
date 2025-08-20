// src/SportsEventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
];

export default function SportsEventsGrid() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let allEvents = [];
        for (const slug of teamSlugs) {
          const res = await fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
          );
          const data = await res.json();
          allEvents.push(...(data.events || []));
        }
        const homeGames = allEvents.filter(e => e.venue?.city === 'Philadelphia');
        homeGames.sort((a, b) => new Date(a.datetime_local) - new Date(b.datetime_local));
        setEvents(homeGames);
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Utility: diff in days (floor)
  const dayDiff = (eventDate) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffMs = eventDate - today;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  // Display label
  const getDisplayDay = (eventDate) => {
    const diff = dayDiff(eventDate);
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'TOMORROW';

    const weekday = eventDate
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();

    const prefix = diff > 1 && diff < 7 ? 'THIS' : 'NEXT';
    return `${prefix} ${weekday}`; // non-breaking space
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto mb-16 mt-12 px-4">
      <h2 className="text-black text-4xl font-[Barrio] mb-2 text-left">SPORTS</h2>
      <p className="text-gray-600 text-sm mb-6 text-left">
        Catch the Phillies, Sixers, Eagles, Flyers & Union in action
      </p>

      {loading ? (
        <p>Loading events…</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 pb-4">
            {events.map(evt => {
              const eventDate  = new Date(evt.datetime_local);
              const diff       = dayDiff(eventDate);
              const displayDay = getDisplayDay(eventDate);

              // badge color logic
              const bgColor =
                diff === 0 ? 'bg-green-500' :
                diff === 1 ? 'bg-blue-500' :
                'bg-gray-500';

              return (
                <div
                  key={evt.id}
                  className="relative min-w-[360px] max-w-[360px] bg-white rounded-2xl shadow-lg hover:shadow-xl transition-transform hover:scale-105 overflow-hidden flex flex-col"
                >
                  <Link to={`/sports/${evt.id}`} className="flex flex-col flex-grow">
                    <div className="relative">
                      <img
                        src={evt.performers?.[0]?.image || 'https://via.placeholder.com/400'}
                        alt={evt.short_title}
                        className="w-full h-56 object-cover"
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

                    <div className="p-5 flex flex-col justify-between flex-grow">
                      <h3 className="text-lg font-bold text-indigo-800 mb-2 line-clamp-2">
                        {evt.short_title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        📅 {eventDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day:   'numeric',
                        })}
                      </p>
                      {evt.stats?.lowest_price && (
                        <p className="text-sm text-yellow-600 font-semibold mt-2">
                          🎟️ From ${evt.stats.lowest_price}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        📍 {evt.venue?.name}, {evt.venue?.city}
                      </p>
                    </div>
                  </Link>
                  {evt.url && (
                    <a
                      href={evt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="m-4 mt-2 border border-indigo-600 rounded-md py-2 font-semibold text-center text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      Get Tickets
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
