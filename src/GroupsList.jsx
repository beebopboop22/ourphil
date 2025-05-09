// src/GroupsList.jsx
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
    if (!groups.length) return;
    // pick random featured
    const random = groups[Math.floor(Math.random() * groups.length)];
    setFeaturedGroupId(random?.id || null);

    const types = new Set();
    const counts = {};
    groups.forEach(g => {
      (g.Type?.split(',').map(t => t.trim()) || []).forEach(t => {
        types.add(t);
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    setAllTypes([...types].sort());
    setTypeCounts(counts);
  }, [groups]);

  const filtered = groups.filter(g => {
    const name = g.Name?.toLowerCase() || '';
    return (
      name.includes(searchTerm.trim().toLowerCase()) &&
      (selectedType === '' || g.Type?.includes(selectedType))
    );
  });

  const featured = !searchTerm && !selectedType
    ? filtered.filter(g => g.featured)
    : [];
  const others = filtered.filter(g => !g.featured);

  const AddGroupCard = () => (
    <div
      onClick={() => setShowSubmitModal(true)}
      className="flex-none w-56 h-96 mx-2 cursor-pointer border-2 border-dashed border-indigo-400
                 rounded-2xl p-6 text-center text-indigo-600 hover:bg-indigo-50 hover:border-indigo-600 transition"
    >
      <div className="text-3xl mb-2">＋</div>
      <div className="font-semibold">Add a Group</div>
      <div className="text-sm text-gray-500 mt-1">Know a crew that should be listed?</div>
    </div>
  );

  return (
    <div className="relative px-4">
      {/* Background Heart */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//OurPhilly-CityHeart-2.png"
        alt="Philly Heart"
        className="absolute opacity-10 rotate-12 w-[600px] bottom-[-100px] right-[-100px] pointer-events-none"
      />

      <div className="relative max-w-screen-2xl mx-auto z-10">
        {/* Controls (search/type) could go here */}

        {/* Horizontal scroll on all viewports */}
        <div className="overflow-x-auto py-4">
          <div className="flex space-x-4 px-2">
            <AddGroupCard />
            {others.slice(0, visibleCount).map(g => (
              <GroupCard
                key={g.id}
                group={g}
                isAdmin={isAdmin}
                featuredGroupId={featuredGroupId}
              />
            ))}
          </div>
        </div>

       

        {/* Add Group Modal */}
        {showSubmitModal && <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />}
      </div>
    </div>
  );
};

export default GroupsList;
