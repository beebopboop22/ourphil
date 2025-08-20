// src/SportsEventPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import TaggedEventsScroller from './TaggedEventsScroller.jsx';
import SubmitEventSection from './SubmitEventSection.jsx';

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

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-grow relative mt-32">
        {image && (
          <div
            className="w-full h-[40vh] bg-cover bg-center"
            style={{ backgroundImage: `url(${image})` }}
          />
        )}
        <div className="relative max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8 transform z-10 -mt-24">
          <div className="flex flex-col sm:flex-row items-start gap-8">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4">{event.short_title}</h1>
              <p className="text-lg mb-4">
                {dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {' • '}
                {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}
                {event.venue?.name && (
                  <>
                    {' • '}
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(`${event.venue.name}, ${event.venue.city}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {event.venue.name}, {event.venue.city}
                    </a>
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                <Link
                  to="/tags/sports"
                  className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-lg font-semibold"
                >
                  #sports
                </Link>
              </div>
              {event.stats?.lowest_price && (
                <p className="text-yellow-700 mb-6">
                  Tickets from ${event.stats.lowest_price}
                </p>
              )}
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md font-semibold"
              >
                Get Tickets
              </a>
            </div>
            {image && (
              <div className="w-full sm:w-1/2">
                <img
                  src={image}
                  alt={event.short_title}
                  className="w-full h-auto rounded-lg shadow-lg max-h-[60vh]"
                />
              </div>
            )}
          </div>
        </div>
        <TaggedEventsScroller tags={['sports']} />
        <SubmitEventSection />
      </main>
      <Footer />
    </div>
  );
}
