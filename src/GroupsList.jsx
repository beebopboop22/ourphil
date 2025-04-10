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

  const filteredGroups = groups.filter(group => {
    const name = group.Name?.toLowerCase() || '';
    return (
      name.includes(searchTerm.trim().toLowerCase()) &&
      (selectedType === '' || group.Type?.includes(selectedType))
    );
  });

  const featuredGroups = (searchTerm || selectedType) ? [] : filteredGroups.filter(group => group.featured);
  const otherGroups = filteredGroups.filter(group => !group.featured);

  return (
    <div className="relative py-20 px-4 mt-12 overflow-hidden bg-neutral-50">

      {/* Big Heart Logo */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png"
        alt="Philly Heart"
        className="absolute opacity-10 rotate-12 w-[600px] bottom-[-100px] right-[-100px] pointer-events-none z-0"
      />

      <div className="relative max-w-screen-xl mx-auto z-10 text-center">

        <h2 className="text-5xl font-[Barrio] text-gray-800 mb-3">Active Communities</h2>
        <p className="text-gray-600 text-md mb-8 max-w-2xl mx-auto">
          Groups, crews & secret societies hiding in plain sight.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow px-4 py-2 border border-gray-300 rounded-full max-w-xs"
          />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-full"
          >
            <option value="">All Types</option>
            {allTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Featured */}
        {featuredGroups.length > 0 && (
          <div className="mb-12">
            <h3 className="text-yellow-500 text-2xl font-bold mb-2">🌟 Bobo's Picks</h3>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {featuredGroups.map(group => (
                <GroupCard key={group.id} group={group} isAdmin={isAdmin} featuredGroupId={featuredGroupId} />
              ))}
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <button
            onClick={() => setShowSubmitModal(true)}
            className="bg-white border border-gray-200 text-gray-700 rounded-2xl p-6 flex flex-col justify-center items-center hover:shadow-md transition w-full h-full"
          >
            <div className="text-4xl mb-2">➕</div>
            <p className="text-sm font-semibold">Add a Group</p>
          </button>

          {otherGroups.slice(0, visibleCount).map((group, idx) => (
            <GroupCard
              key={group.id || idx}
              group={group}
              isAdmin={isAdmin}
              featuredGroupId={featuredGroupId}
            />
          ))}
        </div>

        {visibleCount < otherGroups.length && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setVisibleCount(prev => prev + 8)}
              className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50"
            >
              Show More
            </button>
          </div>
        )}

        {showSubmitModal && (
          <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
        )}
      </div>
    </div>
  );
};

export default GroupsList;

