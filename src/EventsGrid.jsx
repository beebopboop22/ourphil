// src/EventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { FaStar } from 'react-icons/fa';

const EventsGrid = ({ neighborhood }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Convert Supabase timestamp to JS Date
  const toJsDate = (raw) => {
    if (!raw) return null;
    let iso = raw.replace(' ', 'T');
    if (iso.endsWith('+00')) iso = iso.replace(/\+00$/, 'Z');
    return new Date(iso);
  };

  // TODAY / TOMORROW / WEEKDAY tag
  const getDisplayDay = (d) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const nd = new Date(d); nd.setHours(0,0,0,0);
    if (nd.getTime() === today.getTime()) return 'TODAY';
    if (nd.getTime() === tomorrow.getTime()) return 'TOMORROW';
    return nd.toLocaleDateString('en-US', { weekday:'short' }).toUpperCase();
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('neighbor_events')
          .select('*')
          .order('date', { ascending: true });
        if (error) throw error;
        setEvents(data);
      } catch (e) {
        console.error('Error fetching events:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = events
    .map(evt => ({ ...evt, jsDate: toJsDate(evt.date) }))
    .filter(evt => evt.jsDate && evt.jsDate >= today)
    .filter(evt => !neighborhood || evt.neighborhood === neighborhood);

  return (
    <div className="relative w-full max-w-screen-xl mx-auto mb-12 px-4 py-8">
      {/* Header */}
      <h2 className="text-black text-4xl font-[Barrio] mb-1 text-left z-10 relative">
        SCIENCE IN THE CITY
      </h2>
      <p className="text-gray-600 text-sm mb-6 text-left z-10 relative">
        Coming up at The Academy of Natural Sciences & Franklin Institute
      </p>

      {loading ? (
        <p>Loading events...</p>
      ) : upcoming.length === 0 ? (
        <p>No upcoming events found.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 pb-2">
            {upcoming.map((evt, idx) => {
              const tag = getDisplayDay(evt.jsDate);
              // make ~every 4th a dramatic featured card
              const isFeatured = idx % 4 === 0;
              const widthClass = isFeatured
                ? 'min-w-[400px] max-w-[400px]'
                : 'min-w-[260px] max-w-[260px]';

              return (
                <a
                  key={evt.link}
                  href={evt.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    relative
                    ${widthClass}
                    bg-gray-50
                    rounded-2xl
                    shadow-lg
                    hover:shadow-2xl
                    transition-transform
                    hover:scale-105
                    overflow-hidden
                    flex flex-col
                  `}
                >
                  <div className="relative">
                    <img
                      src={evt.image || 'https://via.placeholder.com/300'}
                      alt={evt.name}
                      className={`w-full ${isFeatured ? 'h-72' : 'h-56'} object-cover`}
                    />
                    <div className="absolute top-3 left-3 bg-black text-white text-sm font-bold px-3 py-1 rounded-full">
                      {tag}
                    </div>
                    {evt.isTradition && (
                      <div className="absolute top-3 right-3 border-2 border-yellow-400 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <FaStar className="text-yellow-500" />
                        Tradition
                      </div>
                    )}
                  </div>
                  <div className="p-8 flex flex-col justify-center flex-grow">
                    <h3 className="text-2xl md:text-3xl font-bold text-indigo-800 mb-4 line-clamp-2 text-center">
                      {evt.name}
                    </h3>
                    <p className="text-lg md:text-xl text-gray-600 text-center">
                      📅 {evt.jsDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
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

export default EventsGrid;
