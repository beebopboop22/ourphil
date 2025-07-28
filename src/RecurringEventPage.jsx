// src/RecurringEventPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import { RRule } from 'rrule';
import { Helmet } from 'react-helmet';
import PostFlyerModal from './PostFlyerModal';
import FloatingAddButton from './FloatingAddButton';

export default function RecurringEventPage() {
  const { slug, date } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Series state
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Occurrences
  const [occurrences, setOccurrences] = useState([]);

  // Tags
  const [tagsList, setTagsList] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // Helpers
  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'p.m.' : 'a.m.';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2,'0')} ${suffix}`;
  }
  function parseLocalYMD(s) {
    const [y,mo,d] = s.split('-').map(Number);
    return new Date(y, mo-1, d);
  }
  function copyLinkFallback(url) {
    navigator.clipboard.writeText(url).catch(console.error);
  }
  function handleShare() {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) navigator.share({ title, url }).catch(console.error);
    else copyLinkFallback(url);
  }

  // Fetch series + tags
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: sr, error: srErr } = await supabase
          .from('recurring_events')
          .select(`
            id, name, description, link, address,
            start_date, end_date, start_time, end_time,
            rrule, image_url, created_at
          `)
          .eq('slug', slug)
          .single();
        if (srErr) throw srErr;
        setSeries(sr);

        const { data: all } = await supabase.from('tags').select('id,name,slug');
        setTagsList(all || []);

        const { data: tgs } = await supabase
          .from('taggings')
          .select('tag_id')
          .eq('taggable_type','recurring_events')
          .eq('taggable_id', sr.id);
        setSelectedTags((tgs || []).map(t => t.tag_id));
      } catch (e) {
        console.error(e);
        setError('Could not load series.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Expand RRULE into occurrence dates
  useEffect(() => {
    if (!series) return;
    const opts = RRule.parseString(series.rrule);
    opts.dtstart = new Date(`${series.start_date}T${series.start_time}`);
    if (series.end_date) opts.until = new Date(`${series.end_date}T23:59:59`);
    const rule = new RRule(opts);

    const windowStart = new Date();
    windowStart.setHours(0,0,0,0);
    const windowEnd = series.end_date
      ? new Date(`${series.end_date}T23:59:59`)
      : new Date(windowStart.getFullYear()+1, windowStart.getMonth(), windowStart.getDate());

    const allOccs = rule.between(windowStart, windowEnd, true);
    setOccurrences(allOccs);
  }, [series]);

  if (loading) return <div className="py-20 text-center">Loading…</div>;
  if (error)   return <div className="py-20 text-center text-red-600">{error}</div>;
  if (!series) return null;

  // Compute whenText
  const whenText = date
    ? parseLocalYMD(date).toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })
    : 'Recurring Series';

  // Prev / Next logic
  const isoDates = occurrences.map(dt => dt.toISOString().slice(0,10));
  const idx = date ? isoDates.indexOf(date) : -1;
  const prevDate = idx > 0 ? isoDates[idx-1] : null;
  const nextDate = idx >= 0 && idx < isoDates.length-1 ? isoDates[idx+1] : null;

  return (
    <>
      <Helmet>
        <title>{series.name} | Our Philly</title>
        <meta name="description" content={series.description || ''} />
      </Helmet>

      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />

        <main className="flex-grow">
          {/* Hero banner */}
          <div
            className="w-full h-[40vh] bg-cover bg-center"
            style={{ backgroundImage: `url(${series.image_url})` }}
          />

          {/* Overlapping center card with arrows */}
          <div className="relative max-w-4xl mx-auto -mt-24 px-4">
            {/* Prev arrow */}
            {prevDate && (
              <button
                onClick={() => navigate(`/series/${slug}/${prevDate}`)}
                className="absolute left-0 top-1/2 -translate-y-1/2 p-3 bg-gray-100 hover:bg-gray-200 rounded-full shadow z-20 text-3xl"
              >
                ←
              </button>
            )}

            <div className="bg-white shadow-xl rounded-xl p-8 relative z-10 text-center">
              <h1 className="text-4xl font-bold">{series.name}</h1>
              <p className="mt-4 text-lg font-medium">
                {whenText}
                {series.start_time && ` — ${formatTime(series.start_time)}`}
                {series.address && (
                  <> • <a
                    href={`https://maps.google.com?q=${encodeURIComponent(series.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {series.address}
                  </a></>
                )}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {tagsList
                  .filter(t => selectedTags.includes(t.id))
                  .map((t,i) => (
                    <Link
                      key={t.id}
                      to={`/tags/${t.slug}`}
                      className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-lg font-semibold"
                    >
                      #{t.name}
                    </Link>
                  ))}
              </div>
            </div>

            {/* Next arrow */}
            {nextDate && (
              <button
                onClick={() => navigate(`/series/${slug}/${nextDate}`)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-gray-100 hover:bg-gray-200 rounded-full shadow z-20 text-3xl"
              >
                →
              </button>
            )}
          </div>

          {/* Main content grid */}
          <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side: description, CTA buttons */}
            <div>
              {series.description && (
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Description</h2>
                  <p className="text-gray-700">{series.description}</p>
                </div>
              )}

              {series.link && (
                <a
                  href={series.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-indigo-600 text-white text-center py-3 rounded-lg shadow hover:bg-indigo-700 transition"
                >
                  Visit Site
                </a>
              )}

              <button
                onClick={handleShare}
                className="block w-full bg-green-600 text-white text-center py-3 rounded-lg shadow hover:bg-green-700 mt-4 transition"
              >
                Share
              </button>
            </div>

            {/* Right side: capped-height image */}
            <div>
              <img
                src={series.image_url}
                alt={series.name}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>

          {/* Upcoming Dates */}
          <div className="max-w-5xl mx-auto mt-12 border-t border-gray-200 pt-8 px-4 pb-12">
            <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
              Upcoming Dates
            </h2>
            {occurrences.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming dates.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {occurrences.map(dt => {
                  const iso = dt.toISOString().slice(0,10);
                  const label = dt.toLocaleDateString('en-US', {
                    weekday:'long', month:'long', day:'numeric'
                  });
                  return (
                    <Link
                      key={iso}
                      to={`/series/${slug}/${iso}`}
                      className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <img
                          src={series.image_url}
                          alt={series.name}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                          {label}
                        </h3>
                        {series.start_time && (
                          <span className="text-sm text-gray-600">
                            @ {formatTime(series.start_time)}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <Footer />
        <FloatingAddButton />
        <PostFlyerModal />
      </div>
    </>
  );
}
