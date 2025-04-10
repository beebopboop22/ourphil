import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';

const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
];

const SportsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const allEvents = [];

        for (const slug of teamSlugs) {
          const res = await fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
          );
          const data = await res.json();
          allEvents.push(...(data.events || []));
        }

        allEvents.sort((a, b) => new Date(a.datetime_local) - new Date(b.datetime_local));

        setEvents(allEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-white py-10 px-4">
      <Navbar />

      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-black text-2xl font-bold mb-1 text-left">🏟️ Upcoming Philly Sports Games</h2>
        <p className="text-gray-600 text-sm mb-4 text-left">Every major home game, all in one place.</p>

        {loading ? (
          <p>Loading games...</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-2 flex-wrap justify-start">
              {events.map(event => {
                const eventDate = new Date(event.datetime_local);
                const weekday = eventDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

                return (
                  <a
                    key={event.id}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative min-w-[280px] max-w-[280px] bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-105 overflow-hidden flex flex-col"
                  >
                    <div className="relative">
                      <img
                        src={event.performers?.[0]?.image || 'https://via.placeholder.com/300'}
                        alt={event.short_title}
                        className="w-full h-36 object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                        {weekday}
                      </div>
                    </div>

                    <div className="p-4 flex flex-col justify-between flex-grow">
                      <h3 className="text-md font-semibold text-indigo-800 mb-1 truncate">
                        {event.short_title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        📅 {eventDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      {event.stats?.lowest_price && (
                        <p className="text-xs text-yellow-600 font-medium mt-1">
                          🎟️ From ${event.stats.lowest_price}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        📍 {event.venue?.name}, {event.venue?.city}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SportsPage;


