import React from 'react'
import { Link } from 'react-router-dom'
import useEventFavorite from './utils/useEventFavorite'

function parseMMDDYYYY(str) {
  if (!str) return null
  const [first] = str.split(/through|–|-/)
  const [m, d, y] = first.trim().split('/')
  return new Date(+y, +m - 1, +d)
}

function parseISODateLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getBubble(date) {
  if (!date) return { text: '', color: 'bg-gray-400', pulse: false }
  const today = new Date();
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24))
  if (diff === 0) return { text: 'Today', color: 'bg-green-500', pulse: false }
  if (diff === 1) return { text: 'Tomorrow!', color: 'bg-blue-500', pulse: false }
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  if (diff > 1 && diff < 7) return { text: `This ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false }
  if (diff >= 7 && diff < 14) return { text: `Next ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false }
  return { text: weekday, color: 'bg-[#ba3d36]', pulse: false }
}

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table })
  return children(state)
}

export default function SavedEventsScroller({ events = [] }) {
  if (!events.length) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekendStart = new Date(today)
  const day = today.getDay()
  if (day === 6) {
    // Saturday
  } else if (day === 0) {
    weekendStart.setDate(today.getDate() - 1)
  } else {
    weekendStart.setDate(today.getDate() + (6 - day))
  }
  const weekendEnd = new Date(weekendStart)
  weekendEnd.setDate(weekendStart.getDate() + 1)

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex gap-4 pb-4">
        {events.map(ev => {
          const {
            id,
            slug,
            title,
            image,
            imageUrl,
            start_date,
            source_table,
            group,
            venues,
          } = ev
          const img = imageUrl || image || ''
          const link =
            source_table === 'big_board_events'
              ? `/big-board/${slug}`
              : source_table === 'events'
                ? `/events/${slug}`
                : source_table === 'group_events'
                  ? `/groups/${group?.slug}/events/${id}`
                  : source_table === 'recurring_events'
                    ? `/series/${slug}/${start_date}`
                    : source_table === 'all_events'
                      ? `/${venues?.slug || ''}/${slug}`
                      : '/'
          const d = source_table === 'events'
            ? parseMMDDYYYY(start_date)
            : parseISODateLocal(start_date)
          const isWeekend = d && d >= weekendStart && d <= weekendEnd
          const { text, color, pulse } = getBubble(d)
          return (
            <FavoriteState key={`${source_table}-${id}`} event_id={id} source_table={source_table}>
              {({ isFavorite, toggleFavorite, loading }) => (
                <div className="w-[260px] sm:w-[300px] flex-shrink-0 flex flex-col">
                  <Link
                    to={link}
                    className={`relative w-full h-[380px] sm:h-[420px] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition ${isFavorite ? 'ring-2 ring-indigo-600' : ''}`}
                  >
                    {img && (
                      <img
                        src={img}
                        alt={title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                    {isWeekend && (
                      <span className="absolute top-3 left-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded z-20">
                        This Weekend
                      </span>
                    )}
                    {isFavorite && (
                      <div className="absolute top-3 right-3 bg-indigo-600 text-white text-xs px-2 py-1 rounded z-20">
                        In the plans!
                      </div>
                    )}
                    <h3 className="absolute bottom-20 left-4 right-4 text-center text-white text-3xl font-[Barrio] font-bold z-20 leading-tight">
                      {title}
                    </h3>
                    <span
                      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 ${color} text-white text-base font-bold px-6 py-1 rounded-full whitespace-nowrap min-w-[6rem] ${pulse ? 'animate-pulse' : ''} z-20`}
                    >
                      {text}
                    </span>
                  </Link>
                  <button
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleFavorite()
                    }}
                    disabled={loading}
                    className={`mt-2 w-full border border-indigo-600 rounded-md py-2 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                  >
                    {isFavorite ? 'In the Plans' : 'Add to Plans'}
                  </button>
                </div>
              )}
            </FavoriteState>
          )
        })}
      </div>
    </div>
  )
}
