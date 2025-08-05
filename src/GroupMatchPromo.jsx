import React, { useEffect, useState } from 'react';

export default function GroupMatchPromo({ groups, onStart, onAddGroup }) {
  const images = groups.filter(g => g.imag).map(g => g.imag);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!images.length) return;
    const timer = setInterval(() => {
      setIndex(i => (i + 4) % images.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [images.length]);

  const current = [];
  for (let i = 0; i < 4 && i < images.length; i++) {
    current.push(images[(index + i) % images.length]);
  }

  return (
    <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
      <div className="grid grid-cols-2 gap-2" aria-hidden="true">
        {current.map((src, i) => (
          <img key={i} src={src} alt="" className="h-32 w-full object-cover rounded" />
        ))}
      </div>
      <div className="text-center md:text-left">
        <h2 className="mb-4 text-3xl font-[barrio]">Find Your Group Matches</h2>
        <p className="mb-6 text-gray-700">Get instant suggestions based on your interests and neighborhood.</p>
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
          <button
            onClick={onStart}
            className="bg-indigo-600 text-white px-8 py-4 rounded shadow hover:bg-indigo-700"
          >
            Quick Match
          </button>
          <button
            onClick={onAddGroup}
            className="bg-gray-200 text-gray-800 px-8 py-4 rounded shadow hover:bg-gray-300"
          >
            Add Your Group
          </button>
        </div>
      </div>
    </div>
  );
}

