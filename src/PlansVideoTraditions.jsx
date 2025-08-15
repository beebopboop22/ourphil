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

const formatDate = date => {
  if (!date) return ''
  return 'This ' + date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

export default function PlansVideoTraditions() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const [current, setCurrent] = useState(0)
  const [added, setAdded] = useState(false)
  const [pillConfigs, setPillConfigs] = useState([])
  const [navHeight, setNavHeight] = useState(0)

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
    const navEl = document.querySelector('nav')
    if (!navEl) return
    const updateHeight = () => setNavHeight(navEl.offsetHeight)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(navEl)
    window.addEventListener('resize', updateHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('id, slug, "E Name", Dates, "End Date", "E Image", "E Description"')
        const merged = []
        ;(data || []).forEach(e => {
          const start = parseDate(e.Dates)
          const end = e['End Date'] ? parseDate(e['End Date']) : start
          if (!start) return
          merged.push({
            key: `ev-${e.id}`,
            slug: `/events/${e.slug}`,
            name: e['E Name'],
            start,
            end,
            image: e['E Image'] || '',
            description: e['E Description'] || ''
          })
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
  }, [])

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
    <div className="relative flex flex-col min-h-screen overflow-x-hidden">
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

      <div
        className="bg-[#ba3d36] text-white py-3 text-center font-[Barrio] text-lg z-10"
        style={{ marginTop: navHeight }}
      >
        Upcoming Philly Traditions
      </div>

      <div
        className="flex-1 overflow-hidden relative z-10 pb-16"
        style={{ height: `calc(100dvh - ${navHeight}px)` }}
      >
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
                  className={`plans-carousel-card w-11/12 max-w-md mx-auto flex flex-col overflow-hidden rounded-xl bg-white transition-all duration-500 ${
                    idx === current && added
                      ? 'border-4 border-indigo-600'
                      : 'border border-transparent'
                  }`}
                  style={{ maxHeight: 'calc(100dvh - var(--bottom-bar, 5rem) - env(safe-area-inset-bottom))' }}
                >
                  {evt.image && (
                    <div className="shrink-0 relative w-full aspect-video">
                      <img
                        src={evt.image}
                        alt={evt.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-center">
                    <h3 className="font-bold text-xl mb-4">{evt.name}</h3>
                  </div>
                  <div className="shrink-0 border-t p-3 bg-white">
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

      {events.length > 0 && (
        <div className="px-4 py-8 z-10">
          {events.map(ev => (
            <p key={`list-${ev.key}`} className="mb-4">
              {ev.name}, {formatDate(ev.start)}: {ev.description}
            </p>
          ))}
        </div>
      )}

      <div className="mb-96"></div>

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
      <style>{`
        @supports not (height: 100dvh) {
          .plans-carousel-card {
            max-height: calc(100vh - var(--bottom-bar, 5rem));
          }
        }
      `}</style>
    </div>
  )
}

