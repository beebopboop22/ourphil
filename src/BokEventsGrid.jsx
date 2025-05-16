// src/BokEventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function BokEventsGrid() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Compute full-day difference
  const dayDiff = (date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = new Date(date);
    d.setHours(0,0,0,0);
    return Math.round((d - today) / (1000*60*60*24));
  };

  // Returns "TODAY", "TOMORROW", "THIS XDAY", or "NEXT XDAY"
  const getDisplayDay = (date) => {
    const diff = dayDiff(date);
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'TOMORROW';

    const weekday = date
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();

    const prefix = diff > 1 && diff < 7 ? 'THIS' : 'NEXT';
    return `${prefix} ${weekday}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        today.setHours(0,0,0,0);

        const { data, error } = await supabase
          .from('bok_events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;

        // only future and today
        const upcoming = data.filter(evt => {
          const d = new Date(evt.date);
          d.setHours(0,0,0,0);
          return d >= today;
        });

        setEvents(upcoming);
      } catch (err) {
        console.error('Error fetching Bok events:', err);
      } finally {
        setLoading(false);
      }
    })();
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
              <p className="z-10">No upcoming events found.</p>
            ) : (
              events.map(evt => {
                const eventDate  = new Date(evt.date);
                const diff       = dayDiff(evt.date);
                const displayTag = getDisplayDay(eventDate);

                // badge colors: green/today, blue/tomorrow, gray/others
                const bgColor =
                  diff === 0 ? 'bg-green-500' :
                  diff === 1 ? 'bg-blue-500' :
                  'bg-gray-500';

                return (
                  <a
                    key={evt.link}
                    href={evt.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative min-w-[240px] max-w-[240px] bg-white rounded-lg shadow hover:shadow-lg transition-transform hover:scale-105 overflow-hidden flex flex-col"
                  >
                    <div className="relative">
                      <img
                        src={evt.image || 'https://via.placeholder.com/300'}
                        alt={evt.title}
                        className="w-full h-32 object-cover"
                      />
                      <div
                        className={`
                          absolute top-2 left-2 text-white text-sm font-bold
                          px-3 py-0.5 rounded-full whitespace-nowrap shadow-md z-10
                          ${bgColor}
                        `}
                      >
                        {displayTag}
                      </div>
                    </div>

                    <div className="p-3 flex flex-col justify-between flex-grow">
                      <h3 className="text-sm font-semibold text-indigo-800 mb-1 line-clamp-2">
                        {evt.title}
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        📅 {eventDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day:   'numeric',
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
}
