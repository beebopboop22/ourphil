// src/ReviewPhotoGrid.jsx
import React, { useState } from 'react';

export default function ReviewPhotoGrid({ photos = [] }) {
  const [active, setActive] = useState(null);
  const items = photos.slice(0, 24);

  if (items.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <div className="overflow-x-auto">
        <div className="grid grid-rows-2 grid-flow-col auto-cols-[120px] sm:auto-cols-[160px] gap-2">
          {items.map((url, i) => (
            <button
              key={url + i}
              className="relative w-full pb-[100%] overflow-hidden rounded-lg focus:outline-none"
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
