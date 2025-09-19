import React from 'react'
import { Link } from 'react-router-dom'
import useEventFavorite from './utils/useEventFavorite'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'

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

function formatDisplayDate(date, startTime) {
  if (!date) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24))
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  let prefix
  if (diffDays === 0) prefix = 'Today'
  else if (diffDays === 1) prefix = 'Tomorrow'
  else if (diffDays > 1 && diffDays < 7) prefix = `This ${weekday}`
  else prefix = weekday
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  let timePart = ''
  if (startTime) {
    const [h = 0, m = 0] = startTime.split(':').map(Number)
    const dt = new Date()
    dt.setHours(h, m)
    timePart = dt
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      .toLowerCase()
  }
  return `${prefix}, ${datePart}${timePart ? `, ${timePart}` : ''}`
}

export default function SavedEventCard({ event, onRemove }) {
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
  const detailPath =
    getDetailPathForItem({
      ...event,
      group_slug: group?.slug,
      venue_slug: venues?.slug,
    }) || '/'

  const d = source_table === 'events'
    ? parseMMDDYYYY(start_date)
    : parseISODateLocal(start_date)
  const bubbleText = d ? formatDisplayDate(d, start_time) : ''

  const { isFavorite, toggleFavorite, loading } = useEventFavorite({ event_id: id, source_table })

  const handleFav = async e => {
    e.preventDefault()
    e.stopPropagation()
    const wasFavorite = isFavorite
    await toggleFavorite()
    if (wasFavorite && onRemove) onRemove()
  }

  return (
    <Link
      to={detailPath}
      className="block bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition flex flex-col"
    >
      <div className="relative w-full h-48">
        {img && <img src={img} alt={title} className="w-full h-full object-cover" />}
        {bubbleText && (
          <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-3 py-1.5 rounded-full text-sm font-semibold text-gray-800">
            {bubbleText}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1 justify-between items-center text-center">
        <h3 className="text-lg font-bold text-gray-800 line-clamp-2 mb-1">{title}</h3>
        {isRecurring
          ? address && <p className="text-sm text-gray-600">at {address}</p>
          : venues?.name && <p className="text-sm text-gray-600">at {venues.name}</p>}
        <div className="mt-4 w-full bg-gray-100 border-t px-3 py-2">
          <button
            onClick={handleFav}
            disabled={loading}
            className={`w-full border border-indigo-600 rounded-md py-1 text-sm font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
          >
            {isFavorite ? 'In the Plans' : 'Add to Plans'}
          </button>
        </div>
      </div>
    </Link>
  )
}
