// src/RecurringEventsScroller.jsx
import React, { useState, useEffect } from 'react'
import { RRule } from 'rrule'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'
import useEventFavorite from './utils/useEventFavorite'

const TYPE_OPTIONS = [
  { key: null,       label: 'All',      icon: null },
  { key: 'open_mic', label: 'Open Mic', icon: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//open-mic.png' },
  { key: 'karaoke',  label: 'Karaoke',  icon: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//karaoke.png' },
  { key: 'games',    label: 'Games',    icon: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//bingo.png' },
]

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table })
  return children(state)
}

export default function RecurringEventsScroller({
  windowStart,
  windowEnd,
  header = 'Recurring Series'
}) {
  const [occs, setOccs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState(null)

  function parseISO(d) {
    const [y, m, dd] = d.split('-').map(Number)
    return new Date(y, m - 1, dd)
  }

  function getDayLabel(dateStr) {
    const d = parseISO(dateStr)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diff = Math.floor((d - today) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function formatTime(t) {
    if (!t) return ''
    let [h, m] = t.split(':')
    let hh = parseInt(h, 10) % 12 || 12
    const ampm = parseInt(h, 10) >= 12 ? 'p.m.' : 'a.m.'
    return `${hh}:${(m || '00').padStart(2, '0')} ${ampm}`
  }

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      try {
        let q = supabase
          .from('recurring_events')
          .select(`
            id,
            name,
            slug,
            image_url,
            start_date,
            start_time,
            rrule,
            event_type
          `)
          .eq('is_active', true)
        if (selectedType) q = q.eq('event_type', selectedType)
        const { data: series = [] } = await q

        const allOccs = series.flatMap((s) => {
          const opts = RRule.parseString(s.rrule)
          opts.dtstart = new Date(`${s.start_date}T${s.start_time}`)
          const rule = new RRule(opts)
          return rule.between(windowStart, windowEnd, true).map((dt) => ({
            id:    `${s.id}::${dt.toISOString().slice(0, 10)}`,
            seriesId: s.id,
            title: s.name,
            slug:  s.slug,
            image: s.image_url,
            date:  dt.toISOString().slice(0, 10),
            time:  s.start_time,
            type:  s.event_type,
            href:  `/series/${s.slug}/${dt.toISOString().slice(0, 10)}`,
          }))
        })

        allOccs.sort((a, b) => (a.date < b.date ? -1 : 1))
        setOccs(allOccs)
      } catch (e) {
        console.error(e)
        setOccs([])
      } finally {
        setLoading(false)
      }
    })()
  }, [windowStart, windowEnd, selectedType])

  return (
    <section className="py-8">
      <h2 className="text-3xl font-[Barrio] font-bold text-center mb-6">{header}</h2>

      {/* Filters: horizontally scrollable on mobile */}
      <div className="overflow-x-auto scrollbar-hide px-4 mb-8">
        <div className="flex space-x-2 whitespace-nowrap">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key ?? 'all'}
              onClick={() => setSelectedType(opt.key)}
              className={`
                flex items-center space-x-1
                text-xs sm:text-sm font-semibold
                px-3 sm:px-4 py-1 sm:py-2 rounded-full
                transition
                ${selectedType === opt.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}
              `}
            >
              {opt.icon && <img src={opt.icon} alt={opt.label} className="h-5 w-5" />}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8 text-gray-600">Loading…</p>
      ) : occs.length === 0 ? (
        <p className="text-center py-8 text-gray-600">No events found.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 sm:gap-6 pb-4 px-4">
            {occs.map((evt) => {
              const day = getDayLabel(evt.date)
              const time = formatTime(evt.time)
              const bubbleText = time ? `${day} ${time}` : day

              return (
                <FavoriteState
                  key={evt.id}
                  event_id={evt.seriesId}
                  source_table="recurring_events"
                >
                  {({ isFavorite, toggleFavorite, loading }) => (
                    <div className="flex-shrink-0 w-[220px] sm:w-[260px]">
                      <Link
                        to={evt.href}
                        className={`relative w-full h-[340px] sm:h-[380px] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition ${isFavorite ? 'ring-2 ring-indigo-600' : ''}`}
                      >
                        <img
                          src={evt.image}
                          alt={evt.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />

                        <h3 className="absolute bottom-20 left-3 sm:left-4 right-3 sm:right-4 text-center text-white text-xl sm:text-2xl font-[Barrio] font-bold z-20 leading-tight">
                          {evt.title}
                        </h3>

                        <span
                          className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold px-4 py-1 rounded-full whitespace-nowrap min-w-max z-20"
                        >
                          {bubbleText}
                        </span>
                      </Link>
                      <button
                        onClick={(e) => {
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
      )}
    </section>
  )
}
