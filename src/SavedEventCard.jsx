import React from 'react'
import { Link } from 'react-router-dom'
import EventFavorite from './EventFavorite.jsx'

function parseISODateLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function parseMMDDYYYY(str) {
  if (!str) return null
  const [first] = str.split(/through|–|-/)
  const [m, d, y] = first.trim().split('/').map(Number)
  return new Date(y, m - 1, d)
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  let hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.'
  hour = hour % 12 || 12
  return `${hour}:${m.padStart(2, '0')} ${ampm}`
}

export default function SavedEventCard({ event }) {
  const {
    id,
    slug,
    title,
    image,
    imageUrl,
    start_date,
    start_time,
    venues,
    address,
    source_table,
    group,
  } = event

  const img = imageUrl || image || ''
  const isRecurring = source_table === 'recurring_events'
  const link =
    source_table === 'big_board_events'
      ? `/big-board/${slug}`
      : source_table === 'events'
        ? `/events/${slug}`
        : source_table === 'group_events'
          ? `/groups/${group?.slug}/events/${id}`
          : source_table === 'recurring_events'
            ? `/series/${slug}`
            : source_table === 'all_events'
              ? `/${venues?.slug || ''}/${slug}`
              : '/'

  const d = source_table === 'events'
    ? parseMMDDYYYY(start_date)
    : parseISODateLocal(start_date)
  const bubbleLabel = d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  const bubbleTime = start_time ? ` ${formatTime(start_time)}` : ''

  return (
    <Link
      to={link}
      className="block bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition flex flex-col"
    >
      <div className="relative w-full h-48">
        {img && <img src={img} alt={title} className="w-full h-full object-cover" />}
        <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded-full text-xs font-semibold text-gray-800">
          {bubbleLabel}{bubbleTime}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1 justify-between items-center text-center">
        <h3 className="text-lg font-bold text-gray-800 line-clamp-2 mb-1">{title}</h3>
        {isRecurring
          ? address && <p className="text-sm text-gray-600">at {address}</p>
          : venues?.name && <p className="text-sm text-gray-600">at {venues.name}</p>}
        <div className="mt-4 w-full bg-gray-100 border-t px-3 py-2 flex justify-center">
          <EventFavorite event_id={id} source_table={source_table} />
        </div>
      </div>
    </Link>
  )
}
