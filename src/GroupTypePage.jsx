// src/GroupTypePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import GroupsList from './GroupsList';
import GroupProgressBar from './GroupProgressBar';
import Footer from './Footer';


const unslugify = (slug) =>
  slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const GroupTypePage = () => {
  const { tagSlug } = useParams();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const tag = unslugify(tagSlug);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) {
        console.error('Error fetching groups:', error);
      } else {
        const filtered = data.filter(group =>
          group.Type?.toLowerCase().includes(tag.toLowerCase())
        );
        setGroups(filtered);
      }
      setLoading(false);
    };

    fetchGroups();
  }, [tag]);

  return (
    <>
      <Helmet>
        <title>{tag} Groups – Our Philly</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content={`Explore Philly groups for ${tag.toLowerCase()}.`} />
      </Helmet>

      <Navbar />

      {/* Progress bar sits directly below the fixed nav */}
      <div className="pt-20 bg-white mb-10">
        <GroupProgressBar />
      </div>

      <div className="min-h-screen bg-white-50 px-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-5xl font-[Barrio] text-black mb-6 text-center">
            {tag.toUpperCase()} GROUPS IN PHILLY
          </h1>

          {loading ? (
            <div className="text-center text-gray-500 py-20">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              No groups found under this tag.
            </div>
          ) : (
            <GroupsList groups={groups} isAdmin={false} />
          )}

        </div>
      </div>
      <Footer />

    </>
  );
};

export default GroupTypePage;

