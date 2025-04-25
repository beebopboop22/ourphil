// src/PopularGroups.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import SubmitGroupModal from './SubmitGroupModal';
import { Link } from 'react-router-dom';
import GroupProgressBar from './GroupProgressBar';

const PopularGroups = ({ isAdmin }) => {
  const [groups, setGroups] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, Name, Type, imag, slug, Description')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }

      const total = data.length;
      const recent = data.slice(-5).map((g, i) => ({
        ...g,
        groupNumber: total - 5 + i + 1,
        total,
      }));

      setGroups(recent);
    };

    fetchGroups();
  }, []);

  return (
    
    <div className="relative py-16 px-4 mb-8  bg-neutral-50">
       {/* Staple-heart centered above the title, bleeding up */}
       <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU"
        alt="Heart Staple"
        className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-100 pointer-events-none z-10"
      />

      {/* Background Image */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU"
        alt="Philly Heart"
        className="absolute opacity-20 rotate-12 w-[400px] bottom-[-100px] right-[-100px] pointer-events-none z-0"
      />

      <div className="relative max-w-screen-xl mx-auto z-10 text-center">
        <h2 className="text-5xl font-[Barrio] text-gray-800 mb-2">
          GROUPS GROUPS GROUPS
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          We're trying to index 1,000 active groups - add yours
        </p>

        <GroupProgressBar />

        {/* Horizontal scroll container */}
        <div className="flex gap-4 overflow-x-auto pb-4 mt-6">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.slug}`}
              className="relative flex-shrink-0 w-[280px] flex flex-col bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition text-center"
            >
              {/* Image wrapper with group # */}
              <div className="relative w-full h-32 mb-3">
                <img
                  src={group.imag || 'https://via.placeholder.com/150'}
                  alt={group.Name}
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-2 right-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  #{group.groupNumber}
                </div>
                {/* Type badge */}
                {group.Type && (
                  <div className="absolute top-2 left-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {group.Type.split(',')[0].trim()}
                  </div>
                )}
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {group.Name}
              </h3>

              {group.Description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                  {group.Description}
                </p>
              )}
            </Link>
          ))}
        </div>

        {/* Explore All Groups Button */}
        <div className="flex justify-center mt-10">
          <Link
            to="/groups"
            className="inline-block bg-indigo-600 text-white font-bold text-lg px-8 py-3 rounded-full shadow hover:bg-indigo-700 hover:scale-105 transition-all duration-200"
          >
            🔍 Explore All Groups
          </Link>
        </div>

        {showSubmitModal && (
          <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
        )}
      </div>
    </div>
  );
};

export default PopularGroups;
