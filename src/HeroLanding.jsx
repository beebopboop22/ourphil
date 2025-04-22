// src/HeroLanding.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const HeroLanding = () => {
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  // helper: pull the first date out of your "Dates" string
  const parseStartDate = (datesStr) => {
    if (!datesStr) return null;
    // split on 'through' or '–' or '-' for multi‑day ranges
    const [first] = datesStr.split(/through|–|-/);
    return new Date(first.trim());
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from('events')
          .select(`id, "E Name", Dates, "E Link"`)
          .order('Dates', { ascending: true });

        if (error) throw error;

        const nextThree = data
          .map((e) => {
            const startDate = parseStartDate(e.Dates);
            return { ...e, startDate };
          })
          .filter((e) => e.startDate && e.startDate >= today)
          .slice(0, 3);

        setUpcoming(nextThree);
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-20 px-6 overflow-hidden">
      {/* Heart background */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1%20copy-min.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbGFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xIGNvcHktbWluLnBuZyIsImlhdCI6MTc0NDgwMjI3NiwiZXhwIjozNjc4MTI5ODI3Nn0._JpTXbt3OsVUC_QOX0V9BQtTy0KeFtBBXp8KC87dbuo"
        alt="Heart Logo Background"
        className="absolute -bottom-24 right-10 w-[600px] opacity-10 rotate-6 pointer-events-none"
      />

      {/* Concierge illustration */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/Our-Philly-Concierge_Illustration-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyLVBoaWxseS1Db25jaWVyZ2VfSWxsdXN0cmF0aW9uLTEucG5nIiwiaWF0IjoxNzQ1MzM1Mjc2LCJleHAiOjM2NzgxODMxMjc2fQ.HdMKzz1VUeCD8Fh75AmC93KvjXwDyF0281g9xbAvncc"
        alt="Our Philly Concierge"
        className="
  absolute left-1/5 top-1/2 transform -translate-x-1/3 -translate-y-1/2
  w-32     /* 8rem  / 128px */
  md:w-64  /* 16rem / 256px */
  lg:w-96  /* 24rem / 384px */
  xl:w-[32rem] /* ~512px */
  z-0
"    />

      <div className="relative max-w-screen-xl mx-auto flex flex-col items-center text-center z-10">
        <h1 className="text-6xl font-[Barrio] font-black mb-6 text-black relative">
          <span className="relative inline-block">DIG INTO PHILLY</span>
        </h1>

        {loading ? (
          <p className="text-sm text-gray-700">Loading upcoming events…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-gray-700">No upcoming events found.</p>
        ) : (
          <p className="text-sm text-gray-700 inline-flex flex-wrap justify-center gap-4">
            <strong className="mr-2">COMING UP:</strong>
            {upcoming.map((evt) => (
              <a
                key={evt.id}
                href={evt['E Link']}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 underline"
              >
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>{evt['E Name']}</span>
              </a>
            ))}
          </p>
        )}
      </div>
    </section>
  );
};

export default HeroLanding;
