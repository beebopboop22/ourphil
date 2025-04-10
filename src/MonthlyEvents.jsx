// src/MonthlyEvents.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const MonthlyEvents = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const today = new Date();

      const { data, error } = await supabase
        .from('events')
        .select('id, "E Name", Dates, "End Date", "E Month", "E Image", "E Link"')
        .order('Dates', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      const enhanced = data.map(event => {
        const startDateStr = event['Dates']?.split(',')[0]?.trim();
        const endDateStr = event['End Date']?.split(',')[0]?.trim() || startDateStr;
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const isActive = startDate <= today && endDate >= today;
        return { ...event, startDate, endDate, isActive };
      });

      const sorted = enhanced
        .filter(event => !isNaN(event.endDate) && event.endDate >= today)
        .sort((a, b) => {
          if (b.isActive && !a.isActive) return 1;
          if (a.isActive && !b.isActive) return -1;
          return a.startDate - b.startDate;
        });

      setEvents(sorted.slice(0, 12));
    };

    fetchEvents();
  }, []);

  if (!events.length) return null;

  return (
    <div className="w-full max-w-screen-xl mx-auto mb-12 px-4">
      <h2 className="text-black text-4xl font-[Barrio] mb-2 text-left">
        Philly Traditions
      </h2>
      <p className="text-gray-600 text-sm mb-4 text-left">
        Iconic city happenings you can take part in
      </p>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 pb-2">
          {events.map((event, idx) => (
            <a
              key={event.id || idx}
              href={event['E Link'] || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="relative min-w-[250px] max-w-[250px] bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-105 overflow-hidden flex flex-col border border-yellow-200"
            >
              {event.isActive && (
                <div className="absolute top-2 left-2 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                  🟢 Active
                </div>
              )}
              {event['E Image'] && (
                <img
                  src={event['E Image']}
                  alt={event['E Name']}
                  className="w-full h-32 object-cover"
                />
              )}
              <div className="p-4 flex flex-col justify-between flex-grow">
                <h3 className="text-md font-semibold text-indigo-800 mb-1 truncate">
                  {event['E Name']}
                </h3>
                <p className="text-xs text-gray-500">📅 {event.Dates}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MonthlyEvents;





