import React, { useEffect, useState } from 'react';

const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
];

const SportsEventsGrid = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        let allEvents = [];

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

  // Utility function to get the display label for the event day
  const getDisplayDay = (eventDate) => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Normalize the times by comparing year, month, and date only.
    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(eventDate, today)) {
      return 'TODAY';
    } else if (isSameDay(eventDate, tomorrow)) {
      return 'TOMORROW';
    } else {
      return eventDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    }
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto mb-16 px-4">
      <h2 className="text-black text-4xl font-[Barrio] mb-2 text-left">SPORTS</h2>
      <p className="text-gray-600 text-sm mb-6 text-left">
        Catch the Phillies, Sixers, Eagles, Flyers & Union in action
      </p>

      {loading ? (
        <p>Loading events...</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 pb-4">
            {events.map((event) => {
              const eventDate = new Date(event.datetime_local);
              const displayDay = getDisplayDay(eventDate);

              return (
                <a
                  key={event.id}
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative min-w-[360px] max-w-[360px] bg-white rounded-2xl shadow-lg hover:shadow-xl transition-transform hover:scale-105 overflow-hidden flex flex-col"
                >
                  <div className="relative">
                    <img
                      src={event.performers?.[0]?.image || 'https://via.placeholder.com/400'}
                      alt={event.short_title}
                      className="w-full h-56 object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                      {displayDay}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col justify-between flex-grow">
                    <h3 className="text-lg font-bold text-indigo-800 mb-2 line-clamp-2">
                      {event.short_title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      📅 {eventDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {event.stats?.lowest_price && (
                      <p className="text-sm text-yellow-600 font-semibold mt-2">
                        🎟️ From ${event.stats.lowest_price}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
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
  );
};

export default SportsEventsGrid;


