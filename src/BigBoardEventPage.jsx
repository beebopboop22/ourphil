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

/**
 * BigBoardEventPage
 * -----------------
 * Detailed view of a single Big Board event with edit/delete for owners.
 * Also shows a “More events on this day” grid below the main details.
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

  // “More events on this day” state
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

    // 1) fetch event metadata
    const { data: ev, error: evErr } = await supabase
      .from('big_board_events')
      .select(`
        id,
        post_id,
        title,
        description,
        link,
        start_date,
        end_date,
        created_at,
        slug
      `)
      .eq('slug', slug)
      .single();

    if (evErr) {
      console.error(evErr);
      setError('Could not load event.');
      setLoading(false);
      return;
    }

    // 2) fetch flyer post (to get image and owner)
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

    // 3) resolve storage URL for main event
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

    // 4) fetch “more events on this day”
    fetchMoreEvents(fullEvent.start_date, fullEvent.id);
  }

  async function fetchMoreEvents(startDate, excludeId) {
    setLoadingMore(true);

    // Query all other events with the same start_date
    const { data: list, error: listErr } = await supabase
      .from('big_board_events')
      .select(`
        id,
        post_id,
        title,
        start_date,
        end_date,
        slug
      `)
      .eq('start_date', startDate)
      .neq('id', excludeId)        // exclude current event
      .order('start_date', { ascending: true });

    if (listErr) {
      console.error(listErr);
      setLoadingMore(false);
      return;
    }

    // Resolve each event’s image_url from its post
    const enriched = await Promise.all(
      list.map(async (ev) => {
        // fetch corresponding post to get image_url
        const { data: post, error: postErr } = await supabase
          .from('big_board_posts')
          .select('image_url')
          .eq('id', ev.post_id)
          .single();
        let imageUrl = '';
        if (!postErr && post?.image_url) {
          const {
            data: { publicUrl },
          } = await supabase.storage.from('big-board').getPublicUrl(post.image_url);
          imageUrl = publicUrl;
        }
        return { ...ev, imageUrl };
      })
    );

    setMoreEvents(enriched);
    setLoadingMore(false);
  }

  // Start editing
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

  // Handle form input changes
  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((fd) => ({ ...fd, [name]: value }));
  }

  // Save edits
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);

    const updatePayload = {
      title: formData.title,
      description: formData.description || null,
      link: formData.link || null,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
    };

    const { data, error } = await supabase
      .from('big_board_events')
      .update(updatePayload)
      .eq('id', event.id)
      .select()
      .single();

    setSaving(false);
    if (error) {
      alert('Error saving event: ' + error.message);
    } else {
      setEvent({ ...event, ...data });
      setIsEditing(false);
      // If start_date changed, re-fetch “more events on this day”
      if (data.start_date !== event.start_date) {
        fetchMoreEvents(data.start_date, event.id);
      }
    }
  }

  // Delete event
  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event?')) return;
    const { error } = await supabase
      .from('big_board_events')
      .delete()
      .eq('id', event.id);
    if (error) {
      alert('Error deleting event: ' + error.message);
    } else {
      navigate('/');
    }
  }

  if (loading) return <div className="py-20 text-center">Loading…</div>;
  if (error) return <div className="py-20 text-center text-red-600">{error}</div>;
  if (!event) return <div className="py-20 text-center">Event not found.</div>;

  // Format display dates
  const startDateObj = parseLocalYMD(event.start_date);
  const endDateObj = event.end_date ? parseLocalYMD(event.end_date) : null;
  const start = startDateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const end = endDateObj
    ? endDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // SEO: page title & meta description
  const pageTitle = `${event.title} – ${end ? `${start}–${end}` : start} – OUR PHILLY`;
  const metaDescription =
    event.description ||
    `Learn more about "${event.title}" happening on ${end ? `${start}–${end}` : start}.`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />

      </Helmet>

      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />

        <main className="flex-grow pt-24 pb-12 px-4">
          <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left Column: Flyer Image + Posted On */}
              <div className="bg-gray-50 flex flex-col items-center p-6 md:p-8 lg:p-12">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                />
                <p className="mt-4 text-sm text-gray-500 self-start">
                  Posted on {new Date(event.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Right Column: Details */}
              <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-between">
                {/* Top: Edit/Delete Buttons (if owner) */}
                {event.owner_id === user?.id && !isEditing && (
                  <div className="flex flex-col items-center mb-6 space-y-3">
                    <button
                      onClick={startEditing}
                      className="w-full bg-indigo-600 text-white font-semibold px-5 py-3 rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full bg-red-600 text-white font-semibold px-5 py-3 rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                    >
                      Delete Event
                    </button>
                  </div>
                )}

                {isEditing ? (
                  /* Edit Form */
                  <form onSubmit={handleSave} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-300 rounded-md px-4 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        name="description"
                        rows={4}
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-md px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Link (optional)
                      </label>
                      <input
                        type="url"
                        name="link"
                        value={formData.link}
                        onChange={handleChange}
                        placeholder="https://example.com"
                        className="w-full border border-gray-300 rounded-md px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          name="start_date"
                          value={formData.start_date}
                          onChange={handleChange}
                          required
                          className="w-full border border-gray-300 rounded-md px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date (optional)
                        </label>
                        <input
                          type="date"
                          name="end_date"
                          value={formData.end_date || ''}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-md px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4 mt-6">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-5 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-green-600 text-white font-semibold px-5 py-2 rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Display Mode */
                  <div className="flex flex-col justify-between h-full">
                    <div>
                      {/* Title */}
                      <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                        {event.title}
                      </h1>

                      {/* Notification Box */}
                      <div className="mt-4 p-4 bg-purple-50 border-l-4 border-purple-600 rounded-md">
                        <p className="text-purple-700 text-sm">
                          This was submitted by a total stranger. Use the hovering purple plus icon to drop your
                          event on our calendar.
                        </p>
                      </div>

                      {/* Dates */}
                      <p className="mt-6 text-lg text-gray-700">
                        <span className="font-medium">When:</span>{' '}
                        {end ? `${start} — ${end}` : start}
                      </p>

                      {/* Description */}
                      {event.description && (
                        <div className="mt-8">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            Description
                          </h2>
                          <p className="text-base text-gray-700 leading-relaxed">
                            {event.description}
                          </p>
                        </div>
                      )}

                      {/* Link */}
                      {event.link && (
                        <div className="mt-8">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            More Info
                          </h2>
                          <a
                            href={event.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline text-base break-words"
                          >
                            {event.link}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Back Link */}
                    <div className="mt-10">
                      <Link
                        to="/"
                        className="inline-block text-indigo-600 hover:underline font-semibold text-base"
                      >
                        ← Back to More Events
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────
                “More events on this day” Section
            ─────────────────────────────────────────────────────────── */}
            <div className="border-t border-gray-200 mt-12 pt-8 px-8 pb-12">
              <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
                More stranger submissions for {startDateObj.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h2>

              {loadingMore ? (
                <p className="text-gray-500">Loading more events…</p>
              ) : moreEvents.length === 0 ? (
                <p className="text-gray-600">No other events on this day.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {moreEvents.map((ev) => {
                    // Format date for card
                    const cardStart = parseLocalYMD(ev.start_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });
                    const cardEnd = ev.end_date
                      ? parseLocalYMD(ev.end_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : null;

                    return (
                      <Link
                        key={ev.id}
                        to={`/big-board/${ev.slug}`}
                        className="bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] overflow-hidden flex flex-col"
                      >
                        <div className="relative h-40 bg-gray-100">
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
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-2">
                              {ev.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              📅 {cardStart}
                              
                            </p>
                          </div>
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

        {/* Floating Purple Plus for Submissions */}
        <FloatingAddButton onClick={() => setShowFlyerModal(true)} />

        {/* PostFlyerModal */}
        <PostFlyerModal
          isOpen={showFlyerModal}
          onClose={() => setShowFlyerModal(false)}
        />
      </div>
    </>
  );
}
