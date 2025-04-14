import React, { useEffect, useState } from 'react';

const GroupsHeroSearch = ({ searchTerm, setSearchTerm, selectedType, setSelectedType, allGroups }) => {
  const [allTypes, setAllTypes] = useState([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const placeholders = [
    'running',
    'queer',
    'chess',
    'books',
    'pickleball leagues',
    'crochet',
  ];

  useEffect(() => {
    const typeSet = new Set();
    allGroups.forEach(group => {
      const types = group.Type?.split(',').map(t => t.trim()) || [];
      types.forEach(type => typeSet.add(type));
    });
    setAllTypes(Array.from(typeSet).sort());

    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [allGroups]);

  return (
    <div className="relative py-32 px-4 text-center bg-white overflow-hidden">

      {/* Background Image */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NDY0NDI4NywiZXhwIjozNjc4MTE0MDI4N30.SWf3Byr-wbChb9R_Kbmu_pLe_1itlDL_D-i8uI8Qb5Y"
        alt="Philly Heart"
        className="fixed inset-230 w-full h-full object-contain opacity-15 scale-20 pointer-events-none"
      />

      {/* Overlay Content */}
      <div className="relative z-10">

        <h1 className="text-6xl font-[Barrio] text-gray-900 mb-4">
          Find Your Philly Crew
        </h1>

        <p className="text-gray-600 max-w-xl mx-auto mb-10 text-lg">
          Search real groups made by real people doing cool stuff in Philly.
        </p>

        <div className="flex justify-center relative max-w-xl mx-auto">
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

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-full text-sm"
          >
            <option value="">Browse by Type</option>
            {allTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {selectedType && (
            <button
              onClick={() => setSelectedType('')}
              className="text-sm text-indigo-600 hover:underline"
            >
              Clear Filter
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default GroupsHeroSearch;


