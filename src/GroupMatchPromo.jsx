import React, { useEffect, useState } from 'react';

export default function GroupMatchPromo({ groups, onStart }) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-12">
      <div className="grid grid-cols-2 gap-2" aria-hidden="true">
        {current.map((src, i) => (
          <img key={i} src={src} alt="" className="h-32 w-full object-cover rounded" />
        ))}
      </div>
      <div className="text-center md:text-left">
        <h2 className="mb-4 text-3xl font-[barrio]">Find Your Group Matches</h2>
        <p className="mb-6 text-gray-700">Get instant suggestions based on your interests and neighborhood.</p>
        <button
          onClick={onStart}
          className="bg-indigo-600 text-white px-8 py-4 rounded shadow hover:bg-indigo-700"
        >
          Start Matching
        </button>
      </div>
    </div>
  );
}

