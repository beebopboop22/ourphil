// src/TagPage.jsx
import React, { useEffect, useState, useMemo, useContext } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import FloatingAddButton from './FloatingAddButton'
import SubmitGroupModal from './SubmitGroupModal'
import PostFlyerModal from './PostFlyerModal'
import { Helmet } from 'react-helmet'
import { RRule } from 'rrule'
import { Clock } from 'lucide-react'
import useEventFavorite from './utils/useEventFavorite'
import { AuthContext } from './AuthProvider'

// ── Helpers to parse dates ────────────────────────────────────────
function parseISODateLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date) ? null : date
}
function parseDate(datesStr) {
  if (!datesStr) return null
  const [first] = datesStr.split(/through|–|-/)
  const [m, d, y] = first.trim().split('/').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date) ? null : date
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  let hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.'
  hour = hour % 12 || 12
  return `${hour}:${m.padStart(2,'0')} ${ampm}`
}


// ── Helper to render “Today/Tomorrow/This …” labels ───────────────
function getDateLabel(date) {
  const today = new Date()
  today.setHours(0,0,0,0)
  const diff = Math.round((date - today) / (1000*60*60*24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) {
    const wd = date.toLocaleDateString('en-US',{ weekday: 'long' })
    return `This ${wd}`
  }
  return date.toLocaleDateString('en-US',{ weekday: 'long' })
}

const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
]

