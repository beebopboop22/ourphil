// src/SocialVideoCarousel.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import { Link } from 'react-router-dom'

// ─── Helpers ──────────────────────────────────────────────
const parseDate = datesStr => {
  if (!datesStr) return null
  const [first] = datesStr.split(/through|–|-/)
  const [m, d, y] = first.trim().split('/')
  return new Date(+y, +m - 1, +d)
}
const parseISODateLocal = str => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
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
const isThisWeekend = date => {
  const t = new Date(); t.setHours(0,0,0,0)
  const d = t.getDay()
  const fri = new Date(t); fri.setDate(t.getDate()+((5-d+7)%7))
  const sun = new Date(t); sun.setDate(t.getDate()+((0-d+7)%7))
  fri.setHours(0,0,0,0); sun.setHours(23,59,59,999)
  return date>=fri && date<=sun
}

export default function SocialVideoCarousel() {
  // ─── Falling‐pills setup ────────────────────────────────
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
          left:     Math.random()*100,
          duration: 6 + Math.random()*3,   // 6–9s
          delay:    -Math.random()*9,
        }))
        setPillConfigs(configs)
      })
  }, [])

  // ─── Carousel state ──────────────────────────────────────
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef          = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ─── Fetch & combine events + big-board ─────────────────
  useEffect(() => {
    ;(async () => {
      const today = new Date(); today.setHours(0,0,0,0)
      const { data: tradData = [] } = await supabase
        .from('events')
        .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
      const { data: bbData = [] } = await supabase
        .from('big_board_events')
        .select(`
          id, title, start_date, slug,
          big_board_posts!big_board_posts_event_id_fkey(image_url)
        `)

      const trad = tradData.map(e => ({
        key:    `ev-${e.id}`,
        slug:   `/events/${e.slug}`,
        name:   e['E Name'],
        start:  parseDate(e.Dates),
        end:    e['End Date'] ? parseDate(e['End Date']) : parseDate(e.Dates),
        image:  e['E Image'] || '',
      }))

      const bb = bbData.map(e => {
        const start = parseISODateLocal(e.start_date)
        const key   = e.big_board_posts?.[0]?.image_url
        const { data:{ publicUrl='' } } = supabase
          .storage.from('big-board')
          .getPublicUrl(key)
        return {
          key:    `bb-${e.id}`,
          slug:   `/big-board/${e.slug}`,
          name:   e.title,
          start,
          end:    start,
          image:  publicUrl,
          isBB:   true,
        }
      })

      const combined = [...trad, ...bb]
        .filter(evt => evt.end >= today)
        .sort((a,b) => {
          const aActive = a.start<=today && today<=a.end
          const bActive = b.start<=today && today<=b.end
          if (aActive!==bActive) return aActive?-1:1
          return a.start - b.start
        })
        .slice(0, 16)

      setEvents(combined)
      setLoading(false)
    })()
  }, [])

  // ─── Auto‐scroll every 3s ─────────────────────────────────
  useEffect(() => {
    if (!events.length) return
    const iv = setInterval(() => {
      setCurrentIndex(i=>(i+1)%events.length)
    }, 3000)
    return ()=>clearInterval(iv)
  }, [events])

  useEffect(() => {
    const el = containerRef.current
    if (el) {
      const w = el.clientWidth
      el.scrollTo({ left: currentIndex*w, behavior:'smooth' })
    }
  }, [currentIndex])

  return (
    <>
      <style>{`
        @keyframes fall { to { transform: translateY(110vh); } }
      `}</style>

      <div className="relative flex flex-col min-h-screen overflow-hidden">
        <Navbar />

        {/* falling pills restricted to right half */}
        <div className="absolute inset-y-0 right-0 w-1/2 sm:w-1/3 pointer-events-none z-50">
          {pillConfigs.map((p,i)=>(
            <span key={i}
              style={{
                position:        'absolute',
                left:            `${p.left}%`,
                top:             '-3rem',
                padding:         '.5rem 1rem',
                borderRadius:    '9999px',
                color:           '#fff',
                fontSize:        '1rem',
                whiteSpace:      'nowrap',
                opacity:         0.9,
                backgroundColor: p.color,
                animation:       `fall ${p.duration}s linear ${p.delay}s infinite`,
              }}
            >
              #{p.name}
            </span>
          ))}
        </div>

        <div className="bg-[#28313e] text-white py-3 text-center font-[Barrio] text-xl mt-20 z-10">
          Subscribe to #tags for your weekly digest
        </div>

        <div className="h-[calc(40vh+80px)] min-h-[340px] overflow-hidden relative z-10">
          {loading ? (
            <p className="text-center py-20">Loading…</p>
          ) : (
            <div ref={containerRef} className="flex w-full h-full overflow-hidden">
              {events.map(evt => {
                const isActive = evt.start<=new Date() && new Date()<=evt.end
                const { text: relativeDay } = getBubble(evt.start, isActive)
                const weekend = isThisWeekend(evt.start)
                return (
                  <Link
                    key={evt.key}
                    to={evt.slug}
                    className="relative w-full flex-shrink-0 h-full block"
                    style={{ minWidth:'100%' }}
                  >
                    <img
                      src={evt.image}
                      alt={evt.name}
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/80 to-black/30 z-10"/>
                    <div className="absolute inset-0 flex flex-col justify-center z-20">
                      <div className="border-l-4 border-white pl-4 px-8">
                        <p className="text-white uppercase font-semibold tracking-widest text-sm md:text-base mb-2">
                          {relativeDay}
                        </p>
                        <h3 className="font-[Barrio] text-6xl md:text-7xl text-white drop-shadow-lg font-bold leading-snug">
                          {evt.name}
                        </h3>
                      </div>
                    </div>
                    {evt.isBB && (
                      <div className="absolute inset-x-0 bottom-0 h-6 bg-indigo-600 flex items-center justify-center z-20">
                        <span className="text-xs font-bold text-white uppercase">
                          COMMUNITY SUBMISSION
                        </span>
                      </div>
                    )}
                    {weekend && (
                      <span className="absolute top-3 left-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full z-20">
                        Weekend Pick
                      </span>
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
