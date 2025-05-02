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

export default function GroupDetails() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);

  const [group, setGroup] = useState(null);
  const [relatedGroups, setRelatedGroups] = useState([]);
  const [favCount, setFavCount] = useState(0);
  const [myFavId, setMyFavId] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [isApprovedForGroup, setIsApprovedForGroup] = useState(false);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // load group
      const { data: grp } = await supabase.from('groups').select('*').eq('slug', slug).single();
      setGroup(grp);

      // favorites count
      const { count } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', grp.id);
      setFavCount(count || 0);

      // my favorite id
      if (user) {
        const rows = await getMyFavorites();
        const mine = rows.find(r => r.group_id === grp.id);
        setMyFavId(mine?.id ?? null);
      }

      // related groups
      if (grp?.Type) {
        const types = grp.Type.split(',').map(t => t.trim());
        const { data: rel } = await supabase
          .from('groups')
          .select('*')
          .ilike('Type', `%${types[0]}%`)
          .neq('slug', slug);
        setRelatedGroups(rel || []);
      }

      // updates
      const { data: upd } = await supabase
        .from('group_updates')
        .select('*')
        .eq('group_id', grp.id)
        .order('created_at', { ascending: false });
      setUpdates(upd || []);

      // claim approval
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

  const toggleFav = async () => {
    if (!user || !group) return;
    setToggling(true);
    if (myFavId) {
      await removeFavorite(myFavId);
      setMyFavId(null);
      setFavCount(c => c - 1);
    } else {
      const { data } = await addFavorite(group.id);
      setMyFavId(data[0].id);
      setFavCount(c => c + 1);
    }
    setToggling(false);
  };

  const submitClaim = async () => {
    if (!claimMessage.trim()) return;
    setSubmittingClaim(true);
    await supabase
      .from('group_claim_requests')
      .insert({ group_id: group.id, user_id: user.id, message: claimMessage, status: 'Pending' });
    setSubmittingClaim(false);
    setShowClaimModal(false);
  };

  const handleEdit = async (id, content) => {
    const updated = prompt('Edit your update:', content);
    if (!updated) return;
    await supabase.from('group_updates').update({ content: updated }).eq('id', id);
    setUpdates(updates.map(u => u.id === id ? { ...u, content: updated } : u));
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
          {/* include tags at end of title */}
          <title>{`${group.Name} – Our Philly – ${types.join(', ')}`}</title>

          {/* standard meta description */}
          <meta name="description" content={group.Description} />

          {/* Open Graph */}
          <meta property="og:title" content={group.Name} />
          <meta property="og:description" content={group.Description} />
          <meta property="og:url" content={window.location.href} />
          {/* you can swap in any group image or a default */}
          <meta property="og:image" content={group.imag} />

          {/* keywords from your type tags */}
          <meta name="keywords" content={types.join(', ')} />

          <link rel="icon" href="/favicon.ico" />
        </Helmet>

      <Navbar />
      <GroupProgressBar />

      {/* Header: cover + avatar */}
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
      </div>

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowClaimModal(false)}>
          <div className="bg-white rounded-lg p-6 relative max-w-md w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowClaimModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl">×</button>
            <h2 className="text-xl font-semibold mb-4">Tell us about your connection to this group</h2>
            <textarea
              rows={4}
              value={claimMessage}
              onChange={e => setClaimMessage(e.target.value)}
              className="w-full border rounded p-2 mb-4"
              placeholder="I help organize events for this group..."
            />
            <button
              onClick={submitClaim}
              disabled={submittingClaim}
              className="w-full bg-blue-600 text-white py-2 rounded"
            >{submittingClaim ? 'Submitting…' : 'Submit Claim Request'}</button>
          </div>
        </div>
      )}

      {/* Group Info with inline heart + claim */}
      <div className="mt-24 px-4">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">{group.Name}</h1>
            <button onClick={toggleFav} disabled={toggling} className="flex items-center text-3xl focus:outline-none">
              {myFavId ? '❤️' : '🤍'}
              <span className="ml-1 text-xl font-semibold">{favCount}</span>
            </button>
          </div>
          <p className="text-gray-600 mt-2">{group.Description}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {types.map((type, i) => (
              <Link
                key={i}
                to={`/groups/type/${type.toLowerCase().replace(/\s+/g, '-')}`}
                className="bg-indigo-100 text-indigo-700 px-3 py-1 text-xs rounded-full"
              >{type}</Link>
            ))}
          </div>
          <div className="flex items-center space-x-4 mt-6">
            {group.Link && (
              <a
                href={group.Link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full"
              >Visit Group Website</a>
            )}
            {user && (
              <button
                onClick={() => setShowClaimModal(true)}
                className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full"
              >Claim Group</button>
            )}
          </div>

          {/* Post Update Section */}
          {user ? (
            isApprovedForGroup ? (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Post an Update</h2>
                <GroupUpdateForm groupId={group.id} userId={user.id} onPostSuccess={() => setUpdates([])} />
              </div>
            ) : (
              <div className="mt-10 p-4 bg-gray-100 rounded text-center text-gray-600">
                <p>
                  You need to{' '}<button onClick={() => setShowClaimModal(true)} className="underline text-blue-600">claim this group</button>{' '}before you can post updates.
                </p>
              </div>
            )
          ) : (
            <div className="mt-10 p-4 bg-gray-100 rounded text-center text-gray-600">
              <p>
                Log in to claim this group and post updates.{' '}
                <Link to="/login" className="underline text-blue-600">Log in</Link>{' '}or{' '}
                <Link to="/signup" className="underline text-blue-600">Sign up</Link>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Updates */}
      <div className="max-w-screen-xl mx-auto px-4 mt-12 space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Updates</h2>
        {updates.length === 0 ? (
          <p className="text-gray-500">
            No updates yet.
            {!user && (
              <Link to="/login" className="text-blue-600 underline ml-2">Log in to claim this group</Link>
            )}
          </p>
        ) : (
          updates.map(update => (
            <div key={update.id} className="bg-white border border-gray-200 hover:bg-gray-50 rounded-lg p-4 shadow-sm transition mb-4">
              <div className="flex items-start mb-3">
                <img src={group.imag} alt={group.Name} className="w-10 h-10 rounded-full mr-3 object-cover" />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
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
                <Link key={g.id} to={`/groups/${g.slug}`} className="flex-shrink-0 w-40 h-64 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                  <img src={g.imag} alt={g.Name} className="w-full h-20 object-cover" />
                  <div className="px-2 py-2 flex-1 flex flex-col items-center text-center">
                    <h3 className="text-sm font-semibold truncate w-full">{g.Name}</h3>
                    <p className="text-xs text-gray-600 mt-1 flex-1 overflow-hidden line-clamp-2 w-full">{g.Description}</p>
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
}
