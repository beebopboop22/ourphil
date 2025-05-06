// src/GroupsPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import GroupsHeroSearch from './GroupsHeroSearch';
import GroupsList from './GroupsList';
import GroupProgressBar from './GroupProgressBar';
import Footer from './Footer';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState([]);

  // Fetch all groups
  useEffect(() => {
    async function fetchGroups() {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) console.error('Error fetching groups:', error);
      else setGroups(data);
      setLoading(false);
    }
    fetchGroups();
  }, []);

  // Filtered groups based on search + selectedType
  const filteredGroups = useMemo(() =>
    groups.filter(group => {
      const name = group.Name?.toLowerCase() || '';
      const types = group.Type?.split(',').map(t => t.trim()) || [];
      return (
        name.includes(searchTerm.toLowerCase()) &&
        (selectedType.length === 0 || selectedType.some(t => types.includes(t)))
      );
    }),
  [groups, searchTerm, selectedType]);

  // Derive all unique types for category list
  const allTypes = useMemo(() => {
    const set = new Set();
    groups.forEach(g => {
      (g.Type?.split(',').map(t => t.trim()) || []).forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [groups]);

  // Slugify helper
  const slugify = text =>
    text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  return (
    <>
      <Helmet>
        <title>Philly Groups – Neighborhood Crews & Clubs | Our Philly</title>
        <meta name="description" content="From sports leagues to social crews, explore Philly's most active local groups and communities." />
        <link rel="canonical" href="https://ourphilly.com/groups" />
      </Helmet>

      <div className="min-h-screen bg-white-50 pt-20">
        <Navbar />
        <GroupProgressBar />

        <div className="max-w-screen-full mx-auto px-4">
          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading Groups...</div>
          ) : (
            <>
              <GroupsHeroSearch
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                allGroups={groups}
              />

              <GroupsList groups={filteredGroups} isAdmin={false} />

              {/* Category text grid */}
              <section className="mt-12 mb-12">
                <h2 className="text-2xl font-[Barrio] text-center font-bold mb-4">Browse by Category</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {allTypes.map(type => (
                    <Link
                      key={type}
                      to={`/groups/type/${slugify(type)}`}
                      className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-center text-indigo-600 font-medium transition"
                    >
                      {type}
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
