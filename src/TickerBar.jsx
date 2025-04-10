// src/TickerBar.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const TickerBar = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('E Name, Dates');

      if (error) {
        console.error('Error fetching ticker events:', error);
      } else {
        setEvents(data || []);
      }
    };

    fetchEvents();
  }, []);

  if (!events.length) return null;

  return (
    <div className="w-full bg-yellow-300 text-black text-sm sm:text-base font-semibold py-2 overflow-hidden whitespace-nowrap shadow-md z-50">
      <div className="animate-marquee flex gap-10 px-4">
        {events.map((event, idx) => (
          <span key={idx} className="inline-block">
            📅 {event.Dates || 'TBD'} — {event['E Name']}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TickerBar;
