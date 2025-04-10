import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import GroupCard from './GroupCard';
import Navbar from './Navbar';

const VolunteerGroups = () => {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const fetchVolunteerGroups = async () => {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }

      const filtered = data.filter(group =>
        group.Type?.toLowerCase().includes('volunteers')
      );
      setGroups(filtered);
    };

    fetchVolunteerGroups();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />

      <div className="max-w-screen-xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-indigo-800 mb-2">Volunteer Opportunities in Philly</h1>
        <p className="text-gray-600 mb-10 max-w-2xl">
          These local groups are looking for extra hands. Whether you're looking to give back once a month or dive in weekly, there's a way to help.
        </p>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map(group => (
            <GroupCard key={group.id} group={group} isAdmin={false} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default VolunteerGroups; 
