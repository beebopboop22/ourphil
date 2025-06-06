// src/BigBoardEventPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import { Helmet } from 'react-helmet';

/**
 * BigBoardEventPage
 * -----------------
 * Detailed view of a single Big Board event with edit/delete for owners.
 */
export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    start_date: '',
    end_date: '',
  });
  const [saving, setSaving] = useState(false);

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

    // 1) fetch event metadata (including description & link)
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

    // 3) resolve storage URL
    const {
      data: { publicUrl },
    } = await supabase.storage.from('big-board').getPublicUrl(post.image_url);

    setEvent({
      ...ev,
      imageUrl: publicUrl,
      owner_id: post.user_id,
    });
    setLoading(false);
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

  // Build SEO title and meta description
  const pageTitle = end
    ? `${event.title} - ${start} — ${end} - Our Philly`
    : `${event.title} - ${start} - Our Philly`;
  const metaDescription = event.description || '';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
      </Helmet>

      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />

        <main className="flex-grow pt-24 pb-12 px-4">
          <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left Column: Flyer Image */}
              <div className="bg-white-200 flex items-center justify-center p-6 md:p-8 lg:p-12">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Right Column: Details */}
              <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-between">
                {/* Top: Edit/Delete Buttons (if owner) */}
                {event.owner_id === user?.id && !isEditing && (
                  <div className="flex justify-end space-x-4 mb-6">
                    <button
                      onClick={startEditing}
                      className="bg-indigo-600 text-white text-base font-semibold px-5 py-2 rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={handleDelete}
                      className="bg-red-600 text-white text-base font-semibold px-5 py-2 rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                    >
                      Delete Event
                    </button>
                  </div>
                )}

                {/* Content Area */}
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
                        className="bg-green-600 text-white text-base font-semibold px-5 py-2 rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
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

                      {/* Dates */}
                      <p className="mt-3 text-lg text-gray-700">
                        <span className="font-medium">When:</span>{' '}
                        {end ? `${start} — ${end}` : start}
                      </p>

                      {/* Posted on */}
                      <p className="mt-1 text-sm text-gray-500">
                        Posted on {new Date(event.created_at).toLocaleDateString()}
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
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}