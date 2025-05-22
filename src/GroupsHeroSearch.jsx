// src/GroupsHeroSearch.jsx
import React, { useEffect, useState } from 'react';

export default function GroupsHeroSearch({
  searchTerm,
  setSearchTerm,
  selectedType,
  setSelectedType,
  allGroups,
}) {
  const [allTypes, setAllTypes] = useState([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const placeholders = [
    'running',
    'queer',
    'chess',
    'books',
    'pickleball leagues',
    'crochet',
  ];

  useEffect(() => {
    // Derive unique types from allGroups
    const typeSet = new Set();
    allGroups.forEach((group) => {
      const types = group.Type?.split(',').map((t) => t.trim()) || [];
      types.forEach((type) => typeSet.add(type));
    });
    setAllTypes(Array.from(typeSet).sort());

    // Animated placeholder cycling
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [allGroups]);

  const toggleType = (type) => {
    if (selectedType.includes(type)) {
      setSelectedType(selectedType.filter((t) => t !== type));
    } else {
      setSelectedType([...selectedType, type]);
    }
  };

  return (
    <div className="relative pt-20 text-center bg-white">
      {/* Page title and description */}
      
      

      {/* Search input */}
      <div className="flex justify-center relative max-w-xl mx-auto mb-6">
        <input
          type="text"
          placeholder={`Try "${placeholders[placeholderIndex]}"`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-lg px-6 py-4 border-2 border-gray-300 rounded-full shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        <button
          onClick={() => {}}
          className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 text-white text-sm rounded-full hover:bg-indigo-700 transition"
        >
          Search
        </button>
      </div>

      

    </div>
  );
}
