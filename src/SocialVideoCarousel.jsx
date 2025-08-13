// src/SocialVideoCarousel.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import { Link } from 'react-router-dom'

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

  // ─── Fetch upcoming events by tag ─────────────────────────
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

        // 2) fetch event ids tagged with this slug
        const { data: taggings } = await supabase
          .from('taggings')
          .select('taggable_id')
          .eq('tag_id', tagId)
          .eq('taggable_type', 'events')

        const eventIds = (taggings || []).map(t => t.taggable_id)
        if (!eventIds.length) { setEvents([]); setLoading(false); return }

        // 3) fetch events and filter upcoming
        const { data: tradData = [] } = await supabase
          .from('events')
          .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
          .in('id', eventIds)

        const today = new Date(); today.setHours(0,0,0,0)
        const trad = (tradData || [])
          .map(e => ({
            key:   `ev-${e.id}`,
            slug:  `/events/${e.slug}`,
            name:  e['E Name'],
            start: parseDate(e.Dates),
            end:   e['End Date'] ? parseDate(e['End Date']) : parseDate(e.Dates),
            image: e['E Image'] || '',
          }))
          .filter(evt => evt.start && evt.start >= today)
          .sort((a, b) => a.start - b.start)

        setEvents(trad.slice(0,15))
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

      <div className="h-[calc(80vh+80px)] min-h-[400px] overflow-hidden relative z-10">
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
