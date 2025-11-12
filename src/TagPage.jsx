// src/TagPage.jsx
import React, { useEffect, useState, useMemo, useContext, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import PostFlyerModal from './PostFlyerModal'
import { Helmet } from 'react-helmet'
import { RRule } from 'rrule'
import { MapPin } from 'lucide-react'
import { FaStar } from 'react-icons/fa'
import useEventFavorite from './utils/useEventFavorite'
import { AuthContext } from './AuthProvider'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'
import MonthlyEventsMap from './MonthlyEventsMap.jsx'
import MapEventDetailPanel from './components/MapEventDetailPanel.jsx'
import { formatEventDateRange, PHILLY_TIME_ZONE } from './utils/dateUtils'

// ── Helpers ───────────────────────────────────────────────────────
function parseISODateLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date) ? null : date
}
function parseDate(datesStr) {
  if (!datesStr) return null
  const [first] = datesStr.split(/through|–|-/)
  const [m, d, y] = first.trim().split('/').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date) ? null : date
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  let hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.'
  hour = hour % 12 || 12
  return `${hour}:${m.padStart(2,'0')} ${ampm}`
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function formatWeekdayAbbrev(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function formatMonthDay(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeTaggableType(rawType) {
  if (!rawType && rawType !== 0) return ''
  const stringValue = String(rawType).trim()
  if (!stringValue) return ''
  const lastSegment = stringValue.split(/[:\\/]/).pop() || stringValue
  const lower = lastSegment.toLowerCase()
  if (lower === 'allevent' || lower === 'all_event' || lower === 'all-events') return 'all_events'
  if (lower === 'event') return 'events'
  if (lower === 'bigboardevent' || lower === 'big_board_event') return 'big_board_events'
  if (lower === 'groupevent' || lower === 'group_event') return 'group_events'
  if (lower === 'recurringevent' || lower === 'recurring_event') return 'recurring_events'
  return lower
}

function normalizeIdList(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return []
  const seen = new Set()
  const normalized = []
  ids.forEach(value => {
    if (value === null || value === undefined) return
    const asString = String(value).trim()
    if (!asString) return
    const numeric = Number(asString)
    if (Number.isSafeInteger(numeric) && `${numeric}` === asString) {
      const key = `n:${numeric}`
      if (!seen.has(key)) {
        seen.add(key)
        normalized.push(numeric)
      }
    } else {
      const key = `s:${asString}`
      if (!seen.has(key)) {
        seen.add(key)
        normalized.push(asString)
      }
    }
  })
  return normalized
}

function getUpcomingWeekendRange(baseDate = new Date()) {
  const start = startOfDay(baseDate)
  const day = start.getDay()
  if (day >= 1 && day <= 4) {
    start.setDate(start.getDate() + (5 - day))
  } else if (day === 0) {
    start.setDate(start.getDate() - 2)
  } else if (day === 6) {
    start.setDate(start.getDate() - 1)
  }
  const endDate = new Date(start)
  endDate.setDate(start.getDate() + 2)
  return { start, end: endOfDay(endDate) }
}

function buildTimingLabel(startDate, endDate, startTime) {
  if (startDate && endDate && startOfDay(startDate).getTime() !== startOfDay(endDate).getTime()) {
    return `Runs thru ${formatMonthDay(endDate)}`
  }
  if (!startDate) return 'Upcoming'
  const eventDay = startOfDay(startDate)
  const today = startOfDay(new Date())
  const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24))
  const timeLabel = startTime ? ` · ${formatTime(startTime)}` : ''
  if (diffDays === 0) return `Today${timeLabel}`
  if (diffDays === 1) return `Tomorrow${timeLabel}`
  return `${formatWeekdayAbbrev(startDate)} ${formatMonthDay(startDate)}${timeLabel}`
}

const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
]

function resolveAreaName(evt, areaLookup = {}) {
  if (!evt) return null
  if (evt.areaName) return evt.areaName

  const lookup = areaLookup || {}
  const venueEntries = Array.isArray(evt.venues)
    ? evt.venues
    : evt.venues
      ? [evt.venues]
      : []

  const areaCandidates = []
  if (evt.area_id !== undefined && evt.area_id !== null) areaCandidates.push(evt.area_id)
  if (evt.venue_area_id !== undefined && evt.venue_area_id !== null) areaCandidates.push(evt.venue_area_id)
  venueEntries.forEach(entry => {
    if (entry?.area_id !== undefined && entry?.area_id !== null) {
      areaCandidates.push(entry.area_id)
    }
  })

  for (const candidate of areaCandidates) {
    if (candidate === undefined || candidate === null) continue
    const key = typeof candidate === 'string' ? candidate : String(candidate)
    const match = lookup[candidate] || lookup[key] || null
    if (match) {
      return match
    }
  }

  return null
}

