// src/AdminVideoPromo.jsx
import React, { useEffect, useState, useContext } from 'react';
import Navbar from './Navbar';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

function parseDateTime(datesStr) {
  if (!datesStr) return { date: null, time: null };
  const [first] = datesStr.split(/through|–|-/);
  const dateMatch = first.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!dateMatch) return { date: null, time: null };
  const [, m, d, y] = dateMatch.map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date)) return { date: null, time: null };
  const timeMatch = first.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!timeMatch) return { date, time: null };
  let [ , hh, mm = '00', ap ] = timeMatch;
  let h = parseInt(hh, 10);
  if (ap.toLowerCase() === 'pm' && h !== 12) h += 12;
  if (ap.toLowerCase() === 'am' && h === 12) h = 0;
  const time = `${String(h).padStart(2,'0')}:${mm}`;
  return { date, time };
}

function formatDisplayDate(date, startTime) {
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  let prefix;
  if (diffDays === 0) prefix = 'Today';
  else if (diffDays === 1) prefix = 'Tomorrow';
  else if (diffDays > 1 && diffDays < 7) prefix = `This ${weekday}`;
  else prefix = weekday;
  const datePart = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  let timePart = '';
  if (startTime) {
    const [h = 0, m = 0] = startTime.split(':').map(Number);
    const dt = new Date();
    dt.setHours(h, m);
    timePart = dt
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      .toLowerCase();
  }
  return `${prefix}, ${datePart}${timePart ? `, ${timePart}` : ''}`;
}

export default function AdminVideoPromo() {
  const { isAdmin } = useContext(AuthContext);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      loadEvents();
    }
  }, [isAdmin]);

  async function loadEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('id, "E Name", Dates, "E Image"')
      .order('Dates', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = (data || [])
      .map(e => {
        const { date, time } = parseDateTime(e.Dates);
        return {
          id: e.id,
          name: e['E Name'],
          image: e['E Image'],
          date,
          displayDate: formatDisplayDate(date, time),
        };
      })
      .filter(ev => ev.date && ev.date >= today)
      .slice(0, 7);
    setEvents(upcoming);
  }

  if (!isAdmin) {
    return <div className="text-center py-20 text-gray-500">Access denied.</div>;
  }

  return (
    <div className="relative min-h-screen text-white">
      <Navbar />
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//13687405-hd_1080_1920_30fps.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 pt-24 max-w-3xl mx-auto px-4">
        <h1 className="text-center text-4xl font-bold mb-8">UPCOMING PHILLY TRADITIONS</h1>
        {events.map(ev => (
          <div
            key={ev.id}
            className="flex items-center gap-6 py-6 border-b border-white/30 last:border-none"
          >
            {ev.image && (
              <img
                src={ev.image}
                alt=""
                className="w-32 h-24 object-cover rounded"
              />
            )}
            <div>
              <div className="text-2xl font-semibold text-gray-100">{ev.name}</div>
              <div className="text-lg text-gray-300">{ev.displayDate}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

