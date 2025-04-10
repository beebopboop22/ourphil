import React, { useEffect, useState } from 'react';
import GroupCard from './GroupCard';
import SubmitGroupModal from './SubmitGroupModal';
import { supabase } from './supabaseClient';

const FilteredGroupSection = ({ tag, title, isAdmin }) => {
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
      const filtered = data.filter(group =>
        group.Type?.toLowerCase().includes(tag.toLowerCase())
      );
      setGroups(filtered);
    };
    fetchGroups();
  }, [tag]);

  const visibleGroups = groups.slice(0, visibleCount);

  // 🎯 Dynamic subtitle based on tag
  const getSubtitle = (tag) => {
    const normalizedTag = tag.toLowerCase();
    switch (normalizedTag) {
      case 'running':
        return 'Run with Philly crews that meet all over the city';
      case 'books':
        return 'Join a local book club and meet fellow readers';
      case 'music':
        return 'Play, sing, or vibe with Philly’s music groups';
      case 'board games':
        return 'Grab a seat and roll some dice with others';
      case 'outdoors':
        return 'Hike, bike, or kayak with active groups near you';
      case 'volunteering':
        return 'Give back with volunteer and service communities';
      case 'language':
        return 'Practice languages and meet conversation partners';
      default:
        return 'Explore active groups in Philly';
    }
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto px-4 py-16 border-t border-gray-200">
      <div className="mb-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-black text-left">{title}</h2>
          <p className="text-gray-600 text-sm text-left">{getSubtitle(tag)}</p>
        </div>

        {visibleCount < groups.length && (
          <div className="mb-4 text-right">
            <button
              onClick={() => setVisibleCount(prev => prev + 6)}
              className="text-sm font-semibold text-indigo-600 hover:underline"
            >
              See More
            </button>
          </div>
        )}

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
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[200px] block"
              >
                <GroupCard
                  group={{
                    ...group,
                    Description: '',
                    Type: null,
                    Vibes: null,
                    Link: null // prevent rendering any link text inside GroupCard
                  }}
                  isAdmin={false}
                />
              </a>
            ))}
          </div>
        </div>

        {showSubmitModal && (
          <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
        )}
      </div>
    </div>
  );
};

export default FilteredGroupSection;



