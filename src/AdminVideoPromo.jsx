// src/AdminVideoPromo.jsx
import React, { useEffect, useState, useContext } from 'react';
import Navbar from './Navbar';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

function parseDate(datesStr) {
  if (!datesStr) return null;
  const [first] = datesStr.split(/through|–|-/);
  const parts = first.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt) ? null : dt;
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
      .select('id, "E Name", Dates')
      .order('Dates', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = (data || [])
      .map(e => ({ id: e.id, name: e['E Name'], date: parseDate(e.Dates) }))
      .filter(ev => ev.date && ev.date >= today)
      .slice(0, 5);
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
      <div className="relative z-10 pt-24 max-w-xl mx-auto">
        {events.map(ev => (
          <div
            key={ev.id}
            className="py-4 border-b border-white/30 last:border-none"
          >
            <div className="font-semibold text-gray-100">{ev.name}</div>
            <div className="text-sm text-gray-300">
              {ev.date?.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

