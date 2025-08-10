// src/EventDetailPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import { Helmet } from 'react-helmet';
import FloatingAddButton from './FloatingAddButton';
import PostFlyerModal from './PostFlyerModal';
import HeroLanding from './HeroLanding';
import GroupMatchPromo from './GroupMatchPromo';
import GroupMatchWizard from './GroupMatchWizard';
import SubmitGroupModal from './SubmitGroupModal';
import TaggedEventScroller from './TaggedEventsScroller';
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
import ReviewPhotoGrid from './ReviewPhotoGrid';

export default function EventDetailPage() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // ─── State ───────────────────────────────────────────────────────────
  const [event, setEvent] = useState(null);
  const [favCount, setFavCount] = useState(0);

  const {
    isFavorite,
    toggleFavorite,
    loading: toggling,
  } = useEventFavorite({ event_id: event?.id, source_table: 'events' })

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');

  const [modalImage, setModalImage] = useState(null);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);

  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);
  const [tagMap, setTagMap] = useState({});
  const [eventTags, setEventTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const openAddGroup = () => {
    setShowMatchModal(false);
    setShowSubmitModal(true);
  };
  const reviewPhotoUrls = React.useMemo(() =>
    reviews.flatMap(r => r.photo_urls || []),
  [reviews]);

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

  // ─── Helpers ─────────────────────────────────────────────────────────
  function parseDateStr(str) {
    if (!str) return null;
    if (str.includes('/')) {
      const [m, d, y] = str.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function getFriendlyDate(str) {
    const d = parseDateStr(str);
    if (!d) return '';
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d - today) / (1000*60*60*24));
    let prefix;
    if (diff === 0) prefix = 'Today';
    else if (diff === 1) prefix = 'Tomorrow';
    else if (diff > 1 && diff < 7)
      prefix = `This ${d.toLocaleDateString('en-US',{ weekday:'long' })}`;
    else if (diff >= 7 && diff < 14)
      prefix = `Next ${d.toLocaleDateString('en-US',{ weekday:'long' })}`;
    else
      prefix = d.toLocaleDateString('en-US',{ weekday:'long' });
    const md = d.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
    return `${prefix}, ${md}`;
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

  // ─── Load event, favorites & community subs ───────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) console.error(error);
      else setEvent(data);
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!event) return;
    supabase
      .from('taggings')
      .select('tags(name,slug)')
      .eq('taggable_type', 'events')
      .eq('taggable_id', event.id)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setEventTags([]);
        } else {
          setEventTags((data || []).map(r => r.tags));
        }
      });
  }, [event]);

  // load all tags for "Explore" section
  useEffect(() => {
    supabase
      .from('tags')
      .select('name,slug')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('tags load error', error);
        else setAllTags(data || []);
      });
  }, []);

  useEffect(() => {
    async function fetchGroups() {
      const { data, error } = await supabase.from('groups').select('*');
      if (!error) setGroups(data || []);
    }
    fetchGroups();
  }, []);

  useEffect(() => {
    if (!event) return;

    // favorite count
    supabase
      .from('event_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .then(({ count, error }) => {
        if (!error) setFavCount(count || 0);
      });

    // upcoming community submissions
    (async () => {
      const today = new Date().toISOString().slice(0,10);
      const { data: list, error } = await supabase
        .from('big_board_events')
        .select('id,post_id,title,start_date,slug')
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(24);
      if (error) {
        console.error(error);
        setMoreEvents([]);
        setLoadingMore(false);
        return;
      }
      const enriched = await Promise.all(
        list.map(async ev => {
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
      setMoreEvents(enriched);
      setLoadingMore(false);
    })();
  }, [event, user]);

  // ─── Load tags for community cards ────────────────────────────────────
  useEffect(() => {
    if (!moreEvents.length) return;
    const ids = moreEvents.map(ev => String(ev.id));
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
        setTagMap(map);
      });
  }, [moreEvents]);

  // ─── Favorite toggle ─────────────────────────────────────────────────
  const toggleFav = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!event) return;
    const wasFav = isFavorite;
    await toggleFavorite();
    setFavCount(c => (wasFav ? c - 1 : c + 1));
  };

  // ─── Reviews ─────────────────────────────────────────────────────────
  const loadReviews = async () => {
    setLoadingReviews(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at',{ ascending: false });
    if (error) {
      console.error(error);
      setReviews([]);
    } else {
      setReviews(data.map(r => {
        let urls = Array.isArray(r.photo_urls) ? r.photo_urls : [];
        if (!Array.isArray(r.photo_urls) && r.photo_urls) {
          try {
            const p = JSON.parse(r.photo_urls);
            if (Array.isArray(p)) urls = p;
          } catch {}
        }
        return { ...r, photo_urls: urls };
      }));
    }
    setLoadingReviews(false);
  };
  useEffect(() => { if (event) loadReviews(); }, [event]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!user) return alert('Log in to leave a review.');
    setSubmitting(true);
    const photoUrls = [];
    for (let file of photoFiles) {
      const name = file.name.replace(/[^a-z0-9.\-_]/gi,'_').toLowerCase();
      const path = `${event.id}-${Date.now()}-${name}`;
      const { error: upErr } = await supabase.storage
        .from('event-photos').upload(path, file);
      if (upErr) { alert('Upload failed.'); setSubmitting(false); return; }
      const { data:{ publicUrl } } =
        supabase.storage.from('event-photos').getPublicUrl(path);
      photoUrls.push(publicUrl);
    }
    const { error } = await supabase.from('reviews').insert({
      event_id: event.id,
      user_id: user.id,
      rating, comment, photo_urls: photoUrls
    });
    setSubmitting(false);
    if (!error) {
      setComment(''); setRating(5); setPhotoFiles([]);
      loadReviews();
    }
  };

  const startEdit = r => {
    setEditingId(r.id);
    setDraftRating(r.rating);
    setDraftComment(r.comment);
  };
  const saveEdit = async () => {
    const { error } = await supabase
      .from('reviews')
      .update({ rating: draftRating, comment: draftComment })
      .eq('id', editingId);
    if (!error) { setEditingId(null); loadReviews(); }
    else alert('Update failed: ' + error.message);
  };
  const deleteReview = async id => {
    if (!window.confirm('Delete this review?')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (!error) loadReviews(); else alert('Delete failed.');
  };
  const alreadyReviewed = user && reviews.some(r => r.user_id === user.id);

  if (!event) {
    return <div className="py-20 text-center text-gray-500">Loading…</div>;
  }

  // ─── Build displayDate ───────────────────────────────────────────────
  const sd = parseDateStr(event.Dates);
  const ed = parseDateStr(event['End Date']);
  const singleDay = !ed || ed.getTime() === sd.getTime();
  const displayDate = singleDay
    ? getFriendlyDate(event.Dates)
    : `${sd.toLocaleDateString('en-US',{ month:'long', day:'numeric' })} — ${ed.toLocaleDateString('en-US',{ month:'long', day:'numeric' })}`;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Helmet>
        <title>{`${event['E Name']} – ${displayDate} – Our Philly`}</title>
        <meta name="description" content={event['E Description']} />
        <link rel="canonical" href={`https://ourphilly.org/events/${slug}`} />
      </Helmet>
      {/* JSON-LD structured data */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: event['E Name'],
          startDate: event['E Start Date'],
          endDate: event['E End Date'] || event['E Start Date'],
          description: event['E Description'],
          image: [event['E Image']],
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: event['E Address'] || 'Philadelphia',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Philadelphia',
              addressRegion: 'PA',
              addressCountry: 'US',
            },
          },
          organizer: {
            '@type': 'Organization',
            name: 'Our Philly',
            url: 'https://ourphilly.org',
          },
        })}
      </script>

      <Navbar />

      <main className="flex-grow">
        {/* Hero */}
        <div
          className="relative w-full h-screen bg-cover bg-center flex items-end"
          style={{ backgroundImage: `url(${event['E Image']})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/80" />
          <button
            onClick={toggleFav}
            disabled={toggling}
            className="absolute top-6 left-6 z-10 text-4xl"
          >
            {isFavorite ? '❤️' : '🤍'} <span className="text-2xl">{favCount}</span>
          </button>
          <div className="relative z-10 w-full max-w-4xl mx-auto p-6 pb-12 text-white text-center">
            <h1 className="text-6xl font-[Barrio] mb-4">{event['E Name']}</h1>
            <p className="text-xl mb-6">
              {displayDate}
              {event.time && ` — ${event.time}`}
            </p>
            <div className="flex justify-center gap-4 mb-6">
              {event['E Link'] && (
                <a
                  href={event['E Link']}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  Visit Site
                </a>
              )}
              <button
                onClick={toggleFav}
                disabled={toggling}
                className={`border border-indigo-600 px-4 py-2 rounded font-semibold transition-colors ${isFavorite ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
              <button
                onClick={handleShare}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded"
              >
                Share
              </button>
            </div>
            {eventTags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {eventTags.map((tag, i) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    className={`${pillStyles[i % pillStyles.length]} px-4 py-2 rounded-full text-base font-semibold hover:opacity-80 transition`}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
        </div>
        </div>
        {!user && (
          <div className="w-full bg-indigo-600 text-white text-center py-4 text-xl sm:text-2xl">
            <Link to="/login" className="underline font-semibold">Log in</Link> or <Link to="/signup" className="underline font-semibold">sign up</Link> free to add to your Plans
          </div>
        )}
        {reviewPhotoUrls.length > 0 && (
          <ReviewPhotoGrid photos={reviewPhotoUrls} />
        )}

        {/* Traditions FAQ notice */}
        <div className="max-w-4xl mx-auto mt-8 px-4">
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-center rounded-md p-4">
            <a
              href="/traditions-faq"
              onClick={() =>
                window.gtag &&
                window.gtag('event', 'cta_click', {
                  event_category: 'traditions_faq',
                  event_label: 'events_page_notice',
                })
              }
              className="font-medium underline"
            >
              Do you manage this Philly tradition? Read our FAQ for traditions hosts
            </a>
          </div>
        </div>

        {/* What to Expect */}
        {event['E Description'] && (
          <>
            <div className="max-w-4xl mx-auto mt-8 px-4">
              <div className="flex items-start gap-4">
                <img
                  src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png"
                  alt="Our Philly concierge"
                  className="w-12 h-12 mt-1"
                />
                <div>
                  <h2 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-2">What to Expect</h2>
                  <p className="text-gray-700 text-lg">{event['E Description']}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 w-3/4 mx-auto mt-6" />
          </>
        )}

        {/* Description & Image */}
        <div className="max-w-4xl mx-auto mt-8 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {event.longDescription && (
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">About this Philly Tradition</h2>
                <p className="text-gray-700">{event.longDescription}</p>
              </div>
            )}
            <div className="mb-6">
              <button
                onClick={toggleFav}
                disabled={toggling}
                className={`w-full border border-indigo-600 rounded-md py-3 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
              >
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
            </div>
          </div>
          <div>
            {event['E Image'] && (
              <img
                src={event['E Image']}
                alt={event['E Name']}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
              />
            )}
          </div>
        </div>

        {/* Reviews */}
        <section className="max-w-4xl mx-auto py-10 px-4">
          <h2 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-8">Photos, Photos, Photos</h2>
          {loadingReviews ? (
            <p>Loading reviews…</p>
          ) : reviews.length === 0 ? (
            <p className="text-gray-500">No reviews yet.</p>
          ) : (
            reviews.map(r => (
              <div key={r.id} className="mb-6 bg-white rounded-xl shadow p-6">
                {editingId === r.id ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">Edit Rating</label>
                      <div className="flex space-x-2">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            onClick={() => setDraftRating(n)}
                            className={`text-2xl ${n <= draftRating ? 'text-yellow-500' : 'text-gray-300'}`}
                          >★</button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      className="w-full border rounded p-2 mb-3"
                      value={draftComment}
                      onChange={e => setDraftComment(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-gray-300 rounded">
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-yellow-500 text-xl">
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </span>
                      <time className="text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="text-gray-700 mb-3">{r.comment}</p>
                    {r.photo_urls.length > 0 && (
                      <div className="flex space-x-2 mb-3">
                        {r.photo_urls.map(url => (
                          <div
                            key={url}
                            className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer"
                            onClick={() => setModalImage(url)}
                          >
                            <img src={url} alt="Review" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {user?.id === r.user_id && (
                      <div className="space-x-2">
                        <button
                          onClick={() => startEdit(r)}
                          className="px-2 py-1 bg-yellow-500 text-white text-sm rounded"
                        >Edit</button>
                        <button
                          onClick={() => deleteReview(r.id)}
                          className="px-2 py-1 bg-red-600 text-white text-sm rounded"
                        >Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}

          {/* Post Review Form */}
          {user ? (
            alreadyReviewed ? (
              <p className="mt-6 text-center text-gray-600">You’ve already reviewed this event.</p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 bg-white p-6 rounded-xl shadow space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Rating</label>
                  <div className="flex space-x-2">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className={`text-2xl ${n <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
                      >★</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Your Review</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    required
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-300"
                    rows={4}
                    placeholder="Share your experience…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Upload Photos (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      const valid = files.filter(f => f.type.startsWith('image/'));
                      if (valid.length !== files.length) alert('Non-image files ignored');
                      setPhotoFiles(valid);
                    }}
                    className="text-sm text-gray-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition"
                >
                  {submitting ? 'Posting…' : 'Post Review'}
                </button>
              </form>
            )
          ) : (
            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="text-indigo-600 hover:underline">Log in</Link> to leave a review.
            </p>
          )}

          {/* Image Lightbox */}
          {modalImage && (
            <div
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
              onClick={() => setModalImage(null)}
            >
              <img
                src={modalImage}
                alt="Enlarged"
                className="max-w-full max-h-[90vh] rounded-lg border-4 border-white shadow-lg"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </section>

        <hr className="my-8 border-gray-200" />

        <HeroLanding />

        <hr className="my-8 border-gray-200" />

        <div className="max-w-screen-xl mx-auto px-4">
          <GroupMatchPromo
            groups={groups}
            onStart={() => setShowMatchModal(true)}
            onAddGroup={openAddGroup}
          />
        </div>

        <hr className="my-8 border-gray-200" />

        <TaggedEventScroller
          tags={['nomnomslurp']}
          fullWidth
          header={(
            <>
              <Link
                to="/tags/nomnomslurp"
                className="text-3xl sm:text-5xl font-[Barrio] px-6 py-2 border-4 border-[#004C55] bg-[#d9e9ea] text-[#004C55] rounded-full hover:bg-gray-100"
              >
                #NomNomSlurp
              </Link>
              <span className="ml-4 text-xl">Upcoming</span>
            </>
          )}
        />

        <hr className="my-8 border-gray-200" />

        {/* More Upcoming Community Submissions */}
        <div className="border-t border-gray-200 mt-8 pt-6 px-4 pb-10 max-w-screen-xl mx-auto">
          <h2 className="text-3xl sm:text-4xl text-center font-[Barrio] text-gray-800 mb-8">
            More Upcoming Community Submissions
          </h2>
          {loadingMore ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : moreEvents.length === 0 ? (
            <p className="text-center text-gray-600">No upcoming submissions.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {moreEvents.map(ev => {
                const label = getFriendlyDate(ev.start_date);
                return (
                  <Link
                    key={ev.id}
                    to={`/big-board/${ev.slug}`}
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] overflow-hidden flex flex-col"
                  >
                    <div className="relative h-40 bg-gray-100">
                      <div className="absolute inset-x-0 bottom-0 h-6 bg-indigo-600 flex items-center justify-center z-20">
                        <span className="text-xs font-bold text-white uppercase">
                          COMMUNITY SUBMISSION
                        </span>
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
                    <div className="p-4 flex-1 flex flex-col justify-center text-center">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                        {ev.title}
                      </h3>
                      <p className="text-sm text-gray-600">{label}</p>
                      {!!tagMap[ev.id]?.length && (
                        <div className="mt-2 flex flex-wrap justify-center space-x-1">
                          {tagMap[ev.id].map((tag, i) => (
                            <Link
                              key={tag.slug}
                              to={`/tags/${tag.slug}`}
                              className={`${pillStyles[i % pillStyles.length]} text-base font-semibold px-3 py-1 rounded-full hover:opacity-80 transition`}
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

        {allTags.length > 0 && (
          <div className="my-8 text-center">
            <h3 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-6">Explore these tags</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {allTags.map((tag, i) => (
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

        {showMatchModal && (
          <GroupMatchWizard
            onClose={() => setShowMatchModal(false)}
            onAddGroup={openAddGroup}
          />
        )}
        {showSubmitModal && (
          <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
        )}
      </main>

      <Footer />
      <FloatingAddButton onClick={() => {setModalStartStep(1);setInitialFlyer(null);setShowFlyerModal(true);}} />
      <button
        onClick={() => {setModalStartStep(1);setInitialFlyer(null);setShowFlyerModal(true);}}
        className="fixed bottom-0 left-0 w-full bg-indigo-600 text-white py-4 text-center font-bold sm:hidden z-50"
      >
        Post Event
      </button>
      <PostFlyerModal
        isOpen={showFlyerModal}
        onClose={() => setShowFlyerModal(false)}
        startStep={modalStartStep}
        initialFile={initialFlyer}
      />
    </div>
  );
}