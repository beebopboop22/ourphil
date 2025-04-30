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

  const startDate = new Date(event.start_date).toLocaleDateString();
  const endDate = new Date(event.end_date).toLocaleDateString();

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{event.name} – Our Philly</title>
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />

      <div className="max-w-screen-xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row  gap-6">
          {event.image_url && (
            <div className="md:w-1/3 ">
              <img src={event.image_url} alt={event.name} className="w-full rounded-xl" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-[Barrio] text-gray-900">{event.name}</h1>
              <button
                onClick={toggleFavorite}
                className="text-xl"
                title="Toggle Favorite"
              >
                {isFav ? '❤️' : '🤍'}
              </button>
              <span className="text-xl font-[Barrio]">{favCount}</span>
            </div>
            <p className="text-gray-600 mt-2">{event.description}</p>

        

            {event.link && (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 bg-indigo-600 text-white text-sm px-4 py-2 rounded-full"
              >
                Visit Website
              </a>
            )}
          </div>
        </div>
      </div>
      <SeasonalEventsGrid />

      <Footer/>
    </div>
  );
};

export default SeasonalEventDetailPage;
