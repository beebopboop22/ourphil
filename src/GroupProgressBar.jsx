// src/GroupProgressBar.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import SubmitGroupModal from './SubmitGroupModal';

const GroupProgressBar = ({ goal = 1000 }) => {
  const [totalGroups, setTotalGroups] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      const { count, error } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        setTotalGroups(count);
      } else {
        console.error('Error fetching group count:', error);
      }
    };

    fetchCount();
  }, []);

  const percent = Math.min((totalGroups / goal) * 100, 100);

  return (
    <>
      <div className="w-full bg-neutral-100 py-6 px-4 border-y border-gray-200">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
      <div className="text-sm text-gray-700">
            {totalGroups.toLocaleString()} of {goal.toLocaleString()} Philly groups indexed.
          </div>

          <div className="w-full md:flex-grow md:mx-4 h-2 bg-gray-300 rounded-full overflow-hidden min-w-[100px]">
          <div
              className="h-full bg-indigo-600 transition-all duration-1000 ease-in-out"
              style={{ width: `${percent}%` }}
            ></div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-full hover:bg-indigo-700 transition whitespace-nowrap"
          >
            ➕ Add Your Group
          </button>
        </div>
      </div>

      {showModal && <SubmitGroupModal onClose={() => setShowModal(false)} />}
    </>
  );
};

export default GroupProgressBar;
