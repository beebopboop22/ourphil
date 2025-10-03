// src/RecurringEventsScroller.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { RRule } from 'rrule'
import { supabase } from './supabaseClient'
import { Link, useNavigate } from 'react-router-dom'
import useEventFavorite from './utils/useEventFavorite'
import { AuthContext } from './AuthProvider'
import { ArrowRight } from 'lucide-react'

const TYPE_OPTIONS = [
  { key: null,       label: 'All',      icon: null },
  { key: 'open_mic', label: 'Open Mic', icon: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//open-mic.png' },
  { key: 'karaoke',  label: 'Karaoke',  icon: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//karaoke.png' },
  { key: 'games',    label: 'Games',    icon: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//bingo.png' },
]

const TYPE_LABEL_MAP = TYPE_OPTIONS.reduce((acc, opt) => {
  if (opt.key) acc[opt.key] = opt.label
  return acc
}, {})

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table })
  return children(state)
}

export default function RecurringEventsScroller({
  windowStart,
  windowEnd,
  eyebrow,
  headline,
  description,
  ctaLabel,
  ctaHref,
  defaultType = null,
}) {
  const [occs, setOccs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState(defaultType ?? null)
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    setSelectedType(defaultType ?? null)
  }, [defaultType])

  const parseISO = useMemo(() => (d) => {
    const [y, m, dd] = d.split('-').map(Number)
    return new Date(y, m - 1, dd)
  }, [])

  const getDayLabel = useMemo(
    () => (dateStr) => {
      const d = parseISO(dateStr)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const diff = Math.floor((d - today) / (1000 * 60 * 60 * 24))
      if (diff === 0) return 'Today'
      if (diff === 1) return 'Tomorrow'
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    [parseISO]
  )

  const formatTime = useMemo(
    () => (t) => {
      if (!t) return ''
      const [h, m = '00'] = t.split(':')
      const hour = parseInt(h, 10)
      const displayHour = hour % 12 || 12
      const ampm = hour >= 12 ? 'p.m.' : 'a.m.'
      return `${displayHour}:${m.padStart(2, '0')} ${ampm}`
    },
    []
  )

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
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const allOccs = series.flatMap((s) => {
          try {
            const opts = RRule.parseString(s.rrule)
            opts.dtstart = new Date(`${s.start_date}T${s.start_time}`)
            const rule = new RRule(opts)
            return rule
              .between(windowStart, windowEnd, true)
              .filter((dt) => dt >= todayStart)
              .map((dt) => ({
                id:       `${s.id}::${dt.toISOString().slice(0, 10)}`,
                seriesId: s.id,
                title:    s.name,
                slug:     s.slug,
                image:    s.image_url,
                date:     dt.toISOString().slice(0, 10),
                time:     s.start_time,
                type:     s.event_type,
                href:     `/series/${s.slug}/${dt.toISOString().slice(0, 10)}`,
              }))
          } catch (err) {
            console.error('Recurring rule parse error', err)
            return []
          }
        })

        allOccs.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
        setOccs(allOccs)
      } catch (err) {
        console.error(err)
        setOccs([])
      } finally {
        setLoading(false)
      }
    })()
  }, [windowStart, windowEnd, selectedType])

  const activeFilter = TYPE_OPTIONS.find((opt) => opt.key === selectedType) || TYPE_OPTIONS[0]
  const filterDescription = activeFilter.key ? `${activeFilter.label.toLowerCase()} events` : 'weeklies'
  const cardsToShow = occs.slice(0, 8)

  const summaryText = loading
    ? 'Loading weekly events…'
    : occs.length === 0
    ? `No upcoming ${filterDescription} right now — check back soon!`
    : occs.length <= cardsToShow.length
    ? `Showing ${occs.length} upcoming ${filterDescription} happening this week.`
    : `Showing ${cardsToShow.length} of ${occs.length} upcoming ${filterDescription} happening this week.`

  const resolvedHeadline = headline || 'Recurring Series'
  const ctaDestination = ctaHref || '/series'
  const resolvedCtaLabel = ctaLabel || 'See all recurring events'

  return (
    <section className="mt-16">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">{eyebrow}</p>
            )}
            <h2 className={`text-2xl sm:text-3xl font-bold text-[#28313e] ${eyebrow ? 'mt-2' : ''}`}>
              {resolvedHeadline}
            </h2>
            <p className="mt-2 text-sm text-gray-600 sm:text-base">{summaryText}</p>
            {description && (
              <p className="mt-2 text-sm text-gray-600 sm:text-base">{description}</p>
            )}
          </div>
          <Link
            to={ctaDestination}
            className="inline-flex items-center gap-2 self-start md:self-auto px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-full shadow hover:bg-indigo-700 transition"
          >
            {resolvedCtaLabel}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 whitespace-nowrap">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.key ?? 'all'}
                onClick={() => setSelectedType(opt.key)}
                className={`
                  flex items-center gap-2
                  text-xs sm:text-sm font-semibold
                  px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition
                  ${selectedType === opt.key
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'}
                `}
              >
                {opt.icon && <img src={opt.icon} alt={opt.label} className="h-5 w-5" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="w-[16rem] flex-shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-shrink">
                  <div className="h-[18rem] w-full rounded-2xl bg-gray-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : cardsToShow.length === 0 ? (
            <p className="text-sm text-gray-600 sm:text-base">No events found for this filter just yet.</p>
          ) : (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
              {cardsToShow.map((evt) => {
                const day = getDayLabel(evt.date)
                const time = formatTime(evt.time)
                const bubbleText = time ? `${day} • ${time}` : day
                const typeLabel = evt.type ? TYPE_LABEL_MAP[evt.type] : null

                return (
                  <FavoriteState key={evt.id} event_id={evt.seriesId} source_table="recurring_events">
                    {({ isFavorite, toggleFavorite, loading: favLoading }) => (
                      <div className="w-[16rem] flex-shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-shrink">
                        <Link
                          to={evt.href}
                          className={`flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-md transition duration-200 hover:-translate-y-1 hover:shadow-xl ${
                            isFavorite ? 'ring-2 ring-indigo-600' : ''
                          }`}
                        >
                          <div className="relative h-40 w-full overflow-hidden bg-gray-100">
                            {evt.image ? (
                              <img src={evt.image} alt={evt.title} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-500">
                                Photo coming soon
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-semibold text-indigo-900 shadow-sm backdrop-blur">
                              {bubbleText}
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-4 text-center">
                            <div className="flex w-full flex-1 flex-col items-center">
                              <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{evt.title}</h3>
                              {typeLabel && (
                                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{typeLabel}</p>
                              )}
                            </div>
                          </div>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!user) { navigate('/login'); return }
                            toggleFavorite()
                          }}
                          disabled={favLoading}
                          className={`mt-2 inline-flex w-full items-center justify-center rounded-md border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
                            isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                          }`}
                        >
                          {isFavorite ? 'In the Plans' : 'Add to Plans'}
                        </button>
                      </div>
                    )}
                  </FavoriteState>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
