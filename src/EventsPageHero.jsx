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

// You may want to import Barrio and Pacifico in your global CSS/head:
// @import url('https://fonts.googleapis.com/css2?family=Barrio&family=Pacifico&display=swap');

export default function EventsPageHero() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sportsSummary, setSportsSummary] = useState('')
  const [loadingSports, setLoadingSports] = useState(true)
  const containerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ─── Helpers ──────────────────────────────────────────────
  const parseDate = (datesStr) => {
    if (!datesStr) return null
    const [first] = datesStr.split(/through|–|-/)
    const [m, d, y] = first.trim().split('/')
    return new Date(+y, +m - 1, +d)
  }
  const getBubble = (start, isActive) => {
    const today = new Date(); today.setHours(0,0,0,0)
    if (isActive)   return { text: 'Today',     color: 'bg-green-500', pulse: false }
    const diff = Math.floor((start - today)/(1000*60*60*24))
    if (diff === 1) return { text: 'Tomorrow', color: 'bg-blue-600',  pulse: false }
    const wd = start.toLocaleDateString('en-US',{ weekday:'long' })
    if (diff>1 && diff<7)   return { text:`This ${wd}`,  color:'bg-[#ba3d36]', pulse:false }
    if (diff>=7 && diff<14) return { text:`Next ${wd}`,  color:'bg-[#ba3d36]', pulse:false }
    return { text:wd, color:'bg-[#ba3d36]', pulse:false }
  }
  const isThisWeekend = (date) => {
    const t = new Date(); t.setHours(0,0,0,0)
    const d = t.getDay()
    const fri = new Date(t); fri.setDate(t.getDate()+((5-d+7)%7))
    const sun = new Date(t); sun.setDate(t.getDate()+((0-d+7)%7))
    fri.setHours(0,0,0,0); sun.setHours(23,59,59,999)
    return date>=fri && date<=sun
  }

  // ─── Load & Prep Events ───────────────────────────────
  useEffect(() => {
    ;(async () => {
      const today = new Date(); today.setHours(0,0,0,0)
      const { data, error } = await supabase
        .from('events')
        .select(`id, slug, "E Name", "E Description", Dates, "End Date", "E Image"`)
        .order('Dates',{ ascending:true })
      if (error) {
        console.error(error)
        setLoading(false)
        return
      }
      const enhanced = data
        .map(e => {
          const start = parseDate(e.Dates)
          const end   = e['End Date'] ? parseDate(e['End Date']) : start
          return { ...e, start, end, isActive: start<=today && today<=end }
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

  // ─── Load Sports Summary ───────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        let all = []
        for (const slug of teamSlugs) {
          const res  = await fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
          )
          const json = await res.json()
          all.push(...(json.events||[]))
        }
        const today = new Date(); today.setHours(0,0,0,0)
        const gamesToday = all
          .filter(e => {
            const d = new Date(e.datetime_local)
            d.setHours(0,0,0,0)
            return d.getTime()===today.getTime()
          })
          .map(e => {
            const local = e.performers.find(p => p.name.startsWith('Philadelphia '))
            const opp   = e.performers.find(p => p!== local)
            const team     = local?.name.replace(/^Philadelphia\s+/,'')  || ''
            const opponent = opp?.name.replace(/^Philadelphia\s+/,'')  || ''
            const hour = new Date(e.datetime_local)
              .toLocaleTimeString('en-US',{ hour:'numeric',minute:'numeric',hour12:true })
            return `${team} at ${opponent} at ${hour}`
          })
        setSportsSummary(gamesToday.join(', '))
      } catch (err) {
        console.error(err)
      }
      setLoadingSports(false)
    })()
  }, [])

  // ─── Auto‐scroll every 4.5s ───────────────────────────
  useEffect(() => {
    if (!events.length) return
    const iv = setInterval(() => {
      setCurrentIndex(i => (i+1)%events.length)
    }, 4500) // Slow down
    return () => clearInterval(iv)
  }, [events])

  // ─── Scroll on index change ────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (el) {
      const w = el.clientWidth
      el.scrollTo({ left: currentIndex*w, behavior:'smooth' })
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
              const { text, color } = getBubble(evt.start,evt.isActive)
              const weekend = isThisWeekend(evt.start)
              return (
                <Link
                  key={evt.id}
                  to={`/events/${evt.slug}`}
                  className="relative w-full flex-shrink-0 h-full block"
                  style={{ minWidth: '100%' }}
                >
                  {/* BG image + overlay */}
                  <img
                    src={evt['E Image']}
                    alt={evt['E Name']}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-10" />
                  
                  {/* Bubble: just above the event name, larger */}
                  <span
                    className={`
                      absolute left-8 md:left-12 top-5 md:top-5
                      ${color} text-white text-xl md:text-2xl font-bold shadow-lg
                      px-6 py-2 rounded-full whitespace-nowrap
                      border-4 border-white border-opacity-30
                      z-30
                    `}
                    style={{
                      filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.16))',
                      letterSpacing: '.03em',
                      fontFamily: 'Barrio, sans-serif',
                    }}
                  >
                    {text}
                  </span>
                  
                  {/* Title and description */}
                  <div className="absolute bottom-8 left-8 md:left-12 right-8 md:right-auto z-30 flex flex-col items-start max-w-xl">
                    <h3 className="font-[Barrio] text-2xl md:text-4xl text-white drop-shadow font-bold mb-1 leading-tight">
                      {evt['E Name']}
                    </h3>
                    {evt['E Description'] && (
                      <div className="text-white text-base md:text-lg font-normal leading-tight opacity-90 max-w-[90vw] md:max-w-lg" style={{ textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
                        {evt['E Description']}
                      </div>
                    )}
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
