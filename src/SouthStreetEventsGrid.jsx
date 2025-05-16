// src/SouthStreetEventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function SouthStreetEventsGrid() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculate difference in whole days between given date and today
  function dayDiff(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    return Math.round((d - today) / (1000*60*60*24));
  }

  // Return the badge text: TODAY, TOMORROW, THIS MONDAY, NEXT FRIDAY, etc.
  function getDisplayDay(date) {
    const diff = dayDiff(date);
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'TOMORROW';

    const weekday = date
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();
    const prefix = diff > 1 && diff < 7 ? 'THIS' : 'NEXT';
    return `${prefix} ${weekday}`;
  }

  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        today.setHours(0,0,0,0);

        const { data, error } = await supabase
          .from('south_street_events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;

        // Filter to today or future
        const upcoming = data.filter(evt => {
          const d = new Date(evt.date);
          d.setHours(0,0,0,0);
          return d >= today;
        });

        setEvents(upcoming);
      } catch (err) {
        console.error('Error fetching South Street events:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative w-full max-w-screen-xl mx-auto mb-12 px-4 py-8">
      {/* Background Image */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/South-STREET-JEFF-FUSCO-940X540-removebg-preview.png?token=..."
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
              <p className="z-10">No upcoming events found.</p>
            ) : (
              events.map(evt => {
                const eventDate  = new Date(evt.date);
                const diff       = dayDiff(evt.date);
                const displayTag = getDisplayDay(eventDate);

                // Badge colors: green=today, blue=tomorrow, gray=others
                const badgeColor =
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
                          ${badgeColor}
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
