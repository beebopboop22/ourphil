import React, { useEffect, useState } from 'react';

const GroupsHeroSearch = ({
  searchTerm,
  setSearchTerm,
  selectedType,
  setSelectedType,
  allGroups,
}) => {
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
    allGroups.forEach((group) => {
      const types = group.Type?.split(',').map((t) => t.trim()) || [];
      types.forEach((type) => typeSet.add(type));
    });
    setAllTypes(Array.from(typeSet).sort());

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [allGroups]);

  // Toggle type in multi-select array
  const toggleType = (type) => {
    if (selectedType.includes(type)) {
      setSelectedType(selectedType.filter((t) => t !== type));
    } else {
      setSelectedType([...selectedType, type]);
    }
  };

  return (
    <div className="relative pt-20 text-center bg-white overflow-hidden">
      <div className="relative z-10">
        <h1 className="text-6xl font-[Barrio] text-gray-900 mb-4">
          Find Your Philly Crew
        </h1>

        <p className="text-gray-600 max-w-xl mx-auto mb-10 text-lg">
          Search real groups made by real people doing cool stuff in Philly.
        </p>

        {/* 🔍 Search Input */}
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

        {/* 🏷️ Type Filters */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {allTypes.map((type) => {
            const isActive = selectedType.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`px-4 py-2 rounded-full text-sm border transition ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>

        {/* ❌ Clear Filter */}
        {selectedType.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setSelectedType([])}
              className="text-sm text-indigo-600 hover:underline"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsHeroSearch;
