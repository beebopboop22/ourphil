// src/SocialVideoCarousel.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'
import Navbar from './Navbar'

export default function SocialVideoCarousel() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)

  // parse "MM/DD/YYYY …" into JS Date
  const parseDate = (datesStr) => {
    if (!datesStr) return null
    const [first] = datesStr.split(/through|–|-/)
    const [m, d, y] = first.trim().split('/')
    return new Date(+y, +m - 1, +d)
  }

  // choose bubble text & style
  const getBubble = (start, isActive) => {
    const today = new Date(); today.setHours(0,0,0,0)
    if (isActive) return { text: 'Today', color: 'bg-green-500' }
    const diff = Math.floor((start - today)/(1000*60*60*24))
    if (diff === 1) return { text: 'Tomorrow!', color: 'bg-blue-500' }
    const weekday = start.toLocaleDateString('en-US',{ weekday:'long' })
    if (diff>1 && diff<7) return { text:`This ${weekday}!`, color:'bg-[#ba3d36]' }
    if (diff>=7 && diff<14) return { text:`Next ${weekday}!`, color:'bg-[#ba3d36]' }
    return { text: weekday, color:'bg-[#ba3d36]' }
  }

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
          const end = e['End Date'] ? parseDate(e['End Date']) : start
          return { ...e, start, end, isActive: start<=today && today<=end }
        })
        .filter(e => e.end >= today)
        .sort((a,b)=> a.isActive===b.isActive 
          ? a.start-b.start 
          : a.isActive ? -1 : 1
        )
        .slice(0,15)
      setEvents(enhanced)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!events.length) return
    const iv = setInterval(() => {
      setCurrent(i => (i + 1) % events.length)
    }, 1500)
    return () => clearInterval(iv)
  }, [events])

  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
  if (!events.length) return <div className="flex items-center justify-center h-screen">No upcoming events.</div>

  const evt = events[current]
  const bubble = getBubble(evt.start, evt.isActive)

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      <Navbar />

      {/* push below navbar (assumes Navbar height ~5rem) */}
      <div className="pt-20 flex-grow flex items-center justify-center p-4">
        <Link
          to={`/events/${evt.slug}`}
          className="relative w-full max-w-sm h-[70vh] rounded-2xl overflow-hidden shadow-lg"
        >
          <img
            src={evt['E Image']}
            alt={evt['E Name']}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

          <span
            className={`
              ${bubble.color}
              absolute top-10 left-1/2 transform -translate-x-1/2 text-white text-base font-bold
              px-4 py-1 rounded-full z-20 text-3xl
            `}
          >
            {bubble.text}
          </span>

          <p className="absolute text-5xl bottom-16 left-4 right-4 text-center text-white text-3xl font-[Barrio] font-bold z-20 leading-tight">
            {evt['E Name']}
          </p>

          <p className="absolute bottom-6 left-4 text-white text-sm z-20">
            {new Date(evt.Dates.split(/through|–|-/)[0].trim()).toLocaleDateString('en-US',{
              month:'long',day:'numeric'
            })}
          </p>
        </Link>
      </div>

      {/* bottom bar */}
      <div className="w-full bg-[#28313e]">
        <p className="text-center py-3 text-white font-[Barrio] text-3xl">
          Dig Into Philly
        </p>
      </div>
    </div>
  )
}
