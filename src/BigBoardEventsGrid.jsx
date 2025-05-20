// src/BigBoardEventsGrid.jsx
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function BigBoardEventsGrid() {
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(true)

  const iconUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png'

  // ── Helpers ────────────────────────────────────────────────────────────────
  const dayDiff = (dateStr) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const d     = new Date(dateStr)
    d.setHours(0,0,0,0)
    return Math.floor((d - today) / (1000*60*60*24))
  }

  const getDisplayDay = (dateStr) => {
    const diff = dayDiff(dateStr)
    if (diff === 0) return 'TODAY'
    if (diff === 1) return 'TOMORROW'

    if (diff > 1 && diff < 7) {
      const weekday = new Date(dateStr)
        .toLocaleDateString('en-US',{ weekday:'long' })
        .toUpperCase()
      return `THIS ${weekday}`
    }
    if (diff >= 7 && diff < 14) {
      const weekday = new Date(dateStr)
        .toLocaleDateString('en-US',{ weekday:'long' })
        .toUpperCase()
      return `NEXT ${weekday}`
    }

    // fallback: show month/day
    return new Date(dateStr)
      .toLocaleDateString('en-US',{ month:'short', day:'numeric' })
      .toUpperCase()
  }

  // ── Fetch community events ─────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('big_board_events')
        .select(`
          id,
          title,
          start_date,
          slug,
          big_board_posts!big_board_posts_event_id_fkey (
            image_url
          )
        `)
        .order('start_date',{ ascending:true })

      if (error) {
        console.error('Error loading events:', error)
      } else {
        const enriched = await Promise.all(
          data.map(async ev => {
            const imgKey = ev.big_board_posts?.[0]?.image_url
            const { data: { publicUrl } } = supabase
              .storage.from('big-board')
              .getPublicUrl(imgKey)
            return { ...ev, imageUrl: publicUrl }
          })
        )
        setEvents(enriched)
      }
      setLoading(false)
    })()
  }, [])

  return (
    <div className="w-full max-w-screen-xl mx-auto mb-12 px-4">
      <h2 className="text-black text-4xl font-[Barrio] mb-2 text-left">
        <Link to="/board" className="hover:underline">
          SUBMISSIONS FROM THE BIG BOARD
        </Link>
      </h2>
      <p className="text-gray-600 text-sm mb-4 text-left">
        Community-posted fliers live here — add yours to the Big Board!
      </p>

      {loading ? (
        <p>Loading submissions…</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4">
            {events.map(ev => {
              const diff    = dayDiff(ev.start_date)
              const label   = getDisplayDay(ev.start_date)
              const bgColor =
                diff === 0 ? 'bg-green-500' :
                diff === 1 ? 'bg-blue-500'  :
                             'bg-gray-500'

              return (
                <Link
                  key={ev.id}
                  to={`/big-board/${ev.slug}`}
                  className="relative min-w-[280px] max-w-[280px] bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-105 overflow-hidden flex flex-col"
                >
                  <div className="relative">
                    <img
                      src={ev.imageUrl}
                      alt={ev.title}
                      className="w-full h-36 object-cover"
                    />

                    <img
                      src={iconUrl}
                      alt="Community submission"
                      className="absolute top-2 right-2 w-8 h-8 z-20"
                    />

                    <div
                      className={`
                        absolute top-2 left-2 text-white text-sm font-bold
                        px-3 py-0.5 rounded-full shadow-md z-10
                        ${bgColor}
                      `}
                    >
                      {label}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-grow">
                    <h3 className="text-md font-semibold text-indigo-800 mb-1 line-clamp-2">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      📅 {new Date(ev.start_date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric'
                      })}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
