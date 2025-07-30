// src/MainEventsDetail.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import { Helmet } from 'react-helmet';
import { RRule } from 'rrule';
import PostFlyerModal from './PostFlyerModal';
import FloatingAddButton from './FloatingAddButton';
import SubmitEventSection from './SubmitEventSection';
import TaggedEventScroller from './TaggedEventsScroller';
import useEventFavorite from './utils/useEventFavorite';

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
  const [sameDayEvents, setSameDayEvents] = useState([]);
  const [eventTags, setEventTags] = useState([]);
  const [tagsList, setTagsList] = useState([]);

  // post flyer modal state
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);
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

  const [favCount, setFavCount] = useState(0);
  const {
    isFavorite,
    toggleFavorite,
    loading: toggling,
  } = useEventFavorite({ event_id: event?.id, source_table: 'all_events' });

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

  // Share fallback
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

  // Load tags for this event
  useEffect(() => {
    if (!event) return;
    supabase
      .from('taggings')
      .select('tags(name,slug)')
      .eq('taggable_type', 'all_events')
      .eq('taggable_id', event.id)
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setEventTags((data || []).map(r => r.tags));
      });

    supabase
      .from('event_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('source_table', 'all_events')
      .eq('event_int_id', event.id)
      .then(({ count, error }) => {
        if (!error) setFavCount(count || 0)
      })
  }, [event]);

  // Load all tags for explore section
  useEffect(() => {
    supabase
      .from('tags')
      .select('id,name,slug')
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setTagsList(data || []);
      });
  }, []);

  // Load recurring events on the same day
  useEffect(() => {
    if (!event?.start_date) return;
    const start = parseLocalYMD(event.start_date);
    const dayStart = new Date(start); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(start); dayEnd.setHours(23,59,59,999);
    (async () => {
      try {
        const { data: list } = await supabase
          .from('recurring_events')
          .select('id,name,slug,image_url,start_date,start_time,end_date,rrule')
          .eq('is_active', true);
        const matches = [];
        (list || []).forEach(ev => {
          const opts = RRule.parseString(ev.rrule);
          opts.dtstart = new Date(`${ev.start_date}T${ev.start_time}`);
          if (ev.end_date) opts.until = new Date(`${ev.end_date}T23:59:59`);
          const rule = new RRule(opts);
          if (rule.between(dayStart, dayEnd, true).length) {
            matches.push(ev);
          }
        });
        setSameDayEvents(matches);
      } catch (e) {
        console.error(e);
        setSameDayEvents([]);
      }
    })();
  }, [event]);

  // Populate form on edit
  useEffect(() => {
    if (isEditing && event) {
      setFormData({
        name:        event.name        || '',
        description: event.description || '',
        link:        event.link        || '',
        start_date:  event.start_date  || '',
        end_date:    event.end_date    || '',
        start_time:  event.start_time  || '',
        end_time:    event.end_time    || '',
        address:     event.address     || '',
      });
    }
  }, [isEditing, event]);

  // Handle form field change
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };

  // Save edits
  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:        formData.name,
        description: formData.description || null,
        link:        formData.link || null,
        start_date:  formData.start_date,
        end_date:    formData.end_date   || null,
        start_time:  formData.start_time || null,
        end_time:    formData.end_time   || null,
        address:     formData.address    || null,
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

  // Delete event
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

  // Friendly date/time
  const sd = parseLocalYMD(event.start_date);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const daysDiff = Math.round((sd - today0)/(1000*60*60*24));
  const whenText =
    daysDiff === 0 ? 'Today' :
    daysDiff === 1 ? 'Tomorrow' :
    sd.toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' });
  const timeText = event.start_time ? formatTime(event.start_time) : '';
  const endTimeText = event.end_time ? formatTime(event.end_time) : '';
  const weekdayName = sd.toLocaleDateString('en-US',{ weekday:'long' });
  const metaKeywords = eventTags.map(t => t.name).join(', ');

  const gcalLink = (() => {
    const start = event.start_date.replace(/-/g, '');
    const end = (event.end_date || event.start_date).replace(/-/g, '');
    const url = window.location.href;
    return (
      'https://www.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(event.name)}` +
      `&dates=${start}/${end}` +
      `&details=${encodeURIComponent('Details: ' + url)}`
    );
  })();

  // Which address to_SEARCH for Google Maps:
  const resolvedAddress = event.address?.trim() || venueData?.address?.trim();
  // Link text is always venue name if available:
  const linkText = venueData?.name || resolvedAddress;

  return (
    <>
      <Helmet>
        <title>{`${event.name} | Our Philly Concierge`}</title>
        <meta name="description" content={(event.description||'').slice(0,155)} />
        <meta name="keywords" content={metaKeywords} />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={`${event.name} | Our Philly Concierge`} />
        <meta property="og:description" content={(event.description||'').slice(0,155)} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={window.location.href} />
        {event.image && <meta property="og:image" content={event.image} />}
        <meta name="twitter:card" content="summary_large_image" />
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
          <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8 -mt-24 transform relative">
            <button
              onClick={toggleFavorite}
              disabled={toggling}
              className="absolute left-6 top-6 text-3xl"
            >
              {isFavorite ? '❤️' : '🤍'} <span className="text-2xl">{favCount}</span>
            </button>
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">{event.name}</h1>
              <p className="text-lg font-medium">
                {whenText}
                {timeText && ` — ${timeText}`}
                {endTimeText && ` to ${endTimeText}`}
                {resolvedAddress && (
                  <> • <a
                    href={`https://maps.google.com?q=${encodeURIComponent(resolvedAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {linkText}
                  </a></>
                )}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left */}
            <div>
              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Name */}
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
                  {/* Description */}
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
                  {/* Link */}
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
                  {/* Address */}
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
                  {/* Times */}
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
                  {/* Dates */}
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
                  {/* Save / Cancel */}
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
                  <div className="mb-6 flex items-center space-x-3 bg-gray-50 border rounded-lg p-3">
                    <button onClick={toggleFavorite} disabled={toggling} className="text-2xl">
                      {isFavorite ? '❤️' : '🤍'}
                    </button>
                    <span className="text-gray-700">{favCount} people have favorited this</span>
                  </div>

                  <button
                    onClick={handleShare}
                    className="w-full bg-green-600 text-white py-3 rounded-lg shadow hover:bg-green-700 transition mb-4"
                  >
                    Share
                  </button>

                  <a
                    href={gcalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-indigo-600 text-white py-3 rounded-lg shadow hover:bg-indigo-700 transition mb-4 text-center"
                  >
                    Add to Google Calendar
                  </a>

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

          {relatedEvents.length > 0 && venueData && (
            <section className="max-w-4xl mx-auto mt-12 px-4">
              <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
                More at {venueData.name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedEvents.slice(0, 6).map(re => {
                  const dt = parseLocalYMD(re.start_date);
                  const md = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                  return (
                    <Link
                      key={re.id}
                      to={`/${venueData.slug}/${re.slug}`}
                      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] overflow-hidden flex flex-col"
                    >
                      <div className="relative h-40 bg-gray-100">
                        {re.image ? (
                          <img
                            src={re.image}
                            alt={re.name}
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
                          {re.name}
                        </h3>
                        <span className="text-sm text-gray-600">{md}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
          </section>
            )}
            <TaggedEventScroller tags={['music']} header="#Music Coming Soon" />
          {sameDayEvents.length > 0 && (
            <section className="max-w-4xl mx-auto mt-12 px-4">
                <h2 class="text-2xl text-center font-semibold text-gray-800 mb-6">
                  Every {weekdayName} in Philly
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sameDayEvents.map(ev => (
                  <Link
                    key={ev.id}
                    to={`/series/${ev.slug}/${event.start_date}`}
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
            </section>
          )}


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

          <SubmitEventSection onNext={file => { setInitialFlyer(file); setModalStartStep(2); setShowFlyerModal(true); }} />
        </main>

        <Footer/>
        <FloatingAddButton onClick={() => { setModalStartStep(1); setInitialFlyer(null); setShowFlyerModal(true); }} />
        <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} startStep={modalStartStep} initialFile={initialFlyer} />
      </div>
    </>
  );
}