function EventCard({ evt, profileMap, tag }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const now = new Date()
  const startDate = evt.isTradition ? evt.start : parseISODateLocal(evt.start_date)
  const isToday = startDate && startDate.getTime() === today.getTime()
  const diffDays = startDate ? Math.ceil((startDate - now) / (1000*60*60*24)) : 0
  const bubbleLabel = isToday
    ? 'Today'
    : diffDays === 1
      ? 'Tomorrow'
      : startDate
        ? startDate.toLocaleDateString('en-US',{ month:'short', day:'numeric' })
        : ''
  const bubbleTime = evt.start_time ? ` ${formatTime(evt.start_time)}` : ''

  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: evt.isRecurring ? String(evt.id).split('::')[0] : evt.id,
    source_table: evt.isBigBoard
      ? 'big_board_events'
      : evt.isTradition
        ? 'events'
        : evt.isGroupEvent
          ? 'group_events'
          : evt.isRecurring
            ? 'recurring_events'
            : 'all_events',
  })

  return (
    <Link
      to={evt.href}
      className={`block bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition flex flex-col ${isFavorite ? 'ring-2 ring-indigo-600' : ''}`}
    >
      <div className="relative w-full h-48">
        {evt.imageUrl && <img src={evt.imageUrl} alt={evt.title} className="w-full h-full object-cover" />}
        <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded-full text-xs font-semibold text-gray-800">
          {bubbleLabel}{bubbleTime}
        </div>
        {isFavorite && (
          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">In the plans!</div>
        )}
        {evt.isGroupEvent && (
          <div className="absolute inset-x-0 bottom-0 bg-green-600 text-white text-xs uppercase text-center py-1">Group Event</div>
        )}
        {evt.isBigBoard && (
          <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white text-xs uppercase text-center py-1">Submission</div>
        )}
        {evt.isTradition && (
          <div className="absolute inset-x-0 bottom-0 bg-yellow-500 text-white text-xs uppercase text-center py-1">Tradition</div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1 justify-between items-center text-center">
        <div>
          <h3 className="text-lg font-bold text-gray-800 line-clamp-2 mb-1">{evt.title}</h3>
          {evt.isRecurring ? (
            evt.address && <p className="text-sm text-gray-600">at {evt.address}</p>
          ) : (
            evt.venues?.name && <p className="text-sm text-gray-600">at {evt.venues.name}</p>
          )}
        </div>
        <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
          <Link
            to={`/tags/${tag.slug}`}
            className={`${pillStyles[0]} text-[0.6rem] sm:text-sm px-2 sm:px-3 py-1 sm:py-2 rounded-full font-semibold`}
          >
            #{tag.name}
          </Link>
        </div>
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); if (!user) { navigate('/login'); return; } toggleFavorite(); }}
          disabled={loading}
          className={`mt-4 w-full border border-indigo-600 rounded-md py-2 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
        >
          {isFavorite ? 'In the Plans' : 'Add to Plans'}
        </button>
      </div>
      {evt.isBigBoard && (
        <div className="w-full bg-blue-50 text-blue-900 py-2 text-center">
          <div className="text-[0.55rem] uppercase font-semibold tracking-wide">SUBMITTED BY</div>
          <div className="mt-1 flex justify-center gap-1 text-xs font-semibold">
            <span>{profileMap[evt.owner_id]?.username}</span>
            {profileMap[evt.owner_id]?.cultures?.map(c => (
              <span key={c.emoji} className="relative group">
                {c.emoji}
                <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                  {c.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Link>
  )
}

export default function TagPage() {
  const params = useParams()
  const slug = (params.slug || '').replace(/^#/, '')

  // ── State hooks ────────────────────────────────────────────────
  const [tag, setTag] = useState(null)
  const [groups, setGroups] = useState([])
  const [traditions, setTraditions] = useState([])
  const [bigBoard, setBigBoard] = useState([])
  const [groupEvents, setGroupEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [recSeries, setRecSeries] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [allTags, setAllTags] = useState([])
  const [loading, setLoading] = useState(true)

  // modal toggles
  const [showFlyerModal, setShowFlyerModal] = useState(false)
  const [showSubmitGroupModal, setShowSubmitGroupModal] = useState(false)

  // view toggle: 'events' or 'groups'
  const [view, setView] = useState('events')

  // “see more” toggles
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [showAllGroups, setShowAllGroups] = useState(false)

  // Filter UI state for groups
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // ── Derived category list ─────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return groups
      .filter(g => {
        if (selectedCategory !== 'All') {
          const primary = (g.Type || '').split(',')[0].trim()
          if (primary !== selectedCategory) return false
        }
        const lower = searchTerm.toLowerCase()
        return (
          g.Name.toLowerCase().includes(lower) ||
          (g.Description || '').toLowerCase().includes(lower)
        )
      })
  }, [groups, searchTerm, selectedCategory])

  // ── Load tag + all data ────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      // 1) fetch tag
      const { data: t } = await supabase
        .from('tags')
        .select('*')
        .eq('slug', slug)
        .single()
      if (!t) {
        setLoading(false)
        return
      }
      setTag(t)

      // 2) fetch taggings
      const { data: taggings } = await supabase
        .from('taggings')
        .select('taggable_type,taggable_id')
        .eq('tag_id', t.id)
      const byType = taggings.reduce((acc, { taggable_type, taggable_id }) => {
        acc[taggable_type] = acc[taggable_type] || []
        acc[taggable_type].push(taggable_id)
        return acc
      }, {})
      const recurringIds = byType.recurring_events || []

      // 3) parallel fetch all sources
      const [gRes, trRes, bbRes, geRes, aeRes, recRes] = await Promise.all([
        byType.groups?.length
          ? supabase
              .from('groups')
              .select('id,Name,slug,imag,Description,Type')
              .in('id', byType.groups)
          : { data: [] },
        byType.events?.length
          ? supabase
              .from('events')
              .select('id,"E Name","E Image",slug,Dates,"End Date"')
              .in('id', byType.events)
          : { data: [] },
        byType.big_board_events?.length
          ? supabase
              .from('big_board_events')
              .select('id,title,slug,start_date,end_date,big_board_posts!big_board_posts_event_id_fkey(image_url,user_id)')
              .in('id', byType.big_board_events)
          : { data: [] },
        byType.group_events?.length
          ? supabase
              .from('group_events')
              .select('id,title,start_date,end_date,image_url,group_id')
              .in('id', byType.group_events)
          : { data: [] },
        byType.all_events?.length
          ? supabase
              .from('all_events')
              .select('id,name,slug,image,start_date,venue_id(name,slug)')
              .in('id', byType.all_events)
          : { data: [] },
        recurringIds.length
          ? supabase
              .from('recurring_events')
              .select('id,name,slug,image_url,start_date,end_date,start_time,rrule')
              .in('id', recurringIds)
          : { data: [] },
      ])

      // 4) build group_id → slug map for groupEvents
      const evGroupIds = [...new Set((geRes.data || []).map(ev => ev.group_id))]
      const { data: groupRows = [] } = evGroupIds.length
        ? await supabase
            .from('groups')
            .select('id,slug')
            .in('id', evGroupIds)
        : { data: [] }
      const groupSlugMap = {}
      groupRows.forEach(g => { groupSlugMap[g.id] = g.slug })

      // 5) shape and store data
      setGroups(gRes.data || [])

      setTraditions((trRes.data || []).map(e => {
        const start = parseDate(e.Dates)
        const end   = parseDate(e['End Date']) || start
        return {
          id: e.id,
          title: e['E Name'],
          imageUrl: e['E Image'] || '',
          start,
          end,
          start_date: start ? start.toISOString().slice(0,10) : null,
          end_date: end ? end.toISOString().slice(0,10) : null,
          slug: e.slug,
          href: `/events/${e.slug}`,
          isTradition: true,
        }
      }))

      setBigBoard((bbRes.data || []).map(ev => {
        const key = ev.big_board_posts?.[0]?.image_url
        const owner = ev.big_board_posts?.[0]?.user_id
        const url = key
          ? supabase.storage
              .from('big-board')
              .getPublicUrl(key).data.publicUrl
          : ''
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date || ev.start_date)
        return {
          id: ev.id,
          title: ev.title,
          imageUrl: url,
          start,
          end,
          start_date: ev.start_date,
          end_date: ev.end_date || ev.start_date,
          slug: ev.slug,
          owner_id: owner,
          href: `/big-board/${ev.slug}`,
          isBigBoard: true,
        }
      }))

      setGroupEvents((geRes.data || []).map(ev => {
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date || ev.start_date)
        let imgUrl = ''
        if (ev.image_url) {
          imgUrl = ev.image_url.startsWith('http')
            ? ev.image_url
            : supabase.storage
                .from('big-board')
                .getPublicUrl(ev.image_url).data.publicUrl
        }
        const slug = groupSlugMap[ev.group_id]
        return {
          id: ev.id,
          title: ev.title,
          imageUrl: imgUrl,
          start,
          end,
          start_date: ev.start_date,
          end_date: ev.end_date || ev.start_date,
          group_slug: slug,
          href: `/groups/${slug}/events/${ev.id}`,
          isGroupEvent: true,
        }
      }))

      setAllEvents((aeRes.data || []).map(ev => {
        const start = parseISODateLocal(ev.start_date)
        const venueSlug = ev.venue_id?.slug || null
        return {
          id: ev.id,
          title: ev.name,
          imageUrl: ev.image || '',
          start,
          start_date: ev.start_date,
          slug: ev.slug,
          venues: ev.venue_id
            ? { name: ev.venue_id.name, slug: venueSlug }
            : null,
          href: venueSlug ? `/${venueSlug}/${ev.slug}` : `/${ev.slug}`,
        }
      }))

      setRecSeries(recRes.data || [])
      setLoading(false)
    }
    load()
  }, [slug])

  // Load profile info for big-board submitters
  useEffect(() => {
    const ids = Array.from(new Set(bigBoard.map(e => e.owner_id).filter(Boolean)))
    if (!ids.length) { setProfileMap({}); return }
    ;(async () => {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,username,image_url')
        .in('id', ids)
      const map = {}
      for (const p of profs || []) {
        let img = p.image_url || ''
        if (img && !img.startsWith('http')) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-images')
            .getPublicUrl(img)
          img = publicUrl
        }
        map[p.id] = { username: p.username, image: img, cultures: [] }
      }
      const { data: rows } = await supabase
        .from('profile_tags')
        .select('profile_id, culture_tags(id,name,emoji)')
        .in('profile_id', ids)
        .eq('tag_type', 'culture')
      rows?.forEach(r => {
        if (!map[r.profile_id]) map[r.profile_id] = { username: '', image: '', cultures: [] }
        if (r.culture_tags?.emoji) {
          map[r.profile_id].cultures.push({ emoji: r.culture_tags.emoji, name: r.culture_tags.name })
        }
      })
      setProfileMap(map)
    })()
  }, [bigBoard])

  // ── load all tags for bottom nav ───────────────────────────────
  useEffect(() => {
    supabase.from('tags').select('name,slug').order('name')
      .then(({ data }) => setAllTags(data || []))
  }, [])

  // ── derive recurring instances ─────────────────────────────────
  const recEventsList = useMemo(() => {
    return recSeries.flatMap(series => {
      if (!series.start_date) return []
      const opts = RRule.parseString(series.rrule)
      const startTime = series.start_time || '00:00:00'
      const dtstart = new Date(`${series.start_date}T${startTime}`)
      if (isNaN(dtstart)) return []
      opts.dtstart = dtstart
      if (series.end_date) opts.until = new Date(`${series.end_date}T23:59:59`)
      return new RRule(opts)
        .all()
        .filter(d => d >= new Date())
        .slice(0, 3)
        .map(d => ({
          id: `${series.id}::${d.toISOString().slice(0,10)}`,
          title: series.name,
          imageUrl: series.image_url,
          start: d,
          start_date: d.toISOString().slice(0,10),
          start_time: series.start_time,
          slug: series.slug,
          address: series.address,
          href: `/series/${series.slug}/${d.toISOString().slice(0,10)}`,
          isRecurring: true,
        }))
    })
  }, [recSeries])

  if (loading) return <p className="text-center py-20">Loading…</p>
  if (!tag)    return <p className="text-center py-20 text-red-600">Tag not found</p>

  // ── merge + sort all events ────────────────────────────────────
  const allList = [
    ...traditions,
    ...bigBoard,
    ...groupEvents,
    ...allEvents,
    ...recEventsList,
  ]
  const today0 = new Date(); today0.setHours(0,0,0,0)
  const upcoming = allList
    .filter(e => e.start && e.start >= today0)
    .sort((a,b) => a.start - b.start)

  // ── slice for see-more ────────────────────────────────────────
  const displayedEvents = showAllEvents ? upcoming : upcoming.slice(0,16)
  const displayedGroups = showAllGroups ? filteredGroups : filteredGroups.slice(0,16)

  return (
    <>
      <Helmet>
        <title>
          #{tag.name} –{' '}
          {tag.description || `${groups.length} groups & ${upcoming.length} events`} | Our Philly
        </title>
      </Helmet>

      <div className="min-h-screen bg-neutral-50">
        <Navbar/>

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="mt-20 bg-gradient-to-r from-red-50 to-indigo-50 border-b">
          <div className="max-w-screen-xl mx-auto px-4 py-10 text-center">
            <h1 className="text-4xl font-[barrio] text-gray-800 mb-4">#{tag.name}</h1>
            {tag.is_seasonal && (
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-1 bg-[#d9e9ea] text-[#004C55] px-3 py-1 rounded-full text-xs font-semibold">
                  <Clock className="w-4 h-4" />
                  Seasonal Tag
                </div>
              </div>
            )}
            {tag.description && (
              <p className="max-w-2xl mx-auto text-gray-700 mb-6">{tag.description}</p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setView('events')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                  view === 'events'
                    ? 'bg-[#bf3d35] text-white'
                    : 'bg-white border border-[#bf3d35] text-[#bf3d35]'
                }`}
              >
                Events
              </button>
              <button
                onClick={() => setView('groups')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                  view === 'groups'
                    ? 'bg-[#29313f] text-white'
                    : 'bg-white border border-[#29313f] text-[#29313f]'
                }`}
              >
                Groups
              </button>
              <button
                onClick={() => setShowFlyerModal(true)}
                className="px-4 py-2 rounded-full text-sm bg-[#bf3d35] text-white hover:opacity-90 transition"
              >
                Submit Event
              </button>
              <button
                onClick={() => setShowSubmitGroupModal(true)}
                className="px-4 py-2 rounded-full text-sm bg-[#29313f] text-white hover:opacity-90 transition"
              >
                Submit Group
              </button>
            </div>
          </div>
        </div>

        {/* ── EVENTS GRID ─────────────────────────────────────────── */}
        {view === 'events' && (
          <section className="max-w-screen-xl mx-auto px-4 py-8">
            <h3 className="text-2xl font-[barrio] text-gray-800 text-center mb-6">
              Upcoming #{tag.name} events
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayedEvents.map(evt => (
                <EventCard key={evt.id + evt.start} evt={evt} profileMap={profileMap} tag={tag} />
              ))}
            </div>
            {!showAllEvents && upcoming.length > 16 && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowAllEvents(true)}
                  className="px-6 py-2 bg-[#bf3d35] text-white rounded-full hover:opacity-90 transition"
                >
                  See more events
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── GROUPS GRID ─────────────────────────────────────────── */}
        {view === 'groups' && (
          <section className="max-w-screen-xl mx-auto px-4 py-8">
            <h3 className="text-2xl font-[barrio] text-gray-800 text-center mb-6">
              Discover #{tag.name} groups
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayedGroups.map(g => (
                <Link
                  key={g.id}
                  to={`/groups/${g.slug}`}
                  className="block bg-white rounded-xl border hover:shadow-lg transition overflow-hidden"
                >
                  <div className="h-32 bg-gray-100">
                    <img
                      src={g.imag}
                      alt={g.Name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {g.Name}
                    </h4>
                  </div>
                </Link>
              ))}
            </div>
            {!showAllGroups && filteredGroups.length > 16 && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowAllGroups(true)}
                  className="px-6 py-2 bg-[#29313f] text-white rounded-full hover:opacity-90 transition"
                >
                  See more groups
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Browse all tags ───────────────────────────────────────── */}
        <section className="py-12 bg-white mb-16">
          <div className="max-w-screen-xl mx-auto px-4">
            <h3 className="text-3xl font-bold mb-4 text-center">Browse all tags</h3>
            <div className="overflow-x-auto py-4">
              <div className="flex space-x-4 px-4">
                {allTags.map(t => (
                  <Link
                    key={t.slug}
                    to={`/tags/${t.slug}`}
                    className="flex-shrink-0 bg-indigo-600 text-white px-6 py-3 text-lg font-semibold rounded-full whitespace-nowrap hover:bg-indigo-700 transition"
                  >
                    #{t.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <FloatingAddButton onClick={() => setShowFlyerModal(true)} />

        {showFlyerModal && (
          <PostFlyerModal isOpen onClose={() => setShowFlyerModal(false)} />
        )}
        {showSubmitGroupModal && (
          <SubmitGroupModal isOpen onClose={() => setShowSubmitGroupModal(false)} />
        )}

        <Footer/>
      </div>
    </>
  )
}
