// src/ProfilePage.jsx
import React, { useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import GroupProgressBar from './GroupProgressBar';
import GroupCard from './GroupCard';
import Footer from './Footer';
import { getMyFavorites } from './utils/favorites';

export default function ProfilePage() {
  const { user } = useContext(AuthContext);

  const [favRows, setFavRows] = useState([]);
  const [favGroups, setFavGroups] = useState([]);
  const [loadingFav, setLoadingFav] = useState(true);

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSug, setLoadingSug] = useState(false);

  const [popular, setPopular] = useState([]);
  const [loadingPop, setLoadingPop] = useState(true);

  // 1️⃣ Load the user’s favorites
  useEffect(() => {
    if (!user) {
      setFavRows([]);
      setFavGroups([]);
      setLoadingFav(false);
      return;
    }
    setLoadingFav(true);
    getMyFavorites()
      .then(async (rows) => {
        setFavRows(rows);
        if (rows.length) {
          const ids = rows.map(r => r.group_id);
          const { data: groups, error } = await supabase
            .from('groups')
            .select('*')
            .in('id', ids);
          if (!error) setFavGroups(groups);
        } else {
          setFavGroups([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingFav(false));
  }, [user]);


  // 3️⃣ Meanwhile, always fetch “Most Liked Groups” as a fallback
  useEffect(() => {
    setLoadingPop(true);
    supabase
      .from('favorites')
      .select('group_id')
      .then(({ data: favs, error }) => {
        if (error) throw error;
        // tally counts client-side
        const counts = {};
        favs.forEach(f => {
          counts[f.group_id] = (counts[f.group_id] || 0) + 1;
        });
        const topIds = Object.entries(counts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 8)
          .map(([id]) => id);

        return supabase
          .from('groups')
          .select('*')
          .in('id', topIds);
      })
      .then(({ data, error }) => {
        if (error) throw error;
        setPopular(data || []);
      })
      .catch(err => {
        console.error('Popular fetch error:', err);
        setPopular([]);
      })
      .finally(() => setLoadingPop(false));
  }, []);

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="text-center py-20 text-gray-600">
          Please{' '}
          <a href="/login" className="text-indigo-600 hover:underline">
            log in
          </a>{' '}
          to view your profile.
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <GroupProgressBar />

      <div className="max-w-screen-xl mx-auto px-4 py-12 space-y-12">
        {/* Your Favorites */}
        <section>
          <h2 className="text-4xl font-[Barrio] text-gray-800 mb-4 text-center">
            Your Favorites
          </h2>
          {loadingFav ? (
            <p className="text-center">Loading favorites…</p>
          ) : favGroups.length === 0 ? (
            <p className="text-center text-gray-600">
              You haven’t favorited any groups yet.
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {favGroups.map(g => (
                <GroupCard key={g.id} group={g} />
              ))}
            </div>
          )}
        </section>

        {/* Fallback: Most Liked Groups */}
        <section>
          <h2 className="text-4xl font-[Barrio] text-gray-800 mb-4 text-center">
            Most Liked Groups
          </h2>
          {loadingPop ? (
            <p className="text-center">Loading most liked groups…</p>
          ) : popular.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {popular.map(g => (
                <GroupCard key={g.id} group={g} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">
              No popular groups to show.
            </p>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}
