// src/SurpriseModal.jsx
import React, { useEffect, useState } from 'react';

const styleVariants = [
  'bg-gradient-to-br from-yellow-100 via-white to-yellow-50',
  'bg-gradient-to-br from-pink-100 via-white to-pink-50',
  'bg-gradient-to-br from-indigo-100 via-white to-indigo-50',
  'bg-gradient-to-br from-green-100 via-white to-green-50'
];

const SurpriseModal = ({ group, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  if (!group) return null;

  const vibes = group.Vibes?.split(',').map((v) => v.trim()) || [];
  const imageUrl = group.imag;
  const groupTypes = group.Type?.split(',').map((t) => t.trim()) || [];
  const styleClass = styleVariants[Math.floor(Math.random() * styleVariants.length)];

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-w-md w-full rounded-2xl shadow-2xl p-6 text-center transform transition duration-300 ease-out scale-90 opacity-0 ${
          visible ? 'scale-100 opacity-100' : ''
        } ${styleClass}`}
      >
        <h2 className="text-3xl font-extrabold text-gray-800 mb-2">🎉 Surprise Group!</h2>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={group.Name}
            className="w-full h-48 object-cover rounded-xl mb-4"
          />
        )}
        <h3 className="text-xl font-bold text-gray-800 mb-1">{group.Name}</h3>
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {groupTypes.map((type, i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-white border text-xs font-medium text-gray-800 hover:scale-105 transition-transform">
              {type}
            </span>
          ))}
        </div>
        <p className="text-gray-700 text-base leading-relaxed mb-4">{group.Description}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {vibes.map((vibe, index) => (
            <span
              key={index}
              className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full hover:bg-gray-300 transition"
            >
              {vibe}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SurpriseModal;
