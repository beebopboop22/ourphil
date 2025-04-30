// src/Bulletin.jsx
import React, { useState } from 'react';

const initialUpdates = [
  {
    id: 1,
    title: 'Phillies Game Tonight',
    preview: 'First pitch at 6:40 PM vs. Cubs.',
    details: 'Join the Philly faithful at Citizens Bank Park as the Phillies face off against the Chicago Cubs. Great weather expected — perfect evening for a ballgame.'
  },
  {
    id: 2,
    title: 'Free Jazz Concert',
    preview: 'Clark Park hosts an outdoor show.',
    details: 'This Saturday at 3 PM, enjoy a live jazz performance by local artists in Clark Park. Bring a blanket, snacks, and friends. Free and open to the public.'
  },
  {
    id: 3,
    title: 'Home Show Tomorrow',
    preview: 'DIY + local vendors at the Armory.',
    details: 'The Philadelphia Home Show returns this weekend at the 23rd Street Armory. Discover local makers, DIY workshops, and exclusive show-only discounts on home goods and renovation services.'
  },
  {
    id: 4,
    title: 'Union Game Saturday',
    preview: 'Tailgate kicks off at 5PM.',
    details: 'Catch the Philadelphia Union in action at Subaru Park this Saturday night. Tailgate with the Sons of Ben and cheer on Philly’s soccer squad.'
  },
];

const Bulletin = () => {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="max-w-screen-md mx-auto py-12 px-4 bg-white">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 font-[Barrio]">Community Bulletin</h1>
      <div className="divide-y divide-gray-200">
        {initialUpdates.map((update) => (
          <div
            key={update.id}
            className="py-4 cursor-pointer hover:bg-gray-50 transition"
            onClick={() => setExpandedId(expandedId === update.id ? null : update.id)}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">{update.title}</h2>
              <span className="text-gray-400 text-sm">{expandedId === update.id ? '▲' : '▼'}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{update.preview}</p>
            {expandedId === update.id && (
              <p className="text-sm text-gray-700 mt-3">{update.details}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bulletin;
