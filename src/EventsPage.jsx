// src/EventsPage.jsx
import React from 'react';
import { Helmet } from 'react-helmet';
import Navbar from './Navbar';
import HeroLanding from './HeroLanding';
import EventsGrid from './EventsGrid';
import SeasonalEventsGrid from './SeasonalEvents';
import SportsEventsGrid from './SportsEventsGrid';
import ConcertEventsGrid from './ConcertEventsGrid';
import Footer from './Footer';

export default function EventsPage() {
  return (
    <>
      <Helmet>
        <title>Our Philly – All Upcoming Events</title>
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="description"
          content="Your one-stop guide to Philadelphia’s upcoming traditions, seasonal events, sports games, and concerts."
        />
        <meta
          name="keywords"
          content="Philadelphia events, Philly traditions, Philly seasonal events, sports in Philly, Philadelphia concerts"
        />
        <meta property="og:title" content="Our Philly – All Upcoming Events" />
        <meta
          property="og:description"
          content="Your one-stop guide to Philadelphia’s upcoming traditions, seasonal events, sports games, and concerts."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ourphilly.com/events" />
        <meta property="og:image" content="https://your-image-url.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="min-h-screen flex flex-col pt-20 bg-gray-100 overflow-x-hidden">
        <Navbar />
        <HeroLanding />
          <SeasonalEventsGrid />
          <SportsEventsGrid />
          <ConcertEventsGrid />
        <Footer />
      </div>
    </>
  );
}
