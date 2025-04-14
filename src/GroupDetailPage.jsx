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
  const [groupIndex, setGroupIndex] = useState(null);
  const [totalGroups, setTotalGroups] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    const fetchGroup = async () => {
      const { data: allGroups, error: allError } = await supabase
        .from('groups')
        .select('slug')
        .order('id', { ascending: true });

      if (allError) {
        console.error('Error fetching all groups:', allError);
        return;
      }

      const index = allGroups.findIndex(g => g.slug === slug);
      setGroupIndex(index + 1);
      setTotalGroups(allGroups.length);

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
          .neq('slug', slug);

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
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Navbar />

      {/* Full-width Hero */}
      <div className="w-full bg-gray-100 border-b border-gray-300 py-10 px-4 mb-16">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row gap-8 items-center">

          {group.imag && (
            <div className="w-40 h-40 flex-shrink-0">
              <img
                src={group.imag}
                alt={group.Name}
                className="w-full h-full object-cover rounded-2xl border-4 border-indigo-100"
              />
            </div>
          )}

          <div className="flex-grow text-center md:text-left">
            {groupIndex && totalGroups && (
              <p className="text-xs text-gray-500 font-medium mb-1">
                Group #{groupIndex} of {totalGroups}
              </p>
            )}

            <h1 className="text-4xl font-[Barrio] text-gray-900 mb-2">{group.Name}</h1>

            <p className="text-gray-600 mb-3">{group.Description}</p>

            {types.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
                {types.map((type, idx) => (
                  <span key={idx} className="bg-indigo-100 text-indigo-700 px-3 py-1 text-xs rounded-full">
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
                className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full hover:bg-indigo-700 transition"
              >
                Visit Group Website
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4">

        {/* Related Groups */}
        {relatedGroups.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Similar Groups</h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {relatedGroups.slice(0, visibleCount).map(group => (
                <GroupCard key={group.id} group={group} isAdmin={false} />
              ))}
            </div>

            {visibleCount < relatedGroups.length && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setVisibleCount(prev => prev + 10)}
                  className="px-5 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 transition"
                >
                  See More
                </button>
              </div>
            )}
          </div>
        )}

        {/* Explore More */}
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

        <MonthlyEvents />
        <SportsEventsGrid />
      </div>

      <Voicemail />
      <Footer />
    </div>
  );
};

export default GroupDetails;




