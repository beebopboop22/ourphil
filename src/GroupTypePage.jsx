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

export default function GroupTypePage() {
  const { tagSlug } = useParams();
  const [groups, setGroups] = useState([]);            // filtered groups
  const [allTypes, setAllTypes] = useState([]);        // all available types
  const [loading, setLoading] = useState(true);
  const tag = unslugify(tagSlug);

  // Fetch filtered groups for this tag
  useEffect(() => {
    async function fetchFiltered() {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) {
        console.error('Error fetching groups:', error);
      } else {
        const filtered = data.filter(group =>
          (group.Type || '').toLowerCase().includes(tag.toLowerCase())
        );
        setGroups(filtered);
      }
      setLoading(false);
    }
    fetchFiltered();
  }, [tag]);

  // Fetch all group types for category grid
  useEffect(() => {
    async function fetchTypes() {
      const { data, error } = await supabase.from('groups').select('Type');
      if (error) {
        console.error('Error fetching types:', error);
      } else {
        const typesSet = new Set();
        data.forEach(g => {
          (g.Type?.split(',').map(t => t.trim()) || []).forEach(t => typesSet.add(t));
        });
        setAllTypes(Array.from(typesSet).sort());
      }
    }
    fetchTypes();
  }, []);

  // Slugify helper
  const slugify = (text = '') =>
    text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const pageTitle = `${tag} Groups – Our Philly`;
  const pageDesc = `Explore Philadelphia’s best ${tag.toLowerCase()} groups—connect, heart, and plug into your community.`;
  const pageUrl = `https://ourphilly.com/groups/type/${tagSlug}`;
  const ogImage = groups[0]?.imag || '/favicon.ico';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content={pageDesc} />
        <meta name="keywords" content={`${tag}, ${tag} groups, Philly community`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={ogImage} />
        <link rel="canonical" href={pageUrl} />
      </Helmet>

      <Navbar />
      <div className="pt-20 bg-white mb-10">
        <GroupProgressBar />
      </div>

      <div className="min-h-screen bg-gray-50 px-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-5xl font-[Barrio] text-black mb-4 text-center">
            {tag.toUpperCase()} GROUPS IN PHILLY
          </h1>

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

          {/* Category grid of ALL types */}
          <section className="mt-12 mb-12">
            <h2 className="text-2xl font-[Barrio] text-center font-bold mb-4">
              Find Other Groups in Philly
            </h2>
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
        </div>
      </div>

      <Footer />
    </>
  );
}