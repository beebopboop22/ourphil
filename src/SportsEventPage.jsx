// src/SportsEventPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import TaggedEventsScroller from './TaggedEventsScroller.jsx';
import SubmitEventSection from './SubmitEventSection.jsx';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import { supabase } from './supabaseClient';

export default function SportsEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);
  const [moreTagMap, setMoreTagMap] = useState({});

  useEffect(() => {
    (async () => {
      const rawId = id.startsWith('sg-') ? id.slice(3) : id;
      try {
        const res = await fetch(
          `https://api.seatgeek.com/2/events/${rawId}?client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
        );
        const data = await res.json();
        const ev = data.events?.[0] || data.event || data || null;
        setEvent(ev);
      } catch (err) {
        console.error('Error loading game', err);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 text-center">Loading...</div>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 text-center">Event not found.</div>
        <Footer />
      </div>
    );
  }

  const dt = new Date(event.datetime_local);
  const performers = event.performers || [];
  const home = performers.find(p => p.home_team) || performers.find(p => p.name.startsWith('Philadelphia')) || performers[0] || {};
  const away = performers.find(p => p.id !== home.id) || {};
  const image = home.image || away.image || '';
  const heroUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/sports-complex.jpg';

  const { isFavorite, toggleFavorite, loading: favLoading } = useEventFavorite({
    event_id: event ? `sg-${event.id}` : null,
    source_table: 'all_events',
  });

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    await toggleFavorite();
  };

  const handleShare = () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      navigator.share({ title, url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url).catch(console.error);
    }
  };

  function parseLocalYMD(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

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
          (list || []).map(async itm => {
            const { data: p } = await supabase
              .from('big_board_posts')
              .select('image_url')
              .eq('id', itm.post_id)
              .single();
            const { data: { publicUrl } } = supabase
              .storage.from('big-board')
              .getPublicUrl(p.image_url);
            return { ...itm, imageUrl: publicUrl };
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
    const ids = moreEvents.map(e => e.id);
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gameDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diffDays = Math.round((gameDay - today) / (1000 * 60 * 60 * 24));
  const prefix = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : dt.toLocaleDateString('en-US', { weekday: 'long' });
  const whenWhere = `${prefix}, ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}${event.venue?.name ? `, ${event.venue.name}` : ''}`;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-grow relative mt-32">
        <div
          className="w-full h-[40vh] bg-cover bg-center"
          style={{ backgroundImage: `url(${heroUrl})` }}
        />

        {!user && (
          <div className="w-full bg-indigo-600 text-white text-center py-4 text-xl sm:text-2xl">
            <Link to="/login" className="underline font-semibold">Log in</Link> or{' '}
            <Link to="/signup" className="underline font-semibold">sign up</Link> free to add to your Plans
          </div>
        )}

        <div
          className={`relative max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8 transform z-10 ${user ? '-mt-24' : ''}`}
        >
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">{event.short_title}</h1>
            <p className="text-lg font-medium">{whenWhere}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/tags/sports"
                className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-lg font-semibold"
              >
                #sports
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <button
              onClick={handleFavorite}
              disabled={favLoading}
              className={`w-full border border-indigo-600 rounded-md py-3 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
            >
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
            {event.url && (
              <div className="mt-6">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-6 py-3 rounded-md text-center bg-indigo-600 text-white text-base font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 transition duration-150 ease-in-out"
                >
                  Get Tickets
                </a>
              </div>
            )}
            <div className="mt-6 flex flex-col space-y-4">
              <button
                onClick={handleShare}
                className="w-full px-6 py-3 rounded-md bg-green-600 text-white text-base font-medium shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 active:scale-95 transition duration-150 ease-in-out"
              >
                Share
              </button>
              <Link to="/" className="w-full text-center text-indigo-600 hover:underline font-medium">
                ← Back to Events
              </Link>
            </div>
          </div>
          <div>
            {image && (
              <img
                src={image}
                alt={event.short_title}
                className="w-full h-auto rounded-lg shadow-lg max-h-[60vh]"
              />
            )}
          </div>
        </div>

        <TaggedEventsScroller tags={['sports']} />

        <div className="max-w-5xl mx-auto mt-12 border-t border-gray-200 pt-8 px-4 pb-12">
          <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
            More Upcoming Community Submissions
          </h2>
          {loadingMore ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : moreEvents.length === 0 ? (
            <p className="text-center text-gray-600">No upcoming submissions.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {moreEvents.map(evItem => {
                const dt = parseLocalYMD(evItem.start_date);
                const diff = Math.round((dt - new Date(new Date().setHours(0,0,0,0))) / (1000*60*60*24));
                const prefix = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : dt.toLocaleDateString('en-US',{ weekday:'long' });
                const md = dt.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
                return (
                  <Link
                    key={evItem.id}
                    to={`/big-board/${evItem.slug}`}
                    className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition"
                  >
                    <div className="relative h-40 bg-gray-100">
                      <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1">
                        COMMUNITY SUBMISSION
                      </div>
                      <img
                        src={evItem.imageUrl}
                        alt={evItem.title}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between text-center">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                        {evItem.title}
                      </h3>
                      <span className="text-sm text-gray-600">{prefix}, {md}</span>
                      {!!moreTagMap[evItem.id]?.length && (
                        <div className="mt-2 flex flex-wrap justify-center space-x-1">
                          {moreTagMap[evItem.id].map((tag, i) => (
                            <Link
                              key={tag.slug}
                              to={`/tags/${tag.slug}`}
                              className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold"
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

        <SubmitEventSection />
      </main>
      <Footer />
    </div>
  );
}
