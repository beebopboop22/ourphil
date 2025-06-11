// src/TagPage.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import FloatingAddButton from './FloatingAddButton'
import PostFlyerModal from './PostFlyerModal'
import { Helmet } from 'react-helmet'
import FloatingGallery from './FloatingGallery'

// ── Helpers to parse dates ────────────────────────────────────────
function parseISODateLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function parseDate(datesStr) {
  if (!datesStr) return null
  const [first] = datesStr.split(/through|–|-/)
  const [m, d, y] = first.trim().split('/').map(Number)
  return new Date(y, m - 1, d)
}

export default function TagPage() {
  const { slug } = useParams()

  // ── State hooks ────────────────────────────────────────────────
  const [tag, setTag] = useState(null)
  const [groups, setGroups] = useState([])
  const [traditions, setTraditions] = useState([])
  const [bigBoard, setBigBoard] = useState([])
  const [groupEvents, setGroupEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFlyerModal, setShowFlyerModal] = useState(false)

  // ── Filter UI state ────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // ── Derived category list ─────────────────────────────────────
  const categories = useMemo(() => {
    const all = groups
      .flatMap(g => (g.Type || '').split(','))
      .map(t => t.trim())
      .filter(Boolean)
    return ['All', ...Array.from(new Set(all))]
  }, [groups])

  

  // ── Filtered groups ────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
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

  // ── Load everything ─────────────────────────────────────────────
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

      // 3) fetch each table
      const [gRes, trRes, bbRes, geRes, aeRes] = await Promise.all([
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
              .select('id,title,slug,big_board_posts!big_board_posts_event_id_fkey(image_url),start_date,end_date')
              .in('id', byType.big_board_events)
          : { data: [] },

        byType.group_events?.length
          ? supabase
              .from('group_events')
              .select('id,title,slug,start_date,end_date,groups(Name,imag,slug)')
              .in('id', byType.group_events)
          : { data: [] },

        byType.all_events?.length
          ? supabase
              .from('all_events')
              .select('id,name,slug,image,start_date,venue_id(name,slug)')
              .in('id', byType.all_events)
          : { data: [] }
      ])

      // 4) shape each collection
      setGroups(gRes.data || [])
      setTraditions((trRes.data || []).map(e => ({
        id: e.id,
        title: e['E Name'],
        slug: e.slug,
        imageUrl: e['E Image'] || '',
        start: parseDate(e.Dates),
        end: parseDate(e['End Date']) || parseDate(e.Dates),
        isTradition: true
      })))
      setBigBoard((bbRes.data || []).map(ev => {
        const key = ev.big_board_posts?.[0]?.image_url
        const url = key
          ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
          : ''
        return {
          id: ev.id,
          title: ev.title,
          slug: ev.slug,
          imageUrl: url,
          isBigBoard: true,
          start: parseISODateLocal(ev.start_date),
          end: parseISODateLocal(ev.end_date)
        }
      }))
      setGroupEvents((geRes.data || []).map(ev => ({
        id: ev.id,
        title: ev.title,
        slug: ev.slug,
        imageUrl: ev.groups?.imag || '',
        start: parseISODateLocal(ev.start_date),
        end: parseISODateLocal(ev.end_date),
        href: `/groups/${ev.groups.slug}/events/${ev.id}`,
        isGroupEvent: true
      })))
      setAllEvents((aeRes.data || []).map(ev => ({
        id: ev.id,
        title: ev.name,
        slug: ev.slug,
        imageUrl: ev.image || '',
        start: parseISODateLocal(ev.start_date),
        href: `/${ev.venue_id.slug}/${ev.slug}`,
        isAllEvent: true
      })))

      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return <p className="text-center py-20">Loading…</p>
  if (!tag)    return <p className="text-center py-20 text-red-600">Tag not found</p>

  // combine all event-like items
  const events = [...traditions, ...bigBoard, ...groupEvents, ...allEvents]
  const totalGroups = groups.length
  const totalEvents = events.length

  // filter only upcoming
  const today0 = new Date(); today0.setHours(0,0,0,0)
  const upcomingEvents = events
    .filter(e => e.start && e.start >= today0)
    .sort((a,b) => a.start - b.start)

// inside your TagPage, just below where you compute `upcomingEvents`:
const nextEvent = upcomingEvents[0] || null

    

  return (
    <>
      <Helmet>
        <title>#{tag.name} | Our Philly</title>
        <meta
          name="description"
          content={
            tag.description ||
            `${totalGroups} groups & ${totalEvents} events tagged #${tag.name}`
          }
        />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <div className="flex flex-col min-h-screen bg-neutral-50 pt-20">
        <Navbar/>

        {/* Hero */}
        {/* Hero */}
<div className="relative bg-gray-100 overflow-hidden pt-20 pb-12 mb-8 h-[44vh]">
  {/* skyline behind */}
  <img
    src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//skyline-grey.png"
    alt=""
    className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
  />

  {/* Floating gallery: column on mobile, row on sm+ */}
  <div className="absolute inset-0 pointer-events-none flex flex-col sm:flex-row items-center justify-center gap-4">
    <FloatingGallery images={groups.map(g => g.imag).filter(Boolean)} />
  </div>

  {/* Header content */}
  <div className="relative max-w-6xl mx-auto px-4 text-center sm:text-left z-10">
    <h1 className="text-4xl font-[barrio] sm:text-8xl font-extrabold text-indigo-900 mb-2">
      #{tag.name}
    </h1>

    {/* Next-Event Spotlight */}
    {nextEvent && (() => {
      let to
      if (nextEvent.isGroupEvent)       to = nextEvent.href
      else if (nextEvent.isTradition)   to = `/events/${nextEvent.slug}`
      else if (nextEvent.isBigBoard)    to = `/big-board/${nextEvent.slug}`
      else if (nextEvent.isAllEvent)    to = nextEvent.href
      else                               to = '#'

      return (
        <div className="mt-4 text-base sm:text-lg text-gray-800">
          <span className="font-medium text-indigo-600">Next up:</span>{' '}
          <Link to={to} className="font-semibold hover:underline">
            {nextEvent.title} —{' '}
            {nextEvent.start.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric'
            })}
          </Link>
        </div>
      )
    })()}
  </div>
