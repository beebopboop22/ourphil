import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { DAILY_SPECIALS_2025 } from './constants/specials';

const HeroLanding = () => {
  const [events, setEvents] = useState([]);
  const [email, setEmail] = useState('');
  const [nextGame, setNextGame] = useState(null);
  const [special, setSpecial] = useState(null);

  useEffect(() => {
    const today = new Date();
    const mmdd = `${today.getMonth() + 1}/${today.getDate()}`;

    const forcedSpecial = window.localStorage.getItem('forceSpecial');

    if (forcedSpecial) {
      setSpecial(forcedSpecial);
    } else if (DAILY_SPECIALS_2025[mmdd]) {
      setSpecial(DAILY_SPECIALS_2025[mmdd]);
    }

    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, "E Name", Dates, "End Date", "E Link"')
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

      const active = enhanced.filter(event => event.isActive);
      setEvents(active.slice(0, 2));
    };

    const fetchSports = async () => {
      try {
        const res = await fetch(`https://api.seatgeek.com/2/events?performers.slug=philadelphia-phillies&per_page=1&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`);
        const data = await res.json();
        if (data.events.length > 0) {
          setNextGame(data.events[0].short_title);
        }
      } catch (err) {
        console.error('Error fetching sports:', err);
      }
    };

    fetchEvents();
    fetchSports();
  }, []);

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-20 px-6 overflow-hidden">
      <img 
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png"
        alt="Heart Logo"
        className="absolute -bottom-24 right-10 w-[600px] opacity-10 rotate-6 pointer-events-none"
      />

      <div className="relative max-w-screen-xl mx-auto flex flex-col items-center text-center z-10">
        <h1 className="text-6xl font-[Barrio] font-black mb-4 text-black">
          DIG INTO PHILLY
        </h1>

        {(special || nextGame || events.length) && (
          <div className="flex justify-center flex-wrap gap-2 text-sm mb-3">
            <span className="font-semibold tracking-wide text-gray-500 uppercase">Tonight!</span>

            {special && (
              <>
                <span className="animate-pulse text-green-500">●</span>
                <span className="text-black">{special}</span>
              </>
            )}

            {nextGame && (
              <>
                <span className="animate-pulse text-green-500">●</span>
                <a href="/sports" className="text-blue-600 underline">{nextGame}</a>
              </>
            )}

            {events.map(event => (
              <React.Fragment key={event.id}>
                <span className="animate-pulse text-green-500">●</span>
                <a href={event['E Link'] || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {event['E Name']}
                </a>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex justify-center flex-wrap gap-3 text-md mb-6 text-gray-600">
          <a href="/groups">Groups</a>
          <span>&bull;</span>
          <a href="/sports">Sports</a>
          <span>&bull;</span>
          <a href="/concerts">Concerts</a>
          <span>&bull;</span>
          <a href="/trivia">Trivia</a>
          <span>&bull;</span>
          <a href="/voicemail">Voicemail</a>
        </div>

        <div className="flex justify-center">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none"
          />
          <button
            onClick={() => alert(`Subscribed: ${email}`)}
            className="bg-black text-white font-semibold px-6 py-2 rounded-r-lg hover:bg-gray-800 transition"
          >
            Subscribe
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroLanding;

