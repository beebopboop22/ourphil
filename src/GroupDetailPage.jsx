// src/GroupDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import GroupCard from './GroupCard';
import SportsEventsGrid from './SportsEventsGrid';
import MonthlyEvents from './MonthlyEvents';
import Voicemail from './Voicemail';
import Footer from './Footer';

const GroupDetails = () => {
  const { slug } = useParams();
  const [group, setGroup] = useState(null);
  const [relatedGroups, setRelatedGroups] = useState([]);

  useEffect(() => {
    const fetchGroup = async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        console.error('Error fetching group:', error);
        return;
      }

      setGroup(data);

      if (data?.Type) {
        const types = data.Type.split(',').map(t => t.trim());
        const { data: related, error: relatedError } = await supabase
          .from('groups')
          .select('*')
          .ilike('Type', `%${types[0]}%`)
          .neq('slug', slug)
          .limit(6);

        if (!relatedError) setRelatedGroups(related);
      }
    };

    fetchGroup();
  }, [slug]);

  if (!group) {
    return <div className="text-center py-20 text-gray-500">Loading Group...</div>;
  }

  const types = group.Type?.split(',').map(t => t.trim()) || [];

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 px-4">
      <Navbar />

      <div className="max-w-screen-xl mx-auto mb-16">

        {/* Group Info */}
        <div className="text-center mb-12">
          {group.imag && (
            <img 
              src={group.imag} 
              alt={group.Name} 
              className="mx-auto w-40 h-40 object-cover rounded-full mb-4 border-4 border-indigo-100"
            />
          )}

          <h1 className="text-4xl font-[Barrio] text-gray-900 mb-2">{group.Name}</h1>

          <p className="text-gray-600 max-w-xl mx-auto mb-4">{group.Description}</p>

          {types.length > 0 && (
            <div className="flex justify-center flex-wrap gap-2 mb-4">
              {types.map((type, idx) => (
                <span key={idx} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs">
                  {type}
                </span>
              ))}
            </div>
          )}

          {group.Link && (
            <a
              href={group.Link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 bg-indigo-600 text-white text-sm px-4 py-2 rounded-full hover:bg-indigo-700 transition"
            >
              Visit Group Website
            </a>
          )}
        </div>

        {/* Related Groups */}
        {relatedGroups.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Similar Groups</h2>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {relatedGroups.map(group => (
                <GroupCard key={group.id} group={group} isAdmin={false} />
              ))}
            </div>
          </div>
        )}

        {/* Explore the Rest of OurPhilly */}
        <div className="mb-20 text-center">
          <h2 className="text-3xl font-[Barrio] text-indigo-900 mb-2">Explore More Philly Magic</h2>
          <p className="text-gray-600 text-sm mb-6">Find sports, concerts, voicemails & other weird wonderful stuff.</p>

          <div className="flex justify-center flex-wrap gap-4 text-md font-medium">
            <Link to="/sports" className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full hover:bg-blue-200 transition">⚾ Philly Sports</Link>
            <Link to="/concerts" className="bg-pink-100 text-pink-800 px-4 py-2 rounded-full hover:bg-pink-200 transition">🎵 Concerts</Link>
            <Link to="/voicemail" className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full hover:bg-yellow-200 transition">📞 Anonymous Voicemail</Link>
            <Link to="/groups" className="bg-green-100 text-green-800 px-4 py-2 rounded-full hover:bg-green-200 transition">🧭 Explore All Groups</Link>
          </div>
        </div>

        {/* Live Philly Stuff */}
        <MonthlyEvents />
        <SportsEventsGrid />
        
      </div>
      <Voicemail />
      <Footer />
    </div>
  );
};

export default GroupDetails;


