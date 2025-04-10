import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import GroupCard from './GroupCard';
import SubmitGroupModal from './SubmitGroupModal';

const GroupsList = ({ groups, isAdmin }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [allTypes, setAllTypes] = useState([]);
  const [typeCounts, setTypeCounts] = useState({});
  const [featuredGroupId, setFeaturedGroupId] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    if (groups.length > 0) {
      const randomGroup = groups[Math.floor(Math.random() * groups.length)];
      if (randomGroup) setFeaturedGroupId(randomGroup.id);

      const typeSet = new Set();
      const counts = {};
      groups.forEach(group => {
        const types = group.Type?.split(',').map(t => t.trim()) || [];
        types.forEach(type => {
          typeSet.add(type);
          counts[type] = (counts[type] || 0) + 1;
        });
      });
      setAllTypes(Array.from(typeSet).sort());
      setTypeCounts(counts);
    }
  }, [groups]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedType('');
  };

  const trimmedSearch = searchTerm.trim().toLowerCase();
  const trimmedType = selectedType.trim();

  const filteredGroups = groups.filter(group => {
    const name = group.Name?.toLowerCase() || '';
    const matchesSearch = name.includes(trimmedSearch);
    const matchesType = trimmedType === '' || group.Type?.includes(trimmedType);
    return matchesSearch && matchesType;
  });

  const featuredGroups = filteredGroups.filter(group => group.featured);
  const otherGroups = filteredGroups.filter(group => !group.featured);

  const groupsWithMascots = [];
  otherGroups.forEach((group, index) => {
    groupsWithMascots.push(group);
    if ((index + 1) % 12 === 0) {
      groupsWithMascots.push({ Name: '__MASCOT_INSERT__' });
    }
  });

  const visibleGroups = groupsWithMascots.slice(0, visibleCount);

  return (
    <div className="max-w-screen-xl mx-auto px-4 mt-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Groups</h2>

        <div className="w-full max-w-5xl flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
  <input
    type="text"
    placeholder="Search for a group..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="flex-grow px-5 py-3 rounded-full border border-gray-300 shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
  />
  <select
    value={selectedType}
    onChange={(e) => setSelectedType(e.target.value)}
    className="w-full sm:w-56 px-4 py-3 rounded-full border border-gray-300 shadow-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
  >
    <option value="">All Types</option>
    {allTypes.map((type) => (
      <option key={type} value={type}>{type}</option>
    ))}
  </select>
</div>


        {/* Trending chips */}
        <div className="w-full max-w-5xl mb-6">
  <div className="flex items-center gap-4 flex-wrap">
    <span className="text-sm font-medium text-gray-600">Popular group types:</span>
    {Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => (
        <button
          key={type}
          onClick={() => setSelectedType(type)}
          className={`px-3 py-1 rounded-full border text-sm font-medium transition ${
            selectedType === type
              ? 'bg-white text-indigo-600 border-white'
              : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
          }`}
        >
          {type} ({count})
        </button>
    ))}
  </div>
</div>
      </div>

      {/* Featured groups */}
      {featuredGroups.length > 0 && (
        <div className="mb-10">
          <h2 className="text-yellow-500 text-2xl font-bold mb-2">🌟 Bobo's Picks</h2>
          <p className="text-gray-600 italic mb-4">“If you're looking for groups — oh boy!”</p>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredGroups.slice(0, 4).map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isAdmin={isAdmin}
                featuredGroupId={featuredGroupId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other groups + Add button */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          onClick={() => setShowSubmitModal(true)}
          className="bg-indigo-100 text-indigo-700 rounded-2xl p-6 flex flex-col justify-center items-center hover:bg-indigo-200 transition w-full h-full"
        >
          <div className="text-4xl mb-2">➕</div>
          <p className="text-sm font-semibold">Add a Group</p>
        </button>

        {visibleGroups.map((group, idx) => (
          <GroupCard
            key={group.id || `mascot-${idx}`}
            group={group}
            isAdmin={isAdmin}
            featuredGroupId={featuredGroupId}
          />
        ))}
      </div>

      {/* Show More button */}
      {visibleCount < groupsWithMascots.length && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setVisibleCount((prev) => prev + 8)}
            className="bg-white text-indigo-700 px-6 py-2 rounded-full font-semibold shadow hover:shadow-lg hover:bg-indigo-50 transition"
          >
            Show More
          </button>
        </div>
      )}

      {showSubmitModal && (
        <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
      )}

      {/* Floating add button */}
      <button
        onClick={() => setShowSubmitModal(true)}
        className="fixed bottom-5 right-5 bg-white text-indigo-700 px-6 py-4 rounded-full shadow-xl text-base font-semibold z-50 hover:scale-105 hover:bg-indigo-50 transition-all"
      >
        + Submit a Group
      </button>
    </div>
  );
};

export default GroupsList;
