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
const parseISODateLocal = str => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const isThisWeekend = date => {
  const t = new Date(); t.setHours(0,0,0,0)
  const d = t.getDay()
  const sat = new Date(t); sat.setDate(t.getDate()+((6-d+7)%7))
  const sun = new Date(t); sun.setDate(t.getDate()+((0-d+7)%7))
  sat.setHours(0,0,0,0); sun.setHours(23,59,59,999)
  return date>=sat && date<=sun
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

export default function SocialVideoCarousel() {
  // ─── Falling pills setup ────────────────────────────────
  const [pillConfigs, setPillConfigs] = useState([])
  const colors = ['#22C55E','#0D9488','#DB2777','#3B82F6','#F97316','#EAB308','#8B5CF6','#EF4444']
  useEffect(() => {
    supabase
      .from('tags')
      .select('id,name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        const configs = (data||[]).map((t,i) => ({
          name:     t.name,
          color:    colors[i % colors.length],
          left:     50 + Math.random()*50,  // between 50% and 100%
          duration: 4 + Math.random()*2,    // 4–6s fall
          delay:    -Math.random()*6,
        }))
        setPillConfigs(configs)
      })
  }, [])

  // ─── Carousel state ──────────────────────────────────────
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef          = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ─── Fetch & combine weekend events + big-board ───────────
  useEffect(() => {
    ;(async () => {
      const { data: tradData = [] } = await supabase
        .from('events')
        .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
      const { data: bbData = [] } = await supabase
        .from('big_board_events')
        .select(`
          id, title, start_date, slug,
          big_board_posts!big_board_posts_event_id_fkey(image_url)
        `)

      const trad = tradData
        .map(e => ({
          key:   `ev-${e.id}`,
          slug:  `/events/${e.slug}`,
          name:  e['E Name'],
          start: parseDate(e.Dates),
          end:   e['End Date'] ? parseDate(e['End Date']) : parseDate(e.Dates),
          image: e['E Image'] || '',
        }))
        .filter(evt => isThisWeekend(evt.start))

      const bb = bbData
        .map(e => {
          const start = parseISODateLocal(e.start_date)
          const key   = e.big_board_posts?.[0]?.image_url
          const { data:{ publicUrl='' } } = supabase
            .storage.from('big-board')
            .getPublicUrl(key)
          return {
            key:   `bb-${e.id}`,
            slug:  `/big-board/${e.slug}`,
            name:  e.title,
            start,
            end:   start,
            image: publicUrl,
            isBB:  true,
          }
        })
        .filter(evt => isThisWeekend(evt.start))

      setEvents([...trad, ...bb].slice(0,30))
      setLoading(false)
    })()
  }, [])

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
    <>
      <style>{`
        .pill {
          position: absolute;
          top: -2rem;
          padding: .4rem .8rem;
          border-radius: 9999px;
          color: #fff;
          font-size: .875rem;
          white-space: nowrap;
          opacity: .9;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes fall {
          to { transform: translateY(110vh); }
        }
      `}</style>

      <div className="relative flex flex-col min-h-screen overflow-hidden">
        <Navbar />

        {/* falling pills restricted to right half */}
        <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none z-50">
          {pillConfigs.map((p, i) => (
            <span
              key={i}
              className="pill"
              style={{
                left:              `${p.left}%`,
                backgroundColor:   p.color,
                animationDuration: `${p.duration}s`,
                animationDelay:    `${p.delay}s`,
              }}
            >
              #{p.name}
            </span>
          ))}
        </div>

        <div className="bg-[#ba3d36] text-white py-3 text-center font-[Barrio] text-lg mt-20 z-10">
          Subscribe to #tags for your weekly digest
        </div>

        <div className="h-[calc(80vh+80px)] min-h-[400px] overflow-hidden relative z-10">
          {loading ? (
            <p className="text-center py-20">Loading…</p>
          ) : (
            <div ref={containerRef} className="flex w-full h-full overflow-hidden">
              {events.map(evt => {
                const isActive = evt.start <= new Date() && new Date() <= evt.end
                const relativeDay = getBubble(evt.start, isActive).text
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
                        {relativeDay}
                      </p>
                      <h3 className="font-[Barrio] text-3xl md:text-5xl text-white drop-shadow-lg font-bold leading-snug">
                        {evt.name}
                      </h3>
                    </div>
                    {evt.isBB && (
                      <div className="absolute inset-x-0 bottom-0 h-6 bg-indigo-600 flex items-center justify-center">
                        <span className="text-xs font-bold text-white uppercase">
                          COMMUNITY SUBMISSION
                        </span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
