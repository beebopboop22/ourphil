import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import GroupCard from './GroupCard';
import SportsEventsGrid from './SportsEventsGrid';
import MonthlyEvents from './MonthlyEvents';
import Voicemail from './Voicemail';
import Footer from './Footer';
import GroupProgressBar from './GroupProgressBar';

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
      <Helmet>
        <title>{group.Name} – Our Philly</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />
      <GroupProgressBar />

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
                  <Link
                    key={idx}
                    to={`/groups/type/${type.toLowerCase().replace(/\s+/g, '-')}`}
                    className="bg-indigo-100 text-indigo-700 px-3 py-1 text-xs rounded-full hover:bg-indigo-200 transition"
                  >
                    {type}
                  </Link>
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
            <h2 className="text-4xl font-[Barrio] text-gray-800 text-center mb-6">
              More in {types.slice(0, 2).join(', ')}
            </h2>
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

        <MonthlyEvents />
        <SportsEventsGrid />
      </div>

      <Voicemail />
      <Footer />
    </div>
  );
};

export default GroupDetails;

