// src/GroupTypePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
        const filtered = data.filter((group) =>
          group.Type?.toLowerCase().includes(tag.toLowerCase())
        );
        setGroups(filtered);
      }
      setLoading(false);
    };

    fetchGroups();
  }, [tag]);

  const pageTitle = `${tag} Groups – Our Philly`;
  const pageDesc = `Explore Philadelphia’s best ${tag.toLowerCase()} groups—connect, heart, and plug into your community.`;
  const pageUrl = `https://ourphilly.com/groups/type/${tagSlug}`;
  const ogImage = groups[0]?.imag || '/favicon.ico';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <link rel="icon" href="/favicon.ico" />

        {/* Primary Meta Tags */}
        <meta name="description" content={pageDesc} />
        <meta name="keywords" content={`${tag}, ${tag} groups, Philly community`} />

        {/* Open Graph / Facebook */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={ogImage} />

        {/* Canonical */}
        <link rel="canonical" href={pageUrl} />
      </Helmet>

      <Navbar />

      {/* Progress bar sits directly below the fixed nav */}
      <div className="pt-20 bg-white mb-10">
        <GroupProgressBar />
      </div>

      <div className="min-h-screen bg-gray-50 px-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-5xl font-[Barrio] text-black mb-4 text-center">
            {tag.toUpperCase()} GROUPS IN PHILLY
          </h1>

          {/* Browse All Groups link */}
          <div className="text-center mb-8">
            <Link
              to="/groups"
              className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition"
            >
              Browse All Groups
            </Link>
          </div>

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
