// src/TraditionsVideo.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

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

export default function TraditionsVideo() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('id, "E Name", Dates, "E Image", "E Description"')
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
          captionDate: formatDisplayDate(date, null),
          description: e['E Description'],
        };
      })
      .filter(ev => ev.date && ev.date >= today)
      .slice(0, 10);
    setEvents(upcoming);
  }

  return (
    <>
      <div className="relative min-h-screen text-white">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//13687405-hd_1080_1920_30fps.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6 pb-6">
          <h1 className="text-center text-4xl font-[Barrio] mb-1">Upcoming Philly Traditions</h1>
          <p className="text-center text-xs mb-4">Make your Philly plans at ourphilly.org</p>
          {events.map(ev => (
            <div
              key={ev.id}
              className="flex w-full items-center justify-start gap-2 py-1 border-b border-white/30 last:border-none"
            >
              {ev.image && (
                <img
                  src={ev.image}
                  alt=""
                  className="w-16 h-10 object-cover rounded"
                />
              )}
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-100">{ev.name}</div>
                <div className="text-xs text-gray-300">{ev.displayDate}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white">
        <div className="h-24" />
        <div className="px-4 pb-24 text-sm text-gray-800">
          {events.map(ev => (
            <p key={ev.id} className="mb-2">
              {`${ev.name} - ${ev.captionDate} - ${ev.description}`}
            </p>
          ))}
        </div>
      </div>
    </>
  );
}

