import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import Seo from './components/Seo.jsx'
import { supabase } from './supabaseClient'
import { COMMUNITY_REGIONS } from './communityIndexData.js'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'
import { RRule } from 'rrule'

const SITE_BASE_URL = 'https://www.ourphilly.org'
const HEART_BACKGROUND_IMAGE_URL =
  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png'
const CONTACT_PATH = '/contact/'
const REVIEW_CHUNK_SIZE = 50
const UPCOMING_WINDOW_DAYS = 21
const HAPPENING_SOON_WINDOW_HOURS = 72

function normalizeTokens(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.flatMap(normalizeTokens)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,&/|;]+| and | AND |\\n/g)
      .map(part => part.replace(/neighborhood$/i, '').trim().toLowerCase())
      .filter(Boolean)
  }
  if (typeof value === 'object') {
    const nested = []
    const keys = ['area', 'Area', 'name', 'Name', 'title', 'Title']
    keys.forEach(key => {
      if (value[key]) nested.push(value[key])
    })
    return nested.flatMap(normalizeTokens)
  }
  return []
}

function rowMatchesRegion(row, aliasSet) {
  if (!row || !aliasSet || aliasSet.size === 0) return false
  const candidates = []
  const possibleKeys = [
    'Area',
    'area',
    'Areas',
    'areas',
    'Region',
    'region',
    'Neighborhood',
    'neighborhood',
    'Neighborhoods',
    'neighborhoods',
    'Quadrant',
    'quadrant',
    'location_area',
    'locationArea',
    'area_display',
    'Area_display',
    'AreaDisplay',
  ]
  possibleKeys.forEach(key => {
    if (row[key]) candidates.push(row[key])
  })
  if (row.groups?.Area) candidates.push(row.groups.Area)
  if (row.group?.Area) candidates.push(row.group.Area)
  if (row.big_board_posts?.Area) candidates.push(row.big_board_posts.Area)
  if (row.big_board_events?.Area) candidates.push(row.big_board_events.Area)
  if (row.AreaList) candidates.push(row.AreaList)
  if (row.location?.area) candidates.push(row.location.area)

  const tokens = candidates.flatMap(normalizeTokens)
  return tokens.some(token => aliasSet.has(token))
}

function parseDateString(input) {
  if (!input) return null
  if (input instanceof Date) {
    const clone = new Date(input.getTime())
    clone.setHours(0, 0, 0, 0)
    return clone
  }
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [yearStr, monthStr, dayStr] = trimmed.split(/[-T]/)
      const year = Number(yearStr)
      const month = Number(monthStr)
      const day = Number(dayStr)
      if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null
      return new Date(year, month - 1, day)
    }
    const parts = trimmed.split('/')
    if (parts.length === 3) {
      const [mStr, dStr, yStr] = parts
      let month = Number(mStr)
      let day = Number(dStr)
      let year = Number(yStr)
      if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null
      if (year < 100) year += year >= 70 ? 1900 : 2000
      return new Date(year, month - 1, day)
    }
    const timestamp = Date.parse(trimmed)
    if (!Number.isNaN(timestamp)) {
      const parsed = new Date(timestamp)
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    }
  }
  return null
}

function formatDateRange(start, end) {
  if (!start) return 'Date TBA'
  const sameDay = !end || end.getTime() === start.getTime()
  if (sameDay) {
    return start.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const startYear = start.getFullYear()
  const endYear = end.getFullYear()
  const sameYear = startYear === endYear
  const sameMonth = sameYear && start.getMonth() === end.getMonth()

  if (sameYear && sameMonth) {
    const monthName = start.toLocaleDateString('en-US', { month: 'long' })
    return `${monthName} ${start.getDate()}–${end.getDate()}, ${startYear}`
  }

  if (sameYear) {
    const startLabel = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    const endLabel = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    return `${startLabel} – ${endLabel}, ${startYear}`
  }

  const startLabel = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

const WEEKDAY_DISPLAY_ORDER = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const RRULE_WEEKDAY_TO_NAME = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const WEEKDAY_SYNONYMS = {
  sun: 'Sunday',
  sunday: 'Sunday',
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
}

function normalizeWeekdayName(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && value >= 0 && value <= 6) {
    return WEEKDAY_DISPLAY_ORDER[value]
  }
  const trimmed = String(value).trim().toLowerCase()
  if (!trimmed) return null
  return WEEKDAY_SYNONYMS[trimmed] || null
}

function sortUniqueWeekdays(days) {
  const unique = Array.from(new Set(days))
  return unique.sort((a, b) => WEEKDAY_DISPLAY_ORDER.indexOf(a) - WEEKDAY_DISPLAY_ORDER.indexOf(b))
}

function extractWeekdaysFromRrule(rruleString) {
  if (!rruleString) return []
  try {
    const options = RRule.parseString(rruleString)
    const { byweekday } = options
    const weekdays = Array.isArray(byweekday) ? byweekday : byweekday ? [byweekday] : []
    const names = weekdays
      .map(entry => {
        if (typeof entry === 'number') {
          return RRULE_WEEKDAY_TO_NAME[entry] || null
        }
        if (typeof entry === 'object' && entry !== null && 'weekday' in entry) {
          const index = entry.weekday
          return RRULE_WEEKDAY_TO_NAME[index] || null
        }
        return null
      })
      .filter(Boolean)
    return sortUniqueWeekdays(names)
  } catch (err) {
    console.error('RRULE parse error', err)
    return []
  }
}

function extractWeekdays(row) {
  if (!row) return []
  const candidateKeys = [
    'day_of_week',
    'days_of_week',
    'Day_of_week',
    'DayOfWeek',
    'DaysOfWeek',
    'dayOfWeek',
  ]
  const names = []
  candidateKeys.forEach(key => {
    if (!row[key]) return
    const value = row[key]
    if (Array.isArray(value)) {
      value.forEach(item => {
        const name = normalizeWeekdayName(item)
        if (name) names.push(name)
      })
    } else if (typeof value === 'string') {
      value
        .split(/[,&/|;]+| and | AND |\n/g)
        .map(part => normalizeWeekdayName(part))
        .filter(Boolean)
        .forEach(name => names.push(name))
    } else {
      const name = normalizeWeekdayName(value)
      if (name) names.push(name)
    }
  })
  if (names.length) {
    return sortUniqueWeekdays(names)
  }
  return extractWeekdaysFromRrule(row.rrule)
}

function formatWeekdayList(days) {
  if (!days || days.length === 0) return 'Day varies'
  if (days.length === 1) return days[0]
  if (days.length === 2) return `${days[0]} & ${days[1]}`
  return `${days.slice(0, -1).join(', ')} & ${days[days.length - 1]}`
}

function formatTimeOfDay(time) {
  if (!time) return null
  const [hourStr, minuteStr = '0'] = time.split(':')
  const hour = Number(hourStr)
  if (Number.isNaN(hour)) return null
  const minute = Number(minuteStr)
  const normalizedMinute = Number.isNaN(minute) ? 0 : minute
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(normalizedMinute).padStart(2, '0')} ${suffix}`
}

function formatCompactTime(time) {
  if (!time) return ''
  const [hourStr, minuteStr = '0'] = time.split(':')
  const hour = Number(hourStr)
  if (Number.isNaN(hour)) return ''
  const minute = Number(minuteStr)
  const normalizedMinute = Number.isNaN(minute) ? 0 : minute
  const suffix = hour >= 12 ? 'p' : 'a'
  const displayHour = hour % 12 || 12
  const minutes = String(normalizedMinute).padStart(2, '0')
  return `${displayHour}:${minutes}${suffix}`
}

function buildSummary(text, fallback = 'Details coming soon.') {
  if (typeof text !== 'string' || !text.trim()) return fallback
  const trimmed = text.trim()
  if (trimmed.length <= 180) return trimmed
  return `${trimmed.slice(0, 177)}…`
}

function dedupeByUrl(items) {
  const seen = new Set()
  const result = []
  items.forEach(item => {
    if (!item || !item.url) return
    if (seen.has(item.url)) return
    seen.add(item.url)
    result.push(item)
  })
  return result
}

function resolveBigBoardUrl(raw) {
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    const match = raw.match(/\/public\/big-board\/(.+)$/)
    if (match) {
      return supabase.storage.from('big-board').getPublicUrl(match[1]).data?.publicUrl || raw
    }
    return raw
  }
  return supabase.storage.from('big-board').getPublicUrl(raw).data?.publicUrl || null
}

function parsePhotoUrls(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.filter(url => typeof url === 'string' && url.trim().length)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter(url => typeof url === 'string' && url.trim().length)
      }
    } catch {}
    return trimmed
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length)
  }
  return []
}

function getDurationMs(start, end) {
  if (!start) return Number.MAX_SAFE_INTEGER
  if (!end) return 0
  return Math.max(0, (end?.getTime?.() || 0) - start.getTime())
}

function computeNextOccurrence(series) {
  if (!series?.rrule || !series?.start_date) return null
  try {
    const options = RRule.parseString(series.rrule)
    options.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`)
    if (series.end_date) {
      options.until = new Date(`${series.end_date}T23:59:59`)
    }
    const rule = new RRule(options)
    const now = new Date()
    return rule.after(now, true)
  } catch (err) {
    console.error('Recurring event next occurrence error', err)
    return null
  }
}

