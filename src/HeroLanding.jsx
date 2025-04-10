import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const HeroLanding = () => {
  const [events, setEvents] = useState([]);
  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState('');

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

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % events.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [events]);

  const current = events[index];

  return (
    <section className="w-full bg-white border-b border-gray-200 py-20 px-6">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* LEFT SIDE */}
        <div>
          <h1 className="text-5xl sm:text-6xl font-black text-black mb-6 leading-tight tracking-tight">
            DIG INTO PHILLY
          </h1>
          <p className="text-lg text-gray-600 mb-6 max-w-md">
            Discover local events, voices, and groups that make Philly unforgettable.
          </p>
          <div className="flex max-w-md">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none"
            />
            <button
              onClick={() => alert(`Subscribed: ${email}`)}
              className="bg-black text-white font-semibold px-6 py-2 rounded-r-lg hover:bg-gray-800 transition"
            >
              Subscribe
            </button>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="w-full h-[400px] relative rounded-2xl overflow-hidden shadow-lg">
          {current ? (
            <a
              href={current['E Link'] || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-full"
            >
              <img
                src={current['E Image']}
                alt={current['E Name']}
                className="w-full h-full object-cover"
              />

              {/* STATUS LIP */}
              <div
                className={`absolute bottom-0 left-0 w-full px-4 py-3 text-base font-extrabold uppercase tracking-wide text-center 
                  ${current.isActive ? 'bg-green-600 text-white' : 'bg-yellow-500 text-white'}`}
              >
                {current.isActive ? '🟢 Happening now' : '🗓 Coming up'}
              </div>

              <div className="absolute inset-0 bg-black/40 flex flex-col justify-end px-6 pb-16">
                <h2 className="text-white text-2xl font-bold drop-shadow-lg mb-1">
                  {current['E Name']}
                </h2>
                <p className="text-white text-sm">
                  📅 {current.Dates}
                </p>
              </div>
            </a>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading...
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroLanding;
