import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { DAILY_SPECIALS_2025 } from './constants/specials';
import { Link } from 'react-router-dom';

const HeroLanding = () => {
  const [todayEvents, setTodayEvents] = useState([]);
  const [tomorrowEvents, setTomorrowEvents] = useState([]);
  const [fillerEvents, setFillerEvents] = useState([]);
  const [todaySports, setTodaySports] = useState([]);
  const [tomorrowSports, setTomorrowSports] = useState([]);
  const [special, setSpecial] = useState(null);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const formatDateMMDD = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
  const formatDateShort = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  useEffect(() => {
    const fetchEvents = async (date, setter) => {
      const { data, error } = await supabase
        .from('events')
        .select('id, "E Name", Dates, "End Date", "E Link"')
        .order('Dates', { ascending: true });

      if (error) return console.error('Error fetching events:', error);

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
        .select('id, "E Name", Dates, "E Link"')
        .order('Dates', { ascending: true });

      if (error) return console.error('Error fetching filler events:', error);

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
        const res = await fetch(
          `https://api.seatgeek.com/2/events?performers.slug=philadelphia-phillies&per_page=5&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
        );
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

  const conciergeNote = () => {
    const usedNames = new Set();
    let tonightItems = [];
    let tomorrowItems = [];

    todaySports.forEach(item => {
      tonightItems.push(
        <a href={item.url} key={item.id} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          {item.short_title}
        </a>
      );
    });
    todayEvents.forEach(event => {
      if (!usedNames.has(event['E Name'])) {
        usedNames.add(event['E Name']);
        tonightItems.push(
          <a href={event['E Link']} key={event.id} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            {event['E Name']}
          </a>
        );
      }
    });

    tomorrowSports.forEach(item => {
      tomorrowItems.push(
        <a href={item.url} key={item.id} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          {item.short_title}
        </a>
      );
    });
    tomorrowEvents.forEach(event => {
      if (!usedNames.has(event['E Name'])) {
        usedNames.add(event['E Name']);
        tomorrowItems.push(
          <a href={event['E Link']} key={event.id} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            {event['E Name']}
          </a>
        );
      }
    });

    const fillerItems = fillerEvents.filter(e => !usedNames.has(e['E Name'])).slice(0, 3).map(item => (
      <a href={item['E Link']} key={item.id} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
        {item['E Name']} ({formatDateShort(item.startDate)})
      </a>
    ));

    return (
<p    className="text-sm text-left text-gray-700 whitespace-pre-line font-reenie leading-relaxed">
<strong>Concierge Report</strong> Today – {tonightItems.length > 0 ? tonightItems.reduce((acc, curr) => [acc, ', ', curr]) : 'nothing yet'}
        . Tomorrow – {tomorrowItems.length > 0 ? tomorrowItems.reduce((acc, curr) => [acc, ', ', curr]) : 'nothing lined up'}
        . Coming Up – {fillerItems.length > 0 ? fillerItems.reduce((acc, curr) => [acc, ', ', curr]) : 'more soon'}
      </p>
    );
  };

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-20 px-6 overflow-hidden">
      <img 
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1%20copy-min.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xIGNvcHktbWluLnBuZyIsImlhdCI6MTc0NDgwMjI3NiwiZXhwIjozNjc4MTI5ODI3Nn0._JpTXbt3OsVUC_QOX0V9BQtTy0KeFtBBXp8KC87dbuo"
        alt="Heart Logo Background"
        className="absolute -bottom-24 right-10 w-[600px] opacity-10 rotate-6 pointer-events-none"
      />
      <div className="relative max-w-screen-xl mx-auto flex flex-col items-center text-center z-10">
        <h1 className="text-6xl font-[Barrio] font-black mb-6 text-black relative">
          <span className="relative inline-block">
            DIG INTO PHILLY
          </span>
        </h1>
        <div className="bg-yellow-50 rounded-xl p-6 mt-4 max-w-3xl mx-auto shadow-md relative">
          <img
            src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/Our-Philly-Concierge_Illustration-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyLVBoaWxseS1Db25jaWVyZ2VfSWxsdXN0cmF0aW9uLTEucG5nIiwiaWF0IjoxNzQ0OTA3OTMyLCJleHAiOjM2NzgxNDAzOTMyfQ.OOM1-HQgRQbw5Z0HI8g5c5fPwvWlvXlj3NXiUK-UHYA"
            alt="Our Philly Concierge"
            className="absolute bottom-40 w-28 md:w-36 lg:w-40 translate-y-6 z-0"
          />
          <div className="relative z-10">
            {conciergeNote()}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroLanding;