function EventRow({ evt, tags, profileMap, areaLookup }) {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)

  const favoriteEventId = evt.isSports
    ? null
    : evt.favoriteId ?? (evt.isRecurring ? String(evt.id).split('::')[0] : evt.id ?? null)
  const favoriteSource = evt.isSports
    ? null
    : evt.source_table ?? (
        evt.isBigBoard
          ? 'big_board_events'
          : evt.isTradition
            ? 'events'
            : evt.isGroupEvent
              ? 'group_events'
              : evt.isRecurring
                ? 'recurring_events'
                : 'all_events'
      )

  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: favoriteEventId ?? null,
    source_table: favoriteSource ?? null,
  })

  const startDate = evt.start instanceof Date
    ? evt.start
    : evt.start_date
      ? parseISODateLocal(evt.start_date)
      : null
  const endDate = evt.end instanceof Date
    ? evt.end
    : evt.end_date
      ? parseISODateLocal(evt.end_date)
      : startDate
  const timingLabel = buildTimingLabel(startDate, endDate, evt.start_time)
  const dateRangeText = startDate && endDate && startOfDay(startDate).getTime() !== startOfDay(endDate).getTime()
    ? `${formatMonthDay(startDate)} – ${formatMonthDay(endDate)}`
    : ''

  const badges = []
  if (evt.isTradition) badges.push({ label: 'Tradition', className: 'bg-yellow-100 text-yellow-800', icon: <FaStar className="text-yellow-500" /> })
  if (evt.isBigBoard) badges.push({ label: 'Submission', className: 'bg-purple-100 text-purple-800' })
  if (evt.isGroupEvent) badges.push({ label: 'Group Event', className: 'bg-emerald-100 text-emerald-800' })
  if (evt.isRecurring) badges.push({ label: 'Recurring', className: 'bg-blue-100 text-blue-800' })
  if (evt.isSports) badges.push({ label: 'Sports', className: 'bg-green-100 text-green-800' })

  const detailPath = evt.href || getDetailPathForItem({
    ...evt,
    venue_slug: evt.venues?.slug,
  }) || '/'

  const imageSrc = evt.imageUrl || evt.image || ''
  const submitter = evt.isBigBoard ? profileMap[evt.owner_id] : null

  const areaName = resolveAreaName(evt, areaLookup)

  const seenTags = new Set()
  const uniqueTags = []
  tags.forEach(tag => {
    if (!tag?.slug || seenTags.has(tag.slug)) return
    seenTags.add(tag.slug)
    uniqueTags.push(tag)
  })
  const shownTags = uniqueTags.slice(0, 3)
  const extraCount = Math.max(0, uniqueTags.length - shownTags.length)

  const addressLabel = evt.venues?.name
    ? `at ${evt.venues.name}`
    : evt.address
      ? evt.address
      : ''

  const actions = evt.isSports
    ? (evt.url ? (
        <a
          href={evt.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="w-full border border-indigo-600 rounded-full px-4 py-2 text-sm font-semibold text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors text-center"
        >
          Get Tickets
        </a>
      ) : null)
    : (
        <button
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            if (!user) {
              navigate('/login')
              return
            }
            toggleFavorite()
          }}
          disabled={loading || !favoriteEventId || !favoriteSource}
          className={`w-full border border-indigo-600 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
        >
          {isFavorite ? 'In the Plans' : 'Add to Plans'}
        </button>
      )

  const containerClass = `block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${isFavorite && !evt.isSports ? 'ring-2 ring-indigo-600' : ''}`

  return (
    <Link to={detailPath} className={containerClass}>
      <div className="flex flex-col gap-4 p-4 sm:p-6 sm:flex-row sm:items-stretch">
        <div className="w-full sm:w-48 flex-shrink-0">
          <div className="overflow-hidden rounded-xl bg-gray-100 aspect-[4/3]">
            {imageSrc ? (
              <img src={imageSrc} alt={evt.title || evt.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800 uppercase tracking-wide">{timingLabel}</span>
            {areaName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                <MapPin className="h-3 w-3 text-slate-500" />
                {areaName}
              </span>
            )}
            {badges.map(badge => (
              <span
                key={badge.label}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 uppercase tracking-wide ${badge.className}`}
              >
                {badge.icon}
                {badge.label}
              </span>
            ))}
            {isFavorite && !evt.isSports && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 uppercase tracking-wide text-white">
                In the Plans
              </span>
            )}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[#28313e] break-words">{evt.title || evt.name}</h3>
            {dateRangeText && (
              <p className="mt-1 text-sm text-gray-500">{dateRangeText}</p>
            )}
            {evt.description && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">{evt.description}</p>
            )}
            {addressLabel && (
              <p className="mt-1 text-sm text-gray-500">{addressLabel}</p>
            )}
          </div>
          {shownTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {shownTags.map((tag, index) => (
                <Link
                  key={tag.slug}
                  to={`/tags/${tag.slug}`}
                  onClick={e => e.stopPropagation()}
                  className={`${pillStyles[index % pillStyles.length]} px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-80`}
                >
                  #{tag.name}
                </Link>
              ))}
              {extraCount > 0 && <span className="text-xs text-gray-500">+{extraCount} more</span>}
            </div>
          )}
          {submitter?.username && (
            <p className="text-xs text-gray-500">Submitted by <span className="font-medium text-gray-600">{submitter.username}</span></p>
          )}
        </div>
        {actions && <div className="flex flex-col items-stretch justify-center gap-2 sm:w-44">{actions}</div>}
      </div>
    </Link>
  )
}

