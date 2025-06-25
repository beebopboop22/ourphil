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
import TriviaTonightBanner from './TriviaTonightBanner';

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
    const hour  = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2,'0')} ${suffix}`;
  }
  function parseLocalYMD(s) {
    const [y,mo,d] = s.split('-').map(Number);
    return new Date(y, mo-1, d);
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
        setTagsList(all);

        const { data: tgs } = await supabase
          .from('taggings')
          .select('tag_id')
          .eq('taggable_type','recurring_events')
          .eq('taggable_id', sr.id);
        setSelectedTags(tgs.map(t => t.tag_id));
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
    
        // parse the rule and set dtstart + until
        const opts = RRule.parseString(series.rrule);
        opts.dtstart = new Date(`${series.start_date}T${series.start_time}`);
        if (series.end_date) {
          opts.until = new Date(`${series.end_date}T23:59:59`);
        }
        const rule = new RRule(opts);
    
        // build our window: from today through the series end date
        const windowStart = new Date();
        windowStart.setHours(0,0,0,0);
    
        const windowEnd = series.end_date
          ? new Date(`${series.end_date}T23:59:59`)
          : new Date(windowStart.getFullYear() + 1, windowStart.getMonth(), windowStart.getDate());
    
        // grab every occurrence in that window
        const allOccs = rule.between(windowStart, windowEnd, true);
    
        // if you still want to limit to, say, the next 10 dates:
        // const upcoming = allOccs.slice(0, 10);
        setOccurrences(allOccs);
      }, [series, date]);
    

  if (loading) return <div className="py-20 text-center">Loading…</div>;
  if (error)   return <div className="py-20 text-center text-red-600">{error}</div>;
  if (!series) return null;

  // Compute “when” text
  const whenText = date
    ? parseLocalYMD(date).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
    : 'Recurring Series';

  return (
    <>
      <Helmet>
        <title>{series.name} | Our Philly</title>
        <meta name="description" content={series.description || ''} />
      </Helmet>
      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />

        <main className="flex-grow pt-24 pb-12 px-4">
          <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Image & Share */}
              <div className="bg-gray-50 p-8 flex flex-col items-center space-y-4">
                {series.image_url && (
                  <img
                    src={series.image_url}
                    alt={series.name}
                    className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                  />
                )}
                <span className="text-sm text-gray-500 self-start">
                  Created on {new Date(series.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="w-full bg-green-600 text-white py-2 rounded-full shadow hover:bg-green-700 transition"
                >
                  Share
                </button>
              </div>

              {/* Details */}
              <div className="p-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">{series.name}</h1>

                {/* When & Where */}
                <div className="text-gray-700 mb-6">
                  <h2 className="text-xl font-semibold">When & Where?</h2>
                  <p className="mt-1">
                    {whenText}
                    {series.start_time && ` — ${formatTime(series.start_time)}`}
                  </p>
                  {series.address ? (
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(series.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline block mt-1"
                    >
                      {series.address}
                    </a>
                  ) : (
                    <span className="text-gray-500 italic">No location specified</span>
                  )}
                </div>

                {/* Description */}
                {series.description && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold">Description</h2>
                    <p className="mt-2 text-gray-700">{series.description}</p>
                  </div>
                )}

                {/* Tags */}
                {selectedTags.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-800">Tags</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tagsList
                        .filter(t => selectedTags.includes(t.id))
                        .map((t, i) => (
                          <Link
                            key={t.id}
                            to={`/tags/${t.slug}`}
                            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm hover:bg-gray-300"
                          >
                            #{t.name}
                          </Link>
                        ))}
                    </div>
                  </div>
                )}

                {/* More Info */}
                {series.link && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold">More Info</h2>
                    <a
                      href={series.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Visit Site
                    </a>
                  </div>
                )}

                {/* Back */}
                <div className="mt-10">
                  <Link to="/" className="text-indigo-600 hover:underline">
                    ← Back to Events
                  </Link>
                </div>
              </div>
            </div>

            {/* Upcoming Dates */}
            <div className="border-t border-gray-200 mt-12 pt-8 px-8 pb-12">
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

            {/* Trivia Banner */}
            <div className="mt-8 mb-6 px-8">
              <TriviaTonightBanner />
            </div>
          </div>
        </main>

        <Footer />
        <FloatingAddButton />
        <PostFlyerModal />
      </div>
    </>
  );
}
