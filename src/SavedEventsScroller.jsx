import React from 'react'
import { Link } from 'react-router-dom'
import EventFavorite from './EventFavorite.jsx'

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

export default function SavedEventsScroller({ events = [] }) {
  if (!events.length) return null
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
          const { text, color, pulse } = getBubble(d)
          return (
            <Link
              key={`${source_table}-${id}`}
              to={link}
              className="relative w-[260px] h-[380px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg"
            >
              {img && (
                <img
                  src={img}
                  alt={title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
              <EventFavorite
                event_id={id}
                source_table={source_table}
                className="absolute top-3 right-3 z-20 text-2xl text-white"
              />
              <h3 className="absolute bottom-16 left-4 right-4 text-center text-white text-3xl font-[Barrio] font-bold z-20 leading-tight">
                {title}
              </h3>
              <span
                className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 ${color} text-white text-base font-bold px-6 py-1 rounded-full whitespace-nowrap min-w-[6rem] ${pulse ? 'animate-pulse' : ''} z-20`}
              >
                {text}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
