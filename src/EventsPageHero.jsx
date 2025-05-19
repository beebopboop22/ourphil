import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'

// only Philly teams
const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
]

export default function EventsPageHero() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sportsSummary, setSportsSummary] = useState('')
  const [loadingSports, setLoadingSports] = useState(true)
  const containerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ─── Helpers ──────────────────────────────────────────────────────────────
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
    if (diff === 1) return { text: 'Tomorrow!', color: 'bg-blue-500',  pulse: false }
    const wd = start.toLocaleDateString('en-US',{ weekday:'long' })
    if (diff>1 && diff<7)   return { text:`This ${wd}!`,  color:'bg-[#ba3d36]', pulse:false }
    if (diff>=7 && diff<14) return { text:`Next ${wd}!`,  color:'bg-[#ba3d36]', pulse:false }
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

  // ─── Load & Prep Events ───────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const today = new Date(); today.setHours(0,0,0,0)
      const { data, error } = await supabase
        .from('events')
        .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
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

  // ─── Load Sports Summary ──────────────────────────────────────────────────
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

  // ─── Auto‐scroll every 1.75s ───────────────────────────────────────────────
  useEffect(() => {
    if (!events.length) return
    const iv = setInterval(() => {
      setCurrentIndex(i => (i+1)%events.length)
    }, 1750)
    return () => clearInterval(iv)
  }, [events])

  // ─── Scroll on index change ────────────────────────────────────────────────
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
      {!loadingSports && sportsSummary && (
        <div className="bg-[#bf3d35] text-white text-sm py-2 px-4 text-center z-10">
          <span className="font-[Barrio] font-bold">TONIGHT</span> {sportsSummary}
        </div>
      )}

      {/* ── Carousel ── */}
      <div className="h-[calc(80vh-112px)] overflow-hidden">
        {loading ? (
          <p className="text-center py-20">Loading…</p>
        ) : (
          <div ref={containerRef} className="flex w-full h-full overflow-hidden">
            {events.map(evt => {
              const { text, color, pulse } = getBubble(evt.start,evt.isActive)
              const weekend = isThisWeekend(evt.start)
              return (
                <Link
                  key={evt.id}
                  to={`/events/${evt.slug}`}
                  className="relative w-full flex-shrink-0"
                >
                  <img
                    src={evt['E Image']}
                    alt={evt['E Name']}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  {weekend && (
                    <span className="absolute top-3 left-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full z-20">
                      Weekend Pick
                    </span>
                  )}
                  <h3 className="absolute bottom-24 left-4 right-4 text-center text-white text-5xl font-[Barrio] font-bold z-20 leading-tight">
                    {evt['E Name']}
                  </h3>
                  <span
                    className={`
                      absolute bottom-12 left-1/2 transform -translate-x-1/2
                      ${color} text-white text-lg font-bold
                      px-4 py-1 rounded-full whitespace-nowrap
                      ${pulse?'animate-pulse':''}
                      z-20
                    `}
                  >
                    {text}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Bar + Heart ── */}
      <div className="relative">
        <div className="bg-[#28313e] text-white py-3 text-center font-[Barrio] text-2xl">
          Dig Into Philly
        </div>
        <img
          src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//OurPhilly-CityHeart-2.png"
          alt="heart"
          className="absolute bottom-0 left-0 w-1/6 translate-y-[55%]"
        />
      </div>
    </>
  )
}
