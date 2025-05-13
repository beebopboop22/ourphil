// src/MyPhotos.jsx

import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

export default function MyPhotos() {
  const { user } = useContext(AuthContext);
  const [photos, setPhotos] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [visibleCount, setVisibleCount] = useState(4);  // how many photos to show initially

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data: reviews, error } = await supabase
        .from('reviews')
        .select('event_id, created_at, photo_url, photo_urls')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('MyPhotos load error', error);
        return;
      }

      const all = [];
      reviews.forEach(r => {
        if (r.photo_url) {
          all.push({ url: r.photo_url, date: r.created_at });
        }
        let arr = [];
        try {
          arr = Array.isArray(r.photo_urls)
            ? r.photo_urls
            : JSON.parse(r.photo_urls || '[]');
        } catch {
          arr = [];
        }
        arr.forEach(url => {
          all.push({ url, date: r.created_at });
        });
      });

      setPhotos(all);
    })();
  }, [user]);

  if (!user) return null;

  if (photos.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">
        You haven’t uploaded any photos yet.
      </p>
    );
  }

  // only show up to visibleCount photos
  const visiblePhotos = photos.slice(0, visibleCount);

  return (
    <section className="max-w-screen-xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-[Barrio] mb-6 text-center">My Photos</h2>

      {/* grid of fixed square thumbnails */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {visiblePhotos.map((p, i) => (
          <div
            key={i}
            className="w-full aspect-square overflow-hidden rounded-lg cursor-pointer relative"
            onClick={() => setModalImage(p.url)}
          >
            <img
              src={p.url}
              alt={`Photo from ${new Date(p.date).toLocaleDateString()}`}
              className="object-cover w-full h-full"
            />
          </div>
        ))}
      </div>

      {/* 'See more' button if more photos exist */}
      {photos.length > visibleCount && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setVisibleCount(count => count + 4)}
            className="text-indigo-600 hover:underline"
          >
            See more photos
          </button>
        </div>
      )}

      {/* modal lightbox */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <img
            src={modalImage}
            alt="Enlarged"
            className="max-w-full max-h-full rounded-lg shadow-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
