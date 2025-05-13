// src/OutletDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import GroupsList from './GroupsList';
import { Helmet } from 'react-helmet';

export default function OutletDetailPage() {
  const { slug } = useParams();
  const [outlet, setOutlet] = useState(null);
  const [loading, setLoading] = useState(true);

  // suggested groups
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  const [loadingSuggested, setLoadingSuggested] = useState(true);

  // 1) fetch outlet by slug
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('news_outlets')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) console.error('Outlet load error:', error);
      setOutlet(data);
      setLoading(false);
    })();
  }, [slug]);

  // 2) fetch “groups you might like” based on outlet.area
  useEffect(() => {
    if (!outlet) return;
    setLoadingSuggested(true);

    (async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, Name, slug, imag, Type, Area')
        .eq('Area', outlet.area)
        .limit(10);

      if (error) console.error('fetching suggested groups:', error);
      setSuggestedGroups(data || []);
      setLoadingSuggested(false);
    })();
  }, [outlet]);

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading…</div>;
  }
  if (!outlet) {
    return <div className="text-center py-20 text-gray-500">Outlet not found.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{outlet.outlet} – Our Philly</title>
        <meta name="description" content={outlet.description} />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />

      {/* ── Hero / Banner ───────────────────────────────────── */}
      <div className="relative w-full h-[400px] md:h-[500px]">
        {outlet.image_url
          ? <img src={outlet.image_url} alt={outlet.outlet}
                 className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 bg-gray-300" />}
        <div className="absolute inset-0 bg-black/50" />

        <div className="absolute bottom-6 left-6 text-white max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-[Barrio] mb-2">{outlet.outlet}</h1>
          {outlet.description && (
            <p className="text-lg md:text-xl leading-relaxed mb-4">
              {outlet.description}
            </p>
          )}
          {outlet.link && (
            <a href={outlet.link} target="_blank" rel="noopener noreferrer"
               className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-full text-sm hover:bg-indigo-700 transition">
              Visit Website
            </a>
          )}
        </div>
      </div>

     {/* ── Details Section ────────────────────────────────── */}
<section className="max-w-screen-md mx-auto px-4 py-8">
  <div className="prose prose-gray">

    {outlet.longDescription && (
      <>
        <p className="text-xs font-semibold uppercase text-indigo-600 mb-2">
          Summary
        </p>
        <p className="leading-relaxed text-gray-700">
          {outlet.longDescription}
        </p>
      </>
    )}
  </div>
</section>


      {/* ── Groups You Might Like ─────────────────────────── */}
      {suggestedGroups.length > 0 && (
        <section className="w-full bg-neutral-100 pt-12 pb-12">
          <h2 className="text-4xl text-center font-[Barrio] mb-6">
            Groups You Might Like
          </h2>

          {/* full-bleed wrapper */}
          <div className="relative w-screen left-1/2 right-1/2 mx-[-50vw]
                          overflow-x-auto overflow-y-hidden">
            <div className="flex space-x-4 flex-nowrap px-4">
              {loadingSuggested
                ? <p className="text-center w-full">Loading suggestions…</p>
                : <GroupsList groups={suggestedGroups} isAdmin={false} />
              }
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
