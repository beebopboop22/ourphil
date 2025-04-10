// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GroupsList from './GroupsList';
import MonthlyEvents from './MonthlyEvents';
import { fetchGroups } from './utils/fetchGroups';
import ReviewCarousel from './ReviewCarousel';
import Sports from './Sports';
import Navbar from './Navbar';
import { Link } from 'react-router-dom';
import WSJHeader from './WSJHeader';
import FeaturedGroups from './FeaturedGroups'; 
import FilteredGroupSection from './FilteredGroupSection';
import Voicemail from './Voicemail';
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
<div className="min-h-screen flex flex-col bg-white-100  p-4">
    <Navbar />
    <HeroLanding />
    <h1
  className="text-black text-3xl sm:text-5xl md:text-5xl font-bold mb-4 mt-20 text-center tracking-wide"
  style={{ fontFamily: "'Playfair Display', serif" }}
></h1>


      <MonthlyEvents />
      <SportsEventsGrid />
      <ConcertEventsGrid />
      {/* Group Listings */}
      <GroupsList
        groups={filteredGroups}
        searchTerm={searchTerm}
        selectedType={selectedType}
        onClearFilters={handleClearFilters}
        isAdmin={isAdmin}
      />
<FilteredGroupSection tag="Running" title="Running Groups" isAdmin={isAdmin} />
<Voicemail />
<Footer />


    </div>
  );
}

export default App;
