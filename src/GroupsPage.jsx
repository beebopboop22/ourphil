// src/GroupsPage.jsx
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import GroupsHeroSearch from './GroupsHeroSearch';
import GroupsList from './GroupsList';
import FilteredGroupSection from './FilteredGroupSection';

const GroupsPage = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*');

      if (error) {
        console.error('Error fetching groups:', error);
      } else {
        setGroups(data);
      }
      setLoading(false);
    };

    fetchGroups();
  }, []);

  // Apply filtering based on search input
  const filteredGroups = groups.filter(group => {
    const name = group.Name?.toLowerCase() || '';
    const typeMatch = selectedType === '' || group.Type?.toLowerCase().includes(selectedType.toLowerCase());
    const nameMatch = name.includes(searchTerm.trim().toLowerCase());
    return typeMatch && nameMatch;
  });

  return (
    <>
      <Helmet>
        <title>Philly Groups – Neighborhood Crews & Clubs | Our Philly</title>
        <meta 
          name="description" 
          content="From sports leagues to social crews, explore Philly's most active local groups and communities." 
        />
        <meta 
          name="keywords" 
          content="Philadelphia groups, Philly clubs, Philly social groups, Philly community, Philly rec sports" 
        />
        <link rel="canonical" href="https://ourphilly.com/groups" />
        <meta property="og:title" content="Philly Groups – Our Philly" />
        <meta property="og:description" content="Discover Philly's coolest local groups, sports leagues, and social crews." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ourphilly.com/groups" />
        <meta property="og:image" content="https://your-image-url.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Philly Groups – Our Philly" />
        <meta name="twitter:description" content="Explore Philly's most active groups and crews." />
        <meta name="twitter:image" content="https://your-image-url.png" />
      </Helmet>

      <div className="min-h-screen bg-white-50 py-10 px-4">
        <Navbar />

        <div className="max-w-screen-xl mx-auto">
          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading Groups...</div>
          ) : (
            <>
              {/* 🔍 Hero Search */}
              <GroupsHeroSearch
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                allGroups={groups}
              />

              {/* 🔎 Search Results - always show */}
              <GroupsList
                groups={filteredGroups}
                isAdmin={false}
              />

              {/* 📌 Curated Sections - always show */}
              <FilteredGroupSection tag="Sports League" title="Spring Sports Leagues" />
              <FilteredGroupSection tag="Arts" title="Arts & Crafts" />
              <FilteredGroupSection tag="Cycling" title="Cycling Crews" />
              <FilteredGroupSection tag="" title="Recently Added" sortByDate />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default GroupsPage;

