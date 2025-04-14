// src/HeroLanding.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { DAILY_SPECIALS_2025 } from './constants/specials';
import { Link } from 'react-router-dom';

const HeroLanding = () => {
  const [todayEvents, setTodayEvents] = useState([]);
  const [tomorrowEvents, setTomorrowEvents] = useState([]);
  const [fillerEvents, setFillerEvents] = useState([]);
  const [email, setEmail] = useState('');
  const [todaySports, setTodaySports] = useState([]);
  const [tomorrowSports, setTomorrowSports] = useState([]);
  const [special, setSpecial] = useState(null);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const formatDateMMDD = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

  useEffect(() => {
    const fetchEvents = async (date, setter) => {
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
        const isActive = startDate <= date && endDate >= date;
        return { ...event, startDate, endDate, isActive };
      });

      const active = enhanced.filter(event => event.isActive);
      setter(active);
    };

    const fetchUpcomingFillers = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, "E Name", Dates, "End Date", "E Link"')
        .order('Dates', { ascending: true });

      if (error) {
        console.error('Error fetching filler events:', error);
        return;
      }

      const enhanced = data.map(event => {
        const startDateStr = event['Dates']?.split(',')[0]?.trim();
        const startDate = new Date(startDateStr);
        return { ...event, startDate };
      });

      const future = enhanced.filter(event => event.startDate > tomorrow);
      setFillerEvents(future);
    };

    const fetchSports = async (date, setter) => {
      try {
        const res = await fetch(`https://api.seatgeek.com/2/events?performers.slug=philadelphia-phillies&per_page=5&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`);
        const data = await res.json();
        const eventsOnDate = data.events.filter(event => {
          const eventDate = new Date(event.datetime_local);
          return eventDate.toDateString() === date.toDateString();
        });
        setter(eventsOnDate);
      } catch (err) {
        console.error('Error fetching sports:', err);
      }
    };

    const forcedSpecial = window.localStorage.getItem('forceSpecial');
    if (forcedSpecial) {
      setSpecial(forcedSpecial);
    } else if (DAILY_SPECIALS_2025[formatDateMMDD(today)]) {
      setSpecial(DAILY_SPECIALS_2025[formatDateMMDD(today)]);
    }

    fetchEvents(today, setTodayEvents);
    fetchEvents(tomorrow, setTomorrowEvents);
    fetchUpcomingFillers();
    fetchSports(today, setTodaySports);
    fetchSports(tomorrow, setTomorrowSports);

  }, []);

  const renderTodayTomorrow = () => {
    const usedNames = new Set();
    let items = [];

    todaySports.forEach(item => items.push({ item, label: 'Tonight!', isSports: true }));
    todayEvents.forEach(item => {
      if (!usedNames.has(item['E Name'])) {
        usedNames.add(item['E Name']);
        items.push({ item, label: 'Tonight!', isSports: false });
      }
    });

    tomorrowSports.forEach(item => items.push({ item, label: 'Tomorrow!', isSports: true }));
    tomorrowEvents.forEach(item => {
      if (!usedNames.has(item['E Name'])) {
        usedNames.add(item['E Name']);
        items.push({ item, label: 'Tomorrow!', isSports: false });
      }
    });

    return items.slice(0, 4).map(({ item, label, isSports }, idx, arr) => {
      const showLabel = idx === 0 || label !== arr[idx - 1].label;
      return (
        <React.Fragment key={item.id || item.short_title}>
          {showLabel && <span className="font-semibold tracking-wide text-gray-500 uppercase ml-2">{label}</span>}
          <span className="animate-pulse text-green-500">●</span>
          {isSports ? (
            <Link to="/sports" className="text-blue-600 underline">{item.short_title}</Link>
          ) : (
            <a href={item['E Link'] || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{item['E Name']}</a>
          )}
        </React.Fragment>
      );
    });
  };

  const renderComingUp = () => {
    const usedNames = new Set([
      ...todayEvents.map(e => e['E Name']),
      ...tomorrowEvents.map(e => e['E Name'])
    ]);

    const comingUpItems = fillerEvents.filter(e => !usedNames.has(e['E Name'])).slice(0, 3);

    return (
      <>
        <div className="flex justify-center flex-wrap gap-2 text-sm mb-3 mt-3">
          <span className="font-semibold tracking-wide text-gray-500 uppercase">Coming Up!</span>
          {comingUpItems.map(item => (
            <React.Fragment key={item.id}>
              <span className="animate-pulse text-green-500">●</span>
              <a href={item['E Link'] || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{item['E Name']}</a>
            </React.Fragment>
          ))}
        </div>
      </>
    );
  };

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

        {/* Special + Today/Tomorrow */}
        <div className="flex justify-center flex-wrap gap-2 text-sm mb-3">
          {special && (
            <>
              <span className="font-semibold tracking-wide text-gray-500 uppercase">Tonight!</span>
              <span className="animate-pulse text-green-500">●</span>
              <span className="text-black">{special}</span>
            </>
          )}
          {renderTodayTomorrow()}
        </div>

        {/* Coming Up */}
        {renderComingUp()}

        {/* Nav */}
        <div className="flex justify-center flex-wrap gap-3 text-md mb-6 text-gray-600">
          <Link to="/groups">Groups</Link>
          <span>&bull;</span>
          <Link to="/sports">Sports</Link>
          <span>&bull;</span>
          <Link to="/concerts">Concerts</Link>
          <span>&bull;</span>
          <Link to="/trivia">Trivia</Link>
          <span>&bull;</span>
          <Link to="/voicemail">Voicemail</Link>
        </div>

        {/* Email */}
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






