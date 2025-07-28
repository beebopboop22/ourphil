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
import GroupsList from './GroupsList';
import SeasonalEventsGrid from './SeasonalEvents';

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

  // Other recurring events on same date
  const [sameDayEvents, setSameDayEvents] = useState([]);
  const [loadingSameDay, setLoadingSameDay] = useState(true);

  // Suggested groups
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Upcoming community submissions
  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);
  const [moreTagMap, setMoreTagMap] = useState({});

  const pillStyles = [
    'bg-red-100 text-red-800',
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
  ];

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

  // Load other recurring events on the same day
  useEffect(() => {
    if (!series || !date) return;
    setLoadingSameDay(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('recurring_events')
          .select('id,name,slug,image_url,start_date,start_time,rrule')
          .eq('is_active', true);
        const targetStart = new Date(`${date}T00:00:00`);
        const targetEnd = new Date(`${date}T23:59:59`);
        const others = (data || []).filter(s => s.id !== series.id).filter(s => {
          try {
            const opts = RRule.parseString(s.rrule);
            opts.dtstart = new Date(`${s.start_date}T${s.start_time}`);
            const rule = new RRule(opts);
            return rule.between(targetStart, targetEnd, true).length > 0;
          } catch {
            return false;
          }
        });
        setSameDayEvents(others);
      } catch (e) {
        console.error(e);
        setSameDayEvents([]);
      } finally {
        setLoadingSameDay(false);
      }
    })();
  }, [series, date]);

  // Load suggested groups based on tags
  useEffect(() => {
    if (!selectedTags.length) {
      setSuggestedGroups([]);
      setLoadingGroups(false);
      return;
    }
    setLoadingGroups(true);
    (async () => {
      try {
        const { data: tagRows } = await supabase
          .from('taggings')
          .select('taggable_id')
          .eq('taggable_type', 'groups')
          .in('tag_id', selectedTags);
        const ids = [...new Set((tagRows || []).map(r => r.taggable_id))];
        if (!ids.length) {
          setSuggestedGroups([]);
          setLoadingGroups(false);
          return;
        }
        const { data: groups } = await supabase
          .from('groups')
          .select('*')
          .in('id', ids);
        setSuggestedGroups(groups || []);
      } catch (e) {
        console.error(e);
        setSuggestedGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    })();
  }, [selectedTags]);

  // Load upcoming community submissions
  useEffect(() => {
    setLoadingMore(true);
    (async () => {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: list } = await supabase
          .from('big_board_events')
          .select('id, post_id, title, start_date, slug')
          .gte('start_date', todayStr)
          .order('start_date', { ascending: true })
          .limit(39);
        const enriched = await Promise.all(
          (list || []).map(async ev => {
            const { data: post } = await supabase
              .from('big_board_posts')
              .select('image_url')
              .eq('id', ev.post_id)
              .single();
            const { data: { publicUrl } } = supabase
              .storage.from('big-board')
              .getPublicUrl(post.image_url);
            return { ...ev, imageUrl: publicUrl };
          })
        );
        setMoreEvents(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMore(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!moreEvents.length) return;
    const ids = moreEvents.map(ev => ev.id);
    supabase
      .from('taggings')
      .select('tags(name,slug),taggable_id')
      .eq('taggable_type', 'big_board_events')
      .in('taggable_id', ids)
      .then(({ data, error }) => {
        if (error) throw error;
        const map = {};
        data.forEach(({ taggable_id, tags }) => {
          map[taggable_id] = map[taggable_id] || [];
          map[taggable_id].push(tags);
        });
        setMoreTagMap(map);
      })
      .catch(console.error);
  }, [moreEvents]);

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
                className="absolute left-0 top-1/2 -translate-y-1/2 p-3 bg-gray-100 hover:bg-gray-200 rounded-full shadow"
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
                className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-gray-100 hover:bg-gray-200 rounded-full shadow"
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

          {date && (
            <div className="max-w-5xl mx-auto border-t border-gray-200 pt-8 px-4 pb-12">
              <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
                Other Recurring Events on {whenText}
              </h2>
              {loadingSameDay ? (
                <p className="text-center text-gray-500">Loading…</p>
              ) : sameDayEvents.length === 0 ? (
                <p className="text-center text-gray-600">None found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sameDayEvents.map(ev => (
                    <Link
                      key={ev.id}
                      to={`/series/${ev.slug}/${date}`}
                      className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <img
                          src={ev.image_url}
                          alt={ev.name}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                          {ev.name}
                        </h3>
                        {ev.start_time && (
                          <span className="text-sm text-gray-600">@ {formatTime(ev.start_time)}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="max-w-screen-xl mx-auto border-t border-gray-200 pt-8 pb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center px-4">
              Groups You May Be Interested In
            </h2>
            {loadingGroups ? (
              <p className="text-center text-gray-500">Loading…</p>
            ) : suggestedGroups.length === 0 ? (
              <p className="text-center text-gray-600 px-4">No groups found.</p>
            ) : (
              <GroupsList groups={suggestedGroups} isAdmin={false} />
            )}
          </div>

          <div className="max-w-screen-xl mx-auto border-t border-gray-200 pt-8 pb-12 px-4">
            <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
              Other Upcoming Events
            </h2>
            {loadingMore ? (
              <p className="text-center text-gray-500">Loading…</p>
            ) : moreEvents.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming events.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {moreEvents.map(ev => {
                  const dt = parseLocalYMD(ev.start_date);
                  const diff = Math.round((dt - new Date(new Date().setHours(0,0,0,0))) / (1000*60*60*24));
                  const prefix =
                    diff === 0 ? 'Today' :
                    diff === 1 ? 'Tomorrow' :
                    dt.toLocaleDateString('en-US',{ weekday:'long' });
                  const md = dt.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
                  return (
                    <Link
                      key={ev.id}
                      to={`/big-board/${ev.slug}`}
                      className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1">
                          COMMUNITY SUBMISSION
                        </div>
                        <img
                          src={ev.imageUrl}
                          alt={ev.title}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                          {ev.title}
                        </h3>
                        <span className="text-sm text-gray-600">{prefix}, {md}</span>
                        {!!moreTagMap[ev.id]?.length && (
                          <div className="mt-2 flex flex-wrap justify-center space-x-1">
                            {moreTagMap[ev.id].map((tag, i) => (
                              <Link
                                key={tag.slug}
                                to={`/tags/${tag.slug}`}
                                className={`${pillStyles[i % pillStyles.length]} text-xs font-semibold px-2 py-1 rounded-full hover:opacity-80 transition`}
                              >
                                #{tag.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <SeasonalEventsGrid />

          {!user && (
            <div className="max-w-screen-xl mx-auto pb-12 px-4">
              <Link
                to="/signup"
                className="block w-full bg-indigo-600 text-white text-center py-4 text-xl font-bold rounded-lg hover:bg-indigo-700 transition"
              >
                Sign Up to Save Favorites
              </Link>
            </div>
          )}

        </main>

        <Footer />
        <FloatingAddButton />
        <PostFlyerModal />
      </div>
    </>
  );
}
