import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const SouthStreetEventsGrid = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper function to display "TODAY", "TOMORROW", or weekday.
  const getDisplayDay = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Normalize event date to midnight.
    const normalizedEvent = new Date(eventDate);
    normalizedEvent.setHours(0, 0, 0, 0);

    if (normalizedEvent.getTime() === today.getTime()) {
      return 'TODAY';
    } else if (normalizedEvent.getTime() === tomorrow.getTime()) {
      return 'TOMORROW';
    } else {
      return normalizedEvent.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // normalize to midnight

        const { data, error } = await supabase
          .from('south_street_events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;

        // Filter for only today or future events.
        const upcomingEvents = data.filter((event) => {
          const eventDate = new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= today;
        });

        setEvents(upcomingEvents);
      } catch (error) {
        console.error('Error fetching South Street events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="relative w-full max-w-screen-xl mx-auto mb-12 px-4 py-8">
      {/* Background Image */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/South-STREET-JEFF-FUSCO-940X540-removebg-preview.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvU291dGgtU1RSRUVULUpFRkYtRlVTQ08tOTQwWDU0MC1yZW1vdmViZy1wcmV2aWV3LnBuZyIsImlhdCI6MTc0NDQ2OTA4MiwiZXhwIjozNjc4MDk2NTA4Mn0.9L-70FNw4HBePpKyhRqkWdTwABoPTMmKwu5SV-bGGXM"
        alt="South Street background"
        className="absolute right-0 top-10 -translate-y-1/4 w-60 h-auto opacity-60 rotate-2 pointer-events-none"
      />

      <h2 className="text-black text-4xl font-[Barrio] mb-1 text-left z-10 relative">
        SOUTH STREET EVENTS
      </h2>

      <p className="text-gray-600 text-sm mb-6 text-left z-10 relative">
        What's happening on South Street
      </p>

      {loading ? (
        <p className="z-10 relative">Loading events...</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide z-10 relative">
          <div className="flex gap-3 md:gap-5 pb-2">
            {events.length === 0 ? (
              <p>No upcoming events found.</p>
            ) : (
              events.map((event) => {
                const eventDate = new Date(event.date);
                const displayTag = getDisplayDay(eventDate);

                return (
                  <a
                    key={event.link}
                    href={event.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative min-w-[240px] max-w-[240px] bg-white rounded-lg shadow hover:shadow-lg transition-transform hover:scale-105 overflow-hidden flex flex-col"
                  >
                    <div className="relative">
                      <img
                        src={event.image || 'https://via.placeholder.com/300'}
                        alt={event.title}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        {displayTag}
                      </div>
                    </div>

                    <div className="p-3 flex flex-col justify-between flex-grow">
                      <h3 className="text-sm font-semibold text-indigo-800 mb-1 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        📅 {eventDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SouthStreetEventsGrid;