export default function TagPage() {
  const params = useParams()
  const slug = (params.slug || '').replace(/^#/, '')
  const { user } = useContext(AuthContext)

  // ── State hooks ────────────────────────────────────────────────
  const [tag, setTag] = useState(null)
  const [traditions, setTraditions] = useState([])
  const [bigBoard, setBigBoard] = useState([])
  const [groupEvents, setGroupEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [recSeries, setRecSeries] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [tagMap, setTagMap] = useState({})
  const [areaLookup, setAreaLookup] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedMapEventId, setSelectedMapEventId] = useState(null)

  // modal toggles
  const [showFlyerModal, setShowFlyerModal] = useState(false)
  const [modalStartStep, setModalStartStep] = useState(1)
  const [initialFlyer, setInitialFlyer] = useState(null)
  const [dateFilter, setDateFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // ── Load tag + all data ────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      // 1) fetch tag
      const { data: t } = await supabase
        .from('tags')
        .select('*')
        .eq('slug', slug)
        .single()
      if (!t) {
        setLoading(false)
        return
      }
      setTag(t)

      const { data: areaRows, error: areaError } = await supabase
        .from('areas')
        .select('id,name')
      if (areaError) {
        console.error('Failed to load areas', areaError)
      }
      const nextAreaLookup = {}
      ;(areaRows || []).forEach(area => {
        if (area?.id === undefined || area?.id === null) return
        nextAreaLookup[area.id] = area.name || ''
      })
      setAreaLookup(nextAreaLookup)

      // 2) fetch taggings
      const pageSize = 1000
      let allTaggings = []
      let from = 0
      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('taggings')
          .select('taggable_type,taggable_id')
          .eq('tag_id', t.id)
          .range(from, from + pageSize - 1)
        if (pageError) {
          console.error('Failed to load taggings for tag', t.id, pageError)
          break
        }
        const safePage = page || []
        allTaggings = allTaggings.concat(safePage)
        if (safePage.length < pageSize) break
        from += pageSize
      }

      const byType = allTaggings.reduce((acc, { taggable_type, taggable_id }) => {
        const key = normalizeTaggableType(taggable_type)
        if (!key) return acc
        acc[key] = acc[key] || []
        acc[key].push(taggable_id)
        return acc
      }, {})
      const recurringIds = normalizeIdList(byType.recurring_events || [])
      const traditionIds = normalizeIdList(byType.events || [])
      const bigBoardIds = normalizeIdList(byType.big_board_events || [])
      const groupEventIds = normalizeIdList(byType.group_events || [])
      const allEventIds = normalizeIdList(byType.all_events || [])

      // 3) parallel fetch all sources
      const [trRes, bbRes, geRes, aeRes, recRes] = await Promise.all([
        traditionIds.length
          ? supabase
              .from('events')
              .select('id,"E Name","E Description","E Image",slug,Dates,"End Date",start_time,end_time,latitude,longitude,area_id')
              .in('id', traditionIds)
          : { data: [] },
        bigBoardIds.length
          ? supabase
              .from('big_board_events')
              .select('id,title,description,slug,start_date,end_date,start_time,end_time,latitude,longitude,area_id,big_board_posts!big_board_posts_event_id_fkey(image_url,user_id)')
              .in('id', bigBoardIds)
          : { data: [] },
        groupEventIds.length
          ? supabase
              .from('group_events')
              .select('id,title,description,start_date,end_date,start_time,end_time,image_url,group_id,address,latitude,longitude,area_id')
              .in('id', groupEventIds)
          : { data: [] },
        allEventIds.length
          ? supabase
              .from('all_events')
              .select('id,name,description,slug,image,link,start_date,end_date,start_time,end_time,latitude,longitude,area_id,venue_id(name,slug,latitude,longitude,area_id)')
              .in('id', allEventIds)
          : { data: [] },
        recurringIds.length
          ? supabase
              .from('recurring_events')
              .select('id,name,slug,description,address,link,image_url,start_date,end_date,start_time,end_time,rrule,latitude,longitude,area_id')
              .in('id', recurringIds)
          : { data: [] },
      ])

      // 4) build group_id → slug map for groupEvents
      const evGroupIds = [...new Set((geRes.data || []).map(ev => ev.group_id))]
      const { data: groupRows = [] } = evGroupIds.length
        ? await supabase
            .from('groups')
            .select('id,slug')
            .in('id', evGroupIds)
        : { data: [] }
      const groupSlugMap = {}
      groupRows.forEach(g => { groupSlugMap[g.id] = g.slug })

      // 5) shape and store data
      setTraditions((trRes.data || []).map(e => {
        const start = parseDate(e.Dates)
        const end   = parseDate(e['End Date']) || start
        const href =
          getDetailPathForItem({
            ...e,
            slug: e.slug,
          }) || '/'
        const latitude = toNumberOrNull(e.latitude)
        const longitude = toNumberOrNull(e.longitude)
        const areaId = e.area_id ?? null
        return {
          id: e.id,
          title: e['E Name'],
          description: e['E Description'] || '',
          imageUrl: e['E Image'] || '',
          start,
          end,
          start_date: start ? start.toISOString().slice(0,10) : null,
          end_date: end ? end.toISOString().slice(0,10) : null,
          slug: e.slug,
          href,
          isTradition: true,
          start_time: e.start_time || null,
          end_time: e.end_time || null,
          favoriteId: e.id,
          source_table: 'events',
          taggableId: e.id,
          latitude,
          longitude,
          area_id: areaId,
        }
      }))

      setBigBoard((bbRes.data || []).map(ev => {
        const key = ev.big_board_posts?.[0]?.image_url
        const owner = ev.big_board_posts?.[0]?.user_id
        const url = key
          ? supabase.storage
              .from('big-board')
              .getPublicUrl(key).data.publicUrl
          : ''
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date || ev.start_date)
        const href =
          getDetailPathForItem({
            ...ev,
            isBigBoard: true,
          }) || '/'
        const latitude = toNumberOrNull(ev.latitude)
        const longitude = toNumberOrNull(ev.longitude)
        const areaId = ev.area_id ?? null
        return {
          id: ev.id,
          title: ev.title,
          description: ev.description || '',
          imageUrl: url,
          start,
          end,
          start_date: ev.start_date,
          end_date: ev.end_date || ev.start_date,
          slug: ev.slug,
          owner_id: owner,
          href,
          isBigBoard: true,
          start_time: ev.start_time || null,
          end_time: ev.end_time || null,
          favoriteId: ev.id,
          source_table: 'big_board_events',
          taggableId: ev.id,
          latitude,
          longitude,
          area_id: areaId,
        }
      }))

      setGroupEvents((geRes.data || []).map(ev => {
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date || ev.start_date)
        let imgUrl = ''
        if (ev.image_url) {
          imgUrl = ev.image_url.startsWith('http')
            ? ev.image_url
            : supabase.storage
                .from('big-board')
                .getPublicUrl(ev.image_url).data.publicUrl
        }
        const slug = groupSlugMap[ev.group_id]
        const href =
          getDetailPathForItem({
            ...ev,
            group_slug: slug,
            isGroupEvent: true,
          }) || '/'
        const latitude = toNumberOrNull(ev.latitude)
        const longitude = toNumberOrNull(ev.longitude)
        const areaId = ev.area_id ?? null
        return {
          id: ev.id,
          title: ev.title,
          description: ev.description || '',
          imageUrl: imgUrl,
          start,
          end,
          start_date: ev.start_date,
          end_date: ev.end_date || ev.start_date,
          group_slug: slug,
          href,
          isGroupEvent: true,
          start_time: ev.start_time || null,
          end_time: ev.end_time || null,
          favoriteId: ev.id,
          source_table: 'group_events',
          taggableId: ev.id,
          latitude,
          longitude,
          area_id: areaId,
          address: ev.address || '',
        }
      }))

      setAllEvents((aeRes.data || []).map(ev => {
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date || ev.start_date)
        const venueRecord = Array.isArray(ev.venue_id) ? ev.venue_id[0] : ev.venue_id
        const venueSlug = venueRecord?.slug || null
        const venueName = venueRecord?.name || null
        const venueLat = toNumberOrNull(venueRecord?.latitude)
        const venueLng = toNumberOrNull(venueRecord?.longitude)
        const venueAreaId = venueRecord?.area_id ?? null
        const rawLat = toNumberOrNull(ev.latitude)
        const rawLng = toNumberOrNull(ev.longitude)
        const latitude = rawLat ?? venueLat
        const longitude = rawLng ?? venueLng
        const areaId = ev.area_id ?? venueAreaId ?? null
        const venueForDetail = venueRecord
          ? { name: venueName, slug: venueSlug }
          : null
        const href =
          getDetailPathForItem({
            ...ev,
            venue_slug: venueSlug,
            venues: venueForDetail,
          }) || '/'
        return {
          id: ev.id,
          title: ev.name,
          description: ev.description || '',
          imageUrl: ev.image || '',
          start,
          end,
          start_date: ev.start_date,
          end_date: ev.end_date || ev.start_date,
          slug: ev.slug,
          venues: venueRecord
            ? { name: venueName, slug: venueSlug, latitude: venueLat, longitude: venueLng, area_id: venueAreaId }
            : null,
          href,
          start_time: ev.start_time || null,
          end_time: ev.end_time || null,
          link: ev.link || null,
          favoriteId: ev.id,
          source_table: 'all_events',
          taggableId: ev.id,
          latitude,
          longitude,
          area_id: areaId,
          venue_area_id: venueAreaId,
        }
      }))

      if (slug === 'sports') {
        try {
          const teamSlugs = [
            'philadelphia-phillies',
            'philadelphia-76ers',
            'philadelphia-eagles',
            'philadelphia-flyers',
            'philadelphia-union',
          ]
          let all = []
          for (const ts of teamSlugs) {
            const res = await fetch(
              `https://api.seatgeek.com/2/events?performers.slug=${ts}&venue.city=Philadelphia&per_page=50&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
            )
            const json = await res.json()
            all.push(...(json.events || []))
          }
          const mappedSports = all.map(e => {
            const dt = new Date(e.datetime_local)
            const performers = e.performers || []
            const home = performers.find(p => p.home_team) || performers[0] || {}
            const away = performers.find(p => p.id !== home.id) || {}
            const title =
              e.short_title ||
              `${(home.name || '').replace(/^Philadelphia\s+/, '')} vs ${(away.name || '').replace(/^Philadelphia\s+/, '')}`
            const venueLat = toNumberOrNull(e.venue?.location?.lat)
            const venueLng = toNumberOrNull(e.venue?.location?.lon ?? e.venue?.location?.lng)
            return {
              id: `sg-${e.id}`,
              title,
              description: e.description || '',
              imageUrl: home.image || away.image || '',
              start: dt,
              end: dt,
              start_date: dt.toISOString().slice(0,10),
              end_date: dt.toISOString().slice(0,10),
              start_time: dt.toTimeString().slice(0,5),
              end_time: dt.toTimeString().slice(0,5),
              venues: e.venue
                ? {
                    name: e.venue.name,
                    slug: null,
                    latitude: venueLat,
                    longitude: venueLng,
                    area_id: null,
                  }
                : null,
              href: `/sports/${e.id}`,
              url: e.url,
              isSports: true,
              favoriteId: null,
              source_table: null,
              taggableId: e.id,
              latitude: venueLat,
              longitude: venueLng,
              area_id: null,
              venue_area_id: null,
            }
          })
          setAllEvents(prev => [...prev, ...mappedSports])
        } catch (err) {
          console.error('Failed to load sports events', err)
        }
      }

      setRecSeries((recRes.data || []).map(series => ({
        ...series,
        latitude: toNumberOrNull(series.latitude),
        longitude: toNumberOrNull(series.longitude),
        area_id: series.area_id ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [slug])

  // Load profile info for big-board submitters
  useEffect(() => {
    const ids = Array.from(new Set(bigBoard.map(e => e.owner_id).filter(Boolean)))
    if (!ids.length) { setProfileMap({}); return }
    ;(async () => {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,username,image_url')
        .in('id', ids)
      const map = {}
      for (const p of profs || []) {
        let img = p.image_url || ''
        if (img && !img.startsWith('http')) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-images')
            .getPublicUrl(img)
          img = publicUrl
        }
        map[p.id] = { username: p.username, image: img, cultures: [] }
      }
      const { data: rows } = await supabase
        .from('profile_tags')
        .select('profile_id, culture_tags(id,name,emoji)')
        .in('profile_id', ids)
        .eq('tag_type', 'culture')
      rows?.forEach(r => {
        if (!map[r.profile_id]) map[r.profile_id] = { username: '', image: '', cultures: [] }
        if (r.culture_tags?.emoji) {
          map[r.profile_id].cultures.push({ emoji: r.culture_tags.emoji, name: r.culture_tags.name })
        }
      })
      setProfileMap(map)
    })()
  }, [bigBoard])

  // ── derive recurring instances ─────────────────────────────────
  const recEventsList = useMemo(() => {
    return recSeries.flatMap(series => {
      if (!series.start_date) return []
      const opts = RRule.parseString(series.rrule)
      const startTime = series.start_time || '00:00:00'
      const dtstart = new Date(`${series.start_date}T${startTime}`)
      if (isNaN(dtstart)) return []
      opts.dtstart = dtstart
      if (series.end_date) opts.until = new Date(`${series.end_date}T23:59:59`)
      const rule = new RRule(opts)
      const upcoming = []
      let next = rule.after(new Date(), true)
      for (let i = 0; next && i < 3; i++) {
        upcoming.push(next)
        next = rule.after(next, false)
      }
      return upcoming.map(d => ({
        id: `${series.id}::${d.toISOString().slice(0,10)}`,
        title: series.name,
        description: series.description || '',
        imageUrl: series.image_url,
        start: d,
        end: d,
        start_date: d.toISOString().slice(0,10),
        end_date: d.toISOString().slice(0,10),
        start_time: series.start_time,
        end_time: series.end_time,
        slug: series.slug,
        address: series.address,
        link: series.link,
        href: `/series/${series.slug}/${d.toISOString().slice(0,10)}`,
        isRecurring: true,
        favoriteId: series.id,
        source_table: 'recurring_events',
        taggableId: series.id,
        latitude: series.latitude ?? null,
        longitude: series.longitude ?? null,
        area_id: series.area_id ?? null,
      }))
    })
  }, [recSeries])
  const allList = useMemo(() => [
    ...traditions,
    ...bigBoard,
    ...groupEvents,
    ...allEvents,
    ...recEventsList,
  ], [traditions, bigBoard, groupEvents, allEvents, recEventsList])

  const sortedEvents = useMemo(() => {
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)

    const getSortDate = evt => {
      const start = evt.start instanceof Date
        ? evt.start
        : evt.start_date
          ? parseISODateLocal(evt.start_date)
          : null
      const end = evt.end instanceof Date
        ? evt.end
        : evt.end_date
          ? parseISODateLocal(evt.end_date)
          : start

      if (start && start >= today0) return start
      if (end && end >= today0) return end
      return end || start || today0
    }

    const future = []
    const past = []

    allList.forEach(evt => {
      const start = evt.start instanceof Date
        ? evt.start
        : evt.start_date
          ? parseISODateLocal(evt.start_date)
          : null
      const end = evt.end instanceof Date
        ? evt.end
        : evt.end_date
          ? parseISODateLocal(evt.end_date)
          : start
      const isFuture = (start && start >= today0) || (end && end >= today0)
      const sortDate = getSortDate(evt)
      if (isFuture) {
        future.push({ evt, sortDate })
      } else {
        past.push({ evt, sortDate: sortDate || end || start || today0 })
      }
    })

    future.sort((a, b) => a.sortDate - b.sortDate)
    past.sort((a, b) => b.sortDate - a.sortDate)

    return [
      ...future.map(entry => entry.evt),
      ...past.map(entry => entry.evt),
    ]
  }, [allList])

  const weekendRange = useMemo(() => getUpcomingWeekendRange(), [])

  const filteredEvents = useMemo(() => {
    if (!sortedEvents.length) return []
    const events = sortedEvents

    const filterByRange = (rangeStart, rangeEnd) => {
      return events.filter(evt => {
        const rawStart = evt.start instanceof Date ? evt.start : evt.start_date ? parseISODateLocal(evt.start_date) : null
        const rawEnd = evt.end instanceof Date ? evt.end : evt.end_date ? parseISODateLocal(evt.end_date) : rawStart
        const evtStart = rawStart ? startOfDay(rawStart) : null
        const evtEnd = rawEnd ? endOfDay(rawEnd) : evtStart
        if (rangeStart && evtEnd && evtEnd < rangeStart) return false
        if (rangeEnd && evtStart && evtStart > rangeEnd) return false
        return true
      })
    }

    switch (dateFilter) {
      case 'today': {
        const todayStart = startOfDay(new Date())
        const todayEnd = endOfDay(new Date())
        return filterByRange(todayStart, todayEnd)
      }
      case 'weekend': {
        return filterByRange(weekendRange.start, weekendRange.end)
      }
      case 'range': {
        const startInput = customStart ? parseISODateLocal(customStart) : null
        const endInput = customEnd ? parseISODateLocal(customEnd) : null
        const rangeStart = startInput ? startOfDay(startInput) : null
        const rangeEnd = endInput ? endOfDay(endInput) : null
        if (!rangeStart && !rangeEnd) return events
        if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
          return filterByRange(rangeEnd, endOfDay(rangeStart))
        }
        return filterByRange(rangeStart, rangeEnd)
      }
      default:
        return events
    }
  }, [sortedEvents, dateFilter, customStart, customEnd, weekendRange])

  const mapEvents = useMemo(() => {
    const baseTag = tag ? { slug: tag.slug, name: tag.name } : null
    return filteredEvents
      .map(evt => {
        const venueEntries = Array.isArray(evt.venues)
          ? evt.venues
          : evt.venues
            ? [evt.venues]
            : []
        const candidateLat =
          evt.latitude ??
          venueEntries.find(v => v?.latitude !== undefined && v?.latitude !== null)?.latitude ??
          null
        const candidateLng =
          evt.longitude ??
          venueEntries.find(v => v?.longitude !== undefined && v?.longitude !== null)?.longitude ??
          null
        const latitude = toNumberOrNull(candidateLat)
        const longitude = toNumberOrNull(candidateLng)
        if (latitude === null || longitude === null) return null

        const startDate =
          evt.start instanceof Date
            ? evt.start
            : evt.start_date
              ? parseISODateLocal(evt.start_date)
              : null
        const endDate =
          evt.end instanceof Date
            ? evt.end
            : evt.end_date
              ? parseISODateLocal(evt.end_date)
              : startDate

        const detailPath =
          evt.href ||
          getDetailPathForItem({
            ...evt,
            venue_slug: evt.venues?.slug,
          }) ||
          null

        const baseId = evt.taggableId ?? evt.id
        const mapKey = evt.source_table ? `${evt.source_table}:${baseId}` : baseId ? `evt:${baseId}` : null
        const extraTags = mapKey && tagMap[mapKey] ? tagMap[mapKey] : []
        const combinedTags = Array.isArray(extraTags) ? [...extraTags] : []
        if (baseTag && !combinedTags.some(t => t?.slug === baseTag.slug)) {
          combinedTags.push(baseTag)
        }
        const seen = new Set()
        const mapTags = combinedTags
          .map(tagEntry => {
            if (!tagEntry) return null
            const slugVal = tagEntry.slug || tagEntry.slug_id || null
            const nameVal = tagEntry.name || tagEntry.tag_name || null
            if (!slugVal || seen.has(slugVal)) return null
            seen.add(slugVal)
            return { slug: slugVal, name: nameVal || slugVal }
          })
          .filter(Boolean)

        const areaName = resolveAreaName(evt, areaLookup)
        const venueName = venueEntries.find(entry => entry?.name)?.name || evt.venues?.name || null

        const startTimeLabel = evt.start_time ? formatTime(evt.start_time) : null
        const endTimeLabel = evt.end_time ? formatTime(evt.end_time) : null
        let timeLabel = null
        if (startTimeLabel && endTimeLabel && startTimeLabel !== endTimeLabel) {
          timeLabel = `${startTimeLabel} – ${endTimeLabel}`
        } else if (startTimeLabel || endTimeLabel) {
          timeLabel = startTimeLabel || endTimeLabel
        }

        const favoriteEventId = evt.isSports
          ? null
          : evt.favoriteId ?? (evt.isRecurring ? String(evt.id).split('::')[0] : evt.id ?? null)
        const favoriteSource = evt.isSports
          ? null
          : evt.source_table ?? (
              evt.isBigBoard
                ? 'big_board_events'
                : evt.isTradition
                  ? 'events'
                  : evt.isGroupEvent
                    ? 'group_events'
                    : evt.isRecurring
                      ? 'recurring_events'
                      : 'all_events'
            )

        const normalizedBadges = []
        if (Array.isArray(evt.badges)) {
          evt.badges.forEach(badge => {
            if (typeof badge === 'string' && badge.trim()) {
              normalizedBadges.push(badge.trim())
            } else if (badge && typeof badge === 'object' && badge.label) {
              normalizedBadges.push(badge.label)
            }
          })
        }
        if (!normalizedBadges.length) {
          if (evt.isTradition) normalizedBadges.push('Tradition')
          if (evt.isBigBoard) normalizedBadges.push('Submission')
          if (evt.isGroupEvent) normalizedBadges.push('Group Event')
          if (evt.isRecurring) normalizedBadges.push('Recurring')
          if (evt.isSports) normalizedBadges.push('Sports')
        }

        const externalUrl =
          evt.externalUrl || (evt.isSports ? evt.url || evt.ticket_url || null : null)

        return {
          ...evt,
          latitude,
          longitude,
          startDate,
          endDate,
          detailPath,
          areaName,
          mapTags,
          timeLabel,
          favoriteId: favoriteEventId ?? null,
          source_table: favoriteSource ?? null,
          badges: normalizedBadges,
          externalUrl,
          venueName,
        }
      })
      .filter(Boolean)
  }, [filteredEvents, tag, tagMap, areaLookup])

  useEffect(() => {
    if (!selectedMapEventId) return
    const exists = mapEvents.some(evt => evt.id === selectedMapEventId)
    if (!exists) {
      setSelectedMapEventId(null)
    }
  }, [mapEvents, selectedMapEventId])

  const selectedMapEvent = useMemo(
    () => mapEvents.find(evt => evt.id === selectedMapEventId) || null,
    [mapEvents, selectedMapEventId]
  )

  const handleMapEventSelect = useCallback(event => {
    setSelectedMapEventId(event?.id || null)
  }, [])

  useEffect(() => {
    if (!filteredEvents.length) {
      setTagMap({})
      return
    }
    const idsByType = filteredEvents.reduce((acc, evt) => {
      if (!evt.source_table || !evt.taggableId) return acc
      const key = evt.source_table
      if (!acc[key]) acc[key] = new Set()
      acc[key].add(evt.taggableId)
      return acc
    }, {})
    const entries = Object.entries(idsByType).filter(([, ids]) => ids.size)
    if (!entries.length) {
      setTagMap({})
      return
    }
    Promise.all(
      entries.map(([type, ids]) =>
        supabase
          .from('taggings')
          .select('tags(name,slug),taggable_id')
          .eq('taggable_type', type)
          .in('taggable_id', Array.from(ids))
      )
    )
      .then(results => {
        const map = {}
        results.forEach(({ data, error }, index) => {
          if (error) {
            console.error('Failed to load additional tags', error)
            return
          }
          const type = entries[index][0]
          data?.forEach(row => {
            if (!row?.taggable_id || !row.tags) return
            const key = `${type}:${row.taggable_id}`
            map[key] = map[key] || []
            map[key].push(row.tags)
          })
        })
        setTagMap(map)
      })
      .catch(err => {
        console.error('Tag map fetch error', err)
      })
  }, [filteredEvents])

  if (loading) return <p className="text-center py-20">Loading…</p>
  if (!tag)    return <p className="text-center py-20 text-red-600">Tag not found</p>

  const eventCount = filteredEvents.length
  const filterOptions = [
    { value: 'all', label: 'All dates' },
    { value: 'today', label: 'Today' },
    { value: 'weekend', label: 'This weekend' },
    { value: 'range', label: 'Custom range' },
  ]
  const showCustomRange = dateFilter === 'range'
  return (
    <>
      <Helmet>
        <title>#{tag.name} events in Philadelphia | Our Philly</title>
        <meta
          name="description"
          content={`Explore ${eventCount || 'the best'} ${tag.name} events in Philadelphia with Our Philly.`}
        />
      </Helmet>

      <div className="min-h-screen bg-[#fdf7f2] text-[#29313f]">
        <Navbar />
        <main className="pt-24 pb-16">
          <section className="border-b border-[#f4c9bc]/70 bg-white/80">
            <div className="mx-auto max-w-7xl px-6 pt-14 pb-10 flex flex-col gap-8">
              <div className="flex flex-col gap-5">
                <h1 className="text-4xl font-black leading-tight text-[#29313f] sm:text-5xl">
                  {eventCount > 0
                    ? `${eventCount} #${tag.name} events in the city`
                    : `#${tag.name} events in the city`}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#bf3d35]">
                  <label className="flex items-center gap-2 text-[#bf3d35]">
                    <span>Date filter</span>
                    <select
                      value={dateFilter}
                      onChange={e => setDateFilter(e.target.value)}
                      className="rounded-full border border-[#f4c9bc] bg-white/90 px-4 py-2 text-sm font-semibold capitalize text-[#29313f] shadow-sm focus:border-[#bf3d35] focus:outline-none focus:ring-2 focus:ring-[#bf3d35]/30"
                    >
                      {filterOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {showCustomRange && (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-[#bf3d35]">
                        <span>Start</span>
                        <input
                          type="date"
                          value={customStart}
                          onChange={e => setCustomStart(e.target.value)}
                          className="rounded-lg border border-[#f4c9bc] bg-white/90 px-3 py-2 text-sm text-[#29313f] shadow-sm focus:border-[#bf3d35] focus:outline-none focus:ring-2 focus:ring-[#bf3d35]/30"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-[#bf3d35]">
                        <span>End</span>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={e => setCustomEnd(e.target.value)}
                          className="rounded-lg border border-[#f4c9bc] bg-white/90 px-3 py-2 text-sm text-[#29313f] shadow-sm focus:border-[#bf3d35] focus:outline-none focus:ring-2 focus:ring-[#bf3d35]/30"
                        />
                      </label>
                    </div>
                  )}
                  <button
                    onClick={() => { setModalStartStep(1); setInitialFlyer(null); setShowFlyerModal(true); }}
                    className="inline-flex items-center justify-center rounded-full bg-[#bf3d35] px-6 py-3 text-sm font-semibold tracking-wider text-white shadow-lg shadow-[#bf3d35]/30 transition hover:-translate-y-0.5 hover:bg-[#a2322c]"
                  >
                    Submit an event
                  </button>
                </div>
              </div>
            </div>
          </section>

          {mapEvents.length > 0 && (
            <section className="mx-auto max-w-7xl px-6 pt-8">
              <div className="relative">
                <MonthlyEventsMap
                  events={mapEvents}
                  height={560}
                  variant="panel"
                  onSelectEvent={handleMapEventSelect}
                  selectedEventId={selectedMapEventId}
                />

                {selectedMapEvent && (
                  <div className="absolute inset-y-0 left-0 hidden lg:flex lg:items-stretch lg:justify-start lg:p-4 lg:pl-6 xl:pl-8 z-20">
                    <div className="pointer-events-auto flex h-full w-full max-w-sm">
                      <MapEventDetailPanel
                        event={selectedMapEvent}
                        onClose={() => setSelectedMapEventId(null)}
                        variant="desktop"
                      />
                    </div>
                  </div>
                )}

                <div
                  className={`absolute inset-x-4 bottom-4 z-20 flex justify-center lg:hidden ${
                    selectedMapEvent ? 'pointer-events-auto' : 'pointer-events-none'
                  }`}
                >
                  <div
                    className={`pointer-events-auto w-full max-w-md transform-gpu transition-all duration-300 ${
                      selectedMapEvent ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                    }`}
                  >
                    {selectedMapEvent && (
                      <MapEventDetailPanel
                        event={selectedMapEvent}
                        onClose={() => setSelectedMapEventId(null)}
                        variant="mobile"
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="mx-auto max-w-7xl px-6 pt-10">
            {eventCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#f4c9bc] bg-white/80 px-6 py-12 text-center text-[#4a5568] shadow-sm">
                <p className="text-lg font-semibold text-[#29313f]">No #{tag.name} events match these dates yet.</p>
                <p className="mt-3">Be the first to add one and help the city discover it.</p>
                <button
                  onClick={() => { setModalStartStep(1); setInitialFlyer(null); setShowFlyerModal(true); }}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#bf3d35] px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-[#bf3d35]/30 transition hover:-translate-y-0.5 hover:bg-[#a2322c]"
                >
                  Submit an event
                </button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-200">
                {filteredEvents.map(evt => {
                  const baseId = evt.taggableId ?? evt.id
                  const mapKey = evt.source_table ? `${evt.source_table}:${baseId}` : `evt:${baseId}`
                  const extraTags = mapKey && tagMap[mapKey] ? tagMap[mapKey] : []
                  const tagsForRow = Array.isArray(extraTags) ? [...extraTags] : []
                  if (!tagsForRow.some(t => t?.slug === tag.slug)) {
                    tagsForRow.push({ slug: tag.slug, name: tag.name })
                  }
                  const rowKey = `${mapKey}-${evt.start_date || ''}-${evt.start_time || ''}`
                  return <EventRow key={rowKey} evt={evt} tags={tagsForRow} profileMap={profileMap} areaLookup={areaLookup} />
                })}
              </div>
            )}
          </section>
        </main>

        {showFlyerModal && (
          <PostFlyerModal
            isOpen
            onClose={() => setShowFlyerModal(false)}
            startStep={modalStartStep}
            initialFile={initialFlyer}
          />
        )}

        <Footer />
      </div>
    </>
  )
}
