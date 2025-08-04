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
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
import CommentsSection from './CommentsSection';

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

  // Other events / community submissions
  const [sameDayEvents, setSameDayEvents] = useState([]);
  const [communityEvents, setCommunityEvents] = useState([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [communityTagMap, setCommunityTagMap] = useState({});

  // Modal state for "add events"
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);

  const {
    isFavorite,
    toggleFavorite,
    loading: favLoading,
  } = useEventFavorite({ event_id: series?.id, source_table: 'recurring_events' });
  const [initialFlyer, setInitialFlyer] = useState(null);

  const pillStyles = [
    'bg-red-100 text-red-800',
    'bg-orange-100 text-orange-800',
    'bg-amber-100 text-amber-800',
    'bg-yellow-100 text-yellow-800',
    'bg-lime-100 text-lime-800',
    'bg-green-100 text-green-800',
    'bg-emerald-100 text-emerald-800',
    'bg-teal-100 text-teal-800',
    'bg-cyan-100 text-cyan-800',
    'bg-sky-100 text-sky-800',
    'bg-blue-100 text-blue-800',
    'bg-indigo-100 text-indigo-800',
    'bg-violet-100 text-violet-800',
    'bg-purple-100 text-purple-800',
    'bg-fuchsia-100 text-fuchsia-800',
    'bg-pink-100 text-pink-800',
    'bg-rose-100 text-rose-800',
    'bg-gray-100 text-gray-800',
    'bg-slate-100 text-slate-800',
    'bg-zinc-100 text-zinc-800',
    'bg-neutral-100 text-neutral-800',
    'bg-stone-100 text-stone-800',
    'bg-lime-200 text-lime-900',
    'bg-orange-200 text-orange-900',
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

  // ─── Load other recurring events on this day ─────────────────────────
  useEffect(() => {
    if (!series) return;
    const targetIso = date || (occurrences[0]?.toISOString().slice(0,10));
    if (!targetIso) return;
    const start = parseLocalYMD(targetIso); start.setHours(0,0,0,0);
    const end   = new Date(start); end.setHours(23,59,59,999);
    (async () => {
      try {
        const { data: list } = await supabase
          .from('recurring_events')
          .select('id,name,slug,image_url,start_date,start_time,end_date,rrule')
          .eq('is_active', true);
        const others = [];
        (list || []).forEach(ev => {
          if (ev.id === series.id) return;
          const opts = RRule.parseString(ev.rrule);
          opts.dtstart = new Date(`${ev.start_date}T${ev.start_time}`);
          if (ev.end_date) opts.until = new Date(`${ev.end_date}T23:59:59`);
          const rule = new RRule(opts);
          if (rule.between(start, end, true).length)
            others.push({
              id: ev.id,
              name: ev.name,
              slug: ev.slug,
              image_url: ev.image_url,
            });
        });
        setSameDayEvents(others);
      } catch (e) {
        console.error(e);
        setSameDayEvents([]);
      }
    })();
  }, [series, date, occurrences]);

  // ─── Load upcoming community submissions ─────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0,10);
    (async () => {
      setLoadingCommunity(true);
      try {
        const { data: list, error } = await supabase
          .from('big_board_events')
          .select('id,post_id,title,start_date,slug')
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(24);
        if (error) throw error;
        const enriched = await Promise.all(
          (list || []).map(async ev => {
            const { data: post } = await supabase
              .from('big_board_posts')
              .select('image_url')
              .eq('id', ev.post_id)
              .single();
            let url = '';
            if (post?.image_url) {
              const { data:{ publicUrl } } = supabase
                .storage.from('big-board')
                .getPublicUrl(post.image_url);
              url = publicUrl;
            }
            return { ...ev, imageUrl: url };
          })
        );
        setCommunityEvents(enriched);
      } catch (err) {
        console.error(err);
        setCommunityEvents([]);
      } finally {
        setLoadingCommunity(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!communityEvents.length) return;
    const ids = communityEvents.map(ev => String(ev.id));
    supabase
      .from('taggings')
      .select('tags(name,slug),taggable_id')
      .eq('taggable_type','big_board_events')
      .in('taggable_id', ids)
      .then(({ data, error }) => {
        if (error) return console.error(error);
        const map = {};
        data.forEach(({ taggable_id, tags }) => {
          map[taggable_id] = map[taggable_id] || [];
          map[taggable_id].push(tags);
        });
        setCommunityTagMap(map);
      });
  }, [communityEvents]);

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

  const baseDate = date ? parseLocalYMD(date) : new Date();
  baseDate.setHours(0,0,0,0);
  const upcomingOccs = occurrences
    .filter(dt => dt > baseDate)
    .slice(0,3);

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
                className="absolute left-0 top-1/2 -translate-y-1/2 p-3 bg-gray-100 hover:bg-gray-200 rounded-full shadow z-20"
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
              className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-gray-100 hover:bg-gray-200 rounded-full shadow z-20"
            >
              →
            </button>
          )}
          </div>
          {!user && (
            <div className="bg-indigo-50 text-center text-base py-2">
              <Link to="/login" className="text-indigo-600 font-semibold">Log in</Link> to add to your Plans.
            </div>
          )}

          {/* Main content grid */}
          <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side: description, CTA buttons */}
            <div>
              {series.link && (
                <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded">
                  <p className="mb-2">This is a recurring event and may sometimes be cancelled. Check their website before going.</p>
                  <a
                    href={series.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 underline font-semibold"
                  >
                    Visit Site
                  </a>
                </div>
              )}

              {series.description && (
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Description</h2>
                  <p className="text-gray-700">{series.description}</p>
                </div>
              )}
              <div className="mb-6">
                <button
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  className={`w-full border border-indigo-600 rounded-md py-3 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                >
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>

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

        <CommentsSection
          source_table="recurring_events"
          event_id={series.id}
        />

        {/* Upcoming Dates */}
        <div className="max-w-5xl mx-auto mt-12 border-t border-gray-200 pt-8 px-4 pb-12">
            <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
              Upcoming Dates
            </h2>
            {upcomingOccs.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming dates.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingOccs.map(dt => {
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

          {sameDayEvents.length > 0 && (
            <div className="max-w-5xl mx-auto mt-12 border-t border-gray-200 pt-8 px-4 pb-12">
              <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
                Other Events on {date ? parseLocalYMD(date).toLocaleDateString('en-US', { month:'long', day:'numeric' }) : 'this day'}
              </h2>
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
                    <div className="p-4 flex-1 flex flex-col justify-center text-center">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                        {ev.name}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <hr className="my-8 border-gray-200" />

          <div className="max-w-5xl mx-auto pb-12 px-4">
            <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
              Upcoming Community Events
            </h2>
            {loadingCommunity ? (
              <p className="text-center text-gray-500">Loading…</p>
            ) : communityEvents.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming submissions.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {communityEvents.map(evItem => {
                  const dt = parseLocalYMD(evItem.start_date);
                  const diff = Math.round((dt - new Date(new Date().setHours(0,0,0,0))) / (1000*60*60*24));
                  const prefix =
                    diff === 0 ? 'Today' :
                    diff === 1 ? 'Tomorrow' :
                    dt.toLocaleDateString('en-US',{ weekday:'long' });
                  const md = dt.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
                  return (
                    <Link
                      key={evItem.id}
                      to={`/big-board/${evItem.slug}`}
                      className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1">COMMUNITY SUBMISSION</div>
                        {evItem.imageUrl ? (
                          <img src={evItem.imageUrl} alt={evItem.title} className="w-full h-full object-cover object-center" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-center text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">{evItem.title}</h3>
                        <span className="text-sm text-gray-600">{prefix}, {md}</span>
                        {!!communityTagMap[evItem.id]?.length && (
                          <div className="mt-2 flex flex-wrap justify-center space-x-1">
                            {communityTagMap[evItem.id].map((tag, i) => (
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

          {tagsList.length > 0 && (
            <div className="my-8 text-center">
              <h3 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-6">Explore these tags</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {tagsList.map((tag, i) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    className={`${pillStyles[i % pillStyles.length]} px-5 py-3 rounded-full text-lg font-semibold hover:opacity-80 transition`}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <SubmitEventSection onNext={file => { setInitialFlyer(file); setModalStartStep(2); setShowFlyerModal(true); }} />
        </main>

        <Footer />
        <FloatingAddButton onClick={() => {setModalStartStep(1);setInitialFlyer(null);setShowFlyerModal(true);}} />
        <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} startStep={modalStartStep} initialFile={initialFlyer} />
      </div>
    </>
  );
}
