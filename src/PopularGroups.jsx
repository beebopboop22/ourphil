// src/PopularGroups.jsx
import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import SubmitGroupModal from './SubmitGroupModal';
import { Link } from 'react-router-dom';
import GroupProgressBar from './GroupProgressBar';
import { AuthContext } from './AuthProvider';
import { getMyFavorites, addFavorite, removeFavorite } from './utils/favorites';

const PopularGroups = ({ isAdmin }) => {
  const { user } = useContext(AuthContext);

  const [groups, setGroups]         = useState([]);
  const [favMap, setFavMap]         = useState({});
  const [favCounts, setFavCounts]   = useState({});
  const [loadingFavAction, setLoadingFavAction] = useState(false);
  const [showSubmitModal, setShowSubmitModal]   = useState(false);

  // 1) Load up to 20 featured groups
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, Name, Type, imag, slug, Description')
        .eq('status', 'featured')
        .order('id', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Error loading featured groups:', error);
        return;
      }

      // add a 1-based badge number
      setGroups(data.map((g, i) => ({
        ...g,
        groupNumber: i + 1,
      })));
    })();
  }, []);

  // 2) Load total favorite counts
  useEffect(() => {
    if (!groups.length) return;
    (async () => {
      const ids = groups.map(g => g.id);
      const { data, error } = await supabase
        .from('favorites')
        .select('group_id')
        .in('group_id', ids);

      if (error) {
        console.error('Error loading favorite counts:', error);
        return;
      }

      const counts = {};
      data.forEach(r => {
        counts[r.group_id] = (counts[r.group_id] || 0) + 1;
      });
      setFavCounts(counts);
    })();
  }, [groups]);

  // 3) Load this user’s favorites
  useEffect(() => {
    if (!user) {
      setFavMap({});
      return;
    }
    getMyFavorites()
      .then(rows => {
        const m = {};
        rows.forEach(r => {
          m[r.group_id] = r.id;
        });
        setFavMap(m);
      })
      .catch(console.error);
  }, [user]);

  // 4) Toggle heart
  const toggleFav = async (groupId) => {
    if (!user) return;
    setLoadingFavAction(true);

    if (favMap[groupId]) {
      await removeFavorite(favMap[groupId]);
      setFavMap(prev => {
        const copy = { ...prev };
        delete copy[groupId];
        return copy;
      });
      setFavCounts(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || 1) - 1,
      }));
    } else {
      const { data, error } = await addFavorite(groupId);
      if (!error && data?.[0]?.id) {
        setFavMap(prev => ({ ...prev, [groupId]: data[0].id }));
        setFavCounts(prev => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1,
        }));
      }
    }

    setLoadingFavAction(false);
  };

  return (
    <div className="relative py-16 px-4 mb-8 bg-neutral-50">
      {/* staple-heart above */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1%20copy-min.png?token=…"
        alt="Heart Staple"
        className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 z-10 pointer-events-none"
      />
      {/* faint bg heart */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1%20copy-min.png?token=…"
        alt="Philly Heart"
        className="absolute opacity-20 rotate-12 w-[400px] bottom-[-100px] pointer-events-none z-0"
      />

      <div className="relative max-w-screen-xl mx-auto z-10 text-center">
        <h2 className="text-4xl text-left font-[Barrio]">
          Featured GROUPS
        </h2>

        <p className="text-left mb-4 text-gray-600">
          We're shining a spotlight on our top 20 community groups.
        </p>

        <GroupProgressBar />

        <div className="flex gap-4 overflow-x-auto pb-4 mt-6">
          {groups.map(group => {
            const isFav = Boolean(favMap[group.id]);
            const count = favCounts[group.id] || 0;

            return (
              <div
                key={group.id}
                className="flex-shrink-0 w-[280px] h-[350px] flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow hover:shadow-md transition"
              >
                <Link
                  to={`/groups/${group.slug}`}
                  className="flex-grow p-3 flex flex-col"
                >
                  <div className="relative w-full h-32 mb-3 flex-shrink-0">
                    <img
                      src={group.imag || 'https://via.placeholder.com/150'}
                      alt={group.Name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute bottom-2 right-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      #{group.groupNumber}
                    </div>
                    {group.Type && (
                      <div className="absolute top-2 left-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {group.Type.split(',')[0].trim()}
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {group.Name}
                  </h3>
                  {group.Description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-3 flex-grow">
                      {group.Description}
                    </p>
                  )}
                </Link>

                {/* bottom bar with heart + count */}
                <div className="bg-gray-100 border-t px-3 py-2 flex items-center justify-center space-x-3">
                  <button
                    onClick={() => toggleFav(group.id)}
                    disabled={loadingFavAction}
                    className="text-xl"
                  >
                    {isFav ? '❤️' : '🤍'}
                  </button>
                  <span className="font-[Barrio] text-lg text-gray-800">
                    {count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center mt-10">
          <Link
            to="/groups"
            className="inline-block bg-indigo-600 text-white font-bold text-lg px-8 py-3 rounded-full shadow hover:bg-indigo-700 hover:scale-105 transition-all duration-200"
          >
            🔍 Explore All Groups
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
