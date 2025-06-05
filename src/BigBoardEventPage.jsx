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

      <div className="flex flex-col min-h-screen bg-gray-100">
        <Navbar />

        <main className="flex-grow pt-20 pb-12 px-4">
          <div className="max-w-lg mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            {/* Flyer Image (8.5×11) */}
            <div className="w-full bg-gray-200">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-auto object-contain"
              />
            </div>

            <div className="p-6 space-y-6">
              {/* Edit/Delete buttons for owner */}
              {event.owner_id === user?.id && !isEditing && (
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={startEditing}
                    className="bg-indigo-600 text-white px-4 py-1 rounded hover:bg-indigo-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}

              {isEditing ? (
                /* Edit Form */
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Title</label>
                    <input
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      name="description"
                      rows={3}
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Link (optional)</label>
                    <input
                      type="url"
                      name="link"
                      value={formData.link}
                      onChange={handleChange}
                      placeholder="https://example.com"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      required
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      End Date (optional)
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date || ''}
                      onChange={handleChange}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 rounded border"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Display Mode */
                <>
                  {/* Title & Dates */}
                  <h1 className="text-2xl font-bold text-gray-800">{event.title}</h1>
                  <p className="text-gray-600">
                    {end ? `${start} — ${end}` : start}
                  </p>
                  <p className="text-sm text-gray-500">
                    Posted on {new Date(event.created_at).toLocaleDateString()}
                  </p>

                  {/* Description */}
                  {event.description && (
                    <div className="mt-4">
                      <h2 className="text-lg font-semibold text-gray-800 mb-1">
                        Description
                      </h2>
                      <p className="text-gray-700 leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  )}

                  {/* Link */}
                  {event.link && (
                    <div className="mt-4">
                      <h2 className="text-lg font-semibold text-gray-800 mb-1">
                        More Info
                      </h2>
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline break-all"
                      >
                        {event.link}
                      </a>
                    </div>
                  )}

                  {/* Back Link */}
                  <div className="mt-6">
                    <Link
                      to="/"
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      ← Back to More Events
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
