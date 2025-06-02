// src/EventsPageHero.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'

// Only Philly teams
const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
]

// ─── Helpers ──────────────────────────────────────────────
const parseDate = (datesStr) => {
  if (!datesStr) return null
  const [first] = datesStr.split(/through|–|-/)
  const [m, d, y] = first.trim().split('/')
  return new Date(+y, +m - 1, +d)
}

/**
 * Given a start date and whether it’s currently active,
 * return { text: 'Today'|'Tomorrow'|'This Friday'|etc., color: 'bg-...' }
 */
const getBubble = (start, isActive) => {
  const today = new Date(); today.setHours(0,0,0,0)
  if (isActive) {
    return { text: 'Today', color: 'bg-transparent' }
  }
  const diff = Math.floor((start - today)/(1000*60*60*24))
  if (diff === 1) {
    return { text: 'Tomorrow', color: 'bg-transparent' }
  }
  const wd = start.toLocaleDateString('en-US',{ weekday: 'long' })
  if (diff > 1 && diff < 7) {
    return { text: `This ${wd}`, color: 'bg-transparent' }
  }
  if (diff >= 7 && diff < 14) {
    return { text: `Next ${wd}`, color: 'bg-transparent' }
  }
  return { text: wd, color: 'bg-transparent' }
}

const isThisWeekend = (date) => {
  const t = new Date(); t.setHours(0,0,0,0)
  const d = t.getDay()
  // Friday of this week
  const fri = new Date(t); fri.setDate(t.getDate() + ((5 - d + 7) % 7))
  // Sunday of this week
  const sun = new Date(t); sun.setDate(t.getDate() + ((0 - d + 7) % 7))
  fri.setHours(0,0,0,0); sun.setHours(23,59,59,999)
  return date >= fri && date <= sun
}

export default function EventsPageHero() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sportsSummary, setSportsSummary] = useState('')
  const [loadingSports, setLoadingSports] = useState(true)
  const containerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ─── Load & Prep Events ───────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const today = new Date(); today.setHours(0,0,0,0)
      const { data, error } = await supabase
        .from('events')
        .select(`id, slug, "E Name", "E Description", Dates, "End Date", "E Image"`)
        .order('Dates', { ascending: true })
      if (error) {
        console.error(error)
        setLoading(false)
        return
      }
      const enhanced = data
        .map(e => {
          const start = parseDate(e.Dates)
          const end   = e['End Date'] ? parseDate(e['End Date']) : start
          return { ...e, start, end, isActive: start <= today && today <= end }
        })
        .filter(e => e.end >= today)
        .sort((a,b) =>
          a.isActive === b.isActive
            ? a.start - b.start
            : a.isActive ? -1 : 1
        )
        .slice(0,12)
      setEvents(enhanced)
      setLoading(false)
    })()
  }, [])

  // ─── Load Sports Summary ───────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        let allGames = []
        for (const slug of teamSlugs) {
          const res  = await fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
          )
          const json = await res.json()
          allGames.push(...(json.events || []))
        }
        const today = new Date(); today.setHours(0,0,0,0)
        const gamesToday = allGames
          .filter(e => {
            const d = new Date(e.datetime_local)
            d.setHours(0,0,0,0)
            return d.getTime() === today.getTime()
          })
          .map(e => {
            const local = e.performers.find(p => p.name.startsWith('Philadelphia '))
            const opp   = e.performers.find(p => p !== local)
            const team     = local?.name.replace(/^Philadelphia\s+/, '')  || ''
            const opponent = opp?.name.replace(/^Philadelphia\s+/, '')  || ''
            const hour = new Date(e.datetime_local)
              .toLocaleTimeString('en-US',{ hour: 'numeric', minute: 'numeric', hour12: true })
            return `${team} at ${opponent} at ${hour}`
          })
        setSportsSummary(gamesToday.join(', '))
      } catch (err) {
        console.error(err)
      }
      setLoadingSports(false)
    })()
  }, [])

  // ─── Auto‐scroll every 6s (slower) ─────────────────────────
  useEffect(() => {
    if (!events.length) return
    const iv = setInterval(() => {
      setCurrentIndex(i => (i + 1) % events.length)
    }, 6000) // slowed to 6000ms
    return () => clearInterval(iv)
  }, [events])

  // ─── Scroll on index change ────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (el) {
      const w = el.clientWidth
      el.scrollTo({ left: currentIndex * w, behavior: 'smooth' })
    }
  }, [currentIndex])

  return (
    <>
      {/* ── Sports Bar ── */}
      <div className="bg-[#28313e] text-white py-3 text-center font-[Barrio] text-2xl">
        Dig Into Philly
      </div>

      {!loadingSports && sportsSummary && (
        <div className="bg-[#bf3d35] text-white text-sm py-2 px-4 text-center z-10">
          <span className="font-[Barrio] font-bold">TONIGHT</span> {sportsSummary}
        </div>
      )}

      {/* ── Carousel ── */}
      <div className="h-[calc(40vh+80px)] min-h-[340px] overflow-hidden relative">
        {loading ? (
          <p className="text-center py-20">Loading…</p>
        ) : (
          <div ref={containerRef} className="flex w-full h-full overflow-hidden">
            {events.map((evt, i) => {
              // Compute “Today / Tomorrow / This …” text
              const { text: relativeDay } = getBubble(evt.start, evt.isActive)

              return (
                <Link
                  key={evt.id}
                  to={`/events/${evt.slug}`}
                  className="relative w-full flex-shrink-0 h-full block"
                  style={{ minWidth: '100%' }}
                >
                  {/* BG image */}
                  <img
                    src={evt['E Image']}
                    alt={evt['E Name']}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />

                  {/* Dark overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/80 to-black/30 z-10" />

                  {/* ── TEXT BLOCK (left‐aligned, padded, with left border) ── */}
                  <div className="absolute inset-0 flex flex-col justify-center z-20">
                    <div className="flex flex-col items-start justify-center max-w-lg px-8">
                      <div className="border-l-4 border-white pl-4">
                        {/* “Today / Tomorrow” label */}
                        <p
                          className="
                            text-white
                            uppercase
                            font-semibold
                            tracking-widest
                            text-sm md:text-base
                            mb-2
                            "
                          style={{ letterSpacing: '.1em' }}
                        >
                          {relativeDay}
                        </p>

                        {/* Event Title */}
                        <h3
                          className="
                            font-[Barrio]
                            text-2xl md:text-4xl
                            text-white
                            drop-shadow-lg
                            font-bold
                            mb-1
                            leading-snug
                          "
                          style={{ letterSpacing: '.02em' }}
                        >
                          {evt['E Name']}
                        </h3>

                        {/* Event Description (optional) */}
                        {evt['E Description'] && (
                          <p className="text-white text-sm md:text-base leading-snug max-w-[90%]">
                            {evt['E Description']}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
