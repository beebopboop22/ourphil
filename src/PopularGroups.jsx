// src/PopularGroups.jsx

import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import SubmitGroupModal from './SubmitGroupModal';
import { Link } from 'react-router-dom';

const PopularGroups = ({ isAdmin }) => {
  const [groups, setGroups] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, Name, Type, imag, slug')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }

      const totalGroups = data.length;
      const recentGroups = data.slice(-5).map((group, idx) => ({
        ...group,
        groupNumber: totalGroups - 5 + idx + 1,  // Calculate human-readable #
        totalGroups,
      }));

      setGroups(recentGroups);
    };

    fetchGroups();
  }, []);

  return (
    <div className="relative py-20 px-4 mb-12 overflow-hidden bg-neutral-50">
      {/* Background Image */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png"
        alt="Philly Heart"
        className="absolute opacity-10 rotate-12 w-[600px] bottom-[-100px] right-[-100px] pointer-events-none z-0"
      />

      <div className="relative max-w-screen-xl mx-auto z-10">

        <h2 className="text-5xl font-[Barrio] text-gray-800 mb-3 text-center">Recently Added Groups</h2>
        <p className="text-gray-600 text-md mb-8 max-w-2xl mx-auto text-center">
          The newest weirdos in the OurPhilly family.
        </p>

        <div className="space-y-4 sm:space-y-0 sm:divide-y sm:divide-gray-200">

          {groups.map(group => (
            <Link
              key={group.id}
              to={`/groups/${group.slug}`}
              className="flex flex-col sm:flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:shadow-md transition gap-4"
            >
              {/* Image */}
              <img
                src={group.imag || 'https://via.placeholder.com/80'}
                alt={group.Name}
                className="w-20 h-20 object-cover rounded-lg border"
              />

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-semibold text-gray-900">{group.Name}</h3>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-1 text-xs text-gray-500">
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

              {/* Group # & Arrow */}
              <div className="text-center sm:text-right text-sm text-gray-400 whitespace-nowrap">
                <div className="mb-1">Group #{group.groupNumber} of {group.totalGroups}</div>
                <span className="text-xl block sm:inline">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex justify-center mt-10">
          <Link
            to="/groups"
            className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50"
          >
            Explore All Groups
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



