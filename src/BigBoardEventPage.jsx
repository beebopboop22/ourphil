// src/BigBoardEventPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import { Helmet } from 'react-helmet';
import PostFlyerModal from './PostFlyerModal';
import FloatingAddButton from './FloatingAddButton';
import TriviaTonightBanner from './TriviaTonightBanner';

/**
 * BigBoardEventPage
 * -----------------
 * Detailed view of a single Big Board event with edit/delete for owners.
 * Also shows a grid of upcoming community submissions below.
 */
export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit‐form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    start_date: '',
    end_date: '',
  });
  const [saving, setSaving] = useState(false);

  // Upcoming community submissions state
  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);

  // Modal state for new submissions
  const [showFlyerModal, setShowFlyerModal] = useState(false);

  // Parse "YYYY-MM-DD" as local Date at midnight
  function parseLocalYMD(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function fetchEvent() {
    setLoading(true);
    setError(null);
    const { data: ev, error: evErr } = await supabase
      .from('big_board_events')
      .select(`
        id, post_id, title, description, link,
        start_date, end_date, created_at, slug
      `)
      .eq('slug', slug)
      .single();
    if (evErr) {
      console.error(evErr);
      setError('Could not load event.');
      setLoading(false);
      return;
    }
    const { data: post, error: postErr } = await supabase
      .from('big_board_posts')
      .select('image_url, user_id')
      .eq('id', ev.post_id)
      .single();
    if (postErr) {
      console.error(postErr);
      setError('Could not load flyer.');
      setLoading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = await supabase.storage.from('big-board').getPublicUrl(post.image_url);
    const fullEvent = {
      ...ev,
      imageUrl: publicUrl,
      owner_id: post.user_id,
    };
    setEvent(fullEvent);
    setLoading(false);
    fetchMoreEvents(fullEvent.id);
  }

  async function fetchMoreEvents(currentId) {
    setLoadingMore(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: list, error: listErr } = await supabase
      .from('big_board_events')
      .select('id, post_id, title, start_date, end_date, slug')
      .gte('start_date', todayStr)
      .neq('id', currentId)
      .order('start_date', { ascending: true })
      .limit(24);
    if (listErr) {
      console.error(listErr);
      setLoadingMore(false);
      return;
    }
    const enriched = await Promise.all(
      list.map(async (ev) => {
        const { data: p, error: pErr } = await supabase
          .from('big_board_posts')
          .select('image_url')
          .eq('id', ev.post_id)
          .single();
        let imageUrl = '';
        if (!pErr && p?.image_url) {
          const {
            data: { publicUrl },
          } = await supabase.storage.from('big-board').getPublicUrl(p.image_url);
          imageUrl = publicUrl;
        }
        return { ...ev, imageUrl };
      })
    );
    setMoreEvents(enriched);
    setLoadingMore(false);
  }

  function startEditing() {
    setFormData({
      title: event.title,
      description: event.description || '',
      link: event.link || '',
      start_date: event.start_date || '',
      end_date: event.end_date || '',
    });
    setIsEditing(true);
  }
  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((fd) => ({ ...fd, [name]: value }));
  }
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: formData.title,
      description: formData.description || null,
      link: formData.link || null,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
    };
    const { data, error } = await supabase
      .from('big_board_events')
      .update(payload)
      .eq('id', event.id)
      .select()
      .single();
    setSaving(false);
    if (error) alert('Error saving event: ' + error.message);
    else {
      setEvent({ ...event, ...data });
      setIsEditing(false);
      fetchMoreEvents(event.id);
    }
  }
  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event?')) return;
    const { error } = await supabase
      .from('big_board_events')
      .delete()
      .eq('id', event.id);
    if (error) alert('Error deleting: ' + error.message);
    else navigate('/');
  }

  if (loading) return <div className="py-20 text-center">Loading…</div>;
  if (error) return <div className="py-20 text-center text-red-600">{error}</div>;
  if (!event) return <div className="py-20 text-center">Event not found.</div>;

  const startDateObj = parseLocalYMD(event.start_date);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const diffDays = Math.round((startDateObj - today0)/(1000*60*60*24));
  let mainPrefix;
  if (diffDays === 0) mainPrefix = 'Today';
  else if (diffDays === 1) mainPrefix = 'Tomorrow';
  else {
    const weekday = startDateObj.toLocaleDateString('en-US',{ weekday:'long' });
    if (diffDays > 1 && diffDays < 7) mainPrefix = `This ${weekday}`;
    else if (diffDays >= 7 && diffDays < 14) mainPrefix = `Next ${weekday}`;
    else mainPrefix = weekday;
  }
  const mainMD = startDateObj.toLocaleDateString('en-US',{ month:'long', day:'numeric' });

  const pageTitle = `${event.title} – OUR PHILLY`;
  const metaDesc = event.description || `Details for ${event.title}.`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />

        <main className="flex-grow pt-24 pb-12 px-4">
          

          <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">

              {/* Left: image, date bubble, posted, edit/delete buttons */}
              <div className="bg-gray-50 p-8 flex flex-col items-center">
                <div className="relative w-full">
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                  />
                  <span className="absolute top-4 left-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-sm">
                    {mainPrefix}, {mainMD}
                  </span>
                </div>
                <p className="mt-4 text-sm text-gray-500 self-start">
                  Posted on {new Date(event.created_at).toLocaleDateString()}
                </p>
                {event.owner_id === user?.id && !isEditing && (
                  <div className="flex flex-col space-y-3 mt-4 w-full">
                    <button
                      onClick={startEditing}
                      className="w-full bg-indigo-600 text-white px-5 py-3 rounded-lg shadow hover:bg-indigo-700 transition"
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full bg-red-600 text-white px-5 py-3 rounded-lg shadow hover:bg-red-700 transition"
                    >
                      Delete Event
                    </button>
                  </div>
                )}
              </div>

              {/* Right: details or edit form */}
              <div className="p-10 flex flex-col justify-between">
                {isEditing ? (
                  <form onSubmit={handleSave} className="space-y-6">
                    {/* form fields as before */}
                  </form>
                ) : (
                  <div className="flex flex-col justify-between h-full">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900">
                        {event.title}
                      </h1>
                      <div className="mt-4 p-4 bg-purple-50 border-l-4 border-purple-600 rounded-md">
                        <p className="text-purple-700 text-sm">
                          This was submitted by a total stranger. Use the hovering purple plus icon to drop your event on our calendar.
                        </p>
                      </div>
                      
                        <div>
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            When?
                          </h2>
                          <p className="text-gray-700 leading-relaxed">
                          {mainPrefix}, {mainMD}
                          </p>
                        </div>
                      

                      {event.description && (
                        <div>
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            Description
                          </h2>
                          <p className="text-gray-700 leading-relaxed">
                            {event.description}
                          </p>
                        </div>
                      )}

                      {event.link && (
                        <div className="mt-8">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            More Info
                          </h2>
                          <a
                            href={event.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline break-words"
                          >
                            {event.link}
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="mt-10">
                      <Link to="/" className="text-indigo-600 hover:underline font-semibold">
                        ← Back to More Events
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-5 mt-5">
            <TriviaTonightBanner />
          </div>

            {/* Upcoming community submissions */}
            <div className="border-t border-gray-200 mt-12 pt-8 px-8 pb-12">
              <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
                More upcoming community submissions
              </h2>

              {loadingMore ? (
                <p className="text-center text-gray-500">Loading…</p>
              ) : moreEvents.length === 0 ? (
                <p className="text-center text-gray-600">No upcoming submissions.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {moreEvents.map(ev => {
                    const dt = parseLocalYMD(ev.start_date);
                    const today0 = new Date(); today0.setHours(0,0,0,0);
                    const diff = Math.round((dt - today0) / (1000*60*60*24));
                    let prefix;
                    if (diff === 0) prefix = 'Today';
                    else if (diff === 1) prefix = 'Tomorrow';
                    else {
                      const weekday = dt.toLocaleDateString('en-US',{ weekday:'long' });
                      const todayDay = today0.getDay();
                      const daysUntilEnd = 6 - todayDay;
                      if (diff > 1 && diff <= daysUntilEnd) {
                        prefix = `This ${weekday}`;
                      } else if (diff > daysUntilEnd && diff <= daysUntilEnd + 7) {
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
            </div>

          </div>
        </main>

        <Footer />
        <FloatingAddButton onClick={() => setShowFlyerModal(true)} />
        <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} />
      </div>
    </>
  );
}
