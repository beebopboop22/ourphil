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

  // Fetch the main event and related posts
  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      setError(null);
      try {
        const { data: ev, error: evErr } = await supabase
          .from('big_board_events')
          .select('id, post_id, title, description, link, start_date, end_date, created_at, slug')
          .eq('slug', slug)
          .single();
        if (evErr) throw evErr;

        const { data: post } = await supabase
          .from('big_board_posts')
          .select('image_url, user_id')
          .eq('id', ev.post_id)
          .single();
        const { data: { publicUrl } } = await supabase
          .storage.from('big-board')
          .getPublicUrl(post.image_url);

        setEvent({ ...ev, imageUrl: publicUrl, owner_id: post.user_id });
      } catch (err) {
        console.error(err);
        setError('Could not load event.');
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [slug]);

  // Fetch other upcoming events
  useEffect(() => {
    if (!event) return;
    async function fetchMore() {
      setLoadingMore(true);
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: list } = await supabase
          .from('big_board_events')
          .select('id, post_id, title, start_date, slug')
          .gte('start_date', todayStr)
          .neq('id', event.id)
          .order('start_date', { ascending: true })
          .limit(24);

        const enriched = await Promise.all(
          list.map(async (item) => {
            const { data: p } = await supabase
              .from('big_board_posts')
              .select('image_url')
              .eq('id', item.post_id)
              .single();
            const { data: { publicUrl } } = await supabase
              .storage.from('big-board')
              .getPublicUrl(p.image_url);
            return { ...item, imageUrl: publicUrl };
          })
        );
        setMoreEvents(enriched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMore(false);
      }
    }

    fetchMore();
  }, [event]);

  // Start editing: populate form
  const startEditing = () => {
    setFormData({
      title: event.title,
      description: event.description || '',
      link: event.link || '',
      start_date: event.start_date,
      end_date: event.end_date || '',
    });
    setIsEditing(true);
  };

  // Handle form inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((fd) => ({ ...fd, [name]: value }));
  };

  // Save edits
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        description: formData.description || null,
        link: formData.link || null,
        end_date: formData.end_date || null,
      };
      const { data: updated } = await supabase
        .from('big_board_events')
        .update(payload)
        .eq('id', event.id)
        .single();
      setEvent((ev) => ({ ...ev, ...updated }));
      setIsEditing(false);
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete event
  const handleDelete = async () => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await supabase.from('big_board_events').delete().eq('id', event.id);
      navigate('/');
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  if (loading) return <div className="py-20 text-center">Loading…</div>;
  if (error) return <div className="py-20 text-center text-red-600">{error}</div>;

  const start = parseLocalYMD(event.start_date);
  const today = new Date(); today.setHours(0,0,0,0);
  const daysDiff = Math.round((start - today)/(1000*60*60*24));
  let whenText = '';
  if (daysDiff === 0) whenText = 'Today';
  else if (daysDiff === 1) whenText = 'Tomorrow';
  else whenText = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <Helmet>
        <title>{event.title} – Our Philly</title>
        <meta name="description" content={event.description || ''} />
      </Helmet>

      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />
        <main className="flex-grow pt-24 pb-12 px-4">
          <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left panel */}
              <div className="bg-gray-50 p-8 flex flex-col items-center">
                <img src={event.imageUrl} alt={event.title} className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg" />
                <span className="mt-4 text-sm text-gray-500 self-start">
                  Posted on {new Date(event.created_at).toLocaleDateString()}
                </span>
                {event.owner_id === user?.id && !isEditing && (
                  <div className="mt-6 w-full flex flex-col space-y-3">
                    <button onClick={startEditing} className="w-full bg-indigo-600 text-white py-2 rounded-lg">Edit Event</button>
                    <button onClick={handleDelete} className="w-full bg-red-600 text-white py-2 rounded-lg">Delete Event</button>
                  </div>
                )}
              </div>

              {/* Right panel */}
              <div className="p-10">
                {isEditing ? (
                  <form onSubmit={handleSave} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Title</label>
                      <input name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea name="description" rows="3" value={formData.description} onChange={handleChange} className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Link</label>
                      <input name="link" type="url" value={formData.link} onChange={handleChange} className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Start Date</label>
                        <input name="start_date" type="date" value={formData.start_date} onChange={handleChange} required className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">End Date</label>
                        <input name="end_date" type="date" value={formData.end_date} onChange={handleChange} className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div className="flex space-x-4">
                      <button type="submit" disabled={saving} className="flex-1 bg-green-600 text-white py-2 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-gray-300 text-gray-800 py-2 rounded">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
                    <div className="mt-4 text-gray-700">
                      <h2 className="text-xl font-semibold">When?</h2>
                      <p>{whenText}</p>
                    </div>
                    {event.description && (
                      <div className="mt-6">
                        <h2 className="text-xl font-semibold">Description</h2>
                        <p className="mt-2 text-gray-700">{event.description}</p>
                      </div>
                    )}
                    {event.link && (
                      <div className="mt-6">
                        <h2 className="text-xl font-semibold">More Info</h2>
                        <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{event.link}</a>
                      </div>
                    )}
                    <div className="mt-10">
                      <Link to="/" className="text-indigo-600 hover:underline">← Back to Events</Link>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-8 mb-6 px-8">
              <TriviaTonightBanner />
            </div>

            <div className="border-t border-gray-200 mt-12 pt-8 px-8 pb-12">
              <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">More Upcoming Community Submissions</h2>
              {loadingMore ? (
                <p className="text-center text-gray-500">Loading…</p>
              ) : moreEvents.length === 0 ? (
                <p className="text-center text-gray-600">No upcoming submissions.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {moreEvents.map(ev => {
                    const dt = parseLocalYMD(ev.start_date);
                    const diff = Math.round((dt - new Date(new Date().setHours(0,0,0,0)))/(1000*60*60*24));
                    let prefix = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : dt.toLocaleDateString('en-US', { weekday: 'long' });
                    const md = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                    return (
                      <Link key={ev.id} to={`/big-board/${ev.slug}`} className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition">
                        <div className="relative h-40 bg-gray-100">
                          <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white text-xs uppercase text-center py-1">COMMUNITY SUBMISSION</div>
                          <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover object-center" />
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 text-center">{ev.title}</h3>
                          <span className="text-sm text-gray-600 text-center">{prefix}, {md}</span>
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
