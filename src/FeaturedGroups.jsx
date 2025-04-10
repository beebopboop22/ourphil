import React, { useEffect, useState } from 'react';
import GroupCard from './GroupCard';
import { supabase } from './supabaseClient';

const FeaturedGroups = ({ isAdmin }) => {
  const [featuredGroups, setFeaturedGroups] = useState([]);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }
      const shuffled = [...data].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3).map(group => ({ ...group, isAlwaysFeatured: true }));
      setFeaturedGroups(selected);
    };
    fetchGroups();
  }, []);

  return (
    <div className="max-w-screen-xl mx-auto px-4 mt-12">
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800 uppercase mb-2">Featured Groups</h2>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {featuredGroups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              isAdmin={isAdmin}
              featuredGroupId={group.id}
              forceGold={true} // prop to always render gold style
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturedGroups;