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
import GroupUpdateForm from './GroupUpdateForm';
import { getMyFavorites, addFavorite, removeFavorite } from './utils/favorites';

const GroupDetails = () => {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);

  const [group, setGroup] = useState(null);
  const [relatedGroups, setRelatedGroups] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [favCount, setFavCount] = useState(0);
  const [myFavId, setMyFavId] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [isApprovedForGroup, setIsApprovedForGroup] = useState(false);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      // Group
      const { data: grp } = await supabase.from('groups').select('*').eq('slug', slug).single();
      setGroup(grp);

      // Favorites
      const { count } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', grp.id);
      setFavCount(count || 0);

      if (user) {
        const rows = await getMyFavorites();
        const mine = rows.find(r => r.group_id === grp.id);
        setMyFavId(mine?.id ?? null);
      }

      // Related Groups
      if (grp?.Type) {
        const types = grp.Type.split(',').map(t => t.trim());
        const { data: rel } = await supabase
          .from('groups')
          .select('*')
          .ilike('Type', `%${types[0]}%`)
          .neq('slug', slug);
        setRelatedGroups(rel || []);
      }

      // Updates
      const { data: upd } = await supabase
        .from('group_updates')
        .select('*')
        .eq('group_id', grp.id)
        .order('created_at', { ascending: false });
      setUpdates(upd || []);

      // Claim approval
      if (user) {
        const { data } = await supabase
          .from('group_claim_requests')
          .select('id')
          .eq('group_id', grp.id)
          .eq('user_id', user.id)
          .eq('status', 'Approved')
          .single();
        setIsApprovedForGroup(!!data);
      }
    }
    fetchData();
  }, [slug, user]);

  // Toggle favorite
  const toggleFav = async () => {
    if (!user || !group) return;
    setToggling(true);
    if (myFavId) {
      await removeFavorite(myFavId);
      setFavCount(c => c - 1);
      setMyFavId(null);
    } else {
      const { data } = await addFavorite(group.id);
      setMyFavId(data[0].id);
      setFavCount(c => c + 1);
    }
    setToggling(false);
  };

  // Submit claim request
  const submitClaim = async () => {
    if (!claimMessage.trim()) return;
    setSubmittingClaim(true);
    await supabase
      .from('group_claim_requests')
      .insert({ group_id: group.id, user_id: user.id, message: claimMessage, status: 'Pending' });
    setSubmittingClaim(false);
    setShowClaimModal(false);
  };

  // Edit & delete updates
  const handleEdit = async (id, currentContent) => {
    const newContent = prompt('Edit your update:', currentContent);
    if (!newContent) return;
    await supabase.from('group_updates').update({ content: newContent }).eq('id', id);
    setUpdates(updates.map(u => u.id === id ? { ...u, content: newContent } : u));
  };
  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return;
    await supabase.from('group_updates').delete().eq('id', id);
    setUpdates(updates.filter(u => u.id !== id));
  };

  if (!group) return <div className="text-center py-20 text-gray-500">Loading Group…</div>;

  const types = group.Type?.split(',').map(t => t.trim()) || [];

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{group.Name} – Our Philly</title>
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />
      <GroupProgressBar />

      {/* Header */}
      <div className="relative">
        <div
          className="h-64 bg-cover bg-center"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1516508636691-2ea98becb2f5?q=80&w=2671&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfDB8fGVufDB8%3D")' }}
        />
        <div className="absolute left-8 bottom-0 transform translate-y-1/2">
          <img
            src={group.imag}
            alt={group.Name}
            className="w-48 h-48 rounded-full border-4 border-white object-cover"
          />
        </div>
        <div className="absolute right-8 bottom-0 transform translate-y-1/2 flex space-x-4">
          <button
            onClick={toggleFav}
            disabled={toggling}
            className="flex items-center px-6 py-4 bg-white rounded-full shadow text-gray-800 text-2xl"
          >
            <span className="mr-2">{myFavId ? '❤️' : '🤍'}</span>
            <span className="font-semibold text-xl">{favCount}</span>
          </button>
          {user && (
            <button
              onClick={() => setShowClaimModal(true)}
              className="px-6 py-4 bg-blue-600 text-white rounded-full shadow text-lg"
            >Claim Group</button>
          )}
        </div>
      </div>

      {/* Host CTA Banner */}
      {!user && (
        <div className="max-w-screen-xl mx-auto px-4 mt-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded">
            <p className="text-center">
              👋 Hosts: create an account to claim your group and post updates.{' '}
              <Link to="/signup" className="font-semibold underline">Sign up</Link> or{' '}
              <Link to="/login" className="font-semibold underline">Log in</Link> now.
            </p>
          </div>
        </div>
      )}

      {/* Group Info */}
      <div className="mt-24 px-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">{group.Name}</h1>
          <p className="text-gray-600 mt-2">{group.Description}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {types.map((type, i) => (
              <Link
                key={i}
                to={`/groups/type/${type.toLowerCase().replace(/\s+/g, '-')}`}                className="bg-indigo-100 text-indigo-700 px-3 py-1 text-xs rounded-full"
              >{type}</Link>
            ))}
          </div>
          {group.Link && (
            <a href={group.Link} target="_blank" rel="noopener noreferrer" className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full mt-4">
              Visit Group Website
            </a>
          )}

          {/* Post an Update Access Gate */}
          {user ? (
            isApprovedForGroup ? (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Post an Update</h2>
                <GroupUpdateForm
                  groupId={group.id}
                  userId={user.id}
                  onPostSuccess={() => setUpdates([])}
                />
              </div>
            ) : (
              <div className="mt-10 p-4 bg-gray-100 rounded text-center text-gray-600">
                <p>
                  You need to{' '}
                  <button
                    onClick={() => setShowClaimModal(true)}
                    className="underline text-blue-600"
                  >claim this group</button>{' '}
                  before you can post updates.
                </p>
              </div>
            )
          ) : (
            <div className="mt-10 p-4 bg-gray-100 rounded text-center text-gray-600">
              <p>
                Log in to claim this group and post updates.{' '}
                <Link to="/login" className="underline text-blue-600">Log in</Link> or{' '}
                <Link to="/signup" className="underline text-blue-600">Sign up</Link>.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Updates */}
      <div className="max-w-screen-xl mx-auto px-4 mt-12 space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Updates</h2>
        {updates.length === 0 ? (
          <div className="text-gray-500">
            <p>No updates yet.</p>
            {!user && <Link to="/login" className="text-blue-600 underline">Log in to claim this group</Link>}
          </div>
        ) : (
          updates.map(update => (
            <div key={update.id} className="bg-white border border-gray-200 hover:bg-gray-50 rounded-lg p-4 shadow-sm transition">
              <div className="flex items-start mb-3">
                <img src={group.imag} alt={group.Name} className="w-10 h-10 rounded-full mr-3 object-cover" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{group.Name}</p>
                    <p className="text-xs text-gray-500">{new Date(update.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-gray-800 mt-2">{update.content}</p>
                </div>
              </div>
              {user && update.user_id === user.id && (
                <div className="flex justify-end space-x-4 text-blue-500 text-sm">
                  <button onClick={() => handleEdit(update.id, update.content)} className="hover:underline">Edit</button>
                  <button onClick={() => handleDelete(update.id)} className="hover:underline">Delete</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Related Groups */}
      {relatedGroups.length > 0 && (
        <div className="max-w-screen-xl mx-auto px-4 mt-16">
          <h2 className="text-4xl font-[Barrio] text-gray-800 text-center mb-6">
            More in {types.slice(0,2).join(', ')}
          </h2>
          <div className="overflow-x-auto">
            <div className="flex space-x-4 py-4">
              {relatedGroups.map(g => (
                <Link
                  key={g.id}
                  to={`/groups/${g.slug}`}
                  className="flex-shrink-0 w-40 h-64 bg-white rounded-lg shadow overflow-hidden flex flex-col"
                >
                  {/* image */}
                  <img
                    src={g.imag}
                    alt={g.Name}
                    className="w-full h-20 object-cover"
                  />

                  {/* centered title + description */}
                  <div className="px-2 py-2 flex-1 flex flex-col items-center text-center">
                    <h3 className="text-sm font-semibold truncate w-full">
                      {g.Name}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1 flex-1 overflow-hidden line-clamp-2 w-full">
                      {g.Description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <Voicemail />
      <Footer />
    </div>
  );
};

export default GroupDetails;
