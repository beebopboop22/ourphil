// src/SportsPage.jsx
import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { Helmet } from 'react-helmet';
import FilteredGroupSection from './FilteredGroupSection';
import { Link } from 'react-router-dom';


const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
];

const SportsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        let allEvents = [];

        for (const slug of teamSlugs) {
          const res = await fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
          );
          const data = await res.json();
          allEvents.push(...(data.events || []));
        }

        const homeGames = allEvents.filter(e => e.venue?.city === 'Philadelphia');
        homeGames.sort((a, b) => new Date(a.datetime_local) - new Date(b.datetime_local));
        setEvents(homeGames);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = events.filter(event =>
    event.short_title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedTeam === '' || event.performers?.[0]?.slug === selectedTeam)
  );

  return (
    <>
      <Helmet>
        <title>Philly Sports – Upcoming Games & Tickets | Our Philly</title>
        <meta 
          name="description" 
          content="Catch every upcoming home game for Philly's teams: Eagles, Phillies, 76ers, Flyers, and Union." 
        />
        <meta 
          name="keywords" 
          content="Philadelphia sports, Eagles tickets, Phillies games, Flyers schedule, 76ers games, Union tickets, Philly sports schedule" 
        />
        <link rel="canonical" href="https://ourphilly.org/sports" />
        <meta property="og:title" content="Philly Sports – Our Philly" />
        <meta property="og:description" content="See every upcoming home game for Philly sports teams and score tickets." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ourphilly.org/sports" />
        <meta property="og:image" content="https://your-image-url.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Philly Sports – Our Philly" />
        <meta name="twitter:description" content="Upcoming games for Eagles, Phillies, Sixers, Flyers, and Union." />
        <meta name="twitter:image" content="https://your-image-url.png" />
      </Helmet>

      <div className="min-h-screen bg-white py-16 px-4">
        <div className="max-w-screen-xl mx-auto text-center">
          <Navbar />
         

          <h2 className="text-5xl mt-20 font-[Barrio] text-gray-800 mb-3">Philly Sports</h2>
          <p className="text-gray-600 text-md mb-8 max-w-2xl mx-auto">
            Upcoming home games for every Philly team.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow px-4 py-2 border border-gray-300 rounded-full max-w-xs"
            />
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-full"
            >
              <option value="">All Teams</option>
              {teamSlugs.map(slug => (
                <option key={slug} value={slug}>
                  {slug.replace('philadelphia-', '').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p>Loading events...</p>
          ) : (
            <>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredEvents.slice(0, visibleCount).map(event => {
                  const eventDate = new Date(event.datetime_local);
                  const weekday = eventDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

                  return (
                    <Link
                      key={event.id}
                      to={`/sports/${event.id}`}
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
                        <h3 className="text-md font-semibold text-indigo-800 mb-1 truncate">
                          {event.short_title}
                        </h3>
                        <p className="text-xs text-gray-500">
                          📅 {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        {event.stats?.lowest_price && (
                          <p className="text-xs text-yellow-600 font-medium mt-1">
                            🎟️ From ${event.stats.lowest_price}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          📍 {event.venue?.name}, {event.venue?.city}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

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
               <FilteredGroupSection tag="Sports Leagues" title="Sports Leagues"  />
               <FilteredGroupSection tag="Sports Fans" title="Sports Fan Groups"  />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SportsPage;



