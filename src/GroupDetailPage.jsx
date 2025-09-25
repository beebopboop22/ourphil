// src/GroupDetailPage.jsx
import React, { useEffect, useState, useContext } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import GroupProgressBar from './GroupProgressBar'
import { AuthContext } from './AuthProvider'
import GroupEventModal from './GroupEventModal'
import { getMyFavorites, addFavorite, removeFavorite } from './utils/favorites'
import Footer from './Footer'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'

const buildSummary = text => {
  if (typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 160) return trimmed
  return `${trimmed.slice(0, 157)}…`
}

export default function GroupDetailPage() {
  const { slug } = useParams()
  const { user } = useContext(AuthContext)

  // ── Local state ─────────────────────────────────────────────────────────
  const [group, setGroup] = useState(null)
  const [relatedGroups, setRelatedGroups] = useState([])
  const [selectedRelatedTag, setSelectedRelatedTag] = useState('')
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [relatedCache, setRelatedCache] = useState({})
  const [favCount, setFavCount] = useState(0)
  const [myFavId, setMyFavId] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [isApprovedForGroup, setIsApprovedForGroup] = useState(false)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')
  const [claimEmail, setClaimEmail] = useState(user?.email || '')
  const [submittingClaim, setSubmittingClaim] = useState(false)
  const [events, setEvents] = useState([])
  const [showEventModal, setShowEventModal] = useState(false)

  // ── Fetch group, favorites, related groups, approval & events ────────────
  useEffect(() => {
    async function fetchData() {
      const { data: grp } = await supabase
        .from('groups')
        .select('*')
        .eq('slug', slug)
        .single()
      setGroup(grp)

      const { count } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', grp.id)
      setFavCount(count || 0)

      if (user) {
        const rows = await getMyFavorites()
        const mine = rows.find(r => r.group_id === grp.id)
        setMyFavId(mine?.id ?? null)
      }

      if (user) {
        const { data } = await supabase
          .from('group_claim_requests')
          .select('id')
          .eq('group_id', grp.id)
          .eq('user_id', user.id)
          .eq('status', 'Approved')
          .single()
        setIsApprovedForGroup(!!data)
      }

      const { data: evts } = await supabase
        .from('group_events')
        .select('*')
        .eq('group_id', grp.id)
        .order('start_date', { ascending: true })
      setEvents(evts || [])
    }
    fetchData()
  }, [slug, user])

  // ── Handle related tags selection ───────────────────────────────────────
  useEffect(() => {
    if (!group?.Type) {
      setSelectedRelatedTag('')
      setRelatedGroups([])
      return
    }
    const available = group.Type.split(',').map(t => t.trim()).filter(Boolean)
    if (!available.length) {
      setSelectedRelatedTag('')
      setRelatedGroups([])
      return
    }
    setSelectedRelatedTag(prev => (prev && available.includes(prev) ? prev : available[0]))
  }, [group?.Type])

  useEffect(() => {
    setRelatedCache({})
  }, [group?.id])

  useEffect(() => {
    const availableTypes = group?.Type
      ? group.Type.split(',').map(t => t.trim()).filter(Boolean)
      : []

    if (!group || !selectedRelatedTag || !availableTypes.includes(selectedRelatedTag)) {
      setRelatedGroups([])
      setRelatedLoading(false)
      return
    }

    const cached = relatedCache[selectedRelatedTag]
    if (cached) {
      setRelatedGroups(cached)
      setRelatedLoading(false)
      return
    }

    let isCancelled = false
    setRelatedLoading(true)

    supabase
      .from('groups')
      .select('id, Name, slug, imag, Description, Type')
      .ilike('Type', `%${selectedRelatedTag}%`)
      .neq('slug', slug)
      .limit(12)
      .then(({ data, error }) => {
        if (isCancelled) return
        if (error) {
          console.error('Error loading related groups:', error)
          setRelatedGroups([])
          return
        }
        const filtered = (data || []).filter(g => g.slug !== slug)
        setRelatedGroups(filtered)
        setRelatedCache(prev => ({ ...prev, [selectedRelatedTag]: filtered }))
      })
      .finally(() => {
        if (!isCancelled) setRelatedLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [group?.id, selectedRelatedTag, slug, relatedCache])

  // ── Favorite toggle handler ─────────────────────────────────────────────
  const toggleFav = async () => {
    if (!user || !group) return
    setToggling(true)
    if (myFavId) {
      await removeFavorite(myFavId)
      setMyFavId(null)
      setFavCount(c => c - 1)
    } else {
      const { data } = await addFavorite(group.id)
      setMyFavId(data[0].id)
      setFavCount(c => c + 1)
    }
    setToggling(false)
  }

  // ── Claim group handler ────────────────────────────────────────────────
  const submitClaim = async () => {
    if (!claimMessage.trim()) return
    setSubmittingClaim(true)
    await supabase
      .from('group_claim_requests')
      .insert({
        group_id:   group.id,
        user_id:    user.id,
        user_email: claimEmail,
        message:    claimMessage,
        status:     'Pending',
      })
    setSubmittingClaim(false)
    setShowClaimModal(false)
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (!group) {
    return <div className="text-center py-20 text-gray-500">Loading Group…</div>
  }

  const types = group.Type?.split(',').map(t => t.trim()).filter(Boolean) || []
  const slugify = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const metaDesc = group.Description?.length > 140
    ? group.Description.slice(0, 137) + '…'
    : group.Description

  return (
    <div className="min-h-screen bg-neutral-50 pt-32">
      {/* ── SEO & Meta Tags ─────────────────────────────────────────────── */}
      <Helmet>
        <title>
          {group.Name} | {types.join(', ')} Community | Find Groups on Our Philly
        </title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={`${group.Name} | Our Philly`} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={`https://ourphilly.org${window.location.pathname}`} />
        <meta property="og:image" content={group.imag} />
      </Helmet>

      <Navbar />
      <GroupProgressBar />

      {/* ── Header: Cover Banner & Avatar ───────────────────────────────── */}
      <div className="relative">
        <div
          className="h-64 bg-cover bg-center"
          style={{
            backgroundImage: `url("https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/pine-street-51011_1280.jpg")`
          }}
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
            <h2 className="text-xl font-semibold mb-4">
              Tell us about your connection to this group
            </h2>

            {/* Email */}
            <label className="block text-sm font-bold mb-1">Your Email</label>
            <input
              type="email"
              value={claimEmail}
              onChange={e => setClaimEmail(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />

            {/* Message */}
            <label className="block text-sm font-bold mb-1">
              Why you can claim this group
            </label>
            <textarea
              rows={4}
              value={claimMessage}
              onChange={e => setClaimMessage(e.target.value)}
              className="w-full border rounded p-2 mb-4"
              placeholder="I help organize events for this group..."
              required
            />

            <p className="text-xs text-gray-500 mb-4">
              We may message you on Instagram or at your official group email to
              confirm ownership.
            </p>

            <button
              onClick={submitClaim}
              disabled={submittingClaim}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
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
            <button
              onClick={toggleFav}
              disabled={toggling}
              className="flex items-center text-3xl focus:outline-none"
            >
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
              >
                {type}
              </Link>
            ))}
          </div>
          <div className="flex items-center space-x-4 mt-6">
            {group.Link && (
              <a
                href={group.Link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full"
              >
                Visit Group Website
              </a>
            )}
            {user && (
              <button
                onClick={() => setShowClaimModal(true)}
                className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full"
              >
                Claim Group
              </button>
            )}
          </div>
          <div className="mt-2">
            <a href="/groups-faq" className="text-sm text-indigo-700 underline">
              Read our Groups FAQ
            </a>
          </div>

          {/* ── Add Event Form or Prompt ─────────────────────────────────── */}
          {user ? (
            isApprovedForGroup ? (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Add New Event
                </h2>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-3xl hover:bg-gray-300"
                >
                  ＋
                </button>
                <GroupEventModal
                  isOpen={showEventModal}
                  onClose={() => setShowEventModal(false)}
                  groupId={group.id}
                  userId={user.id}
                  onSuccess={() => {
                    supabase
                      .from('group_events')
                      .select('*')
                      .eq('group_id', group.id)
                      .order('start_date', { ascending: true })
                      .then(({ data }) => setEvents(data || []))
                    setShowEventModal(false)
                  }}
                />
              </div>
            ) : (
              <div className="mt-10 p-4 bg-gray-100 rounded text-center text-gray-600">
                <p>
                  You need to{' '}
                  <button
                    onClick={() => setShowClaimModal(true)}
                    className="underline text-blue-600"
                  >
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
                <Link to="/login" className="underline text-blue-600">
                  Log in
                </Link>{' '}
                or{' '}
                <Link to="/signup" className="underline text-blue-600">
                  Sign up
                </Link>
                .
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

      // Determine image URL: if it's already a full URL, use it; otherwise
      // treat it as a key in your 'big-board' bucket.
      let imageUrl;
      if (evt.image_url) {
        if (evt.image_url.startsWith('http')) {
          imageUrl = evt.image_url;
        } else {
          imageUrl = supabase
            .storage
            .from('big-board')
            .getPublicUrl(evt.image_url)
            .data
            .publicUrl;
        }
      } else {
        imageUrl = group.imag;
      }

      return (
        <Link
          key={evt.id}
          to={
            getDetailPathForItem({
              ...evt,
              group_slug: group.slug,
              isGroupEvent: true,
            }) || '/'
          }
          className="relative block bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition"
        >
          {/* Date badge */}
          <div className="absolute top-2 left-2 bg-indigo-600 text-white p-2 rounded">
            <div className="text-lg font-bold">{start.getDate()}</div>
            <div className="uppercase text-xs">
              {start.toLocaleString('en-US', { month: 'short' })}
            </div>
          </div>

          {/* Event image */}
          <div className="h-40 bg-gray-100">
            <img
              src={imageUrl}
              alt={evt.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Event details */}
          <div className="p-4">
            <h3 className="font-semibold text-lg truncate">{evt.title}</h3>
            <p className="text-sm mt-1 line-clamp-3">{evt.description}</p>
            {isOngoing && (
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                Ends in{' '}
                {Math.ceil(((end || start) - today) / (1000 * 60 * 60 * 24))}{' '}
                days
              </span>
            )}
          </div>
        </Link>
      );
    })}
  </div>
</section>


      {types.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 mt-16">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800">
              More in {selectedRelatedTag || types[0]}
            </h2>
            <div className="flex flex-wrap gap-2">
              {types.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedRelatedTag(type)}
                  className={`px-4 py-2 rounded-full border text-sm font-semibold transition ${
                    selectedRelatedTag === type
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-indigo-100 text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  #{type}
                </button>
              ))}
            </div>
          </div>

          {relatedLoading ? (
            <p className="text-center text-gray-500 mt-8">Loading…</p>
          ) : relatedGroups.length === 0 ? (
            <p className="text-center text-gray-500 mt-8">No related groups yet.</p>
          ) : (
            <>
              <ul className="mt-8 space-y-5">
                {relatedGroups.slice(0, 5).map(g => {
                  const groupTypes = g?.Type
                    ? g.Type.split(',').map(type => type.trim()).filter(Boolean)
                    : []
                  const summary = buildSummary(g.Description || '')

                  return (
                    <li
                      key={g.id}
                      className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition"
                    >
                      <Link
                        to={`/groups/${g.slug}`}
                        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex flex-1 items-start gap-4">
                          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-indigo-50">
                            {g.imag ? (
                              <img
                                src={g.imag}
                                alt={g.Name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-indigo-400">
                                No photo yet
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                              Local Group
                            </p>
                            <h3 className="text-lg font-semibold text-gray-900">{g.Name}</h3>
                            {summary && (
                              <p className="mt-2 text-sm text-gray-600">{summary}</p>
                            )}
                            {groupTypes.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {groupTypes.map(type => (
                                  <span
                                    key={`${g.id}-${type}`}
                                    className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
                                  >
                                    {type}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-indigo-600 whitespace-nowrap">
                          View group →
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              {selectedRelatedTag && (
                <div className="mt-6 text-center">
                  <Link
                    to={`/groups/type/${slugify(selectedRelatedTag)}`}
                    className="inline-flex items-center justify-center rounded-full border border-indigo-200 px-5 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                  >
                    View more groups
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <Footer />
    </div>
  )
}
