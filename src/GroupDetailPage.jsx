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
import PlansCard from './components/PlansCard.jsx'

const buildSummary = text => {
  if (typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 160) return trimmed
  return `${trimmed.slice(0, 157)}…`
}

const formatTimeLabel = time => {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return ''
  const period = hours >= 12 ? 'p.m.' : 'a.m.'
  const normalizedHours = hours % 12 || 12
  return `${normalizedHours}:${String(minutes).padStart(2, '0')} ${period}`
}

export default function GroupDetailPage() {
  const { slug } = useParams()
  const { user } = useContext(AuthContext)

  // ── Local state ─────────────────────────────────────────────────────────
  const [group, setGroup] = useState(null)
  const [relatedGroups, setRelatedGroups] = useState([])
  const [selectedRelatedTag, setSelectedRelatedTag] = useState('')
  const [relatedVisibleCount, setRelatedVisibleCount] = useState(5)
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
      setRelatedVisibleCount(5)
      return
    }
    const available = group.Type.split(',').map(t => t.trim()).filter(Boolean)
    if (!available.length) {
      setSelectedRelatedTag('')
      setRelatedGroups([])
      setRelatedVisibleCount(5)
      return
    }
    setSelectedRelatedTag(prev => (prev && available.includes(prev) ? prev : available[0]))
  }, [group?.Type])

  useEffect(() => {
    setRelatedCache({})
    setRelatedVisibleCount(5)
  }, [group?.id])

  useEffect(() => {
    setRelatedVisibleCount(5)
  }, [selectedRelatedTag])

  useEffect(() => {
    const availableTypes = group?.Type
      ? group.Type.split(',').map(t => t.trim()).filter(Boolean)
      : []

    if (!group || !selectedRelatedTag || !availableTypes.includes(selectedRelatedTag)) {
      setRelatedGroups([])
      setRelatedLoading(false)
      setRelatedVisibleCount(5)
      return
    }

    const cached = relatedCache[selectedRelatedTag]
    if (cached) {
      setRelatedGroups(cached)
      setRelatedLoading(false)
      setRelatedVisibleCount(5)
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
          setRelatedVisibleCount(5)
          return
        }
        const filtered = (data || []).filter(g => g.slug !== slug)
        setRelatedGroups(filtered)
        setRelatedCache(prev => ({ ...prev, [selectedRelatedTag]: filtered }))
        setRelatedVisibleCount(5)
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
      <section className="mt-12 max-w-screen-xl mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(evt => {
            const start = evt.start_date ? new Date(evt.start_date) : null
            const end = evt.end_date ? new Date(evt.end_date) : null
            const dateLabel = start
              ? end && end.toDateString() !== start.toDateString()
                ? `${start.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })} – ${end.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}`
                : start.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
              : ''
            let imageUrl
            if (evt.image_url) {
              if (evt.image_url.startsWith('http')) {
                imageUrl = evt.image_url
              } else {
                imageUrl = supabase
                  .storage
                  .from('big-board')
                  .getPublicUrl(evt.image_url)
                  .data
                  .publicUrl
              }
            } else {
              imageUrl = group.imag
            }
            const detailPath =
              getDetailPathForItem({
                ...evt,
                group_slug: group.slug,
                isGroupEvent: true,
              }) || '/'
            const timeLabel = formatTimeLabel(evt.start_time)
            const secondaryMeta = [timeLabel, evt.address].filter(Boolean).join(' · ')

            return (
              <PlansCard
                key={evt.id}
                title={evt.title}
                imageUrl={imageUrl}
                href={detailPath}
                badge={{ label: 'Group Event', className: 'bg-emerald-500 text-white' }}
                meta={dateLabel}
                secondaryMeta={secondaryMeta}
                eventId={evt.id}
                sourceTable="group_events"
              />
            )
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
                {relatedGroups.slice(0, relatedVisibleCount).map(g => {
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
              {selectedRelatedTag && relatedGroups.length > relatedVisibleCount && (
                <div className="mt-6 mb-16 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setRelatedVisibleCount(count =>
                        Math.min(count + 5, relatedGroups.length)
                      )
                    }
                    className="inline-flex items-center justify-center rounded-full border border-indigo-200 px-5 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                  >
                    View more groups
                  </button>
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
