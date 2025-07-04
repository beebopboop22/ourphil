// src/TagPage.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import FloatingAddButton from './FloatingAddButton'
import SubmitGroupModal from './SubmitGroupModal'
import PostFlyerModal from './PostFlyerModal'
import { Helmet } from 'react-helmet'
import { RRule } from 'rrule'

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

export default function TagPage() {
  const { slug } = useParams()

  // ── State hooks ────────────────────────────────────────────────
  const [tag, setTag] = useState(null)
  const [groups, setGroups] = useState([])
  const [traditions, setTraditions] = useState([])
  const [bigBoard, setBigBoard] = useState([])
  const [groupEvents, setGroupEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [recSeries, setRecSeries] = useState([])
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
              .select('id,title,slug,start_date,end_date,big_board_posts!big_board_posts_event_id_fkey(image_url)')
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

      setTraditions((trRes.data || []).map(e => ({
        id: e.id,
        title: e['E Name'],
        imageUrl: e['E Image'] || '',
        start: parseDate(e.Dates),
        end: parseDate(e['End Date']) || parseDate(e.Dates),
        href: `/events/${e.slug}`,
      })))

      setBigBoard((bbRes.data || []).map(ev => {
        const key = ev.big_board_posts?.[0]?.image_url
        const url = key
          ? supabase.storage
              .from('big-board')
              .getPublicUrl(key).data.publicUrl
          : ''
        return {
          id: ev.id,
          title: ev.title,
          imageUrl: url,
          start: parseISODateLocal(ev.start_date),
          end: parseISODateLocal(ev.end_date),
          href: `/big-board/${ev.slug}`,
        }
      }))

      setGroupEvents((geRes.data || []).map(ev => {
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date)
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
          start, end,
          href: `/groups/${slug}/events/${ev.id}`,
        }
      }))

      setAllEvents((aeRes.data || []).map(ev => ({
        id: ev.id,
        title: ev.name,
        imageUrl: ev.image || '',
        start: parseISODateLocal(ev.start_date),
        href: `/${ev.venue_id.slug}/${ev.slug}`,
      })))

      setRecSeries(recRes.data || [])
      setLoading(false)
    }
    load()
  }, [slug])

  // ── load all tags for bottom nav ───────────────────────────────
  useEffect(() => {
    supabase.from('tags').select('name,slug').order('name')
      .then(({ data }) => setAllTags(data || []))
  }, [])

  // ── derive recurring instances ─────────────────────────────────
  const recEventsList = useMemo(() => {
    return recSeries.flatMap(series => {
      const opts = RRule.parseString(series.rrule)
      opts.dtstart = new Date(`${series.start_date}T${series.start_time}`)
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
          href: `/series/${series.slug}/${d.toISOString().slice(0,10)}`,
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

        {/* ── Thin Strip Hero ────────────────────────────── */}
        <div className="bg-white border-b py-2 mt-20">
          <div className="max-w-screen-xl mx-auto px-4 flex flex-wrap items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">#{tag.name}</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setView('events')}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                  view === 'events'
                    ? 'bg-[#bf3d35] text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Events
              </button>
              <button
                onClick={() => setView('groups')}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                  view === 'groups'
                    ? 'bg-[#29313f] text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Groups
              </button>
              <button
                onClick={() => setShowFlyerModal(true)}
                className="px-3 py-1 rounded-full text-sm bg-white border border-[#bf3d35] text-[#bf3d35] hover:bg-[#bf3d35] hover:text-white transition"
              >
                Submit Event
              </button>
              <button
                onClick={() => setShowSubmitGroupModal(true)}
                className="px-3 py-1 rounded-full text-sm bg-white border border-[#29313f] text-[#29313f] hover:bg-[#29313f] hover:text-white transition"
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
              {displayedEvents.map(evt => {
                const label = getDateLabel(evt.start)
                return (
                  <Link
                    key={evt.id + evt.start}
                    to={evt.href}
                    className="relative block bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden"
                  >
                    <div className="absolute top-2 left-2 bg-gray-900/80 text-white italic text-xs px-2 py-1 rounded z-10">
                      {label}
                    </div>
                    <div className="h-40 bg-gray-200">
                      {evt.imageUrl && (
                        <img
                          src={evt.imageUrl}
                          alt={evt.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {evt.title}
                      </p>
                    </div>
                  </Link>
                )
              })}
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
