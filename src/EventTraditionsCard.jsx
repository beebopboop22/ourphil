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

  function handleShare() {
    const url = window.location.href;
    const title = event['E Name'];
    if (navigator.share) {
      navigator.share({ title, url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url).catch(console.error);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 text-white text-3xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
        aria-label="Back"
      >
        ×
      </button>
      <div className="relative w-[600px] max-w-full">
        <div className="relative h-[600px] w-full overflow-hidden rounded-t-lg shadow-lg">
          <img
            src={event['E Image']}
            alt={event['E Name']}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 top-0 bg-white flex items-center justify-between p-2">
            <img src={logoUrl} alt="Our Philly" className="h-8" crossOrigin="anonymous" />
            <span className="text-xs text-black">Make your Philly plans at ourphilly.org</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <p className="text-xl">A Philly Tradition</p>
            <h1 className="font-[Barrio] text-5xl leading-tight">{event['E Name']}</h1>
            <p className="text-lg mt-2">{displayDate}{event.time && ` · ${event.time}`}</p>
          </div>
        </div>
        <button
          onClick={handleShare}
          className="w-full bg-indigo-600 text-white py-3 rounded-b-lg"
        >
          Share Image
        </button>
      </div>
    </div>
  );
}

