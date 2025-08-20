// src/SportsEventPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function SportsEventPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`https://api.seatgeek.com/2/events/${id}?client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`);
        const data = await res.json();
        setEvent(data.event || null);
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

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-screen-xl mx-auto pt-24 px-4">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">{event.short_title}</h1>
        <div className="flex flex-wrap gap-2 mb-6">
          <Link to="/tags/sports" className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">#sports</Link>
        </div>
        {image && (
          <img src={image} alt={event.short_title} className="w-full max-h-96 object-cover rounded-lg mb-6" />
        )}
        <p className="text-gray-700 mb-2">
          📅 {dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <p className="text-gray-700 mb-2">
          ⏰ {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}
        </p>
        <p className="text-gray-700 mb-4">
          📍 {event.venue?.name}, {event.venue?.city}
        </p>
        {event.stats?.lowest_price && (
          <p className="text-yellow-700 mb-6">Tickets from ${event.stats.lowest_price}</p>
        )}
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md font-semibold"
        >
          Get Tickets
        </a>
      </main>
      <Footer />
    </div>
  );
}
