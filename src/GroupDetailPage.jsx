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
import ClaimGroupButton from './ClaimGroupButton';
import GroupUpdateForm from './GroupUpdateForm';
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

  const [updates, setUpdates] = useState([]);
  const [isApprovedForGroup, setIsApprovedForGroup] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      const { data: allGroups } = await supabase.from('groups').select('slug').order('id', { ascending: true });
      const idx = allGroups.findIndex(g => g.slug === slug);
      setGroupIndex(idx + 1);
      setTotalGroups(allGroups.length);

      const { data: grp } = await supabase.from('groups').select('*').eq('slug', slug).single();
      setGroup(grp);

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

  useEffect(() => {
    if (!group) return;
    supabase
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .then(({ count }) => setFavCount(count || 0));

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

  const fetchUpdates = async () => {
    if (!group) return;
    const { data, error } = await supabase
      .from('group_updates')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading updates:', error);
    } else {
      setUpdates(data);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this update?')) return;
    const { error } = await supabase.from('group_updates').delete().eq('id', id);
    if (error) {
      alert('Failed to delete update.');
    } else {
      fetchUpdates();
    }
  };

  const handleEdit = async (id, currentContent) => {
    const newContent = prompt('Edit your update:', currentContent);
    if (!newContent) return;
    const { error } = await supabase.from('group_updates').update({ content: newContent }).eq('id', id);
    if (error) {
      alert('Failed to update.');
    } else {
      fetchUpdates();
    }
  };

  // Always fetch updates when group loads
  useEffect(() => {
    if (group) fetchUpdates();
  }, [group]);

  // Only check approval if logged in
  useEffect(() => {
    if (!user || !group) return;

    const checkApproval = async () => {
      const { data } = await supabase
        .from('group_claim_requests')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .eq('status', 'Approved')
        .single();

      setIsApprovedForGroup(!!data);
    };

    checkApproval();
  }, [user, group]);

  if (!group) {
    return <div className="text-center py-20 text-gray-500">Loading Group…</div>;
  }

  const types = group.Type?.split(',').map(t => t.trim()) || [];

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{group.Name} – Our Philly</title>
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />
      <GroupProgressBar />


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

            {user && (
              <div className="mt-6">
                <ClaimGroupButton groupId={group.id} userId={user.id} />
              </div>
            )}

            {user && isApprovedForGroup && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Post an Update</h2>
                <GroupUpdateForm groupId={group.id} userId={user.id} onPostSuccess={fetchUpdates} />
              </div>
            )}
          </div>

        </div>

      </div>


      <div className="max-w-screen-xl mx-auto px-4">
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Updates</h2>
          {updates.length === 0 ? (
            <p className="text-gray-500">No updates yet.</p>
          ) : (
            <div className="grid gap-4">
              {updates.map((update) => (
                <div key={update.id} className="bg-white border rounded p-4 shadow-sm">
                  <p className="text-gray-800">{update.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(update.created_at).toLocaleString()}
                  </p>
                  {user && update.user_id === user.id && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(update.id, update.content)}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(update.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {relatedGroups.length > 0 && (
          <div className="mt-16">
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
      </div>

      <Voicemail />
      <Footer />
    </div>
  );
};

export default GroupDetails;
