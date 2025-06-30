// src/MainEventsDetail.jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
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
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useContext(AuthContext);

  // State
  const [event, setEvent] = useState(null);
  const [venueData, setVenueData] = useState(null);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [communityEvents, setCommunityEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin / edit state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    link: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);

  // Refs for share fallback
  const copyLinkFallback = url => navigator.clipboard.writeText(url).catch(console.error);
  const handleShare = () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) navigator.share({ title, url }).catch(console.error);
    else copyLinkFallback(url);
  };

  // Fetch everything
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // main event
        const { data: evs, error: evErr } = await supabase
          .from('all_events')
          .select(`
            id, venue_id, name, description, link, image,
            start_date, end_date, start_time, end_time,
            address, created_at, slug
          `)
          .eq('slug', slug)
          .limit(1);
        if (evErr) throw evErr;
        if (!evs?.length) { setLoading(false); return; }
        const ev = evs[0];
        setEvent(ev);

        // venue
        if (ev.venue_id) {
          const { data: vens } = await supabase
            .from('venues')
            .select('id,name,slug,address')
            .eq('id', ev.venue_id)
            .limit(1);
          setVenueData(vens?.[0] || null);
        }

        // related at same venue
        if (ev.venue_id) {
          const todayStr = new Date().toISOString().slice(0,10);
          const { data: rel } = await supabase
            .from('all_events')
            .select(`id,name,slug,start_date,image`)
            .eq('venue_id', ev.venue_id)
            .gte('start_date', todayStr)
            .neq('slug', slug)
            .order('start_date',{ ascending: true })
            .limit(5);
          setRelatedEvents(rel || []);
        }

        // community subs
        const todayStr = new Date().toISOString().slice(0,10);
        const { data: list } = await supabase
          .from('big_board_events')
          .select('id,post_id,title,start_date,slug')
          .gte('start_date', todayStr)
          .neq('slug', slug)
          .order('start_date',{ ascending: true })
          .limit(24);
        if (list) {
          const enriched = await Promise.all(
            list.map(async evb => {
              const { data: p } = await supabase
                .from('big_board_posts')
                .select('image_url')
                .eq('id', evb.post_id)
                .single();
              let url = '';
              if (p?.image_url) {
                const { data:{ publicUrl }} = supabase
                  .storage.from('big-board')
                  .getPublicUrl(p.image_url);
                url = publicUrl;
              }
              return { ...evb, imageUrl: url };
            })
          );
          setCommunityEvents(enriched);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Populate form on edit
  useEffect(() => {
    if (isEditing && event) {
      setFormData({
        name:        event.name || '',
        description: event.description || '',
        link:        event.link || '',
        start_date:  event.start_date || '',
        end_date:    event.end_date || '',
        start_time:  event.start_time || '',
        end_time:    event.end_time || '',
        address:     event.address || '',
      });
    }
  }, [isEditing, event]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:        formData.name,
        description: formData.description || null,
        link:        formData.link || null,
        start_date:  formData.start_date,
        end_date:    formData.end_date || null,
        start_time:  formData.start_time || null,
        end_time:    formData.end_time || null,
        address:     formData.address || null,
      };
      const { data: updated, error } = await supabase
        .from('all_events')
        .update(payload)
        .eq('id', event.id)
        .single();
      if (error) throw error;
      setEvent(ev => ({ ...ev, ...updated }));
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await supabase.from('all_events').delete().eq('id', event.id);
      navigate('/');
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
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
      <div className="flex flex-col min-h-screen bg-white">
        <Navbar/>
        <div className="flex-grow flex items-center justify-center">
          <div className="text-2xl text-red-600">Event not found.</div>
        </div>
        <Footer/>
      </div>
    );
  }

  // Compute friendly date/time
  const sd = parseLocalYMD(event.start_date);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const daysDiff = Math.round((sd - today0)/(1000*60*60*24));
  const whenText =
    daysDiff === 0 ? 'Today' :
    daysDiff === 1 ? 'Tomorrow' :
    sd.toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' });
  const timeText = event.start_time ? formatTime(event.start_time) : '';
  const endTimeText = event.end_time ? formatTime(event.end_time) : '';

  return (
    <>
      <Helmet>
        <title>{`${event.name} | Our Philly Concierge`}</title>
        <meta name="description" content={(event.description||'').slice(0,155)} />
      </Helmet>

      <div className="flex flex-col min-h-screen bg-white">
        <Navbar/>

        <main className="flex-grow">
          {/* Hero */}
          <div
            className="w-full h-[40vh] bg-cover bg-center"
            style={{ backgroundImage: `url(${event.image})` }}
          />

          {/* Overlap Card */}
          <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8 -mt-24 transform">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">{event.name}</h1>
              <p className="text-lg font-medium">
                {whenText}
                {timeText && ` — ${timeText}`}
                {endTimeText && ` to ${endTimeText}`}
              </p>
              {event.address && (
                <p>
                  <a
                    href={`https://maps.google.com?q=${encodeURIComponent(event.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {event.address}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: description / form / related / share / admin */}
            <div>
              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      name="description"
                      rows="3"
                      value={formData.description}
                      onChange={handleChange}
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Link</label>
                    <input
                      name="link"
                      type="url"
                      value={formData.link}
                      onChange={handleChange}
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={handleChange}
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Time</label>
                      <input
                        name="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={handleChange}
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Time</label>
                      <input
                        name="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={handleChange}
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Date</label>
                      <input
                        name="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={handleChange}
                        required
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Date</label>
                      <input
                        name="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={handleChange}
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-green-600 text-white py-2 rounded disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-gray-300 text-gray-800 py-2 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {event.description && (
                    <div className="mb-6">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Description</h2>
                      <p className="text-gray-700 leading-relaxed">{event.description}</p>
                    </div>
                  )}

                  {relatedEvents.length > 0 && venueData && (
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        More at {venueData.name}
                      </h2>
                      <ul className="list-disc list-inside space-y-1">
                        {relatedEvents.map(re => (
                          <li key={re.id}>
                            <Link
                              to={`/${venueData.slug}/${re.slug}`}
                              className="text-indigo-600 hover:underline"
                            >
                              {re.name} — {parseLocalYMD(re.start_date).toLocaleDateString()}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={handleShare}
                    className="w-full bg-green-600 text-white py-3 rounded-lg shadow hover:bg-green-700 transition mb-4"
                  >
                    Share
                  </button>

                  {isAdmin && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition"
                      >
                        Edit Event
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition"
                      >
                        Delete Event
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: image */}
            <div>
              {event.image ? (
                <img
                  src={event.image}
                  alt={event.name}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-full h-[240px] bg-gray-200 rounded-lg" />
              )}
            </div>
          </div>

          {/* Community Submissions */}
          <section className="border-t border-gray-200 mt-12 pt-8 px-4 pb-12 max-w-4xl mx-auto">
            <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
              Upcoming Community Submissions
            </h2>
            {communityEvents.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming submissions.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {communityEvents.map(evb => {
                  const dt = parseLocalYMD(evb.start_date);
                  const diff = Math.round(
                    (dt - new Date(new Date().setHours(0,0,0,0))) /
                    (1000*60*60*24)
                  );
                  const prefix =
                    diff === 0 ? 'Today' :
                    diff === 1 ? 'Tomorrow' :
                    dt.toLocaleDateString('en-US',{ weekday:'long' });
                  const md = dt.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
                  return (
                    <Link
                      key={evb.id}
                      to={`/big-board/${evb.slug}`}
                      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] overflow-hidden flex flex-col"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1 z-20">
                          COMMUNITY SUBMISSION
                        </div>
                        {evb.imageUrl ? (
                          <img
                            src={evb.imageUrl}
                            alt={evb.title}
                            className="w-full h-full object-cover object-center"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-center text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                          {evb.title}
                        </h3>
                        <span className="text-sm text-gray-600">
                          {prefix}, {md}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <Footer/>
      </div>
    </>
  );
}
