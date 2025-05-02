// src/EventDetailPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import HeroLanding from './HeroLanding';
import { Helmet } from 'react-helmet';

import {
  getMyEventFavorites,
  addEventFavorite,
  removeEventFavorite,
} from './utils/eventFavorites';

export default function EventDetailPage() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [favCount, setFavCount] = useState(0);
  const [myFavId, setMyFavId] = useState(null);
  const [toggling, setToggling] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [modalImage, setModalImage] = useState(null);

  // Load event data
  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setEvent(data);
      });
  }, [slug]);

  // Favorites count & status
  useEffect(() => {
    if (!event) return;
    supabase
      .from('event_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .then(({ count }) => setFavCount(count || 0));

    if (user) {
      getMyEventFavorites().then((rows) => {
        const mine = rows.find((r) => r.event_id === event.id);
        setMyFavId(mine?.id ?? null);
      });
    } else {
      setMyFavId(null);
    }
  }, [event, user]);

  // Load and normalize reviews
  const loadReviews = () => {
    supabase
      .from('reviews')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
        } else {
          // Ensure photo_urls is always an array
          const normalized = data.map((r) => {
            let urls = [];
            if (Array.isArray(r.photo_urls)) {
              urls = r.photo_urls;
            } else if (r.photo_urls) {
              try {
                urls = JSON.parse(r.photo_urls);
                if (!Array.isArray(urls)) urls = [];
              } catch {
                urls = [];
              }
            }
            return { ...r, photo_urls: urls };
          });
          setReviews(normalized);
        }
      });
  };

  useEffect(() => {
    if (event) loadReviews();
  }, [event]);

  // Toggle favorite
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

  // Submit review with multiple photos
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert('Log in to leave a review.');
    setSubmitting(true);

    const photoUrls = [];
    for (let file of photoFiles) {
      const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
      const path = `${event.id}-${Date.now()}-${safeName}`;
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

    const { error } = await supabase.from('reviews').insert({
      event_id: event.id,
      user_id: user.id,
      rating,
      comment,
      photo_urls: photoUrls,
    });

    setSubmitting(false);
    if (error) console.error(error);
    else {
      setComment('');
      setRating(5);
      setPhotoFiles([]);
      loadReviews();
    }
  };

  const alreadyReviewed = user && reviews.some((r) => r.user_id === user.id);
  const photoReviews = reviews.filter((r) => Array.isArray(r.photo_urls) && r.photo_urls.length);

  if (!event) {
    return <div className="text-center py-20 text-gray-500">Loading…</div>;
  }

  const formatDate = (raw) =>
    new Date(raw).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  let dateDisplay = '';
  if (event.Dates && event['End Date'] && event.Dates !== event['End Date']) {
    dateDisplay = `${formatDate(event.Dates)} – ${formatDate(event['End Date'])}`;
  } else {
    dateDisplay = formatDate(event.Dates);
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
        <Helmet>
            <title>{`${event['E Name']} – ${dateDisplay} – Our Philly`}</title>            <meta name="description" content={event['E Description']} />
            <meta property="og:description" content={event['E Description']} />
            <meta property="article:published_time" content={event.Dates} />
            <link rel="icon" href="/favicon.ico" />
        </Helmet>
      <Navbar />

      {/* Hero Section */}
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
        <div className="absolute bottom-6 right-6 text-white flex items-center gap-2">
          <button onClick={toggleFav} disabled={toggling} className="text-5xl">
            {myFavId ? '❤️' : '🤍'}
          </button>
          <span className="text-5xl font-[Barrio]">{favCount}</span>
        </div>
      </div>

      {/* Photo Gallery */}
      {photoReviews.length > 0 && (
        <div className="max-w-screen-xl mx-auto py-10 px-4">
          <h2 className="text-2xl font-[Barrio] mb-4 text-gray-800">Your Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photoReviews.flatMap((r) =>
              r.photo_urls.map((url) => (
                <div
                  key={url}
                  className="aspect-square overflow-hidden rounded-lg cursor-pointer"
                  onClick={() => setModalImage(url)}
                >
                  <img
                    src={url}
                    alt="User photo"
                    className="w-full h-full object-cover hover:scale-105 transition"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Reviews & Form */}
      <main className="max-w-screen-xl mx-auto py-12 px-4 mb-40">
        <h2 className="text-2xl font-[Barrio] mb-6">Reviews</h2>
        <div className="space-y-6">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white shadow-md rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-800">
                  {r.user_id === user?.id ? 'You' : 'Stranger'}
                </span>
                <span className="text-yellow-500 text-xl font-[Barrio]">
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </span>
              </div>
              <p className="text-gray-700 mb-3">{r.comment}</p>
              {Array.isArray(r.photo_urls) && r.photo_urls.length > 0 && (
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
              <div className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          ))}

          {reviews.length === 0 && (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          )}
        </div>

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
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium mb-2">Your Rating</label>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`text-2xl ${
                        n <= rating ? 'text-yellow-500' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-300"
                  rows={4}
                  placeholder="Share your experience…"
                />
              </div>

              {/* Multiple Photo Upload */}
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
                      alert('Some files were not images and have been ignored.');
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

        {/* Image Modal */}
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

      <HeroLanding />
      <Footer />
    </div>
  );
}
