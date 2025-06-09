// src/MainEventsDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import FloatingAddButton from './FloatingAddButton';
import PostFlyerModal from './PostFlyerModal';
import { Helmet } from 'react-helmet';

// parse "YYYY-MM-DD" into local Date
function parseLocalYMD(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// format "HH:MM[:SS]" into "h:mm a.m./p.m."
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const min = (minStr || '00').padStart(2, '0');
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

export default function MainEventsDetail() {
  const { venue, slug } = useParams();
  const [event, setEvent] = useState(null);
  const [venueData, setVenueData] = useState(null);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [communityEvents, setCommunityEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [showFlyerModal, setShowFlyerModal] = useState(false);

  // fetch main event, venue, related events
  useEffect(() => {
    (async () => {
      setLoading(true);
      // event
      const { data: evs } = await supabase
        .from('all_events')
        .select('*')
        .eq('slug', slug)
        .limit(1);
      if (!evs?.length) { setLoading(false); return; }
      setEvent(evs[0]);
      // venue
      const { data: vens } = await supabase
        .from('venues')
        .select('*')
        .eq('slug', venue)
        .limit(1);
      const vd = vens?.[0] || null;
      setVenueData(vd);
      // related
      if (vd) {
        const { data: rel } = await supabase
          .from('all_events')
          .select(`id, name, slug, start_date, start_time, image, venues:venue_id(name, slug)`)
          .eq('venue_id', vd.id)
          .neq('slug', slug)
          .order('start_date', { ascending: true })
          .limit(5);
        setRelatedEvents(rel || []);
      }
      setLoading(false);
    })();
  }, [venue, slug]);

  // fetch community submissions
  useEffect(() => {
    (async () => {
      setLoadingCommunity(true);
      const todayStr = new Date().toISOString().slice(0,10);
      const { data: list } = await supabase
        .from('big_board_events')
        .select('id,post_id,title,start_date,slug')
        .gte('start_date', todayStr)
        .neq('slug', slug)
        .order('start_date', { ascending: true })
        .limit(24);
      if (list) {
        const enriched = await Promise.all(
          list.map(async ev => {
            const { data: p } = await supabase
              .from('big_board_posts')
              .select('image_url')
              .eq('id', ev.post_id)
              .single();
            let url = '';
            if (p?.image_url) {
              const { data: { publicUrl }} = supabase
                .storage.from('big-board')
                .getPublicUrl(p.image_url);
              url = publicUrl;
            }
            return { ...ev, imageUrl: url };
          })
        );
        setCommunityEvents(enriched);
      }
      setLoadingCommunity(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar/>
        <div className="flex-grow flex items-center justify-center">
          <div className="text-2xl text-gray-500">Loading…</div>
        </div>
        <Footer/>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar/>
        <div className="flex-grow flex items-center justify-center">
          <div className="text-2xl text-red-600">Event not found.</div>
        </div>
        <Footer/>
      </div>
    );
  }

  // friendly prefix for main event
  const startDateObj = parseLocalYMD(event.start_date);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const diffMain = Math.round((startDateObj - today0)/(1000*60*60*24));
  let mainPrefix;
  if (diffMain === 0) mainPrefix = 'Today';
  else if (diffMain === 1) mainPrefix = 'Tomorrow';
  else {
    const wd = startDateObj.toLocaleDateString('en-US',{ weekday:'long' });
    mainPrefix = `This ${wd}`;
  }
  const mainMD = startDateObj.toLocaleDateString('en-US',{ month:'long', day:'numeric' });

  // SEO
  const pageTitle = event.name.length > 60
    ? event.name.slice(0,57).trim() + '…'
    : event.name;
  const metaDesc = (event.description || '').slice(0,155);

  return (
    <>
      <Helmet>
        <title>{pageTitle} | Our Philly Concierge</title>
        <meta name="description" content={metaDesc}/>
      </Helmet>

      <div className="flex flex-col min-h-screen bg-white">
        <Navbar/>

        {/* Hero + pill */}
        <main className="flex-grow pt-24 pb-12 px-4">
          <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="bg-gray-50 p-8 flex flex-col items-center">
                <div className="relative w-full">
                  {event.image ? (
                    <img
                      src={event.image}
                      alt={event.name}
                      className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-full h-[240px] bg-gray-200 rounded-lg"/>
                  )}
                  <span className="absolute top-4 left-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-sm">
                    {mainPrefix}, {mainMD}
                  </span>
                </div>
                
              </div>
              <div className="p-10 flex flex-col justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
                  {event.description && (
                    <p className="mt-4 text-gray-700 leading-relaxed">{event.description}</p>
                  )}
                  {event.start_time && (
                    <p className="mt-6 text-gray-800">Time: {formatTime(event.start_time)}</p>
                  )}
                  {venueData && (
                    <div className="mt-4 text-gray-600">
                      <p className="font-semibold">{venueData.name}</p>
                      <p className="text-sm">{venueData.address}</p>
                      <p className="text-sm">{venueData.city}, {venueData.state} {venueData.zip}</p>
                    </div>
                    
                  )}
                  {event.link && (
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition"
                  >
                    More Info
                  </a>
                )}
                </div>
                <div className="mt-10">
                  <Link to="/" className="text-indigo-600 hover:underline font-semibold">
                    ← Back to Events
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Upcoming community submissions */}
        <section className="border-t border-gray-200 mt-8 pt-8 px-4 pb-12">
          <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
            Upcoming community submissions
          </h2>

          {loadingCommunity ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : communityEvents.length === 0 ? (
            <p className="text-center text-gray-600">No upcoming submissions.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {communityEvents.map(ev => {
                const dt = parseLocalYMD(ev.start_date);
                const d0 = new Date(); d0.setHours(0,0,0,0);
                const diff = Math.round((dt - d0)/(1000*60*60*24));
                let prefix;
                if (diff === 0) prefix = 'Today';
                else if (diff === 1) prefix = 'Tomorrow';
                else {
                  const weekday = dt.toLocaleDateString('en-US',{ weekday:'long' });
                  const daysToEnd = 6 - d0.getDay();
                  if (diff > 1 && diff <= daysToEnd) {
                    prefix = `This ${weekday}`;
                  } else if (diff > daysToEnd && diff <= daysToEnd + 7) {
                    prefix = `Next ${weekday}`;
                  } else {
                    prefix = weekday;
                  }
                }
                const md = dt.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
                return (
                  <Link
                    key={ev.id}
                    to={`/big-board/${ev.slug}`}
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] overflow-hidden flex flex-col"
                  >
                    <div className="relative h-40 bg-gray-100">
                      <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white text-xs uppercase text-center py-1 z-20">
                        COMMUNITY SUBMISSION
                      </div>
                      {ev.imageUrl ? (
                        <img
                          src={ev.imageUrl}
                          alt={ev.title}
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-center">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 text-center">
                        {ev.title}
                      </h3>
                      <span className="text-sm text-gray-600 block text-center">
                        {prefix}, {md}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <Footer />

        {/* Desktop floating button */}
        <FloatingAddButton onClick={() => setShowFlyerModal(true)} />

        {/* Mobile full-width banner */}
        <button
          onClick={() => setShowFlyerModal(true)}
          className="fixed bottom-0 left-0 w-full bg-indigo-600 text-white py-4 text-center font-bold sm:hidden z-50"
        >
          Post Event
        </button>

        {/* Modal */}
        <PostFlyerModal
          isOpen={showFlyerModal}
          onClose={() => setShowFlyerModal(false)}
        />
      </div>
    </>
  );
}
