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
import GroupEventForm from './GroupEventForm'; // Form component for adding events

import { getMyFavorites, addFavorite, removeFavorite } from './utils/favorites';
import OutletsList from './OutletsList';

export default function GroupDetails() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);

  // ── Local state ─────────────────────────────────────────────────────────
  const [group, setGroup] = useState(null);
  const [relatedGroups, setRelatedGroups] = useState([]);
  const [suggestedOutlets, setSuggestedOutlets] = useState([]);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [favCount, setFavCount] = useState(0);
  const [myFavId, setMyFavId] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [isApprovedForGroup, setIsApprovedForGroup] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  // at the top of the component, alongside claimMessage state:
  const [claimEmail, setClaimEmail] = useState(user?.email || '');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [events, setEvents] = useState([]); // New: holds group-specific events

  // ── Fetch group, favorites, related groups, approval & events ────────────
  useEffect(() => {
    async function fetchData() {
      // Load the group by its slug
      const { data: grp } = await supabase.from('groups').select('*').eq('slug', slug).single();
      setGroup(grp);

      // Fetch total favorites count for this group
      const { count } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', grp.id);
      setFavCount(count || 0);

      // If logged in, get the user's favorite record for this group
      if (user) {
        const rows = await getMyFavorites();
        const mine = rows.find(r => r.group_id === grp.id);
        setMyFavId(mine?.id ?? null);
      }

      // Find related groups by the first type tag
      if (grp?.Type) {
        const types = grp.Type.split(',').map(t => t.trim());
        const { data: rel } = await supabase
          .from('groups')
          .select('*')
          .ilike('Type', `%${types[0]}%`)
          .neq('slug', slug);
        setRelatedGroups(rel || []);
      }

      // Check if user is approved to post events
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

      // Fetch all events for this group, ordered by start_date
      const { data: evts } = await supabase
        .from('group_events')
        .select('*')
        .eq('group_id', grp.id)
        .order('start_date', { ascending: true });
      setEvents(evts || []);
    }
    fetchData();
  }, [slug, user]);

  // ── Fetch news outlets based on group area ───────────────────────────────
  useEffect(() => {
    if (!group) return;
    setLoadingOutlets(true);

    supabase
      .from('news_outlets')
      .select('*')
      .eq('area', group.Area)
      .limit(10)
      .then(({ data, error }) => {
        if (error) console.error('fetching outlets:', error);
        else setSuggestedOutlets(data);
      })
      .finally(() => setLoadingOutlets(false));
  }, [group]);

  // ── Favorite toggle handler ─────────────────────────────────────────────
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

  // ── Claim group handler ────────────────────────────────────────────────
  const submitClaim = async () => {
    if (!claimMessage.trim()) return;
    setSubmittingClaim(true);
    await supabase
      .from('group_claim_requests')
      .insert({ group_id: group.id, user_id: user.id, message: claimMessage, status: 'Pending' });
    setSubmittingClaim(false);
    setShowClaimModal(false);
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (!group) return <div className="text-center py-20 text-gray-500">Loading Group…</div>;

  const types = group.Type?.split(',').map(t => t.trim()) || [];

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      {/* ── SEO & Meta Tags ─────────────────────────────────────────────── */}
      <Helmet>
        <title>{`${group.Name} – Our Philly – ${types.join(', ')}`}</title>
        <meta name="description" content={group.Description} />
        <meta property="og:title" content={group.Name} />
        <meta property="og:description" content={group.Description} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:image" content={group.imag} />
        <meta name="keywords" content={types.join(', ')} />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />
      <GroupProgressBar />

      {/* ── Header: Cover Banner & Avatar ───────────────────────────────── */}
      <div className="relative">
        <div
          className="h-64 bg-cover bg-center"
          style={{ backgroundImage: `url("https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//pine-street-51011_1280.jpg")` }}
        />
        <div className="absolute left-8 bottom-0 transform translate-y-1/2">
          <img
            src={group.imag}
            alt={group.Name}
            className="w-48 h-48 rounded-full border-4 border-white object-cover"
          />
        </div>
      </div>

      {/* ── Claim Modal ───────────────────────────────────────────────────── */}
{showClaimModal && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    onClick={() => setShowClaimModal(false)}
  >
    <div
      className="bg-white rounded-lg p-6 relative max-w-md w-full"
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={() => setShowClaimModal(false)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
      >
        ×
      </button>
      <h2 className="text-xl font-semibold mb-4">Tell us about your connection to this group</h2>

      {/* NEW: email input */}
      <label className="block text-sm font-bold mb-1">Your Email</label>
      <input
        type="email"
        value={claimEmail}
        onChange={e => setClaimEmail(e.target.value)}
        required
        className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="you@example.com"
      />

      <label className="block text-sm font-bold mb-1">Why you can claim this group</label>
      <textarea
        rows={4}
        value={claimMessage}
        onChange={e => setClaimMessage(e.target.value)}
        className="w-full border rounded p-2 mb-4"
        placeholder="I help organize events for this group..."
        required
      />

      <p className="text-xs text-gray-500 mb-4">
        We may message you on Instagram or at your official group email to confirm ownership.
      </p>

      <button
        onClick={async () => {
          setSubmittingClaim(true);
          await supabase
            .from('group_claim_requests')
            .insert({
              group_id: group.id,
              user_id: user.id,
              user_email: claimEmail,      // ← include email here
              message: claimMessage,
              status: 'Pending',
            });
          setSubmittingClaim(false);
          setShowClaimModal(false);
        }}
        disabled={submittingClaim}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
      >
        {submittingClaim ? 'Submitting…' : 'Submit Claim Request'}
      </button>
    </div>
  </div>
)}

      {/* ── Group Info & Actions ─────────────────────────────────────────── */}
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

          {/* ── Add Event Form or Prompt ─────────────────────────────────── */}
          {user ? (
            isApprovedForGroup ? (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Event</h2>
                <GroupEventForm
                  groupId={group.id}
                  userId={user.id}
                  onSuccess={() => {
                    // Refresh events list after successful insert
                    supabase
                      .from('group_events')
                      .select('*')
                      .eq('group_id', group.id)
                      .order('start_date', { ascending: true })
                      .then(({ data }) => setEvents(data || []));
                  }}
                />
              </div>
            ) : (
              <div className="mt-10 p-4 bg-gray-100 rounded text-center text-gray-600">
                <p>
                  You need to{' '}
                  <button onClick={() => setShowClaimModal(true)} className="underline text-blue-600">
                    claim this group
                  </button>{' '}
                  before you can post events.
                </p>
              </div>
            )
          ) : (
            <div className="mt-10 p-4 bg-gray-100 rounded text-center text-gray-600">
              <p>
                Log in to claim this group and post events.{' '}
                <Link to="/login" className="underline text-blue-600">Log in</Link> or{' '}
                <Link to="/signup" className="underline text-blue-600">Sign up</Link>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Events Grid ──────────────────────────────────────────────────── */}
      <section className="mt-12 max-w-screen-xl mx-auto px-4">
        <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(evt => {
            const start = new Date(evt.start_date);
            const end   = evt.end_date ? new Date(evt.end_date) : null;
            const today = new Date();
            const isOngoing = start <= today && (!end || end > today);
            const eventLink = `/groups/${group.slug}/events/${evt.id}`;

            return (
              <Link
                key={evt.id}
                to={eventLink}
                className="relative block bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition"
              >
                {/* Date badge */}
                <div className="absolute top-2 left-2 bg-indigo-600 text-white p-2 rounded">
                  <div className="text-lg font-bold">{start.getDate()}</div>
                  <div className="uppercase text-xs">{start.toLocaleString('en-US', { month: 'short' })}</div>
                </div>

                {/* Event image */}
                <div className="h-40 bg-gray-100">
                  <img
                    src={evt.image || group.imag}
                    alt={evt.title || evt.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Event details */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg truncate">{evt.title || evt.name}</h3>
                  <p className="text-sm mt-1 line-clamp-3">{evt.description}</p>
                  {isOngoing && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                      Ends in{' '}
                      {Math.ceil(((end || start) - today) / (1000 * 60 * 60 * 24))} days
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Related Groups Strip ────────────────────────────────────────── */}
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

      {/* ── Outlets You Might Like ───────────────────────────────────────── */}
      {suggestedOutlets.length > 0 && (
        <section className="w-full bg-neutral-100 pt-12 pb-12">
          <div className="relative w-screen left-1/2 right-1/2 mx-[-50vw] overflow-x-auto overflow-y-hidden">
            <div className="flex space-x-4 flex-nowrap px-4">
              {loadingOutlets ? (
                <p className="text-center w-full">Loading…</p>
              ) : (
                <OutletsList outlets={suggestedOutlets} isAdmin={false} />
              )}
            </div>
          </div>
        </section>
      )}

      <Voicemail />
      <Footer />
    </div>
  );
}
