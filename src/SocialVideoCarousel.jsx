// src/SocialVideoCarousel.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import { Link } from 'react-router-dom'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'

// ─── Helpers ──────────────────────────────────────────────
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
const getBubble = (start, isActive) => {
  const today = new Date(); today.setHours(0,0,0,0)
  if (isActive) return { text: 'Today' }
  const diff = Math.floor((start - today)/(1000*60*60*24))
  if (diff === 1) return { text: 'Tomorrow' }
  const wd = start.toLocaleDateString('en-US',{ weekday:'long' })
  if (diff>1 && diff<7) return { text:`This ${wd}` }
  if (diff>=7 && diff<14) return { text:`Next ${wd}` }
  return { text: wd }
}

export default function SocialVideoCarousel({ tag }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ─── Fetch upcoming events by tag across all tables ───────
  useEffect(() => {
    ;(async () => {
      try {
        // 1) look up tag id
        const { data: tagRow } = await supabase
          .from('tags')
          .select('id')
          .eq('slug', tag)
          .single()

        const tagId = tagRow?.id
        if (!tagId) { setEvents([]); setLoading(false); return }

        // 2) fetch taggings across event tables
        const { data: taggings } = await supabase
          .from('taggings')
          .select('taggable_id, taggable_type')
          .eq('tag_id', tagId)
          .in('taggable_type', ['events','big_board_events','all_events','group_events'])

        const idsByType = {
          events: [],
          big_board_events: [],
          all_events: [],
          group_events: [],
        }
        ;(taggings || []).forEach(t => {
          if (idsByType[t.taggable_type]) idsByType[t.taggable_type].push(t.taggable_id)
        })

        if (
          !idsByType.events.length &&
          !idsByType.big_board_events.length &&
          !idsByType.all_events.length &&
          !idsByType.group_events.length
        ) {
          setEvents([]); setLoading(false); return
        }

        // 3) fetch from each table
        const [eRes, bbRes, aeRes, geRes] = await Promise.all([
          idsByType.events.length
            ? supabase
                .from('events')
                .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
                .in('id', idsByType.events)
            : { data: [] },
          idsByType.big_board_events.length
            ? supabase
                .from('big_board_events')
                .select(`
                  id, title, slug, start_date, end_date,
                  big_board_posts!big_board_posts_event_id_fkey(image_url)
                `)
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

        // 4) lookup group slugs for group_events
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

        // 5) normalize into a single list
        const today = new Date(); today.setHours(0,0,0,0)
        const merged = []

        ;(eRes.data || []).forEach(e => {
          const detailPath = getDetailPathForItem({
            source_table: 'events',
            slug: e.slug,
          })
          const start = parseDate(e.Dates)
          const end = e['End Date'] ? parseDate(e['End Date']) : start
          merged.push({
            key: `ev-${e.id}`,
            slug: detailPath || '/events',
            name: e['E Name'],
            start, end,
            image: e['E Image'] || '',
          })
        })

        ;(bbRes.data || []).forEach(ev => {
          const detailPath = getDetailPathForItem({
            source_table: 'big_board_events',
            slug: ev.slug,
          })
          const start = parseLocalYMD(ev.start_date)
          const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
          const key = ev.big_board_posts?.[0]?.image_url
          const image = key
            ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
            : ''
          merged.push({
            key: `bb-${ev.id}`,
            slug: detailPath || '/big-board',
            name: ev.title,
            start, end,
            image,
          })
        })

        ;(aeRes.data || []).forEach(ev => {
          const detailPath = getDetailPathForItem({
            slug: ev.slug,
            venues: { slug: ev.venue_id?.slug },
          })
          const start = parseLocalYMD(ev.start_date)
          const venueSlug = ev.venue_id?.slug
          merged.push({
            key: `ae-${ev.id}`,
            slug: detailPath || `/${ev.slug}`,
            name: ev.name,
            start,
            end: start,
            image: ev.image || '',
          })
        })

        ;(geRes.data || []).forEach(ev => {
          const start = parseLocalYMD(ev.start_date)
          const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
          let image = ''
          if (ev.image_url?.startsWith('http')) image = ev.image_url
          else if (ev.image_url)
            image = supabase.storage.from('big-board').getPublicUrl(ev.image_url).data.publicUrl
          const groupSlug = groupMap[ev.group_id]
          if (groupSlug) {
            const detailPath = getDetailPathForItem({
              source_table: 'group_events',
              id: ev.id,
              group_slug: groupSlug,
              slug: ev.slug,
            })
            merged.push({
              key: `ge-${ev.id}`,
              slug: detailPath || `/groups/${groupSlug}`,
              name: ev.title,
              start, end,
              image,
            })
          }
        })

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

  // auto-scroll every 1.5s
  useEffect(() => {
    if (!events.length) return
    const iv = setInterval(() => {
      setCurrentIndex(i => (i + 1) % events.length)
    }, 1500)
    return () => clearInterval(iv)
  }, [events])

  // scroll on index change
  useEffect(() => {
    const el = containerRef.current
    if (el) {
      el.scrollTo({ left: currentIndex * el.clientWidth, behavior: 'smooth' })
    }
  }, [currentIndex])

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden">
      <Navbar />

      <div className="bg-[#ba3d36] text-white py-3 text-center font-[Barrio] text-lg mt-32 z-10">
        Subscribe to #tags for your daily digest
      </div>

      <div className="h-[calc(100vh-8rem)] flex-1 overflow-hidden relative z-10 pb-16">
        {loading ? (
          <p className="text-center py-20">Loading…</p>
        ) : (
          <div ref={containerRef} className="flex w-full h-full overflow-hidden">
            {events.map(evt => {
              const isActive = evt.start <= new Date() && new Date() <= evt.end
              const relativeDay = getBubble(evt.start, isActive).text
              const dateStr = evt.start.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })
              return (
                <Link
                  key={evt.key}
                  to={evt.slug}
                  className="relative w-full flex-shrink-0 h-full"
                  style={{ minWidth: '100%' }}
                >
                  <img
                    src={evt.image}
                    alt={evt.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/80 to-black/30" />
                  <div className="absolute inset-0 flex flex-col justify-center px-6 z-20">
                    <p className="text-white uppercase font-semibold tracking-wide text-sm mb-2">
                      {`${relativeDay}, ${dateStr}`}
                    </p>
                    <h3 className="font-[Barrio] text-3xl md:text-5xl text-white drop-shadow-lg font-bold leading-snug">
                      {evt.name}
                    </h3>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
