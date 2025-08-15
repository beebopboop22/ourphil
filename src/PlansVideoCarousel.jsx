// src/PlansVideoCarousel.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'

const parseDate = datesStr => {
  if (!datesStr) return null
  const [first] = datesStr.split(/through|–|-/)
  const parts = first.trim().split('/')
  if (parts.length !== 3) return null
  const [m, d, y] = parts.map(Number)
  const dt = new Date(y, m - 1, d)
  return isNaN(dt) ? null : dt
}
const parseLocalYMD = str => {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return isNaN(dt) ? null : dt
}

export default function PlansVideoCarousel({ tag = 'arts' }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const [current, setCurrent] = useState(0)
  const [added, setAdded] = useState(false)
  const [pillConfigs, setPillConfigs] = useState([])

  const colors = [
    '#22C55E', // green
    '#0D9488', // teal
    '#DB2777', // pink
    '#3B82F6', // blue
    '#F97316', // orange
    '#EAB308', // yellow
    '#8B5CF6', // purple
    '#EF4444', // red
  ]

  useEffect(() => {
    supabase
      .from('tags')
      .select('name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) return
        const configs = (data || []).map((t, i) => ({
          name: t.name,
          color: colors[i % colors.length],
          left: Math.random() * 100,
          duration: 12 + Math.random() * 8,
          delay: -Math.random() * 20,
        }))
        setPillConfigs(configs)
      })
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const { data: tagRow } = await supabase
          .from('tags')
          .select('id')
          .eq('slug', tag)
          .single()
        const tagId = tagRow?.id
        if (!tagId) { setEvents([]); setLoading(false); return }

        const { data: taggings } = await supabase
          .from('taggings')
          .select('taggable_id, taggable_type')
          .eq('tag_id', tagId)
          .in('taggable_type', ['events','big_board_events','all_events','group_events'])

        const idsByType = { events: [], big_board_events: [], all_events: [], group_events: [] }
        ;(taggings || []).forEach(t => {
          if (idsByType[t.taggable_type]) idsByType[t.taggable_type].push(t.taggable_id)
        })

        const [eRes, bbRes, aeRes, geRes] = await Promise.all([
          idsByType.events.length
            ? supabase
                .from('events')
                .select('id, slug, "E Name", Dates, "End Date", "E Image"')
                .in('id', idsByType.events)
            : { data: [] },
          idsByType.big_board_events.length
            ? supabase
                .from('big_board_events')
                .select('id, title, slug, start_date, end_date, big_board_posts!big_board_posts_event_id_fkey(image_url)')
                .in('id', idsByType.big_board_events)
            : { data: [] },
          idsByType.all_events.length
            ? supabase
                .from('all_events')
                .select('id, slug, name, start_date, image, venue_id(slug)')
                .in('id', idsByType.all_events)
            : { data: [] },
          idsByType.group_events.length
            ? supabase
                .from('group_events')
                .select('id, title, slug, start_date, end_date, image_url, group_id')
                .in('id', idsByType.group_events)
            : { data: [] },
        ])

        let groupMap = {}
        if (geRes.data?.length) {
          const groupIds = [...new Set(geRes.data.map(ev => ev.group_id))]
          if (groupIds.length) {
            const { data: groupsData } = await supabase
              .from('groups')
              .select('id, slug')
              .in('id', groupIds)
            groupsData?.forEach(g => { groupMap[g.id] = g.slug })
          }
        }

        const merged = []
        ;(eRes.data || []).forEach(e => {
          const start = parseDate(e.Dates)
          const end = e['End Date'] ? parseDate(e['End Date']) : start
          merged.push({
            key: `ev-${e.id}`,
            slug: `/events/${e.slug}`,
            name: e['E Name'],
            start, end,
            image: e['E Image'] || ''
          })
        })
        ;(bbRes.data || []).forEach(ev => {
          const start = parseLocalYMD(ev.start_date)
          const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
          const key = ev.big_board_posts?.[0]?.image_url
          const image = key
            ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
            : ''
          merged.push({
            key: `bb-${ev.id}`,
            slug: `/big-board/${ev.slug}`,
            name: ev.title,
            start, end,
            image
          })
        })
        ;(aeRes.data || []).forEach(ev => {
          const start = parseLocalYMD(ev.start_date)
          const venueSlug = ev.venue_id?.slug
          merged.push({
            key: `ae-${ev.id}`,
            slug: venueSlug ? `/${venueSlug}/${ev.slug}` : `/${ev.slug}`,
            name: ev.name,
            start,
            end: start,
            image: ev.image || ''
          })
        })
        ;(geRes.data || []).forEach(ev => {
          const start = parseLocalYMD(ev.start_date)
          const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
          let image = ''
          if (ev.image_url?.startsWith('http')) image = ev.image_url
          else if (ev.image_url) image = supabase.storage.from('big-board').getPublicUrl(ev.image_url).data.publicUrl
          const groupSlug = groupMap[ev.group_id]
          if (groupSlug) {
            merged.push({
              key: `ge-${ev.id}`,
              slug: `/groups/${groupSlug}/events/${ev.slug}`,
              name: ev.title,
              start, end,
              image
            })
          }
        })

        const today = new Date(); today.setHours(0,0,0,0)
        const upcoming = merged
          .filter(ev => ev.start && ev.start >= today)
          .sort((a, b) => a.start - b.start)
        setEvents(upcoming.slice(0, 15))
        setLoading(false)
      } catch (err) {
        console.error(err)
        setEvents([])
        setLoading(false)
      }
    })()
  }, [tag])

  useEffect(() => {
    if (!events.length) return
    setAdded(false)
    const borderTimer = setTimeout(() => setAdded(true), 1000)
    const slideTimer = setTimeout(() => {
      setCurrent(c => (c + 1) % events.length)
    }, 2000)
    return () => {
      clearTimeout(borderTimer)
      clearTimeout(slideTimer)
    }
  }, [current, events])

  useEffect(() => {
    const el = containerRef.current
    if (el) {
      el.scrollTo({ left: current * el.clientWidth, behavior: 'smooth' })
    }
  }, [current])

    return (
      <div className="relative flex flex-col min-h-screen overflow-hidden">
        <Navbar />

        <div className="pill-container fixed inset-0 pointer-events-none z-0">
          {pillConfigs.map((p, i) => (
            <span
              key={i}
              className="pill"
              style={{
                left: `${p.left}%`,
                backgroundColor: p.color,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            >
              #{p.name}
            </span>
          ))}
        </div>

        <div className="bg-[#ba3d36] text-white py-3 text-center font-[Barrio] text-lg mt-32 z-10">
          Upcoming #arts events in Philly
        </div>

        <div className="h-[calc(100vh-8rem)] flex-1 overflow-hidden relative z-10 pb-16">
          {loading ? (
            <p className="text-center py-20">Loading…</p>
          ) : (
            <div ref={containerRef} className="flex w-full h-full overflow-hidden">
              {events.map((evt, idx) => (
                <div
                  key={evt.key}
                  className="flex-shrink-0 w-full h-full flex items-center justify-center p-4"
                  style={{ minWidth: '100%' }}
                >
                  <div
                    className={`w-11/12 max-w-md h-full max-h-96 mx-auto rounded-xl overflow-hidden flex flex-col transition-all duration-500 ${
                      idx === current && added
                        ? 'border-4 border-indigo-600'
                        : 'border border-transparent'
                    }`}
                  >
                    {evt.image && (
                      <img
                        src={evt.image}
                        alt={evt.name}
                        className="w-full flex-grow object-cover"
                      />
                    )}
                    <div className="p-4 bg-white text-center">
                      <h3 className="font-bold text-xl mb-4">{evt.name}</h3>
                      <button
                        className={`w-full border rounded-md py-2 font-semibold transition-colors ${
                          idx === current && added
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-600 border-indigo-600'
                        }`}
                      >
                        {idx === current && added ? 'In the Plans' : 'Add to Plans'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 w-full bg-gray-200 text-center py-3 font-[Barrio] text-lg text-gray-800 z-20">
          make your Philly plans at ourphilly.org
        </div>

        <style>{`
          .pill {
            position: absolute;
            top: -3rem;
            padding: .5rem 1rem;
            border-radius: 9999px;
            color: #fff;
            font-size: 1.25rem;
            white-space: nowrap;
            opacity: .15;
            animation-name: fall;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
          @keyframes fall {
            to { transform: translateY(110vh); }
          }
        `}</style>
      </div>
    )
  }

