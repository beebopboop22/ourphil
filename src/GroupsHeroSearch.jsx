import React, { useEffect, useState } from 'react';

/**
 * GroupsHeroSearch
 * ----------------
 * A search bar with rotating placeholder text and concise guidance.
 * Props:
 * - searchTerm: current search string
 * - setSearchTerm: setter for searchTerm
 * - onAddClick: callback to open the "Add Group" modal
 */
export default function GroupsHeroSearch({ searchTerm, setSearchTerm, onAddClick }) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const suggestions = ['running', 'queer', 'chess', 'books', 'pickleball', 'crochet'];

  // Rotate placeholder suggestions
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % suggestions.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pt-8 text-center">
      

      {/* Search input with pill-shaped button */}
      <div className="mx-auto mb-6 flex max-w-2xl">
        <input
          type="text"
          placeholder={`Try "${suggestions[placeholderIndex]}"`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-l-full border-2 border-gray-300 px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        <button
          onClick={() => {} }
          className="rounded-r-full bg-indigo-600 px-6 py-4 text-sm text-white hover:bg-indigo-700 transition"
        >
          Search
        </button>

       
      </div>

       
    </div>
  );
}