// src/PopularGroups.jsx

import React, { useEffect, useState } from 'react';
import GroupCard from './GroupCard';
import SubmitGroupModal from './SubmitGroupModal';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';


const PopularGroups = ({ isAdmin }) => {
  const [groups, setGroups] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }
      setGroups(data); // No filtering, just your best hand-picked groups in Supabase
    };
    fetchGroups();
  }, []);

  const visibleGroups = groups.slice(0, visibleCount);

  return (
    <div className="relative py-20 px-4 mb-12 overflow-hidden bg-neutral-50">
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

        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-2">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="min-w-[200px] bg-indigo-100 text-indigo-700 rounded-2xl p-6 flex-shrink-0 flex flex-col justify-center items-center hover:bg-indigo-200 transition"
            >
              <div className="text-4xl mb-2">➕</div>
              <p className="text-sm font-semibold">Add a Group</p>
            </button>

            {visibleGroups.map(group => (
              <a
                key={group.id}
                href={group.Link}
                to={`/groups/${group.slug}`}
                rel="noopener noreferrer"
                className="min-w-[200px] block"
              >
                <GroupCard
                  group={{
                    ...group,
                    Description: '',
                    Type: null,
                    Vibes: null,
                    Link: null,
                  }}
                  isAdmin={false}
                />
              </a>
            ))}
          </div>
        </div>

        {visibleCount < groups.length && (
          <div className="flex justify-center mt-8">
          <a
            href="/groups"
            className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50"
          >
            Explore All Groups
          </a>
        </div>
        
        )}

        {showSubmitModal && (
          <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
        )}
      </div>
    </div>
  );
};

export default PopularGroups;