</div>


        {/* Upcoming events grid */}
<section className="-mt-20 relative z-10">
  <div className="max-w-screen-xl mx-auto bg-gray-100 text-white rounded-xl px-8 py-12 shadow-2xl">
    <h3 className="text-3xl font-bold font-[barrio] text-black text-center mb-6">
      Upcoming #{tag.name} events
    </h3>

    {/* horizontal scroll wrapper */}
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex space-x-6">
        {/* “+” card */}
        <button
          onClick={() => setShowFlyerModal(true)}
          className="flex-shrink-0 w-64 bg-gray-700 border-2 border-dashed border-gray-500 rounded-xl flex flex-col items-center justify-center p-6 hover:bg-gray-600 transition"
        >
          <span className="text-5xl">+</span>
          <span className="mt-2 text-sm">Add Event</span>
        </button>

        {upcomingEvents.map(evt => {
          const day = evt.start.getDate()
          const month = evt.start
            .toLocaleString('en-US',{ month:'short' })
            .slice(0,3)
          const href = evt.isGroupEvent
            ? evt.href
            : evt.isTradition
              ? `/events/${evt.slug}`
              : evt.isBigBoard
                ? `/big-board/${evt.slug}`
                : evt.isAllEvent
                  ? evt.href
                  : '#'

          return (
            <Link
              key={evt.id}
              to={href}
              className="flex-shrink-0 w-64 relative bg-white rounded-xl shadow-lg overflow-hidden flex flex-col hover:scale-105 transition-transform"
            >
              {/* date badge */}
              <div className="absolute top-2 left-2 pt-4 w-8 h-8 rounded bg-gray-900/80 flex items-center justify-center z-10">
                <div className="text-center text-white">
                  <div className="font-bold text-lg">{day}</div>
                  <div className="text-xs uppercase">{month}</div>
                </div>
              </div>

              {/* image */}
              <div className="relative w-full h-40 bg-gray-200">
                {evt.imageUrl && (
                  <img
                    src={evt.imageUrl}
                    alt={evt.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-800/80 to-transparent" />
              </div>

              {/* ribbons */}
              {evt.isBigBoard && (
                <div className="absolute inset-x-0 bottom-0 h-6 bg-indigo-600 flex items-center justify-center z-20">
                  <span className="text-xs font-bold text-white uppercase">
                    COMMUNITY SUBMISSION
                  </span>
                </div>
              )}
              {evt.isTradition && (
                <div className="absolute inset-x-0 bottom-0 h-6 bg-yellow-500 flex items-center justify-center z-20">
                  <span className="text-xs font-bold text-white uppercase">
                    ANNUAL TRADITION
                  </span>
                </div>
              )}

              {/* footer text */}
              <div className="pb-7 pt-2 flex-1 flex text-center flex-col">
                <p className="text-sm font-semibold text-gray-900 leading-snug">
                  {evt.title.length > 40
                    ? `${evt.title.slice(0,40)}…`
                    : evt.title}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  </div>
</section>


        {/* Discover Groups */}
        <section className="mt-16 mb-20">
        <div className="max-w-screen-3xl mx-auto px-4">
    {/* Hero header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
   <h2 className="text-4xl text-center font-[barrio] text-indigo-900">
     Discover {filteredGroups.length} #{tag.name} groups
   </h2>
   <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
     <input
       type="search"
       placeholder="Search groups..."
       value={searchTerm}
       onChange={e => setSearchTerm(e.target.value)}
        className="w-full sm:flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
      />
     </div>
   </div>

            {filteredGroups.length>0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredGroups.map(g => (
                  <div
                    key={g.id}
                    className="relative bg-white rounded-xl border overflow-hidden hover:shadow-xl transition"
                  >
                    <Link to={`/groups/${g.slug}`} className="block">
                      <div className="h-32 bg-gray-100 overflow-hidden">
                        <img
                          src={g.imag}
                          alt={g.Name}
                          className="w-full h-full object-cover transform hover:scale-105 transition"
                        />
                      </div>
                      <div className="p-4 space-y-2">
                        <h4 className="text-lg font-semibold text-gray-900 line-clamp-2">
                          {g.Name}
                        </h4>
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {g.Description}
                        </p>
                      </div>
                    </Link>
                    {g.Type && (
                      <span className="absolute top-2 right-2 bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">
                        {g.Type.split(',')[0].trim()}
                      </span>
                    )}
                    <div className="border-t px-4 py-3 flex items-center justify-between">
                      <Link
                        to={`/groups/${g.slug}`}
                        className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 
                                    4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 
                                    14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 
                                    6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        <span className="text-sm">Join</span>
                      </Link>
                      <span className="text-sm text-gray-500">Accepting members</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500">No groups match.</p>
            )}
          </div>
        </section>

        <FloatingAddButton onClick={() => setShowFlyerModal(true)} />
        <PostFlyerModal 
          isOpen={showFlyerModal} 
          onClose={() => setShowFlyerModal(false)} 
        />
        <Footer/>
      </div>
    </>
  )
}
