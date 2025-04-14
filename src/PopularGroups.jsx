// src/PopularGroups.jsx

import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import SubmitGroupModal from './SubmitGroupModal';

const PopularGroups = () => {
  const [groups, setGroups] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, Name, Type, slug, imag')
        .order('Date', { ascending: false });

      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }

      const total = data.length;

      const recentFive = data.slice(0, 3).map((group) => {
        const indexInFullList = data.findIndex(g => g.slug === group.slug);
        return {
          ...group,
          groupNumber: total - indexInFullList, // Reverse order
          totalGroups: total,
        };
      });

      setGroups(recentFive);
    };

    fetchGroups();
  }, []);

  return (
    <div className="relative py-20 px-4 mb-12 bg-gray-50">
      <div className="max-w-screen-xl mx-auto z-10">
        <h2 className="text-3xl font-[Barrio] text-gray-800 mb-6">Recently Added Groups</h2>

        <div className="space-y-4">
          {groups.map((group) => (
            <Link
              to={`/groups/${group.slug}`}
              key={group.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">
                <img
                  src={group.imag || 'https://via.placeholder.com/80'}
                  alt={group.Name}
                  className="w-16 h-16 object-cover rounded-lg border"
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{group.Name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                    {group.Type?.split(',').map((type, idx) => (
                      <span
                        key={idx}
                        className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full"
                      >
                        {type.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-right text-sm text-gray-400 whitespace-nowrap">
                <div className="mb-1">Group #{group.groupNumber} of {group.totalGroups}</div>
                <span className="text-xl">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex justify-center mt-8">
          <Link
            to="/groups"
            className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-100 transition"
          >
            Explore All Groups
          </Link>
        </div>

        {showSubmitModal && <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />}
      </div>
    </div>
  );
};

export default PopularGroups;


