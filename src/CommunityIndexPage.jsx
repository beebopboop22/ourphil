import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import Seo from './components/Seo.jsx'
import { supabase } from './supabaseClient'
import { COMMUNITY_REGIONS } from './communityIndexData.js'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'
import { RRule } from 'rrule'

const REVIEW_CHUNK_SIZE = 50
const SITE_BASE_URL = 'https://www.ourphilly.org'
const HEART_BACKGROUND_IMAGE_URL =
  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png'
const CONTACT_PATH = '/contact/'

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
  return unique.sort(
    (a, b) => WEEKDAY_DISPLAY_ORDER.indexOf(a) - WEEKDAY_DISPLAY_ORDER.indexOf(b)
  )
}

function extractWeekdaysFromRrule(rruleString) {
  if (!rruleString) return []
  try {
    const options = RRule.parseString(rruleString)
    const { byweekday } = options
    const weekdays = Array.isArray(byweekday)
      ? byweekday
      : byweekday
        ? [byweekday]
        : []
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

function FilterModal({ title, description, options, selectedValue, onSelect, onClose }) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Close
          </button>
        </div>
        <div className="mt-6 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {options.map(option => {
            const isActive = option.value === selectedValue
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSelect(option.value)
                  onClose?.()
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl border transition font-medium ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ContactCallout({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-rose-100/70 bg-white/85 px-6 py-6 shadow-sm sm:px-8 ${className}`}
    >
      <div className="absolute -top-10 -right-6 w-32 opacity-10 pointer-events-none sm:-right-10 sm:w-40">
        <img
          src={HEART_BACKGROUND_IMAGE_URL}
          alt=""
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">Neighbor powered</p>
        <p className="mt-3 text-base text-gray-700 leading-relaxed">
          These listings come straight from neighbors. Want to add a group, tradition, or weekly event—or notice something
          that needs an update?{' '}
          <Link to={CONTACT_PATH} className="text-indigo-600 underline font-medium">
            Drop us a note on the contact page
          </Link>
          .
        </p>
      </div>
    </div>
  )
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

function buildSummary(text, fallback = 'Details coming soon.') {
  if (typeof text !== 'string' || !text.trim()) return fallback
  const trimmed = text.trim()
  if (trimmed.length <= 180) return trimmed
  return `${trimmed.slice(0, 177)}…`
}

function scoreGroup(group) {
  let score = 0
  if (group.imag) score += 2
  if (group.Description) score += 2
  if (group.Type) score += 1
  if (group.Vibes) score += 1
  if (group.updated_at) score += 0.5
  return score
}

export default function CommunityIndexPage({ region }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [traditions, setTraditions] = useState([])
  const [groups, setGroups] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [photos, setPhotos] = useState([])
  const [weeklyEvents, setWeeklyEvents] = useState([])
  const [weeklyEventDayFilter, setWeeklyEventDayFilter] = useState('all')
  const [weeklyEventsVisibleCount, setWeeklyEventsVisibleCount] = useState(5)
  const [groupTypeFilter, setGroupTypeFilter] = useState('all')
  const [groupsVisibleCount, setGroupsVisibleCount] = useState(5)
  const [traditionMonthFilter, setTraditionMonthFilter] = useState('all')
  const [traditionsVisibleCount, setTraditionsVisibleCount] = useState(5)
  const [showWeeklyFilterModal, setShowWeeklyFilterModal] = useState(false)
  const [showGroupFilterModal, setShowGroupFilterModal] = useState(false)
  const [showTraditionFilterModal, setShowTraditionFilterModal] = useState(false)

  const aliasSet = useMemo(() => {
    const aliases = region?.areaAliases || []
    return new Set(aliases.map(alias => alias.toLowerCase()))
  }, [region])

  const otherRegions = useMemo(
    () => COMMUNITY_REGIONS.filter(entry => entry.key !== region?.key),
    [region]
  )

  useEffect(() => {
    if (!region) return
    let isActive = true

    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [traditionsRes, groupsRes, postsRes, recurringRes] = await Promise.all([
          supabase.from('events').select('*'),
          supabase.from('groups').select('*'),
          supabase
            .from('big_board_posts')
            .select(
              'id, image_url, Area, created_at, big_board_events!big_board_posts_event_id_fkey(title, slug)'
            )
            .order('created_at', { ascending: false })
            .limit(60),
          supabase.from('recurring_events').select('*').eq('is_active', true),
        ])

        if (!isActive) return

        if (traditionsRes.error) console.error('Traditions load error', traditionsRes.error)
        if (groupsRes.error) console.error('Groups load error', groupsRes.error)
        if (postsRes.error) console.error('Community photo load error', postsRes.error)
        if (recurringRes.error) console.error('Recurring events load error', recurringRes.error)

        const traditionRows = Array.isArray(traditionsRes.data) ? traditionsRes.data : []
        const enrichedTraditions = traditionRows
          .filter(row => rowMatchesRegion(row, aliasSet))
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
            return { ...row, __startDate: start || null, __endDate: end || null }
          })
          .filter(row => row.__startDate)
          .sort((a, b) => {
            const aTime = a.__startDate ? a.__startDate.getTime() : Number.MAX_SAFE_INTEGER
            const bTime = b.__startDate ? b.__startDate.getTime() : Number.MAX_SAFE_INTEGER
            return aTime - bTime
          })
        setTraditions(enrichedTraditions)

        const groupRows = Array.isArray(groupsRes.data) ? groupsRes.data : []
        const filteredGroups = groupRows
          .filter(row => rowMatchesRegion(row, aliasSet))
          .sort((a, b) => {
            const scoreDiff = scoreGroup(b) - scoreGroup(a)
            if (Math.abs(scoreDiff) > 0.01) return scoreDiff
            const nameA = (a.Name || '').toLowerCase()
            const nameB = (b.Name || '').toLowerCase()
            return nameA.localeCompare(nameB)
          })
        setGroups(filteredGroups)

        const recurringRows = Array.isArray(recurringRes.data) ? recurringRes.data : []
        const regionRecurring = recurringRows
          .filter(row => rowMatchesRegion(row, aliasSet))
          .map(row => {
            const days = extractWeekdays(row)
            return { ...row, __days: days }
          })
          .sort((a, b) => {
            const dayA = a.__days && a.__days.length ? WEEKDAY_DISPLAY_ORDER.indexOf(a.__days[0]) : 99
            const dayB = b.__days && b.__days.length ? WEEKDAY_DISPLAY_ORDER.indexOf(b.__days[0]) : 99
            if (dayA !== dayB) return dayA - dayB
            const nameA = (a.name || a.Name || '').toLowerCase()
            const nameB = (b.name || b.Name || '').toLowerCase()
            return nameA.localeCompare(nameB)
          })

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
          return { ...row, __tags: tags }
        })
        setWeeklyEvents(enrichedRecurring)

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const upcomingTraditions = enrichedTraditions
          .filter(row => {
            const end = row.__endDate || row.__startDate
            if (!row.__startDate) return false
            if (!end) return row.__startDate >= today
            return end >= today
          })
          .sort((a, b) => {
            const aTime = a.__startDate ? a.__startDate.getTime() : Number.MAX_SAFE_INTEGER
            const bTime = b.__startDate ? b.__startDate.getTime() : Number.MAX_SAFE_INTEGER
            return aTime - bTime
          })
          .slice(0, 6)
        setUpcoming(upcomingTraditions)

        const posts = Array.isArray(postsRes.data) ? postsRes.data : []
        const postPhotos = (await Promise.all(
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
        )).filter(Boolean)

        const traditionIdMap = new Map()
        enrichedTraditions.forEach(row => {
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

        const combined = dedupeByUrl([...reviewPhotos, ...postPhotos]).slice(0, 6)
        setPhotos(combined)
      } catch (err) {
        if (!isActive) return
        console.error('Community index load error', err)
        setError('We had trouble loading this region. Please try again soon.')
        setTraditions([])
        setGroups([])
        setUpcoming([])
        setPhotos([])
        setWeeklyEvents([])
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadData()
    return () => {
      isActive = false
    }
  }, [region, aliasSet])

  if (!region) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-600">This community index was not found.</p>
        </main>
        <Footer />
      </div>
    )
  }

  const canonicalPath = region.slug.startsWith('/') ? region.slug : `/${region.slug}`
  const canonicalUrl = `${SITE_BASE_URL}${canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`}`

  const traditionsCount = traditions.length
  const groupsCount = groups.length
  const weeklyEventsCount = weeklyEvents.length

  const scrollToSection = sectionId => {
    if (typeof document === 'undefined') return
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    setGroupTypeFilter('all')
    setGroupsVisibleCount(5)
    setTraditionMonthFilter('all')
    setTraditionsVisibleCount(5)
    setWeeklyEventDayFilter('all')
    setWeeklyEventsVisibleCount(5)
  }, [region])

  useEffect(() => {
    setGroupsVisibleCount(5)
  }, [groupTypeFilter])

  useEffect(() => {
    setTraditionsVisibleCount(5)
  }, [traditionMonthFilter])

  useEffect(() => {
    setWeeklyEventsVisibleCount(5)
  }, [weeklyEventDayFilter])

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
    return groups.filter(group =>
      group?.Type?.split(',').some(type => type.trim().toLowerCase() === target)
    )
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

  const filteredWeeklyEvents = useMemo(() => {
    if (weeklyEventDayFilter === 'all') return weeklyEvents
    return weeklyEvents.filter(event => (event.__days || []).includes(weeklyEventDayFilter))
  }, [weeklyEvents, weeklyEventDayFilter])

  const visibleWeeklyEvents = filteredWeeklyEvents.slice(0, weeklyEventsVisibleCount)
  const hasMoreWeeklyEvents = visibleWeeklyEvents.length < filteredWeeklyEvents.length

  const weeklyFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All days' }, ...weeklyDayOptions.map(day => ({ value: day, label: day }))],
    [weeklyDayOptions]
  )

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

  const monthLabelMap = useMemo(
    () => Object.fromEntries(monthOptions),
    [monthOptions]
  )

  const filteredTraditions = useMemo(() => {
    if (traditionMonthFilter === 'all') return traditions
    return traditions.filter(tradition => {
      const start = tradition.__startDate
      if (!start) return false
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      return key === traditionMonthFilter
    })
  }, [traditions, traditionMonthFilter])

  const visibleTraditions = filteredTraditions.slice(0, traditionsVisibleCount)
  const hasMoreTraditions = visibleTraditions.length < filteredTraditions.length

  const groupFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All types' }, ...groupTypeOptions.map(type => ({ value: type, label: type }))],
    [groupTypeOptions]
  )

  const traditionFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All months' }, ...monthOptions.map(([value, label]) => ({ value, label }))],
    [monthOptions]
  )

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Seo
        title={region.seoTitle}
        description={region.seoDescription}
        canonicalUrl={canonicalUrl}
      />
      <Navbar />
      <main className="flex-1 pt-24 sm:pt-28">
        <section className="bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <div className="max-w-screen-xl mx-auto px-4 pt-12 pb-16">
            <p className="text-sm uppercase tracking-widest text-indigo-600 mb-2">Community Index</p>
            <h1 className="text-4xl sm:text-5xl font-[Barrio] text-gray-900">{region.name}</h1>
            <p className="mt-6 max-w-3xl text-lg text-gray-700 leading-relaxed">
              <Link to="/philadelphia-events/" className="text-indigo-600 underline font-medium">
                Browse the citywide traditions calendar
              </Link>{' '}
              or hop into the{' '}
              <Link to="/groups" className="text-indigo-600 underline font-medium">
                full groups directory
              </Link>{' '}
              for even more communities to join.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[{
                label: 'Coming Up',
                count: upcoming.length || 0,
                description: `Next traditions on the calendar for ${region.name}.`,
                target: 'upcoming-section',
              }, {
                label: 'Weekly Events',
                count: weeklyEventsCount,
                description: 'Recurring happenings and weekly staples to plug into.',
                target: 'weekly-events-section',
              }, {
                label: 'Groups',
                count: groupsCount,
                description: 'Neighborhood collectives, teams, and volunteer crews.',
                target: 'groups-section',
              }, {
                label: 'Traditions',
                count: traditionsCount,
                description: `Legacy events and annual staples rooted in ${region.name}.`,
                target: 'traditions-section',
              }].map(card => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => scrollToSection(card.target)}
                  className="text-left rounded-2xl bg-white shadow-sm border border-indigo-100 p-6 hover:shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <p className="text-sm uppercase tracking-wide text-indigo-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{loading ? '—' : card.count}</p>
                  <p className="mt-2 text-sm text-gray-600">{card.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-10 max-w-3xl">
              <ContactCallout />
            </div>

          </div>
        </section>

        <section id="upcoming-section" className="max-w-screen-xl mx-auto px-4 py-16">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <h2 className="text-3xl font-[Barrio] text-gray-900">Traditions Coming Up in {region.name}</h2>
            <Link to="/this-weekend-in-philadelphia/" className="text-indigo-600 underline text-sm font-medium">
              See more weekend picks
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-600">Loading events…</p>
          ) : upcoming.length === 0 ? (
            <p className="text-gray-600">No upcoming traditions are scheduled right now. Check back soon or explore the citywide calendar.</p>
          ) : (
            <div className="-mx-4 sm:mx-0">
              <div className="flex gap-6 overflow-x-auto pb-4 px-4 sm:px-0">
                {upcoming.map(tradition => {
                  const href = getDetailPathForItem({ ...tradition, source_table: 'events' }) || '/events'
                  const image = tradition['E Image'] || tradition.image_url || tradition.image
                  const start = tradition.__startDate
                  const end = tradition.__endDate || tradition.__startDate
                  return (
                    <Link
                      key={tradition.id}
                      to={href}
                      className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition flex flex-col shrink-0 w-80 sm:w-96"
                    >
                      {image && (
                        <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                          <img
                            src={image}
                            alt={tradition['E Name'] || 'Tradition'}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-6 flex-1 flex flex-col">
                        <p className="text-xs uppercase tracking-wide text-indigo-500">
                          {start ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-gray-900">
                          {tradition['E Name'] || tradition.name || 'Community Tradition'}
                        </h3>
                        <p className="mt-3 text-sm text-gray-600 flex-1">
                          {buildSummary(tradition['E Description'] || tradition.description || '')}
                        </p>
                        {end && start && end.getTime() !== start.getTime() && (
                          <p className="mt-4 text-sm font-medium text-gray-700">Runs through {end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <section
          id="weekly-events-section"
          className="relative py-16"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-rose-50/60 via-white to-indigo-50/50"
            aria-hidden="true"
          />
          <div className="relative max-w-screen-xl mx-auto px-4">
            <div className="relative overflow-hidden rounded-3xl border border-rose-100/70 bg-white/85 px-6 py-12 shadow-sm sm:px-10">
              <div className="absolute -top-14 -right-8 hidden w-48 opacity-10 pointer-events-none sm:block lg:-right-10 lg:w-60">
                <img
                  src={HEART_BACKGROUND_IMAGE_URL}
                  alt=""
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="relative">
                <div className="max-w-4xl mx-auto text-center">
                  <h2 className="text-3xl font-[Barrio] text-gray-900">Weekly Events in {region.name}</h2>
                  {loading ? (
                    <p className="mt-6 text-gray-600">Loading weekly events…</p>
                  ) : weeklyEvents.length === 0 ? (
                    <p className="mt-6 text-gray-600">
                      We have not logged any weekly events for this region yet.{' '}
                      <Link to={CONTACT_PATH} className="text-indigo-600 underline font-medium">
                        Share one so neighbors can join in
                      </Link>
                      .
                    </p>
                  ) : (
                    <>
                      <div className="mt-6 flex flex-col items-center gap-3">
                        <p className="text-sm text-gray-600">
                          Showing{' '}
                          {weeklyEventDayFilter === 'all'
                            ? 'all days'
                            : `${weeklyEventDayFilter} only`}
                          .
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setShowWeeklyFilterModal(true)}
                            className="px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium text-sm transition"
                          >
                            Filter weekly events
                          </button>
                          {weeklyEventDayFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setWeeklyEventDayFilter('all')}
                              className="px-4 py-2 rounded-full border border-transparent bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium text-sm transition"
                            >
                              Clear filter
                            </button>
                          )}
                        </div>
                      </div>

                      {filteredWeeklyEvents.length === 0 ? (
                        <p className="mt-6 text-gray-600">
                          No weekly events match this day yet. Try another filter.
                        </p>
                      ) : (
                        <div className="mt-8 max-w-4xl mx-auto">
                          <ul className="space-y-5 text-left">
                            {visibleWeeklyEvents.map(event => {
                              const slug = event.slug || event.Slug
                              const href = slug ? `/series/${slug}` : '/series'
                              const image =
                                event.image_url ||
                                event.image ||
                                event.cover_image ||
                                event.photo_url
                              const title = event.name || event.Name || 'Weekly Event'
                              const description =
                                event.description || event.Description || ''
                              const daysLabel = formatWeekdayList(event.__days || [])
                              const timeLabel = formatTimeOfDay(
                                event.start_time ||
                                  event.startTime ||
                                  event.Start_time ||
                                  event.StartTime ||
                                  event.start ||
                                  event.time
                              )
                              const tags = Array.isArray(event.__tags) ? event.__tags : []
                              return (
                                <li
                                  key={event.id || slug || title}
                                  className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition"
                                >
                                  <Link
                                    to={href}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5"
                                  >
                                    <div className="flex items-start gap-4 flex-1">
                                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-indigo-50 flex-shrink-0">
                                        {image ? (
                                          <img
                                            src={image}
                                            alt={title}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-xs text-indigo-400">
                                            No photo yet
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-xs uppercase tracking-wide text-indigo-500">
                                          {daysLabel}
                                        </p>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                          {title}
                                        </h3>
                                        {description && (
                                          <p className="mt-2 text-sm text-gray-600">
                                            {buildSummary(description)}
                                          </p>
                                        )}
                                        {timeLabel && (
                                          <p className="mt-2 text-sm text-gray-500">
                                            Starts at {timeLabel}
                                          </p>
                                        )}
                                        {tags.length > 0 && (
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {tags.map(tag => (
                                              <span
                                                key={`${event.id || slug}-${tag}`}
                                                className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full"
                                              >
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-sm font-medium text-indigo-600 whitespace-nowrap">
                                      View details →
                                    </span>
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                          {hasMoreWeeklyEvents && (
                            <div className="mt-6 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setWeeklyEventsVisibleCount(prev => prev + 5)
                                }
                                className="px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium text-sm transition"
                              >
                                Show more weekly events
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="groups-section" className="relative py-16">
          <div
            className="absolute inset-0 bg-gradient-to-tr from-indigo-50/60 via-white to-rose-50/60"
            aria-hidden="true"
          />
          <div className="relative max-w-screen-xl mx-auto px-4">
            <div className="relative overflow-hidden rounded-3xl border border-indigo-100/70 bg-white/85 px-6 py-12 shadow-sm sm:px-10">
              <div className="absolute -bottom-16 -left-10 hidden w-48 opacity-10 pointer-events-none sm:block lg:-left-16 lg:w-64">
                <img
                  src={HEART_BACKGROUND_IMAGE_URL}
                  alt=""
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="relative">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                  <h2 className="text-3xl font-[Barrio] text-gray-900">All Groups</h2>
                  <Link to="/groups" className="text-indigo-600 underline text-sm font-medium">
                    Explore all Philly groups
                  </Link>
                </div>
                {loading ? (
                  <p className="text-gray-600">Loading groups…</p>
                ) : groups.length === 0 ? (
                  <p className="text-gray-600">
                    No groups have been added for this region yet. Know one?{' '}
                    <Link to={CONTACT_PATH} className="text-indigo-600 underline font-medium">
                      Share it with the community
                    </Link>
                    .
                  </p>
                ) : (
                  <>
                    {groupTypeOptions.length > 0 && (
                      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-gray-600">
                          Showing{' '}
                          {groupTypeFilter === 'all'
                            ? 'all group types'
                            : `${groupTypeFilter} groups`}.
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setShowGroupFilterModal(true)}
                            className="px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium text-sm transition"
                          >
                            Filter groups
                          </button>
                          {groupTypeFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setGroupTypeFilter('all')}
                              className="px-4 py-2 rounded-full border border-transparent bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium text-sm transition"
                            >
                              Clear filter
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {filteredGroups.length === 0 ? (
                      <p className="text-gray-600">No groups match the selected filters yet. Try a different tag.</p>
                    ) : (
                      <div className="max-w-4xl mx-auto">
                        <ul className="space-y-5">
                          {visibleGroups.map(group => {
                            const types = group?.Type
                              ? group.Type.split(',').map(type => type.trim()).filter(Boolean)
                              : []
                            return (
                              <li
                                key={group.id}
                                className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition"
                              >
                                <Link
                                  to={`/groups/${group.slug}`}
                                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5"
                                >
                                  <div className="flex items-start gap-4 flex-1">
                                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-indigo-50 flex-shrink-0">
                                      {group.imag ? (
                                        <img
                                          src={group.imag}
                                          alt={group.Name}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-indigo-400">
                                          No photo yet
                                        </div>
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
                                            <span
                                              key={`${group.id}-${type}`}
                                              className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full"
                                            >
                                              {type}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-sm font-medium text-indigo-600 whitespace-nowrap">View group →</span>
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
                              className="px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium text-sm transition"
                            >
                              Show more groups
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="traditions-section" className="relative max-w-screen-xl mx-auto px-4 py-16">
          <div
            className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-rose-50/60 via-white to-indigo-50/60"
            aria-hidden="true"
          />
          <div className="relative overflow-hidden rounded-[2.5rem] border border-rose-100/70 bg-white/85 px-6 py-12 shadow-sm sm:px-10">
            <div className="absolute -top-14 left-1/2 hidden w-48 -translate-x-1/2 opacity-10 pointer-events-none sm:block lg:w-64">
              <img
                src={HEART_BACKGROUND_IMAGE_URL}
                alt=""
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="relative max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-[Barrio] text-gray-900">All Traditions</h2>
              {loading ? (
                <p className="mt-6 text-gray-600">Loading traditions…</p>
              ) : traditions.length === 0 ? (
                <p className="mt-6 text-gray-600">
                  We have not logged any traditions here yet.{' '}
                  <Link to={CONTACT_PATH} className="text-indigo-600 underline font-medium">
                    Add one for your neighbors
                  </Link>
                  .
                </p>
              ) : (
                <>
                  {monthOptions.length > 0 && (
                    <div className="mt-6 flex flex-col items-center gap-3">
                      <p className="text-sm text-gray-600">
                        Showing{' '}
                        {traditionMonthFilter === 'all'
                          ? 'all months'
                          : `${monthLabelMap[traditionMonthFilter] || 'selected month'} traditions`}.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowTraditionFilterModal(true)}
                          className="px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium text-sm transition"
                        >
                          Filter traditions
                        </button>
                        {traditionMonthFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setTraditionMonthFilter('all')}
                            className="px-4 py-2 rounded-full border border-transparent bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium text-sm transition"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {filteredTraditions.length === 0 ? (
                    <p className="mt-6 text-gray-600">No traditions match this month yet. Try another filter or explore upcoming picks above.</p>
                  ) : (
                    <div className="mt-8 flex justify-center">
                      <ul className="w-full max-w-2xl space-y-5 text-left">
                        {visibleTraditions.map(tradition => {
                          const href = getDetailPathForItem({ ...tradition, source_table: 'events' }) || '/events'
                          const start = tradition.__startDate
                          const end = tradition.__endDate || tradition.__startDate
                          const image = tradition['E Image'] || tradition.image_url || tradition.image
                          const description = tradition['E Description'] || tradition.description || ''
                          return (
                            <li
                              key={tradition.id}
                              className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition"
                            >
                              <Link to={href} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
                                <div className="flex items-start gap-4 flex-1">
                                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-indigo-50 flex-shrink-0">
                                    {image ? (
                                      <img
                                        src={image}
                                        alt={tradition['E Name'] || 'Tradition'}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-xs text-indigo-400">No photo yet</div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-indigo-500">
                                      {formatDateRange(start, end)}
                                    </p>
                                    <h3 className="mt-2 text-lg font-semibold text-gray-900">
                                      {tradition['E Name'] || tradition.name || 'Community Tradition'}
                                    </h3>
                                    {description && (
                                      <p className="mt-2 text-sm text-gray-600">{buildSummary(description)}</p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm font-medium text-indigo-600 whitespace-nowrap">View tradition →</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {hasMoreTraditions && filteredTraditions.length > 0 && (
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => setTraditionsVisibleCount(prev => prev + 5)}
                        className="px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium text-sm transition"
                      >
                        Show more traditions
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border-t border-b border-gray-100">
          <div className="max-w-screen-xl mx-auto px-4 py-16">
            <h2 className="text-3xl font-[Barrio] text-gray-900 mb-8">Community Photos</h2>
            {loading ? (
              <p className="text-gray-600">Loading photos…</p>
            ) : photos.length === 0 ? (
              <p className="text-gray-600">No photos yet. Upload one with your next event review or Big Board post.</p>
            ) : (
              <div className="-mx-4 sm:mx-0">
                <div className="flex gap-4 overflow-x-auto pb-4 px-4 sm:px-0">
                  {photos.map((photo, index) => {
                    const Wrapper = photo.href ? Link : 'div'
                    const wrapperProps = photo.href
                      ? { to: photo.href }
                      : {}
                    return (
                      <Wrapper
                        key={`${photo.url}-${index}`}
                        {...wrapperProps}
                        className={`group relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white shrink-0 w-64 sm:w-72 ${
                          photo.href ? 'hover:shadow-lg transition' : ''
                        }`}
                      >
                        <div className="aspect-square bg-gray-100">
                          <img
                            src={photo.url}
                            alt={photo.caption}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
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

        <section className="bg-white border-t border-gray-100">
          <div className="max-w-screen-xl mx-auto px-4 py-16">
            <h2 className="text-2xl font-[Barrio] text-gray-900 mb-6">Explore More Community Indexes</h2>
            <div className="flex flex-wrap gap-3">
              {otherRegions.map(entry => (
                <Link
                  key={entry.slug}
                  to={`/${entry.slug}/`}
                  className="px-4 py-2 rounded-full border border-indigo-100 text-indigo-600 hover:bg-indigo-50 transition text-sm font-medium"
                >
                  {entry.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <ContactCallout />
          </div>
        </section>

        {error && (
          <section className="max-w-screen-xl mx-auto px-4 pb-16">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
              {error}
            </div>
          </section>
        )}
      </main>
      <Footer />
      {showWeeklyFilterModal && weeklyFilterOptions.length > 0 && (
        <FilterModal
          title="Filter weekly events"
          description="Choose a day of the week to narrow the list."
          options={weeklyFilterOptions}
          selectedValue={weeklyEventDayFilter}
          onSelect={value => setWeeklyEventDayFilter(value)}
          onClose={() => setShowWeeklyFilterModal(false)}
        />
      )}
      {showGroupFilterModal && groupFilterOptions.length > 0 && (
        <FilterModal
          title="Filter groups"
          description="Pick a group type to focus on crews you care about."
          options={groupFilterOptions}
          selectedValue={groupTypeFilter}
          onSelect={value => setGroupTypeFilter(value)}
          onClose={() => setShowGroupFilterModal(false)}
        />
      )}
      {showTraditionFilterModal && traditionFilterOptions.length > 0 && (
        <FilterModal
          title="Filter traditions"
          description="Choose a month to explore traditions happening then."
          options={traditionFilterOptions}
          selectedValue={traditionMonthFilter}
          onSelect={value => setTraditionMonthFilter(value)}
          onClose={() => setShowTraditionFilterModal(false)}
        />
      )}
    </div>
  )
}
