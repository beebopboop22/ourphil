import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import SportsEventsGrid from './SportsEventsGrid';
import ConcertEventsGrid from './ConcertEventsGrid';
import EventsGrid from './EventsGrid';
import SeasonalEventsGrid from './SeasonalEvents';

const WeekendPage = () => {
  return (
    <div className="bg-white min-h-screen pt-20">
      <Navbar />
      <main className="max-w-screen-xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-[Barrio] mb-6 text-center">Your Philly Weekend</h1>

        <SportsEventsGrid />
        <ConcertEventsGrid />
        <EventsGrid />
        <SeasonalEventsGrid />
      </main>
      <Footer />
    </div>
  );
};

export default WeekendPage;
