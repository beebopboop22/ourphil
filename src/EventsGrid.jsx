// src/EventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const EventsGrid = ({ neighborhood }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Turn Supabase's "YYYY‑MM‑DD hh:mm:ss.ssssss+00" into a JS Date
  const toJsDate = (raw) => {
    if (!raw) return null;
    let iso = raw.replace(" ", "T");
    if (iso.endsWith("+00")) iso = iso.replace(/\+00$/, "Z");
    return new Date(iso);
  };

  // TODAY / TOMORROW / "MON" tag
  const getDisplayDay = (d) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const nd = new Date(d); nd.setHours(0,0,0,0);
    if (nd.getTime() === today.getTime()) return "TODAY";
    if (nd.getTime() === tomorrow.getTime()) return "TOMORROW";
    return nd.toLocaleDateString("en-US",{ weekday:"short" }).toUpperCase();
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("neighbor_events")
          .select("*")
          .order("date", { ascending: true });
        if (error) throw error;
        setEvents(data);
      } catch (e) {
        console.error("Error fetching events:", e);
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
      {/* ← New Header */}
      <h2 className="text-black text-4xl font-[Barrio] mb-1 text-left z-10 relative">
        SCIENCE IN THE CITY
      </h2>
      <p className="text-gray-600 text-sm mb-6 text-left z-10 relative">
        Coming up at The Academy of Natural Sciences & Franlin Institute
      </p>

      {loading ? (
        <p>Loading events...</p>
      ) : upcoming.length === 0 ? (
        <p>No upcoming events found.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 md:gap-5 pb-2">
            {upcoming.map(evt => {
              const tag = getDisplayDay(evt.jsDate);
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
                      src={evt.image || "https://via.placeholder.com/300"}
                      alt={evt.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                      {tag}
                    </div>
                  </div>
                  <div className="p-3 flex flex-col justify-between flex-grow">
                    <h3 className="text-sm font-semibold text-indigo-800 mb-1 line-clamp-2">
                      {evt.name}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      📅{" "}
                      {evt.jsDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
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
