// src/EventDetailPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import GroupsList from './GroupsList';
import { AuthContext } from './AuthProvider';
import HeroLanding from './HeroLanding';
import { Helmet } from 'react-helmet';
import RecentActivity from './RecentActivity';
import OutletsList from './OutletsList';



import {
  getMyEventFavorites,
  addEventFavorite,
  removeEventFavorite,
} from './utils/eventFavorites';

export default function EventDetailPage() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);

  // ─── Event & Favorite state ─────────────────────────────────────────────
  const [event, setEvent]           = useState(null);
  const [favCount, setFavCount]     = useState(0);
  const [myFavId, setMyFavId]       = useState(null);
  const [toggling, setToggling]     = useState(false);

  // ─── Reviews state ───────────────────────────────────────────────────────
  const [reviews, setReviews]       = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // ─── New‐review form state ──────────────────────────────────────────────
  const [rating, setRating]         = useState(5);
  const [comment, setComment]       = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // ─── Edit/Delete review state ───────────────────────────────────────────
  const [editingId, setEditingId]       = useState(null);
  const [draftRating, setDraftRating]   = useState(5);
  const [draftComment, setDraftComment] = useState('');

  // ─── Lightbox modal for photos ──────────────────────────────────────────
  const [modalImage, setModalImage]     = useState(null);

  // Groups
const [suggestedGroups, setSuggestedGroups] = useState([]);
const [loadingSuggested, setLoadingSuggested] = useState(true);

 // ─── Outlets You Might Like ────────────────────────────────────────────
 const [suggestedOutlets, setSuggestedOutlets] = useState([]);  // ← new
 const [loadingOutlets, setLoadingOutlets]     = useState(true); // ← new


  // ─── 1) Load event data by slug ────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Event load error:', error);
        else setEvent(data);
      });
  }, [slug]);

   // ─── 1B) Fetch “groups you might like” with tag then Area fallback ──────
