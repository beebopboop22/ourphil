// src/SeasonalEventDetailPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import SeasonalEventsGrid from './SeasonalEvents'; 
import { getMySeasonalFavorites, addSeasonalFavorite, removeSeasonalFavorite } from './utils/seasonalFavorites';

const SeasonalEventDetailPage = () => {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [isFav, setIsFav] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [favId, setFavId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        console.error('Error fetching event:', error);
      } else {
        setEvent(data);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [slug]);

  useEffect(() => {
    if (!event) return;
    (async () => {
      const { data, error } = await supabase
        .from('seasonal_event_favorites')
        .select('*')
        .eq('seasonal_event_id', event.id);

      if (!error) {
        setFavCount(data.length);
        if (user) {
          const mine = data.find(r => r.user_id === user.id);
          if (mine) {
            setIsFav(true);
            setFavId(mine.id);
          }
        }
      }
    })();
  }, [event, user]);

  const toggleFavorite = async () => {
    if (!user || !event) return;

    if (isFav) {
      await removeSeasonalFavorite(favId);
      setIsFav(false);
      setFavId(null);
      setFavCount(c => c - 1);
    } else {
      const inserted = await addSeasonalFavorite(event.id);
      setIsFav(true);
      setFavId(inserted.id);
      setFavCount(c => c + 1);
    }
  };

  if (loading) return <div className="text-center py-20">Loading event...</div>;
  if (!event) return <div className="text-center py-20 text-gray-500">Event not found.</div>;

  const now = new Date();
  const startDate = new Date(event.start_date);
  const isOpen = now >= startDate;
  const tagText = isOpen ? 'Open for Season' : `Opens ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const tagColor = isOpen ? 'bg-orange-500' : 'bg-yellow-400';

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{event.name} – Our Philly</title>
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />

      <div className="relative w-full h-[600px] md:h-[700px]">
        <img
          src={event.image_url}
          alt={event.name}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/50" />

        {/* Open Status Tag */}
        <div className={`absolute top-4 left-4 px-3 py-1 text-lg font-bold text-white rounded-full ${tagColor}`}>
          {tagText}
        </div>

        <div className="absolute bottom-6 left-6 text-white max-w-2xl">
          <h1 className="text-5xl font-[Barrio] leading-tight mb-3">{event.name}</h1>
          <p className="text-xl mb-4 leading-relaxed">{event.description}</p>
          {event.link && (
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-black text-sm px-4 py-2 rounded-full"
            >
              Visit Website
            </a>
          )}
        </div>

        <div className="absolute bottom-6 right-6 text-white flex items-center gap-2">
          <button onClick={toggleFavorite} className="text-5xl">
            {isFav ? '❤️' : '🤍'}
          </button>
          <span className="text-5xl font-[Barrio]">{favCount}</span>
        </div>
      </div>

      <SeasonalEventsGrid />

      <Footer />
    </div>
  );
};

export default SeasonalEventDetailPage;
