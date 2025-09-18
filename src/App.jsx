import React, { useState, useEffect, lazy, Suspense } from 'react';
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
const MapboxMap = lazy(() => import('./MapboxMap'));
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
import { Helmet } from 'react-helmet-async';
import BokEventsGrid from './BokEventsGrid';
import BillboardAd from './BillboardAd';
import SouthStreetEventsGrid from './SouthStreetEventsGrid';
import GroupProgressBar from './GroupProgressBar';
import PlatformPromoBillboard from './PlatformPromoBillboard';
import GroupRecommender from './components/GroupRecommender';
import EventsGrid from './EventsGrid';
import SeasonalEventsGrid from './SeasonalEvents'; 
import Bulletin from './Bulletin';
import NewsletterBar from './NewsletterBar';
import RecentActivity from './RecentActivity';
import BigBoardEventsGrid from './BigBoardEventsGrid';
import CityHolidayAlert from './CityHolidayAlert';
import MoreEventsBanner from './MoreEventsBanner';





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
        <title>Our Philly – A City guide</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta name="description" content="Find sports, concerts, neighborhood groups, weird Philly stuff, and more. Built by locals, for locals." />
        <meta name="keywords" content="Philadelphia, Philly events, Philly sports, Philly concerts, local groups, our philly, philly things to do" />
        <meta property="og:title" content="Our Philly" />
        <meta property="og:description" content="Philadelphia's weirdest, warmest community guide." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ourphilly.org/" />
        <meta property="og:image" content="https://your-image-url.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Our Philly" />
        <meta name="twitter:description" content="Philadelphia's weirdest, warmest community guide." />
        <meta name="twitter:image" content="https://your-image-url.png" />
        <link rel="canonical" href="https://ourphilly.org/" />
      </Helmet>
  
     
      
      <div className="overflow-x-hidden  min-h-screen flex flex-col bg-white-100 pt-20 relative">
        <Navbar /> 
        <CityHolidayAlert />


          
<div className="relative flex flex-col md:flex-row items-center justify-center mt-12 mb-1">
  {/* we need a positioning context for the line + mascot */}
  <div className="relative inline-block text-center">
    {/* your existing heading, but bump it above the line with z-index */}
    <h1 className="text-5xl sm:text-6xl md:text-8xl font-[Barrio] font-black text-black">
            DIG INTO PHILLY
          </h1>

          <div className="mt-4 border-b border-gray-200 pb-4">
            <nav className="inline-flex items-center text-sm uppercase font-bold text-indigo-600">
              {/* Big Board */}
              <Link to="/board" className="flex items-center space-x-1 hover:underline">
                <span role="img" aria-label="bulletin board">📌</span>
                <span>Big Board</span>
                <span className="bg-yellow-400 text-white text-[10px] font-bold px-1 rounded">NEW</span>
              </Link>

              <span className="mx-2 text-gray-400">•</span>

              {/* Events */}
              <Link to="/upcoming-events" className="hover:underline">
                Events
              </Link>

              <span className="mx-2 text-gray-400">•</span>

              {/* Groups */}
              <Link to="/groups" className="hover:underline">
                Groups
              </Link>
          
            </nav>
          </div>
    

    {/* decorative line + mascot, behind the h1 */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
      {/* the horizontal rule */}
      <span className="absolute w-full h-px bg-white opacity-20"></span>
      {/* the mascot, pinned to the right end of that rule */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png"
        alt="Our Philly Mascot"
        className="absolute right-0 w-24 h-auto -translate-y-1/3"
      />
    </div>
  </div>
</div>

        
        
        <HeroLanding />
        <RecentActivity />
        <BigBoardEventsGrid />
        <MoreEventsBanner />
        <PopularGroups />
        <LibraryCardBanner />
        <Voicemail />
        <Footer />
      </div>
    </>
  );
}

export default App;
