// src/GroupDetails.jsx
import React, { useEffect, useState, useContext } from 'react';
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
import { AuthContext } from './AuthProvider';
import { getMyFavorites, addFavorite, removeFavorite } from './utils/favorites';

const GroupDetails = () => {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);

  const [group, setGroup] = useState(null);
  const [relatedGroups, setRelatedGroups] = useState([]);
  const [groupIndex, setGroupIndex] = useState(null);
  const [totalGroups, setTotalGroups] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const [favCount, setFavCount] = useState(0);
  const [myFavId, setMyFavId] = useState(null);
  const [toggling, setToggling] = useState(false);

  // fetch this group + related + index
  useEffect(() => {
    const fetchGroup = async () => {
      // compute index
      const { data: allGroups } = await supabase
        .from('groups').select('slug').order('id', { ascending: true });
      const idx = allGroups.findIndex(g => g.slug === slug);
      setGroupIndex(idx + 1);
      setTotalGroups(allGroups.length);

      // fetch group record
      const { data: grp } = await supabase
        .from('groups').select('*').eq('slug', slug).single();
      setGroup(grp);

      // fetch related
      if (grp?.Type) {
        const types = grp.Type.split(',').map(t => t.trim());
        const { data: rel } = await supabase
          .from('groups')
          .select('*')
          .ilike('Type', `%${types[0]}%`)
          .neq('slug', slug);
        setRelatedGroups(rel);
      }
    };
    fetchGroup();
  }, [slug]);

  // fetch favorite count + my favorite id
  useEffect(() => {
    if (!group) return;

    // total count
    supabase
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .then(({ count }) => setFavCount(count || 0));

    // my favorite?
    if (user) {
      getMyFavorites().then(rows => {
        const mine = rows.find(r => r.group_id === group.id);
        setMyFavId(mine?.id ?? null);
      });
    } else {
      setMyFavId(null);
    }
  }, [group, user]);

  const toggleFav = async () => {
    if (!user || !group) return;

    setToggling(true);
    if (myFavId) {
      await removeFavorite(myFavId);
      setMyFavId(null);
      setFavCount(c => c - 1);
    } else {
      const { data } = await addFavorite(group.id);
      const newId = data[0].id;
      setMyFavId(newId);
      setFavCount(c => c + 1);
    }
    setToggling(false);
  };

  if (!group) {
    return <div className="text-center py-20 text-gray-500">Loading Group…</div>;
  }

  const types = group.Type?.split(',').map(t => t.trim()) || [];

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{group.Name} – Our Philly</title>
        <link rel="icon" href="/favicon.ico" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: group.Name,
            url: window.location.href,
            description: group.Description,
            ...(group.imag ? { logo: group.imag } : {}),
            sameAs: group.Link ? [group.Link] : undefined,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://ourphilly.com" },
                { "@type": "ListItem", position: 2, name: "Groups", item: "https://ourphilly.com/groups" },
                { "@type": "ListItem", position: 3, name: group.Name, item: window.location.href }
              ]
            }
          })}
        </script>
      </Helmet>

      <Navbar />
      <GroupProgressBar />

      {/* Hero with heart count */}
      <div className="w-full bg-gray-100 border-b border-gray-300 py-10 px-4 mb-16">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center gap-8 relative">
          {group.imag && (
            <div className="w-40 h-40 flex-shrink-0 relative">
              <img
                src={group.imag}
                alt={group.Name}
                className="w-full h-full object-cover rounded-2xl border-4 border-indigo-100"
              />
            </div>
          )}
          <div className="flex-grow text-center md:text-left">
            {groupIndex && totalGroups && (
              <p className="text-xs text-gray-500 mb-1">
                Group #{groupIndex} of {totalGroups}
              </p>
            )}
            <div className="flex items-center justify-center md:justify-start space-x-4">
              <h1 className="text-4xl font-[Barrio] text-gray-900">{group.Name}</h1>
              {/* heart + count */}
              <button
                onClick={toggleFav}
                disabled={toggling}
                className="flex items-center space-x-1 text-xl"
              >
                <span>{myFavId ? '❤️' : '🤍'}</span>
                <span className="font-[Barrio] text-2xl">{favCount}</span>
              </button>
            </div>
            <p className="text-gray-600 mt-3">{group.Description}</p>
            {types.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {types.map((type, i) => (
                  <Link
                    key={i}
                    to={`/groups/type/${type.toLowerCase().replace(/\s+/g, '-')}`}
                    className="bg-indigo-100 text-indigo-700 px-3 py-1 text-xs rounded-full"
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
                className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full mt-4"
              >
                Visit Group Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Related */}
      <div className="max-w-screen-xl mx-auto px-4">
        {relatedGroups.length > 0 && (
          <div className="mb-16">
            <h2 className="text-4xl font-[Barrio] text-gray-800 text-center mb-6">
              More in {types.slice(0, 2).join(', ')}
            </h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {relatedGroups.slice(0, visibleCount).map(g => (
                <GroupCard key={g.id} group={g} isAdmin={false} />
              ))}
            </div>
            {visibleCount < relatedGroups.length && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setVisibleCount(v => v + 10)}
                  className="px-5 py-2 border rounded-full"
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
