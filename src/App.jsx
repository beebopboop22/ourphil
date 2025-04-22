import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import GroupsList from './GroupsList';
import MonthlyEvents from './MonthlyEvents';
import { fetchGroups } from './utils/fetchGroups';
import ReviewCarousel from './ReviewCarousel';
import Sports from './Sports';
import Navbar from './Navbar';
import WSJHeader from './WSJHeader';
import FeaturedGroups from './FeaturedGroups';
import FilteredGroupSection from './FilteredGroupSection';
import Voicemail from './Voicemail';
import GroupsPage from './GroupsPage';
import MapboxMap from './MapboxMap';
import PetfinderGrid from './PetfinderGrid';
import SeptaAlertBanner from './SeptaAlertBanner';
import 'mapbox-gl/dist/mapbox-gl.css';
import Footer from './Footer';
import RotatingFeatureBox from './RotatingFeatureBox';
import TriviaNights from './TriviaNights';
import SportsEventsGrid from './SportsEventsGrid';
import ConcertEventsGrid from './ConcertEventsGrid';
import HeroLanding from './HeroLanding';
import PopularGroups from './PopularGroups';
import LibraryCardBanner from './LibraryCardBanner';
import ConcertsPage from './ConcertPage';
import { Helmet } from 'react-helmet';
import BokEventsGrid from './BokEventsGrid';
import BillboardAd from './BillboardAd';
import SouthStreetEventsGrid from './SouthStreetEventsGrid';
import GroupProgressBar from './GroupProgressBar';
import PlatformPromoBillboard from './PlatformPromoBillboard';
import GroupRecommender from './components/GroupRecommender';
import EventsGrid from './EventsGrid';


function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [allTypes, setAllTypes] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [typeCounts, setTypeCounts] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadGroups() {
      const data = await fetchGroups();
      setAllGroups(data);

      const typeSet = new Set();
      const counts = {};
      data.forEach(group => {
        const types = group.Type?.split(',').map(t => t.trim()) || [];
        types.forEach(type => {
          typeSet.add(type);
          counts[type] = (counts[type] || 0) + 1;
        });
      });
      setAllTypes(Array.from(typeSet).sort());
      setTypeCounts(counts);
    }
    loadGroups();
  }, []);

  useEffect(() => {
    const isStoredAdmin = localStorage.getItem('admin') === 'true';
    setIsAdmin(isStoredAdmin);

    const handleKey = (e) => {
      if (e.key === 'A' && e.shiftKey) {
        localStorage.setItem('admin', 'true');
        setIsAdmin(true);
        alert('✅ Admin mode activated');
      }
      if (e.key === 'D' && e.shiftKey) {
        localStorage.removeItem('admin');
        setIsAdmin(false);
        alert('🚫 Admin mode deactivated');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedType('');
  };

  const filteredGroups = allGroups.filter(group => {
    const name = group.Name?.toLowerCase() || '';
    const matchesSearch = name.includes(searchTerm.trim().toLowerCase());
    const matchesType = selectedType === '' || (group.Type && group.Type.includes(selectedType));
    return matchesSearch && matchesType;
  });

  return (
    <>
      <Helmet>
        <title>Our Philly – Philly's Weirdest, Warmest Community Guide</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta name="description" content="Find sports, concerts, neighborhood groups, weird Philly stuff, and more. Built by locals, for locals." />
        <meta name="keywords" content="Philadelphia, Philly events, Philly sports, Philly concerts, local groups, our philly, philly things to do" />
        <meta property="og:title" content="Our Philly" />
        <meta property="og:description" content="Philadelphia's weirdest, warmest community guide." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ourphilly.com/" />
        <meta property="og:image" content="https://your-image-url.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Our Philly" />
        <meta name="twitter:description" content="Philadelphia's weirdest, warmest community guide." />
        <meta name="twitter:image" content="https://your-image-url.png" />
        <link rel="canonical" href="https://ourphilly.com/" />
      </Helmet>
  
     
      
      <div className="min-h-screen flex flex-col bg-white-100 pt-20 relative">
        <Navbar />   
        <HeroLanding />

        <PopularGroups />
        <MonthlyEvents />
        <SportsEventsGrid />
        <ConcertEventsGrid />
        <LibraryCardBanner />
        <Voicemail />
        <BokEventsGrid />
        <SouthStreetEventsGrid />
        <EventsGrid />

        <Footer />
      </div>
    </>
  );
}

export default App;
