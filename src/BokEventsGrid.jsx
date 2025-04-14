import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const BokEventsGrid = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // normalize to midnight

        const { data, error } = await supabase
          .from('bok_events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;

        const upcomingEvents = data.filter((event) => {
          const eventDate = new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= today;
        });

        setEvents(upcomingEvents);
      } catch (error) {
        console.error('Error fetching Bok events:', error);
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
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/Remove%20background%20project%20(5).png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvUmVtb3ZlIGJhY2tncm91bmQgcHJvamVjdCAoNSkucG5nIiwiaWF0IjoxNzQ0NDI2NTUxLCJleHAiOjcxODE3NDE4NTUxfQ.Iqsj1D81oMN2dx0-ApUVCploQQrFLU9KtoqlXx3JXUc"
        alt="Gritty background"
        className="absolute left-0 top-0 -translate-y-1/4 w-1/3 h-auto opacity-50 rotate-3 pointer-events-none"
      />

      <h2 className="text-black text-4xl font-[Barrio] mb-1 text-left z-10 relative">
        BOK EVENTS
      </h2>

      <p className="text-gray-600 text-sm mb-6 text-left z-10 relative">
        What's happening at Bok in South Philly
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
                const weekday = eventDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

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
                        {weekday}
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

export default BokEventsGrid;

