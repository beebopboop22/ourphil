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

  // Modal state and claim message state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    async function fetchGroupData() {
      const { data: grp } = await supabase
        .from('groups')
        .select('*')
        .eq('slug', slug)
        .single();
      setGroup(grp);

      // favorites count and existing favorite
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
    }
    fetchGroupData();
  }, [slug, user]);

  useEffect(() => {
    if (!group) return;
    async function loadUpdates() {
      const { data } = await supabase
        .from('group_updates')
        .select('*')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false });
      setUpdates(data || []);
    }
    loadUpdates();
  }, [group]);

  useEffect(() => {
    if (!user || !group) return;
    async function checkApproval() {
      const { data } = await supabase
        .from('group_claim_requests')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .eq('status', 'Approved')
        .single();
      setIsApprovedForGroup(!!data);
    }
    checkApproval();
  }, [user, group]);

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

  const submitClaim = async () => {
    if (!claimMessage.trim()) return;
    setSubmittingClaim(true);
    await supabase
      .from('group_claim_requests')
      .insert({ group_id: group.id, user_id: user.id, message: claimMessage, status: 'Pending' });
    setSubmittingClaim(false);
    setShowClaimModal(false);
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
          style={{ backgroundImage: `url("https://images.unsplash.com/photo-1516508636691-2ea98becb2f5?q=80&w=2671&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fA%3D%3D")` }}
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
          {/* Always show Claim Group button */}
          {user && (
            <button
              onClick={() => setShowClaimModal(true)}
              className="px-6 py-4 bg-blue-600 text-white rounded-full shadow text-lg"
            >
              Claim Group
            </button>
          )}
        </div>
      </div>

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
            <button
              onClick={() => setShowClaimModal(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
            >&times;</button>
            <h2 className="text-xl font-semibold mb-4">Tell us about your connection to this group:</h2>
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
            >
              {submittingClaim ? 'Submitting…' : 'Submit Claim Request'}
            </button>
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
                to={`/groups/type/${type.toLowerCase().replace(/\s+/g, '-')}`}
                className="bg-indigo-100 text-indigo-700 px-3 py-1 text-xs rounded-full"
              >
                {type}
              </Link>
            ))}
          </div>
          {group.Link && (
            <a
              href={group.Link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full mt-4"
            >Visit Group Website</a>
          )}

          {user && isApprovedForGroup && (
            <div className="mt-10">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Post an Update</h2>
              <GroupUpdateForm groupId={group.id} userId={user.id} onPostSuccess={() => setUpdates([])} />
            </div>
          )}
        </div>
      </div>

      {/* Updates */}
      <div className="max-w-screen-xl mx-auto px-4 mt-12 space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Updates</h2>
        {updates.map(update => (
          <div
            key={update.id}
            className="bg-white border border-gray-200 hover:bg-gray-50 rounded-lg p-4 shadow-sm transition"
          >
            <div className="flex items-start mb-3">
              <img
                src={group.imag}
                alt={group.Name}
                className="w-10 h-10 rounded-full mr-3 object-cover"
              />
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
        ))}
      </div>

      {/* Related Groups */}
      {relatedGroups.length > visibleCount && (
        <div className="max-w-screen-xl mx-auto px-4 mt-16">
          <h2 className="text-4xl font-[Barrio] text-gray-800 text-center mb-6">More in {types.slice(0, 2).join(', ')}</h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {relatedGroups.slice(0, visibleCount).map(g => <GroupCard key={g.id} group={g} isAdmin={false} />)}
          </div>
          <div className="flex justify-center mt-6">
            <button onClick={() => setVisibleCount(v => v + 10)} className="px-5 py-2 border rounded-full">See More</button>
          </div>
        </div>
      )}

      <Voicemail />
      <Footer />
    </div>
  );
};

export default GroupDetails;
