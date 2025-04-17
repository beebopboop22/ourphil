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
  const [visibleCount, setVisibleCount] = useState(12);

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

  const featuredGroups = (!searchTerm && !selectedType) ? filteredGroups.filter(group => group.featured) : [];
  const otherGroups = filteredGroups.filter(group => !group.featured);

  const AddGroupCard = () => (
    <div
      onClick={() => setShowSubmitModal(true)}
      className="cursor-pointer border-2 border-dashed border-indigo-400 rounded-2xl p-6 text-center text-indigo-600 hover:bg-indigo-50 hover:border-indigo-600 transition"
    >
      <div className="text-4xl mb-2">＋</div>
      <div className="font-semibold">Add a Group</div>
      <div className="text-sm text-gray-500 mt-1">Know a crew that should be listed?</div>
    </div>
  );

  return (
    <div className="relative py-20 px-4 overflow-hidden bg-white-50">
      {/* Big Heart */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png"
        alt="Philly Heart"
        className="absolute opacity-10 rotate-12 w-[600px] bottom-[-100px] right-[-100px] pointer-events-none z-0"
      />

      <div className="relative max-w-screen-xl mx-auto z-10">

        {/* Featured */}
        {featuredGroups.length > 0 && (
          <div className="mb-12 text-center">
            <h3 className="text-yellow-500 text-2xl font-bold mb-2">🌟 Bobo's Picks</h3>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {featuredGroups.map(group => (
                <GroupCard key={group.id} group={group} isAdmin={isAdmin} featuredGroupId={featuredGroupId} />
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className={`grid gap-6 ${searchTerm ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
          
          {/* Add a Group Card as first item */}
          <AddGroupCard />

          {otherGroups.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-10">
              No groups found — try another search or explore below!
            </div>
          ) : (
            otherGroups.slice(0, visibleCount).map((group, idx) => (
              <GroupCard
                key={group.id || idx}
                group={group}
                isAdmin={isAdmin}
                featuredGroupId={featuredGroupId}
              />
            ))
          )}
        </div>

        {/* Load More */}
        {visibleCount < otherGroups.length && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setVisibleCount(prev => prev + 8)}
              className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50"
            >
              Show More Groups
            </button>
          </div>
        )}

        {/* Add Group Modal */}
        {showSubmitModal && (
          <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
        )}
      </div>
    </div>
  );
};

export default GroupsList;
