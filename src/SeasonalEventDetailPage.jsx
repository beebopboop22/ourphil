// src/SeasonalEventDetailPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import SeasonalEventsGrid from './SeasonalEvents';
import Seo from './components/Seo.jsx';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
} from './utils/seoHelpers.js';

const FALLBACK_SEASONAL_TITLE = 'Seasonal Event – Our Philly';
const FALLBACK_SEASONAL_DESCRIPTION =
  'Explore seasonal happenings around Philadelphia with Our Philly.';

const SeasonalEventDetailPage = () => {
  const { slug } = useParams();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        console.error('Error fetching event:', error);
        setEvent(null);
      } else {
        setEvent(data);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [slug]);

  const canonicalUrl = `${SITE_BASE_URL}/seasonal/${slug}`;
  const absoluteImage = ensureAbsoluteUrl(event?.image_url);
  const ogImage = absoluteImage || DEFAULT_OG_IMAGE;
  const description = event?.description || FALLBACK_SEASONAL_DESCRIPTION;

  const startDate = event?.start_date ? new Date(event.start_date) : null;
  const now = new Date();
  const isOpen = !!startDate && now >= startDate;
  const tagText = event
    ? isOpen
      ? 'Open for Season'
      : `Opens ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';
  const tagColor = isOpen ? 'bg-orange-500' : 'bg-yellow-400';

  const jsonLd = event
    ? buildEventJsonLd({
        name: event.name,
        canonicalUrl,
        startDate: event.start_date,
        endDate: event.end_date || event.start_date,
        locationName: event.location || 'Philadelphia',
        description,
        image: ogImage,
      })
    : null;

  let content;
  if (loading) {
    content = <div className="text-center py-20">Loading event...</div>;
  } else if (!event) {
    content = <div className="text-center py-20 text-gray-500">Event not found.</div>;
  } else {
    content = (
      <>
        <div className="relative w-full h-[600px] md:h-[700px]">
          <img
            src={event.image_url}
            alt={event.name}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/50" />

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
        </div>

        <SeasonalEventsGrid />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-32">
      <Seo
        title={event ? `${event.name} – Our Philly` : FALLBACK_SEASONAL_TITLE}
        description={description}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="event"
        jsonLd={jsonLd}
      />

      <Navbar />

      {content}

      <Footer />
    </div>
  );
};

export default SeasonalEventDetailPage;