useEffect(() => {
    if (!event) return;
    setLoadingSuggested(true);
  
    (async () => {
      const tags = event.Type?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const area = event.Area?.trim();
      let suggestions = [];
  
      // 1️⃣ Try matching on tags
      if (tags.length) {
        const orFilter = tags.map(t => `Type.ilike.%${t}%`).join(',');
        const { data: byTag, error: tagErr } = await supabase
          .from('groups')
          .select('id, Name, slug, imag, Type, Area')
          .or(orFilter)
          .limit(10);
        if (tagErr) console.error('byTag error', tagErr);
        suggestions = byTag || [];
      }
  
      // 2️⃣ If fewer than 4, fill from same Area
      if (area && suggestions.length < 4) {
        const exclude = suggestions.map(g => g.id).join(',');
        const { data: byArea, error: areaErr } = await supabase
          .from('groups')
          .select('id, Name, slug, imag, Type, Area')
          .eq('Area', area)
          .not('id', 'in', `(${exclude})`)
          .limit(20 - suggestions.length);
        if (areaErr) console.error('byArea error', areaErr);
        suggestions = suggestions.concat(byArea || []);
      }
  
      // 3️⃣ Final fallback: top‑voted groups
      if (suggestions.length < 4) {
        const exclude = suggestions.map(g => g.id).join(',');
        const { data: popular, error: popErr } = await supabase
          .from('groups')
          .select('id, Name, slug, imag, Type, Area')
          .order('Votes', { ascending: false })
          .not('id', 'in', `(${exclude})`)
          .limit(4 - suggestions.length);
        if (popErr) console.error('popular error', popErr);
        suggestions = suggestions.concat(popular || []);
      }
  
      setSuggestedGroups(suggestions);
      setLoadingSuggested(false);
    })();
  }, [event]);

   // ─── 1C) Fetch “outlets you might like” ───────────────────────────────
   useEffect(() => {
    if (!event) return;
    setLoadingOutlets(true);
    supabase
      .from('news_outlets')
      .select('*')
      .eq('area', event.Area)   // match the same Area
      .limit(10)
      .then(({ data, error }) => {
        if (error) console.error('Outlets load error:', error);
        setSuggestedOutlets(data || []);
      })
      .finally(() => setLoadingOutlets(false));
  }, [event]);
  



  // ─── 2) Load favorite count & whether *I* have favorited ───────────────
  useEffect(() => {
    if (!event) return;

    // total count
    supabase
      .from('event_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .then(({ count, error }) => {
        if (!error) setFavCount(count || 0);
      });

    // my own favorite row
    if (user) {
      getMyEventFavorites().then((rows) => {
        const mine = rows.find((r) => r.event_id === event.id);
        setMyFavId(mine?.id ?? null);
      });
    } else {
      setMyFavId(null);
    }
  }, [event, user]);

  // ─── 3) Fetch & normalize reviews for this event ───────────────────────
  const loadReviews = async () => {
    setLoadingReviews(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Reviews load error:', error);
      setReviews([]);
    } else {
      // ensure photo_urls is always an array
      const normalized = data.map((r) => {
        let urls = [];
        if (Array.isArray(r.photo_urls)) {
          urls = r.photo_urls;
        } else if (r.photo_urls) {
          try {
            const parsed = JSON.parse(r.photo_urls);
            if (Array.isArray(parsed)) urls = parsed;
          } catch { /* ignore */ }
        }
        return { ...r, photo_urls: urls };
      });
      setReviews(normalized);
    }
    setLoadingReviews(false);
  };

  useEffect(() => {
    if (event) loadReviews();
  }, [event]);

  // ─── 4) Toggle favorite on/off ──────────────────────────────────────────
  const toggleFav = async () => {
    if (!user || !event) return;
    setToggling(true);
    if (myFavId) {
      await removeEventFavorite(myFavId);
      setMyFavId(null);
      setFavCount((c) => c - 1);
    } else {
      const newRow = await addEventFavorite(event.id);
      setMyFavId(newRow.id);
      setFavCount((c) => c + 1);
    }
    setToggling(false);
  };

  // ─── 5) Post a new review (with optional photos) ───────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert('Log in to leave a review.');
    setSubmitting(true);

    // upload each photo and collect its public URL
    const photoUrls = [];
    for (let file of photoFiles) {
      const name = file.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
      const path = `${event.id}-${Date.now()}-${name}`;
      const { error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(path, file);
      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('One of the uploads failed.');
        setSubmitting(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('event-photos')
        .getPublicUrl(path);
      photoUrls.push(publicUrl);
    }

    // insert the review row
    const { error } = await supabase.from('reviews').insert({
      event_id:   event.id,
      user_id:    user.id,
      rating,
      comment,
      photo_urls: photoUrls,
    });

    setSubmitting(false);
    if (error) console.error('Review insert error:', error);
    else {
      // clear form & reload
      setComment('');
      setRating(5);
      setPhotoFiles([]);
      loadReviews();
    }
  };

  // ─── 6) Start editing an existing review ───────────────────────────────
  const startEdit = (r) => {
    setEditingId(r.id);
    setDraftComment(r.comment);
    setDraftRating(r.rating);
  };

  // ─── 7) Save edits to a review ─────────────────────────────────────────
  const saveEdit = async () => {
    const { error } = await supabase
      .from('reviews')
      .update({ comment: draftComment, rating: draftRating })
      .eq('id', editingId);

    if (error) {
      alert('Update failed: ' + error.message);
    } else {
      setEditingId(null);
      loadReviews();
    }
  };

  // ─── 8) Delete a review ────────────────────────────────────────────────
  const deleteReview = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);
    if (error) alert('Delete failed: ' + error.message);
    else loadReviews();
  };

  // ─── Helpers ───────────────────────────────────────────────────────────
  const alreadyReviewed = user && reviews.some((r) => r.user_id === user.id);
  const photoReviews = reviews.filter((r) => r.photo_urls.length > 0);

  // ─── Loading state ────────────────────────────────────────────────────
  if (!event) {
    return <div className="text-center py-20 text-gray-500">Loading…</div>;
  }

  // nicely format event date(s)
  const formatDate = (raw) =>
    new Date(raw).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  let dateDisplay = formatDate(event.Dates);
  if (event['End Date'] && event['End Date'] !== event.Dates) {
    dateDisplay = `${dateDisplay} – ${formatDate(event['End Date'])}`;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{`${event['E Name']} – ${dateDisplay} – Our Philly`}</title>
        <meta name="description" content={event['E Description']} />
        <meta property="og:description" content={event['E Description']} />
        <meta property="article:published_time" content={event.Dates} />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />

      {/* ── Hero / Banner ────────────────────────────────────────────────── */}
      <div className="relative w-full h-[600px] md:h-[700px]">
        <img
          src={event['E Image']}
          alt={event['E Name']}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute top-4 left-4 bg-yellow-400 px-5 py-2 text-xl font-bold text-white rounded-full">
          {dateDisplay}
        </div>

        {/* Title/Subtitle */}
        <div className="absolute bottom-6 left-6 text-white max-w-2xl">
          <h1 className="text-5xl font-[Barrio] mb-3">{event['E Name']}</h1>
          <p className="text-xl mb-4">{event['E Description']}</p>
          {event['E Link'] && (
            <a
              href={event['E Link']}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-black px-4 py-2 rounded-full text-sm"
            >
              Visit Event Site
            </a>
          )}
        </div>

        {/* Favorite heart + count */}
        <div className="absolute bottom-6 right-6 text-white flex items-center gap-2">
          <button onClick={toggleFav} disabled={toggling} className="text-5xl">
            {myFavId ? '❤️' : '🤍'}
          </button>
          <span className="text-5xl font-[Barrio]">{favCount}</span>
        </div>
      </div>

      <RecentActivity />

     {/* ── Sleek Details Section ──────────────────────────────────────────── */}
<section className="max-w-screen-md mx-auto px-4 py-6">
  <div className="prose prose-gray">
    {/* Overline */}
    <p className="text-xs font-semibold uppercase text-indigo-600 mb-2">
      Event Details
    </p>
    <dl className="space-y-6">
      {event.time && (
        <div>
          <dt className="flex items-center text-sm font-medium text-gray-700">
            <svg
              className="w-4 h-4 mr-1 text-indigo-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 2v4h3a1 1 0 110 2H9V4a1 1 0 112 0z" />
            </svg>
            Time
          </dt>
          <dd className="mt-1 text-base text-gray-600">
            {event.time}
          </dd>
        </div>
      )}

      {event.longDescription && (
        <div>
          <dt className="text-sm font-medium text-gray-700">
            Summary
          </dt>
          <dd className="mt-1 text-base text-gray-700 leading-relaxed">
            {event.longDescription}
          </dd>
        </div>
      )}
    </dl>
  </div>
</section>




      {/* ── Photo Gallery (flat array of all user‐uploaded pics) ───────────── */}
      {photoReviews.length > 0 && (
        <div className="max-w-screen-xl mx-auto py-10 px-4">
          <div className="overflow-x-auto">
            <div className="flex space-x-4">
              {photoReviews
                .flatMap((r) => r.photo_urls)
                .slice(0, 15)           // limit display to first 15
                .map((url) => (
                  <div
                    key={url}
                    className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => setModalImage(url)}
                  >
                    <img
                      src={url}
                      alt="User photo"
                      className="w-full h-full object-cover hover:scale-105 transition"
                    />
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Reviews Section ────────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto py-12 px-4 mb-30">
        <h2 className="text-2xl font-[Barrio] mb-6">Reviews</h2>

        {/* list existing */}
        {loadingReviews
          ? <p>Loading reviews…</p>
          : reviews.map((r) => (
            <div key={r.id} className="mb-6 bg-white shadow-md rounded-xl p-6">
              {/* If this review is in “edit” mode */}
              {editingId === r.id ? (
                <>
                  {/* Rating editor */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Edit Rating</label>
                    <div className="flex space-x-2">
                      {[1,2,3,4,5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDraftRating(n)}
                          className={`text-2xl ${
                            n <= draftRating ? 'text-yellow-500' : 'text-gray-300'
                          }`}
                        >★</button>
                      ))}
                    </div>
                  </div>

                  {/* Comment editor */}
                  <textarea
                    rows={3}
                    className="w-full border rounded p-2 mb-3"
                    value={draftComment}
                    onChange={(e) => setDraftComment(e.target.value)}
                  />

                  {/* Save / Cancel */}
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="px-4 py-2 bg-blue-600 text-white rounded"
                    >Save</button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-gray-300 rounded"
                    >Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  {/* Display stars */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-yellow-500 text-xl font-[Barrio]">
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </span>
                    <time className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="text-gray-700 mb-3">{r.comment}</p>

                  {/* Photo thumbnails on each review */}
                  {r.photo_urls.length > 0 && (
                    <div className="flex space-x-2 mb-3">
                      {r.photo_urls.map((url) => (
                        <div
                          key={url}
                          className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer"
                          onClick={() => setModalImage(url)}
                        >
                          <img
                            src={url}
                            alt="Review"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edit/Delete only if it’s my review */}
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
        ))}

        {/* No reviews placeholder */}
        {(!loadingReviews && reviews.length === 0) && (
          <p className="text-sm text-gray-500">No reviews yet.</p>
        )}

        {/* ── New‐Review Form ──────────────────────────────────────────────── */}
        {user ? (
          alreadyReviewed ? (
            <p className="mt-6 text-center text-gray-600">
              You’ve already reviewed this event.
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 bg-white p-6 rounded-xl shadow-md space-y-6"
            >
              {/* Rating picker */}
              <div>
                <label className="block text-sm font-medium mb-2">Your Rating</label>
                <div className="flex space-x-2">
                  {[1,2,3,4,5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`text-2xl ${
                        n <= rating ? 'text-yellow-500' : 'text-gray-300'
                      }`}
                    >★</button>
                  ))}
                </div>
              </div>

              {/* Comment box */}
              <div>
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-300"
                  rows={4}
                  placeholder="Share your experience…"
                />
              </div>

              {/* Photo uploader */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Upload Photos (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const valid = files.filter((f) => f.type.startsWith('image/'));
                    if (valid.length !== files.length) {
                      alert('Non-image files ignored');
                    }
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
            <Link to="/login" className="text-indigo-600 hover:underline">
              Log in
            </Link>{' '}
            to leave a review.
          </p>
        )}

        {/* ── Photo Modal Lightbox ──────────────────────────────────────────── */}
        {modalImage && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
            onClick={() => setModalImage(null)}
          >
            <img
              src={modalImage}
              alt="Enlarged"
              className="max-w-full max-h-[90vh] rounded-lg border-4 border-white shadow-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        
      </main>
      
      <section className="w-full bg-neutral-100 pt-12 pb-12">
  <h2 className="text-4xl text-center font-[Barrio] mb-6">
    Groups You Might Like
  </h2>

  {/* full-bleed wrapper, no px-4 on any parent */}
  <div className="relative w-full left-1/2 right-1/2 mx-[-50vw] overflow-x-auto overflow-y-hidden">
    <div className="flex space-x-4 flex-nowrap px-4">
      {loadingSuggested
        ? <p className="text-center w-full">Loading suggestions…</p>
        : <GroupsList groups={suggestedGroups} isAdmin={false} />
      }
    </div>
  </div>
</section>



 {/* ── Outlets You Might Like ──────────────────────────────────────────── */}
 {suggestedOutlets.length > 0 && (
        <section className="w-full bg-neutral-100 pt-12 pb-12">
          <div className="relative w-screen left-1/2 right-1/2 mx-[-50vw] overflow-x-auto overflow-y-hidden">
            <div className="flex space-x-4 flex-nowrap px-4">
              {loadingOutlets ? (
                <p className="text-center w-full">Loading…</p>
              ) : (
                <OutletsList outlets={suggestedOutlets} isAdmin={false} />
              )}
            </div>
          </div>
        </section>
      )}

      


     
      <HeroLanding />
      <Footer />

    </div>
    
  );
}
