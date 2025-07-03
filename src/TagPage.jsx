// src/TagPage.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import FloatingAddButton from './FloatingAddButton'
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

export default function TagPage() {
  const { slug } = useParams()

  const [tag, setTag] = useState(null)
  const [groups, setGroups] = useState([])
  const [traditions, setTraditions] = useState([])
  const [bigBoard, setBigBoard] = useState([])
  const [groupEvents, setGroupEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [recSeries, setRecSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFlyerModal, setShowFlyerModal] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = useMemo(() => {
    const allCats = groups
      .flatMap(g => (g.Type || '').split(','))
      .map(t => t.trim())
      .filter(Boolean)
    return ['All', ...Array.from(new Set(allCats))]
  }, [groups])

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

  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1) get tag
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

      // 3) parallel fetch
      const [gRes, trRes, bbRes, geRes, aeRes, recRes] = await Promise.all([
        byType.groups?.length
          ? supabase.from('groups')
              .select('id,Name,slug,imag,Description,Type')
              .in('id', byType.groups)
          : { data: [] },
        byType.events?.length
          ? supabase.from('events')
              .select('id,"E Name","E Image",slug,Dates,"End Date"')
              .in('id', byType.events)
          : { data: [] },
        byType.big_board_events?.length
          ? supabase.from('big_board_events')
              .select('id,title,slug,start_date,end_date,big_board_posts!big_board_posts_event_id_fkey(image_url)')
              .in('id', byType.big_board_events)
          : { data: [] },
        byType.group_events?.length
          ? supabase.from('group_events')
              .select('id,title,start_date,end_date,image_url,group_id')
              .in('id', byType.group_events)
          : { data: [] },
        byType.all_events?.length
          ? supabase.from('all_events')
              .select('id,name,slug,image,start_date,venue_id(name,slug)')
              .in('id', byType.all_events)
          : { data: [] },
        recurringIds.length
          ? supabase.from('recurring_events')
              .select('id,name,slug,image_url,start_date,end_date,start_time,rrule')
              .in('id', recurringIds)
          : { data: [] },
      ])

      // 4) build map group_id→slug from the fetched group_events
      const evGroupIds = [...new Set((geRes.data||[]).map(ev => ev.group_id))]
      const { data: groupRows = [] } = evGroupIds.length
        ? await supabase.from('groups').select('id,slug').in('id', evGroupIds)
        : { data: [] }
      const groupSlugMap = {}
      groupRows.forEach(g => { groupSlugMap[g.id] = g.slug })

      // 5) shape and set everything
      setGroups(gRes.data || [])

      setTraditions((trRes.data || []).map(e => ({
        id: e.id,
        title: e['E Name'],
        imageUrl: e['E Image']||'',
        start: parseDate(e.Dates),
        end: parseDate(e['End Date'])||parseDate(e.Dates),
        href: `/events/${e.slug}`,
        isTradition: true,
      })))

      setBigBoard((bbRes.data||[]).map(ev => {
        const key = ev.big_board_posts?.[0]?.image_url
        const url = key
          ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
          : ''
        return {
          id: ev.id,
          title: ev.title,
          imageUrl: url,
          start: parseISODateLocal(ev.start_date),
          end: parseISODateLocal(ev.end_date),
          href: `/big-board/${ev.slug}`,
          isBigBoard: true,
        }
      }))

      setGroupEvents((geRes.data||[]).map(ev => {
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date)
        let imgUrl = ''
        if (ev.image_url) {
          imgUrl = ev.image_url.startsWith('http')
            ? ev.image_url
            : supabase.storage.from('big-board').getPublicUrl(ev.image_url).data.publicUrl
        }
        const slug = groupSlugMap[ev.group_id]
        return {
          id: ev.id,
          title: ev.title,
          imageUrl: imgUrl,
          start, end,
          href: `/groups/${slug}/events/${ev.id}`,
          isGroupEvent: true,
        }
      }))

      setAllEvents((aeRes.data||[]).map(ev => ({
        id: ev.id,
        title: ev.name,
        imageUrl: ev.image||'',
        start: parseISODateLocal(ev.start_date),
        href: `/${ev.venue_id.slug}/${ev.slug}`,
        isAllEvent: true,
      })))

      setRecSeries(recRes.data||[])
      setLoading(false)
    }
    load()
  }, [slug])

  // ── derive next recurrences ────────────────────────────────────
  const recEventsList = useMemo(() => {
    return recSeries.flatMap(series => {
      const opts = RRule.parseString(series.rrule)
      opts.dtstart = new Date(`${series.start_date}T${series.start_time}`)
      if (series.end_date) opts.until = new Date(`${series.end_date}T23:59:59`)
      return new RRule(opts)
        .all()
        .filter(d => d >= new Date())
        .slice(0,3)
        .map(d => ({
          id: `${series.id}::${d.toISOString().slice(0,10)}`,
          title: series.name,
          imageUrl: series.image_url,
          start: d,
          href: `/series/${series.slug}/${d.toISOString().slice(0,10)}`,
          isRecurring: true,
        }))
    })
  }, [recSeries])

  if (loading) return <p className="text-center py-20">Loading…</p>
  if (!tag)    return <p className="text-center py-20 text-red-600">Tag not found</p>

  // ── merge & filter future ─────────────────────────────────────
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

  const nextEvent = upcoming[0]||null

  return (
    <>
      <Helmet>
        <title>#{tag.name} – {tag.description||`${groups.length} groups & ${upcoming.length} events`} | Our Philly</title>
        <meta name="description" content={tag.description||`${upcoming.length} upcoming #${tag.name} events`} />
      </Helmet>

      <div className="min-h-screen bg-neutral-50 pt-20">
        <Navbar/>

        {/* Hero */}
        <div className="relative bg-gray-100 h-[50vh] overflow-hidden pt-20 pb-12 mb-8">
          <img
            src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/skyline-grey.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          <div className="relative max-w-6xl mx-auto px-4 text-left z-10">
            <h1 className="text-4xl sm:text-8xl font-[barrio] text-indigo-900 mb-4">#{tag.name}</h1>
            {tag.description && <p className="text-lg text-gray-800 mb-4">{tag.description}</p>}
            {nextEvent && (
              <p className="text-base text-gray-800">
                Next up:{' '}
                <Link to={nextEvent.href} className="font-semibold hover:underline">
                  {nextEvent.title} — {nextEvent.start.toLocaleDateString('en-US',{ month:'long', day:'numeric'})}
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Upcoming events scroller */}
        <section className="relative -mt-20 z-10 mb-16">
          <div className="max-w-screen-xl mx-auto bg-gray-100 rounded-xl px-8 py-12 shadow-2xl">
            <h3 className="text-3xl font-[barrio] font-bold text-black text-center mb-6">
              Upcoming #{tag.name} events
            </h3>
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex space-x-6 py-4">
                {upcoming.map(evt => {
                  const day = evt.start.getDate()
                  const mon = evt.start.toLocaleString('en-US',{ month:'short' }).slice(0,3)
                  return (
                    <Link
                      key={evt.id+evt.start}
                      to={evt.href}
                      className="flex-shrink-0 w-64 relative bg-white rounded-xl shadow-lg overflow-hidden hover:scale-105 transition-transform"
                    >
                      <div className="absolute top-2 left-2 w-8 h-8 bg-gray-900/80 rounded-full flex items-center justify-center z-10">
                        <div className="text-white text-center">
                          <div className="font-bold text-lg">{day}</div>
                          <div className="text-xs uppercase">{mon}</div>
                        </div>
                      </div>
                      <div className="relative w-full h-40 bg-gray-200">
                        {evt.imageUrl && <img src={evt.imageUrl} alt={evt.title} className="w-full h-full object-cover" />}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-800/80 to-transparent" />
                      </div>
                      <div className="pt-2 pb-7 flex-1 flex flex-col text-center">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">
                          {evt.title.length>40?`${evt.title.slice(0,40)}…`:evt.title}
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
          <div className="max-w-screen-xl mx-auto px-4">
            {/* …your Discover Groups UI… */}
          </div>
        </section>

        <FloatingAddButton onClick={() => setShowFlyerModal(true)} />
        <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} />
        <Footer />
      </div>
    </>
  )
}
