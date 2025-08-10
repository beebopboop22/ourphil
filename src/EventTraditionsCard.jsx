import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

const logoUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';

function parseDateStr(str) {
  if (!str) return null;
  if (str.includes('/')) {
    const [m, d, y] = str.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getFriendlyDate(str) {
  const d = parseDateStr(str);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function EventTraditionsCard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();
      if (!error) setEvent(data); else console.error(error);
    }
    load();
  }, [slug]);

  if (!event) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  const displayDate = getFriendlyDate(event.Dates);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="relative w-[600px] h-[600px] max-w-full max-h-full overflow-hidden rounded-lg shadow-lg">
        <img
          src={event['E Image']}
          alt={event['E Name']}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <header className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <img src={logoUrl} alt="Our Philly" className="h-8" crossOrigin="anonymous" />
          <span className="text-[10px] text-white drop-shadow">Make your Philly plans at ourphilly.org</span>
        </header>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <p className="text-sm">A Philly Tradition</p>
          <h1 className="font-[Barrio] text-4xl leading-tight">{event['E Name']}</h1>
          <p className="text-sm mt-1">{displayDate}{event.time && ` · ${event.time}`}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 text-white bg-black/30 rounded-full w-8 h-8 flex items-center justify-center" 
          aria-label="Back"
        >
          ×
        </button>
      </div>
    </div>
  );
}

