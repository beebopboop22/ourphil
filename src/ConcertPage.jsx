// src/ConcertsPage.jsx
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import Navbar from './Navbar';

const ConcertsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch(
          `https://api.seatgeek.com/2/events?taxonomies.name=concert&venue.city=Philadelphia&per_page=50&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
        );
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        console.error('Error fetching concerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const venues = Array.from(new Set(events.map(event => event.venue?.name).filter(Boolean))).sort();

  const filteredEvents = events.filter(event =>
    event.short_title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedVenue === '' || event.venue?.name === selectedVenue)
  );

  return (
    <>
      <Helmet>
        <title>Philly Concerts – Live Music in Philadelphia | Our Philly</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta 
          name="description" 
          content="Upcoming concerts in Philadelphia. Find shows, venues, and live music all over Philly curated by Our Philly." 
        />
        <meta 
          name="keywords" 
          content="Philadelphia concerts, Philly live music, Philly shows, music venues, Philly events" 
        />
        <link rel="canonical" href="https://ourphilly.org/concerts" />
        <meta property="og:title" content="Philly Concerts – Our Philly" />
        <meta property="og:description" content="Find upcoming concerts and live music in Philadelphia." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ourphilly.org/concerts" />
        <meta property="og:image" content="https://your-image-url.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Philly Concerts – Our Philly" />
        <meta name="twitter:description" content="Find upcoming concerts and live music in Philadelphia." />
        <meta name="twitter:image" content="https://your-image-url.png" />
      </Helmet>

      <div className="min-h-screen bg-white py-16 px-4">
        <Navbar />

        <main className="max-w-screen-xl mx-auto text-center">
          <h1 className="text-5xl mt-20 font-[Barrio] text-gray-800 mb-3">
            Philly Concerts
          </h1>
          <p className="text-gray-600 text-md mb-8 max-w-2xl mx-auto">
            Live music all over the city — here's what's coming up.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <input
              type="text"
              placeholder="Search concerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow px-4 py-2 border border-gray-300 rounded-full max-w-xs"
            />
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-full"
            >
              <option value="">All Venues</option>
              {venues.map(venue => (
                <option key={venue} value={venue}>{venue}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p>Loading concerts...</p>
          ) : (
            <>
              <section className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredEvents.slice(0, visibleCount).map(event => {
                  const eventDate = new Date(event.datetime_local);
                  const weekday = eventDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

                  return (
                    <a
                      key={event.id}
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white rounded-2xl shadow hover:shadow-xl transition-transform hover:scale-105 overflow-hidden flex flex-col"
                    >
                      <div className="relative">
                        <img
                          src={event.performers?.[0]?.image || 'https://via.placeholder.com/300'}
                          alt={event.short_title}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute top-2 left-2 bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {weekday}
                        </div>
                      </div>

                      <div className="p-4 text-left">
                        <h2 className="text-md font-semibold text-indigo-800 mb-1 truncate">
                          {event.short_title}
                        </h2>
                        <p className="text-xs text-gray-500">
                          📅 {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        {event.stats?.lowest_price && (
                          <p className="text-xs text-yellow-600 font-medium mt-1">
                            🎟️ From ${event.stats.lowest_price}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          📍 {event.venue?.name}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </section>

              {visibleCount < filteredEvents.length && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 8)}
                    className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50"
                  >
                    Show More
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default ConcertsPage;
