// src/SportsEventPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import TaggedEventsScroller from './TaggedEventsScroller.jsx';

export default function SportsEventPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    (async () => {
      const rawId = id.startsWith('sg-') ? id.slice(3) : id;
      try {
        const res = await fetch(
          `https://api.seatgeek.com/2/events/${rawId}?client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
        );
        const data = await res.json();
        const ev = data.events?.[0] || data.event || data || null;
        setEvent(ev);
      } catch (err) {
        console.error('Error loading game', err);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 text-center">Loading...</div>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 text-center">Event not found.</div>
        <Footer />
      </div>
    );
  }

  const dt = new Date(event.datetime_local);
  const performers = event.performers || [];
  const home = performers.find(p => p.home_team) || performers.find(p => p.name.startsWith('Philadelphia')) || performers[0] || {};
  const away = performers.find(p => p.id !== home.id) || {};
  const image = home.image || away.image || '';
  const heroUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/sports-complex.jpg';

  const handleShare = () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      navigator.share({ title, url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url).catch(console.error);
    }
  };


  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gameDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diffDays = Math.round((gameDay - today) / (1000 * 60 * 60 * 24));
  const prefix = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : dt.toLocaleDateString('en-US', { weekday: 'long' });
  const whenWhere = `${prefix}, ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}${event.venue?.name ? `, ${event.venue.name}` : ''}`;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-grow relative mt-32">
        <div
          className="w-full h-[40vh] bg-cover bg-center"
          style={{ backgroundImage: `url(${heroUrl})` }}
        />

        <div
          className="relative max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8 transform z-10 -mt-24"
        >
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">{event.short_title}</h1>
            <p className="text-lg font-medium">{whenWhere}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/tags/sports"
                className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-lg font-semibold"
              >
                #sports
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {event.description && (
              <p className="text-lg leading-relaxed whitespace-pre-line">{event.description}</p>
            )}
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block border border-indigo-600 rounded-md py-3 font-semibold text-center text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors"
              >
                Get Tickets
              </a>
            )}
            <div className="flex flex-col space-y-4">
              <button
                onClick={handleShare}
                className="w-full px-6 py-3 rounded-md bg-green-600 text-white text-base font-medium shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 active:scale-95 transition duration-150 ease-in-out"
              >
                Share
              </button>
              <Link to="/" className="w-full text-center text-indigo-600 hover:underline font-medium">
                ← Back to Events
              </Link>
            </div>
          </div>
          <div>
            {image && (
              <img
                src={image}
                alt={event.short_title}
                className="w-full h-auto rounded-lg shadow-lg max-h-[60vh]"
              />
            )}
          </div>
        </div>

        <TaggedEventsScroller tags={['sports']} />
      </main>
      <Footer />
    </div>
  );
}