function expandOccurrencesWithin(series, windowStart, windowEnd) {
  if (!series?.rrule || !series?.start_date) return []
  try {
    const options = RRule.parseString(series.rrule)
    options.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`)
    if (series.end_date) {
      options.until = new Date(`${series.end_date}T23:59:59`)
    }
    const rule = new RRule(options)
    const occurrences = rule.between(windowStart, windowEnd, true)
    return occurrences.map(date => ({
      date,
      iso: date.toISOString(),
    }))
  } catch (err) {
    console.error('Recurring event occurrence expansion error', err)
    return []
  }
}

function formatOccurrenceChip(occurrence, startTime) {
  if (!occurrence) return 'Upcoming'
  const now = new Date()
  const sameDay =
    occurrence.getFullYear() === now.getFullYear() &&
    occurrence.getMonth() === now.getMonth() &&
    occurrence.getDate() === now.getDate()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow =
    occurrence.getFullYear() === tomorrow.getFullYear() &&
    occurrence.getMonth() === tomorrow.getMonth() &&
    occurrence.getDate() === tomorrow.getDate()
  if (sameDay) {
    return 'Tonight'
  }
  if (isTomorrow) {
    return 'Tomorrow'
  }
  const weekday = occurrence.toLocaleDateString('en-US', { weekday: 'short' })
  const timeLabel = formatCompactTime(startTime)
  return timeLabel ? `${weekday} ${timeLabel}` : weekday
}

function formatOccurrenceTooltip(occurrence, startTime) {
  if (!occurrence) return ''
  const dateLabel = occurrence.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const timeLabel = formatTimeOfDay(startTime)
  return timeLabel ? `${dateLabel} at ${timeLabel}` : dateLabel
}

function formatRelativeDateChip(date) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function BaseModal({ title, onClose, className = '', children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const previouslyFocused = document.activeElement
    function handleKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    const focusable = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.[0]?.focus?.()
    return () => {
      document.removeEventListener('keydown', handleKey)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8 ${className}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

function WeeklyEventsModal({
  open,
  onClose,
  events,
  dayOptions,
  selectedDay,
  onSelectDay,
  search,
  onSearch,
}) {
  const [visibleCount, setVisibleCount] = useState(10)

  useEffect(() => {
    if (!open) return
    setVisibleCount(10)
  }, [open, selectedDay, search])

  const filtered = useMemo(() => {
    const dayFiltered = selectedDay === 'all' ? events : events.filter(evt => (evt.__days || []).includes(selectedDay))
    const query = search.trim().toLowerCase()
    if (!query) return dayFiltered
    return dayFiltered.filter(evt => {
      const haystack = [evt.name, evt.description, evt.summary, evt.__venueLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [events, selectedDay, search])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visible.length < filtered.length

  if (!open) return null

  return (
    <BaseModal title="Weekly events" onClose={onClose} className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectDay('all')}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
            selectedDay === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All days
        </button>
        {dayOptions.map(day => (
          <button
            key={day}
            type="button"
            onClick={() => onSelectDay(day)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              selectedDay === day
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <label className="sr-only" htmlFor="weekly-search">
          Search weekly events
        </label>
        <input
          id="weekly-search"
          type="search"
          value={search}
          onChange={event => onSearch(event.target.value)}
          placeholder="Search by name or venue"
          className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
      <div className="mt-6 space-y-4">
        {visible.length === 0 ? (
          <p className="text-sm text-gray-600">
            No weekly events match those filters yet. Have one to add?{' '}
            <Link to={CONTACT_PATH} className="font-medium text-indigo-600">
              Tell us about it
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-4">
            {visible.map(event => {
              const href = getDetailPathForItem({ ...event, source_table: 'recurring_events' })
              return (
                <li key={event.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <Link
                    to={href}
                    className="flex flex-col gap-4 p-5 transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-indigo-50">
                        {event.image_url ? (
                          <img
                            src={event.image_url}
                            alt={event.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-indigo-400">
                            No photo yet
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-indigo-500">{formatWeekdayList(event.__days)}</p>
                        <h4 className="text-lg font-semibold text-gray-900">{event.name}</h4>
                        {event.description && (
                          <p className="mt-2 text-sm text-gray-600">{buildSummary(event.description)}</p>
                        )}
                        {event.__venueLabel && (
                          <p className="mt-2 text-sm text-gray-500">{event.__venueLabel}</p>
                        )}
                        {event.__tags?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {event.__tags.map(tag => (
                              <span
                                key={`${event.id}-${tag}`}
                                className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-indigo-600">View details →</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount(prev => prev + 5)}
            className="rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
          >
            Show more weekly events
          </button>
        </div>
      )}
    </BaseModal>
  )
}

function NewsletterSheet({ open, onClose, outlets, areaName }) {
  if (!open) return null
  return (
    <BaseModal title={`Subscribe to all ${areaName} newsletters`} onClose={onClose} className="max-w-lg">
      <p className="text-sm text-gray-600">
        We link you to each publisher’s site—subscriptions happen on their end.
      </p>
      <ul className="mt-6 space-y-4">
        {outlets.map(outlet => (
          <li key={outlet.id || outlet.slug || outlet.outlet} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-base font-semibold text-gray-900">{outlet.outlet || outlet.title}</h4>
                {outlet.description && (
                  <p className="mt-1 text-sm text-gray-600">{buildSummary(outlet.description)}</p>
                )}
              </div>
              {outlet.link && (
                <a
                  href={outlet.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                >
                  Open site
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </BaseModal>
  )
}

function ContactCallout({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-rose-100/70 bg-white/90 px-6 py-8 text-center shadow-sm backdrop-blur ${className}`}>
      <div className="pointer-events-none absolute -right-6 -top-10 w-32 opacity-10 sm:-right-10 sm:w-40">
        <img src={HEART_BACKGROUND_IMAGE_URL} alt="" className="h-full w-full object-contain" loading="lazy" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-500">Neighbor powered</p>
      <p className="mt-3 text-base leading-relaxed text-gray-700">
        These listings come straight from neighbors. Want to add a group, tradition, or weekly event—or notice something that
        needs an update?{' '}
        <Link to={CONTACT_PATH} className="font-medium text-indigo-600 underline">
          Drop us a note on the contact page
        </Link>
        .
      </p>
    </div>
  )
}
export default function CommunityIndexPage({ region }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [traditions, setTraditions] = useState([])
  const [otherTraditions, setOtherTraditions] = useState([])
  const [groups, setGroups] = useState([])
  const [weeklyEvents, setWeeklyEvents] = useState([])
  const [photos, setPhotos] = useState([])
  const [newsOutlets, setNewsOutlets] = useState([])
  const [weeklyEventDayFilter, setWeeklyEventDayFilter] = useState('all')
  const [weeklyEventSearch, setWeeklyEventSearch] = useState('')
  const [groupTypeFilter, setGroupTypeFilter] = useState('all')
  const [groupsVisibleCount, setGroupsVisibleCount] = useState(5)
  const [traditionMonthFilter, setTraditionMonthFilter] = useState('all')
  const [traditionSearchQuery, setTraditionSearchQuery] = useState('')
  const [traditionsVisibleCount, setTraditionsVisibleCount] = useState(5)
  const [showWeeklyModal, setShowWeeklyModal] = useState(false)
  const [showNewsletterSheet, setShowNewsletterSheet] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)

  const aliasSet = useMemo(() => {
    const aliases = region?.areaAliases || []
    return new Set(aliases.map(alias => alias.toLowerCase()))
  }, [region])

  const otherRegions = useMemo(() => COMMUNITY_REGIONS.filter(entry => entry.key !== region?.key), [region])

  useEffect(() => {
    if (!region) return
    let isActive = true

    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [traditionsRes, groupsRes, postsRes, recurringRes, outletsRes] = await Promise.all([
          supabase.from('events').select('*'),
          supabase.from('groups').select('*'),
          supabase
            .from('big_board_posts')
            .select('id, image_url, Area, created_at, big_board_events!big_board_posts_event_id_fkey(title, slug)')
            .order('created_at', { ascending: false })
            .limit(60),
          supabase.from('recurring_events').select('*').eq('is_active', true),
          supabase.from('news_outlets').select('*'),
        ])

        if (!isActive) return

        if (traditionsRes.error) console.error('Traditions load error', traditionsRes.error)
        if (groupsRes.error) console.error('Groups load error', groupsRes.error)
        if (postsRes.error) console.error('Community photo load error', postsRes.error)
        if (recurringRes.error) console.error('Recurring events load error', recurringRes.error)
        if (outletsRes.error) console.error('News outlets load error', outletsRes.error)

        const traditionRows = Array.isArray(traditionsRes.data) ? traditionsRes.data : []
        const enrichedTraditionsAll = traditionRows
          .map(row => {
            const start =
              parseDateString(row.Dates) ||
              parseDateString(row['Start Date']) ||
              parseDateString(row.startDate) ||
              parseDateString(row.start_date)
            const end =
              parseDateString(row['End Date']) ||
              parseDateString(row.endDate) ||
              parseDateString(row.end_date) ||
              start
            const createdAt = row.created_at ? Date.parse(row.created_at) : null
            return { ...row, __startDate: start || null, __endDate: end || null, __createdAt: createdAt }
          })
          .filter(row => row.__startDate)

        const regionTraditions = enrichedTraditionsAll
          .filter(row => rowMatchesRegion(row, aliasSet))
          .sort((a, b) => {
            const diff = (a.__startDate?.getTime?.() || 0) - (b.__startDate?.getTime?.() || 0)
            if (diff !== 0) return diff
            return (a['E Name'] || '').localeCompare(b['E Name'] || '')
          })

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const windowEnd = new Date(today)
        windowEnd.setDate(windowEnd.getDate() + UPCOMING_WINDOW_DAYS)

        const otherUpcomingTraditions = enrichedTraditionsAll
          .filter(row => !rowMatchesRegion(row, aliasSet))
          .filter(row => {
            const start = row.__startDate
            if (!start) return false
            return start >= today && start <= windowEnd
          })
          .sort((a, b) => {
            const startDiff = (a.__startDate?.getTime?.() || 0) - (b.__startDate?.getTime?.() || 0)
            if (startDiff !== 0) return startDiff
            const durationDiff = getDurationMs(a.__startDate, a.__endDate) - getDurationMs(b.__startDate, b.__endDate)
            if (durationDiff !== 0) return durationDiff
            return (b.__createdAt || 0) - (a.__createdAt || 0)
          })

        setTraditions(regionTraditions)
        setOtherTraditions(otherUpcomingTraditions)

        const groupRows = Array.isArray(groupsRes.data) ? groupsRes.data : []
        const regionGroups = groupRows
          .filter(row => rowMatchesRegion(row, aliasSet))
          .sort((a, b) => (a.Name || '').localeCompare(b.Name || ''))
        setGroups(regionGroups)

        const recurringRows = Array.isArray(recurringRes.data) ? recurringRes.data : []
        const regionRecurring = recurringRows.filter(row => rowMatchesRegion(row, aliasSet))

        let tagMap = new Map()
        const recurringIds = regionRecurring
          .map(row => row.id)
          .filter(id => typeof id === 'number' || typeof id === 'string')

        if (recurringIds.length) {
          const { data: taggingsData, error: taggingsError } = await supabase
            .from('taggings')
            .select('tag_id, taggable_id')
            .eq('taggable_type', 'recurring_events')
            .in('taggable_id', recurringIds)
          if (!isActive) return
          if (taggingsError) {
            console.error('Recurring event taggings load error', taggingsError)
          } else {
            const tagIds = Array.from(new Set((taggingsData || []).map(t => t.tag_id))).filter(Boolean)
            if (tagIds.length) {
              const { data: tagsData, error: tagsError } = await supabase
                .from('tags')
                .select('id, name')
                .in('id', tagIds)
              if (!isActive) return
              if (tagsError) {
                console.error('Tags load error', tagsError)
              } else {
                const tagNameMap = new Map()
                ;(tagsData || []).forEach(tag => {
                  if (tag?.id) {
                    tagNameMap.set(tag.id, tag.name)
                  }
                })
                tagMap = taggingsData.reduce((acc, tagging) => {
                  const list = acc.get(tagging.taggable_id) || []
                  const tagName = tagNameMap.get(tagging.tag_id)
                  if (tagName) {
                    list.push(tagName)
                    acc.set(tagging.taggable_id, list)
                  }
                  return acc
                }, new Map())
              }
            }
          }
        }

        const enrichedRecurring = regionRecurring.map(row => {
          const rawTags = tagMap.get(row.id) || []
          const tags = rawTags.slice().sort((a, b) => a.localeCompare(b))
          const days = extractWeekdays(row)
          const venuePieces = [row.venue_name, row.address, row.area_description, row.location_summary]
            .map(part => (typeof part === 'string' ? part.trim() : ''))
            .filter(Boolean)
          const venueLabel = venuePieces.slice(0, 2).join(' · ')
          const nextOccurrence = computeNextOccurrence(row)
          return {
            ...row,
            __tags: tags,
            __days: days,
            __venueLabel: venueLabel,
            __nextOccurrence: nextOccurrence,
          }
        })
        setWeeklyEvents(enrichedRecurring)

        const outletsRows = Array.isArray(outletsRes.data) ? outletsRes.data : []
        const regionOutlets = outletsRows
          .filter(row => rowMatchesRegion(row, aliasSet))
          .sort((a, b) => (a.outlet || a.title || '').localeCompare(b.outlet || b.title || ''))
        setNewsOutlets(regionOutlets)

        const posts = Array.isArray(postsRes.data) ? postsRes.data : []
        const postPhotos = (
          await Promise.all(
            posts
              .filter(post => rowMatchesRegion(post, aliasSet))
              .map(async post => {
                const url = resolveBigBoardUrl(post.image_url)
                if (!url) return null
                const linkedEvent = Array.isArray(post.big_board_events)
                  ? post.big_board_events[0]
                  : post.big_board_events
                const href = linkedEvent?.slug ? `/big-board/${linkedEvent.slug}` : null
                return {
                  url,
                  caption: linkedEvent?.title || 'Community Submission',
                  href,
                  source: 'submission',
                  createdAt: post.created_at ? Date.parse(post.created_at) : null,
                }
              })
          )
        ).filter(Boolean)

        const traditionIdMap = new Map()
        regionTraditions.forEach(row => {
          if (row.id) traditionIdMap.set(row.id, row)
        })

        const traditionIds = Array.from(traditionIdMap.keys())
        const reviewRows = []
        for (let i = 0; i < traditionIds.length; i += REVIEW_CHUNK_SIZE) {
          const chunk = traditionIds.slice(i, i + REVIEW_CHUNK_SIZE)
          const { data: reviewData, error: reviewError } = await supabase
            .from('reviews')
            .select('id, event_id, photo_urls')
            .in('event_id', chunk)
          if (reviewError) {
            console.error('Review load error', reviewError)
            continue
          }
          if (Array.isArray(reviewData)) reviewRows.push(...reviewData)
        }

        const reviewPhotos = reviewRows.flatMap(row => {
          const event = traditionIdMap.get(row.event_id)
          if (!event) return []
          const urls = parsePhotoUrls(row.photo_urls)
          if (!urls.length) return []
          const caption = event?.['E Name'] || event?.name || 'Tradition'
          const href = getDetailPathForItem({ ...event, source_table: 'events' })
          return urls.map(url => ({
            url,
            caption,
            href,
            source: 'review',
            createdAt: event.__startDate ? event.__startDate.getTime() : null,
          }))
        })

        const combinedPhotos = dedupeByUrl([...reviewPhotos, ...postPhotos]).slice(0, 9)
        setPhotos(combinedPhotos)
      } catch (err) {
        if (!isActive) return
        console.error('Community index load error', err)
        setError('We had trouble loading this region. Please try again soon.')
        setTraditions([])
        setOtherTraditions([])
        setGroups([])
        setPhotos([])
        setWeeklyEvents([])
        setNewsOutlets([])
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadData()
    return () => {
      isActive = false
    }
  }, [region, aliasSet])
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let cancelled = false
    function reveal() {
      if (!cancelled) setShowPhotos(true)
    }
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(reveal, { timeout: 2000 })
      return () => {
        cancelled = true
        if (window.cancelIdleCallback) window.cancelIdleCallback(handle)
      }
    }
    const timeout = window.setTimeout(reveal, 600)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [region])

  useEffect(() => {
    setGroupTypeFilter('all')
    setGroupsVisibleCount(5)
    setTraditionMonthFilter('all')
    setTraditionSearchQuery('')
    setTraditionsVisibleCount(5)
    setWeeklyEventDayFilter('all')
    setWeeklyEventSearch('')
    setShowPhotos(false)
  }, [region])

  useEffect(() => {
    setGroupsVisibleCount(5)
  }, [groupTypeFilter])

  useEffect(() => {
    setTraditionsVisibleCount(5)
  }, [traditionMonthFilter, traditionSearchQuery])

  const canonicalPath = region?.slug?.startsWith('/') ? region.slug : `/${region?.slug || ''}`
  const canonicalUrl = `${SITE_BASE_URL}${canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`}`

  const scrollToSection = sectionId => {
    if (typeof document === 'undefined') return
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const upcomingTraditions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return traditions
      .filter(row => {
        const end = row.__endDate || row.__startDate
        if (!row.__startDate) return false
        if (!end) return row.__startDate >= today
        return end >= today
      })
      .sort((a, b) => {
        const startDiff = (a.__startDate?.getTime?.() || 0) - (b.__startDate?.getTime?.() || 0)
        if (startDiff !== 0) return startDiff
        const durationDiff = getDurationMs(a.__startDate, a.__endDate) - getDurationMs(b.__startDate, b.__endDate)
        if (durationDiff !== 0) return durationDiff
        return (b.__createdAt || 0) - (a.__createdAt || 0)
      })
  }, [traditions])

  const featuredTradition = upcomingTraditions[0]
  const alsoComingUp = upcomingTraditions.slice(1, 4)

  const groupTypeOptions = useMemo(() => {
    const set = new Set()
    groups.forEach(group => {
      if (!group?.Type) return
      group.Type.split(',').forEach(part => {
        const trimmed = part.trim()
        if (trimmed) set.add(trimmed)
      })
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [groups])

  const filteredGroups = useMemo(() => {
    if (groupTypeFilter === 'all') return groups
    const target = groupTypeFilter.toLowerCase()
    return groups.filter(group => group?.Type?.split(',').some(type => type.trim().toLowerCase() === target))
  }, [groups, groupTypeFilter])

  const visibleGroups = filteredGroups.slice(0, groupsVisibleCount)
  const hasMoreGroups = visibleGroups.length < filteredGroups.length

  const weeklyDayOptions = useMemo(() => {
    const set = new Set()
    weeklyEvents.forEach(event => {
      ;(event.__days || []).forEach(day => set.add(day))
    })
    return WEEKDAY_DISPLAY_ORDER.filter(day => set.has(day))
  }, [weeklyEvents])

  const occurrencesWithinWindow = useMemo(() => {
    const start = new Date()
    const end = new Date(start.getTime() + HAPPENING_SOON_WINDOW_HOURS * 60 * 60 * 1000)
    const occurrences = weeklyEvents.flatMap(event =>
      expandOccurrencesWithin(event, start, end).map(item => ({
        ...event,
        __occurrenceDate: item.date,
        __occurrenceIso: item.iso,
      }))
    )
    return occurrences.sort((a, b) => a.__occurrenceDate - b.__occurrenceDate).slice(0, 4)
  }, [weeklyEvents])

  const monthOptions = useMemo(() => {
    const map = new Map()
    traditions.forEach(tradition => {
      const start = tradition.__startDate
      if (!start) return
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      if (!map.has(key)) {
        const label = start.toLocaleDateString('en-US', {
          month: 'long',
        })
        map.set(key, label)
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [traditions])

  const monthLabelMap = useMemo(() => Object.fromEntries(monthOptions), [monthOptions])

  const filteredTraditionsAll = useMemo(() => {
    const base =
      traditionMonthFilter === 'all'
        ? traditions
        : traditions.filter(tradition => {
            const start = tradition.__startDate
            if (!start) return false
            const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
            return key === traditionMonthFilter
          })
    const query = traditionSearchQuery.trim().toLowerCase()
    if (!query) return base
    return base.filter(tradition => {
      const haystack = [tradition['E Name'], tradition.Description, tradition.summary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [traditions, traditionMonthFilter, traditionSearchQuery])

  const filteredUpcomingTraditions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return filteredTraditionsAll.filter(tradition => {
      const end = tradition.__endDate || tradition.__startDate
      if (!tradition.__startDate) return false
      if (!end) return tradition.__startDate >= today
      return end >= today
    })
  }, [filteredTraditionsAll])

  const filteredPastTraditions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return filteredTraditionsAll
      .filter(tradition => {
        const end = tradition.__endDate || tradition.__startDate
        if (!tradition.__startDate) return false
        if (!end) return tradition.__startDate < today
        return end < today
      })
      .sort((a, b) => (b.__startDate?.getTime?.() || 0) - (a.__startDate?.getTime?.() || 0))
  }, [filteredTraditionsAll])

  const visibleTraditions = filteredUpcomingTraditions.slice(0, traditionsVisibleCount)
  const hasMoreTraditions = visibleTraditions.length < filteredUpcomingTraditions.length

  const todayLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const kpiCards = [
    {
      label: 'Coming Up',
      count: upcomingTraditions.length,
      description: `Next traditions on the calendar for ${region?.name || 'this area'}.`,
      target: 'hero-section',
    },
    {
      label: 'Weekly Events',
      count: weeklyEvents.length,
      description: 'Recurring happenings and weekly staples to plug into.',
      target: 'happening-soon-section',
    },
    {
      label: 'Groups',
      count: filteredGroups.length,
      description: 'Neighborhood crews, teams, and volunteer collectives.',
      target: 'groups-section',
    },
    {
      label: 'Traditions',
      count: filteredTraditionsAll.length,
      description: `Legacy events rooted in ${region?.name || 'the neighborhood'}.`,
      target: 'traditions-section',
    },
  ]
  if (!region) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-gray-600">This community index was not found.</p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Seo title={region.seoTitle} description={region.seoDescription} canonicalUrl={canonicalUrl} />
      <Navbar />
      <main className="flex-1 pt-24 sm:pt-28">
        <section id="hero-section" className="bg-gradient-to-br from-indigo-50 via-white to-rose-50">
          <div className="mx-auto max-w-screen-xl px-4 pb-12 pt-10 sm:pt-12">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-indigo-500">Coming up in {region.name}</p>
            {loading ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="min-h-[320px] animate-pulse rounded-3xl bg-white/80 shadow-sm" />
                <div className="space-y-3">
                  {[0, 1, 2].map(index => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/70" />
                  ))}
                </div>
              </div>
            ) : featuredTradition ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Link
                  to={getDetailPathForItem({ ...featuredTradition, source_table: 'events' })}
                  className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm transition hover:shadow-lg"
                >
                  <div className="relative h-56 w-full overflow-hidden sm:h-64">
                    {featuredTradition['E Image'] ? (
                      <img
                        src={featuredTradition['E Image']}
                        alt={featuredTradition['E Name']}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-indigo-50 text-indigo-300">
                        No photo yet
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                    <div className="absolute bottom-4 left-4 flex items-center gap-3 text-sm text-white">
                      <span className="rounded-full bg-white/20 px-3 py-1 font-medium backdrop-blur">
                        {formatRelativeDateChip(featuredTradition.__startDate)}
                      </span>
                      <span className="rounded-full bg-white/20 px-3 py-1 font-medium backdrop-blur">
                        {formatDateRange(featuredTradition.__startDate, featuredTradition.__endDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
                    <div>
                      <h1 className="text-3xl font-[Barrio] text-gray-900 sm:text-4xl">{featuredTradition['E Name']}</h1>
                      {featuredTradition.Description && (
                        <p className="mt-3 text-base text-gray-700">{buildSummary(featuredTradition.Description)}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-indigo-600">View tradition →</span>
                  </div>
                </Link>
                <div className="flex flex-col justify-between rounded-3xl border border-indigo-100 bg-white/90 p-6 shadow-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">Also coming up</p>
                    <div className="mt-4 space-y-3">
                      {alsoComingUp.length === 0 ? (
                        <p className="text-sm text-gray-600">More traditions will appear here as neighbors add them.</p>
                      ) : (
                        alsoComingUp.map(item => (
                          <Link
                            key={item.id}
                            to={getDetailPathForItem({ ...item, source_table: 'events' })}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-indigo-50 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                          >
                            <div>
                              <p className="text-xs uppercase tracking-wide text-indigo-500">
                                {formatRelativeDateChip(item.__startDate)}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-gray-900">{item['E Name']}</p>
                            </div>
                            <span className="text-sm font-medium text-indigo-600">Open →</span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                  <p className="mt-6 text-xs text-gray-500">Last updated • {todayLabel}</p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-indigo-200 bg-white/70 p-8 text-center text-gray-600">
                No upcoming traditions yet—{' '}
                <Link to={CONTACT_PATH} className="font-medium text-indigo-600">
                  add one for your neighbors
                </Link>
                .
              </div>
            )}
          </div>
        </section>

        <section className="border-y border-indigo-100 bg-white/80">
          <div className="mx-auto max-w-screen-xl px-4 py-6">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {kpiCards.map(card => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => scrollToSection(card.target)}
                  className="flex min-w-[160px] items-center gap-3 rounded-full border border-indigo-100 bg-white px-4 py-2 text-left shadow-sm transition hover:border-indigo-200 hover:shadow"
                >
                  <span className="text-2xl font-semibold text-indigo-600">{loading ? '—' : card.count}</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">{card.label}</p>
                    <p className="text-xs text-gray-600">{card.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-10">
          <div className="mx-auto max-w-3xl">
            <ContactCallout />
          </div>
        </section>

        <section id="happening-soon-section" className="bg-gradient-to-br from-rose-50/60 via-white to-indigo-50/60">
          <div className="mx-auto max-w-screen-xl px-4 py-12">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <h2 className="text-3xl font-[Barrio] text-gray-900">Happening soon</h2>
              <p className="mt-3 text-sm text-gray-600">The next 72 hours of recurring happenings around {region.name}.</p>
              <button
                type="button"
                onClick={() => setShowWeeklyModal(true)}
                className="mt-4 inline-flex items-center justify-center rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
              >
                See all weekly events
              </button>
            </div>
            <div className="mt-8">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3].map(index => (
                    <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/80" />
                  ))}
                </div>
              ) : occurrencesWithinWindow.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-indigo-200 bg-white/70 p-6 text-center text-sm text-gray-600">
                  Nothing in the next three days.{' '}
                  <button
                    type="button"
                    onClick={() => setShowWeeklyModal(true)}
                    className="font-medium text-indigo-600 underline"
                  >
                    See all weekly events
                  </button>
                  .
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {occurrencesWithinWindow.map(event => {
                    const href = getDetailPathForItem({ ...event, source_table: 'recurring_events' })
                    return (
                      <Link
                        key={`${event.id}-${event.__occurrenceIso}`}
                        to={href}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm transition hover:border-indigo-200 hover:shadow"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                            title={formatOccurrenceTooltip(event.__occurrenceDate, event.start_time)}
                          >
                            {formatOccurrenceChip(event.__occurrenceDate, event.start_time)}
                          </span>
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">{event.name}</h3>
                            {event.description && (
                              <p className="mt-2 text-sm text-gray-600">{buildSummary(event.description)}</p>
                            )}
                            {event.__venueLabel && (
                              <p className="mt-2 text-sm text-gray-500">{event.__venueLabel}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-indigo-600">View details →</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
        <section id="groups-section" className="bg-white">
          <div className="mx-auto max-w-screen-xl px-4 py-14">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-indigo-100/70 bg-gradient-to-br from-white via-indigo-50/50 to-rose-50/50 p-10 shadow-sm">
              <div className="pointer-events-none absolute -bottom-24 -left-16 hidden w-56 opacity-10 sm:block">
                <img src={HEART_BACKGROUND_IMAGE_URL} alt="" className="h-full w-full object-contain" loading="lazy" />
              </div>
              <div className="relative mx-auto max-w-4xl text-center">
                <h2 className="text-3xl font-[Barrio] text-gray-900">All Groups</h2>
                <p className="mt-3 text-sm text-gray-600">Crews and collectives anchored in {region.name}.</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupTypeFilter('all')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                      groupTypeFilter === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-indigo-600 shadow-sm hover:bg-indigo-50'
                    }`}
                  >
                    All types
                  </button>
                  {groupTypeOptions.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGroupTypeFilter(option)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        groupTypeFilter === option
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-600 shadow-sm hover:bg-indigo-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative mt-8">
                {loading ? (
                  <p className="text-center text-sm text-gray-600">Loading groups…</p>
                ) : filteredGroups.length === 0 ? (
                  <p className="text-center text-sm text-gray-600">
                    No groups yet—know one we’re missing?{' '}
                    <Link to={CONTACT_PATH} className="font-medium text-indigo-600">
                      Add it
                    </Link>
                    .
                  </p>
                ) : (
                  <>
                    <ul className="mx-auto mt-6 max-w-4xl space-y-5">
                      {visibleGroups.map(group => {
                        const types = group?.Type
                          ? group.Type.split(',').map(type => type.trim()).filter(Boolean)
                          : []
                        return (
                          <li key={group.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
                            <Link
                              to={`/groups/${group.slug}`}
                              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-start gap-4">
                                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-indigo-50">
                                  {group.imag ? (
                                    <img src={group.imag} alt={group.Name} className="h-full w-full object-cover" loading="lazy" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-indigo-300">No photo yet</div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-indigo-500">Local Group</p>
                                  <h3 className="text-lg font-semibold text-gray-900">{group.Name}</h3>
                                  {group.Description && (
                                    <p className="mt-2 text-sm text-gray-600">{buildSummary(group.Description)}</p>
                                  )}
                                  {types.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {types.map(type => (
                                        <span key={`${group.id}-${type}`} className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                                          {type}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-medium text-indigo-600">View group →</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                    {hasMoreGroups && (
                      <div className="mt-6 text-center">
                        <button
                          type="button"
                          onClick={() => setGroupsVisibleCount(prev => prev + 5)}
                          className="rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                        >
                          Show more groups
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="traditions-section" className="bg-gradient-to-br from-white via-rose-50/50 to-indigo-50/40">
          <div className="mx-auto max-w-screen-xl px-4 py-14">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-rose-100/70 bg-white/85 p-10 shadow-sm">
              <div className="pointer-events-none absolute -top-20 left-1/2 hidden w-56 -translate-x-1/2 opacity-10 sm:block">
                <img src={HEART_BACKGROUND_IMAGE_URL} alt="" className="h-full w-full object-contain" loading="lazy" />
              </div>
              <div className="relative mx-auto max-w-4xl text-center">
                <h2 className="text-3xl font-[Barrio] text-gray-900">All Traditions</h2>
                <p className="mt-3 text-sm text-gray-600">Legacy events rooted in {region.name}.</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTraditionMonthFilter('all')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                      traditionMonthFilter === 'all'
                        ? 'bg-rose-500 text-white'
                        : 'bg-white text-rose-600 shadow-sm hover:bg-rose-50'
                    }`}
                  >
                    All months
                  </button>
                  {monthOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTraditionMonthFilter(value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        traditionMonthFilter === value
                          ? 'bg-rose-500 text-white'
                          : 'bg-white text-rose-600 shadow-sm hover:bg-rose-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <label className="sr-only" htmlFor="tradition-search">
                    Search traditions
                  </label>
                  <input
                    id="tradition-search"
                    type="search"
                    value={traditionSearchQuery}
                    onChange={event => setTraditionSearchQuery(event.target.value)}
                    placeholder="Search traditions"
                    className="w-full rounded-2xl border border-rose-100 px-4 py-2 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
              </div>
              <div className="relative mt-8">
                {loading ? (
                  <p className="text-center text-sm text-gray-600">Loading traditions…</p>
                ) : filteredTraditionsAll.length === 0 ? (
                  <p className="text-center text-sm text-gray-600">
                    No traditions yet—share one your neighbors should know about.
                  </p>
                ) : (
                  <>
                    <ul className="mx-auto mt-6 max-w-4xl space-y-5">
                      {visibleTraditions.map(tradition => (
                        <li key={tradition.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
                          <Link
                            to={getDetailPathForItem({ ...tradition, source_table: 'events' })}
                            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-xs uppercase tracking-wide text-rose-500">
                                {formatDateRange(tradition.__startDate, tradition.__endDate)}
                              </p>
                              <h3 className="mt-1 text-lg font-semibold text-gray-900">{tradition['E Name']}</h3>
                              {tradition.Description && (
                                <p className="mt-2 text-sm text-gray-600">{buildSummary(tradition.Description)}</p>
                              )}
                            </div>
                            <span className="text-sm font-medium text-rose-600">View tradition →</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {hasMoreTraditions && (
                      <div className="mt-6 text-center">
                        <button
                          type="button"
                          onClick={() => setTraditionsVisibleCount(prev => prev + 5)}
                          className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Show more traditions
                        </button>
                      </div>
                    )}
                    {filteredPastTraditions.length > 0 && (
                      <details className="mx-auto mt-8 max-w-4xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <summary className="cursor-pointer text-sm font-medium text-gray-900">Past traditions</summary>
                        <ul className="mt-4 space-y-4 text-left">
                          {filteredPastTraditions.map(tradition => (
                            <li key={`past-${tradition.id}`} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                              <Link to={getDetailPathForItem({ ...tradition, source_table: 'events' })} className="block">
                                <p className="text-xs uppercase tracking-wide text-gray-500">
                                  {formatDateRange(tradition.__startDate, tradition.__endDate)}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{tradition['E Name']}</p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
        <section id="news-section" className="bg-white">
          <div className="mx-auto max-w-screen-xl px-4 py-14">
            <div className="rounded-[2.5rem] border border-indigo-100/70 bg-gradient-to-tr from-white via-indigo-50/60 to-rose-50/50 p-10 shadow-sm">
              <div className="mx-auto max-w-4xl text-center">
                <h2 className="text-3xl font-[Barrio] text-gray-900">Local News &amp; Newsletters</h2>
                <p className="mt-3 text-sm text-gray-600">Curated outlets from {region.name} neighbors.</p>
                {newsOutlets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNewsletterSheet(true)}
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                  >
                    Subscribe to all {region.name} newsletters
                  </button>
                )}
              </div>
              <div className="mt-8">
                {loading ? (
                  <p className="text-center text-sm text-gray-600">Loading outlets…</p>
                ) : newsOutlets.length === 0 ? (
                  <p className="text-center text-sm text-gray-600">No outlets listed yet—suggest one?</p>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {newsOutlets.slice(0, 6).map(outlet => {
                      const title = outlet.outlet || outlet.title
                      const description = outlet.description || outlet.longDescription
                      const href = outlet.slug
                        ? `/news/${outlet.slug}`
                        : outlet.link || outlet.url
                      return (
                        <article
                          key={outlet.id || outlet.slug || title}
                          className="flex h-full flex-col justify-between rounded-2xl border border-indigo-100 bg-white p-6 text-left shadow-sm transition hover:border-indigo-200 hover:shadow"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-14 w-14 overflow-hidden rounded-xl bg-indigo-50">
                                {outlet.image_url ? (
                                  <img src={outlet.image_url} alt={title} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-indigo-300">No logo</div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-indigo-500">{outlet.Area || outlet.area || region.name}</p>
                                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                              </div>
                            </div>
                            {description && <p className="text-sm text-gray-600">{buildSummary(description)}</p>}
                          </div>
                          {href && (
                            <a
                              href={href}
                              target={outlet.slug ? undefined : '_blank'}
                              rel={outlet.slug ? undefined : 'noopener noreferrer'}
                              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600"
                            >
                              {outlet.slug ? 'View outlet' : 'Open site'} →
                            </a>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {otherTraditions.length > 0 && (
          <section className="bg-gradient-to-br from-indigo-50/50 via-white to-rose-50/40">
            <div className="mx-auto max-w-screen-xl px-4 py-12">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-[Barrio] text-gray-900">Explore beyond the neighborhood</h2>
                  <p className="mt-2 text-sm text-gray-600">Upcoming traditions around the city over the next few weeks.</p>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto pb-4">
                <div className="flex gap-4">
                  {otherTraditions.map(tradition => (
                    <Link
                      key={`other-${tradition.id}`}
                      to={getDetailPathForItem({ ...tradition, source_table: 'events' })}
                      className="w-64 flex-shrink-0 rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow"
                    >
                      <div className="h-36 w-full overflow-hidden rounded-t-2xl bg-indigo-50">
                        {tradition['E Image'] ? (
                          <img src={tradition['E Image']} alt={tradition['E Name']} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-indigo-300">No photo yet</div>
                        )}
                      </div>
                      <div className="p-4">
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          {tradition.Area || tradition.area || 'Philadelphia'}
                        </span>
                        <p className="mt-3 text-xs uppercase tracking-wide text-gray-500">
                          {formatDateRange(tradition.__startDate, tradition.__endDate)}
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-gray-900">{tradition['E Name']}</h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="photos-section" className="bg-white">
          <div className="mx-auto max-w-screen-xl px-4 py-14">
            <h2 className="text-3xl font-[Barrio] text-gray-900">Community Photos</h2>
            <p className="mt-2 text-sm text-gray-600">Shared via event reviews and Big Board posts.</p>
            {loading ? (
              <p className="mt-6 text-sm text-gray-600">Loading photos…</p>
            ) : !showPhotos ? (
              <p className="mt-6 text-sm text-gray-600">Preparing gallery…</p>
            ) : photos.length === 0 ? (
              <p className="mt-6 text-sm text-gray-600">No photos yet. Upload one with your next event review or Big Board post.</p>
            ) : (
              <div className="mt-6 overflow-x-auto pb-4">
                <div className="flex gap-4">
                  {photos.map((photo, index) => {
                    const Wrapper = photo.href ? Link : 'div'
                    const wrapperProps = photo.href ? { to: photo.href } : {}
                    return (
                      <Wrapper
                        key={`${photo.url}-${index}`}
                        {...wrapperProps}
                        className={`group relative w-64 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition ${
                          photo.href ? 'hover:shadow-lg' : ''
                        }`}
                      >
                        <div className="aspect-square bg-gray-100">
                          <img
                            src={photo.url}
                            alt={photo.caption}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-4">
                          <p className="text-sm font-semibold text-gray-900">{photo.caption}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {photo.source === 'review' ? 'Shared via event review' : 'Shared via community submission'}
                          </p>
                        </div>
                      </Wrapper>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-screen-xl px-4 py-14">
            <h2 className="text-2xl font-[Barrio] text-gray-900">Explore More Community Indexes</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {otherRegions.map(entry => (
                <Link
                  key={entry.slug}
                  to={`/${entry.slug}/`}
                  className="rounded-full border border-indigo-100 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                >
                  {entry.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto max-w-3xl">
            <ContactCallout />
          </div>
        </section>

        {error && (
          <section className="mx-auto max-w-screen-xl px-4 pb-16">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
          </section>
        )}
      </main>
      <Footer />
      <WeeklyEventsModal
        open={showWeeklyModal}
        onClose={() => setShowWeeklyModal(false)}
        events={weeklyEvents}
        dayOptions={weeklyDayOptions}
        selectedDay={weeklyEventDayFilter}
        onSelectDay={value => setWeeklyEventDayFilter(value)}
        search={weeklyEventSearch}
        onSearch={value => setWeeklyEventSearch(value)}
      />
      <NewsletterSheet
        open={showNewsletterSheet}
        onClose={() => setShowNewsletterSheet(false)}
        outlets={newsOutlets}
        areaName={region.name}
      />
    </div>
  )
}
