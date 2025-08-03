// src/ReviewPhotoGrid.jsx
import React, { useState } from 'react';

export default function ReviewPhotoGrid({ photos = [] }) {
  const [active, setActive] = useState(null);
  const items = photos.slice(0, 20);

  if (items.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4">
          {items.map((url, i) => (
            <button
              key={url + i}
              className="relative w-40 h-56 flex-shrink-0 overflow-hidden rounded-lg focus:outline-none"
              onClick={() => setActive(url)}
            >
              <img
                src={url}
                alt={`Review photo ${i + 1}`}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 hover:scale-105"
              />
            </button>
          ))}
        </div>
      </div>
      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setActive(null)}
        >
          <img src={active} alt="Review" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
