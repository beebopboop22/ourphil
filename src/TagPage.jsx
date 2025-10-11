// src/TagPage.jsx
import React, { useEffect, useState, useMemo, useContext } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import PostFlyerModal from './PostFlyerModal'
import { Helmet } from 'react-helmet'
import { RRule } from 'rrule'
import { Clock } from 'lucide-react'
import { FaStar } from 'react-icons/fa'
import useEventFavorite from './utils/useEventFavorite'
import { AuthContext } from './AuthProvider'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'

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

function buildTimingLabel(startDate, startTime) {
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

function EventRow({ evt, tags, profileMap }) {
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
  const timingLabel = buildTimingLabel(startDate, evt.start_time)
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
          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">{timingLabel}</span>
            {badges.map(badge => (
              <span key={badge.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.icon}
                {badge.label}
              </span>
            ))}
            {isFavorite && !evt.isSports && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white">
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
  const [loading, setLoading] = useState(true)

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

      // 2) fetch taggings
      const { data: taggings } = await supabase
        .from('taggings')
        .select('taggable_type,taggable_id')
        .eq('tag_id', t.id)
      const byType = taggings.reduce((acc, { taggable_type, taggable_id }) => {
        acc[taggable_type] = acc[taggable_type] || []
        acc[taggable_type].push(taggable_id)
        return acc
      }, {})
      const recurringIds = byType.recurring_events || []

      // 3) parallel fetch all sources
      const [trRes, bbRes, geRes, aeRes, recRes] = await Promise.all([
        byType.events?.length
          ? supabase
              .from('events')
              .select('id,"E Name","E Description","E Image",slug,Dates,"End Date",start_time,end_time')
              .in('id', byType.events)
          : { data: [] },
        byType.big_board_events?.length
          ? supabase
              .from('big_board_events')
              .select('id,title,description,slug,start_date,end_date,start_time,end_time,big_board_posts!big_board_posts_event_id_fkey(image_url,user_id)')
              .in('id', byType.big_board_events)
          : { data: [] },
        byType.group_events?.length
          ? supabase
              .from('group_events')
              .select('id,title,description,start_date,end_date,start_time,end_time,image_url,group_id')
              .in('id', byType.group_events)
          : { data: [] },
        byType.all_events?.length
          ? supabase
              .from('all_events')
              .select('id,name,description,slug,image,link,start_date,end_date,start_time,end_time,venue_id(name,slug)')
              .in('id', byType.all_events)
          : { data: [] },
        recurringIds.length
          ? supabase
              .from('recurring_events')
              .select('id,name,slug,description,address,link,image_url,start_date,end_date,start_time,end_time,rrule')
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
        }
      }))

      setAllEvents((aeRes.data || []).map(ev => {
        const start = parseISODateLocal(ev.start_date)
        const end   = parseISODateLocal(ev.end_date || ev.start_date)
        const venueSlug = ev.venue_id?.slug || null
        const href =
          getDetailPathForItem({
            ...ev,
            venue_slug: venueSlug,
            venues: ev.venue_id
              ? { name: ev.venue_id.name, slug: venueSlug }
              : null,
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
          venues: ev.venue_id
            ? { name: ev.venue_id.name, slug: venueSlug }
            : null,
          href,
          start_time: ev.start_time || null,
          end_time: ev.end_time || null,
          link: ev.link || null,
          favoriteId: ev.id,
          source_table: 'all_events',
          taggableId: ev.id,
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
              venues: e.venue ? { name: e.venue.name, slug: null } : null,
              href: `/sports/${e.id}`,
              url: e.url,
              isSports: true,
              favoriteId: null,
              source_table: null,
              taggableId: e.id,
            }
          })
          setAllEvents(prev => [...prev, ...mappedSports])
        } catch (err) {
          console.error('Failed to load sports events', err)
        }
      }

      setRecSeries(recRes.data || [])
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

  const upcoming = useMemo(() => {
    const today0 = new Date()
    today0.setHours(0,0,0,0)

    const isUpcoming = evt => {
      const start = evt.start || null
      const end = evt.end || start
      if (!start && !end) return false
      if (start && start >= today0) return true
      if (end && end >= today0) return true
      return false
    }

    const getSortDate = evt => {
      const start = evt.start || null
      const end = evt.end || start
      if (start && start >= today0) return start
      if (end && end >= today0) return end
      return start || end || today0
    }

    return allList
      .filter(isUpcoming)
      .sort((a,b) => getSortDate(a) - getSortDate(b))
  }, [allList])

  const weekendRange = useMemo(() => getUpcomingWeekendRange(), [])

  const filteredEvents = useMemo(() => {
    if (!upcoming.length) return []
    const events = upcoming

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
  }, [upcoming, dateFilter, customStart, customEnd, weekendRange])

  useEffect(() => {
    if (!upcoming.length) {
      setTagMap({})
      return
    }
    const idsByType = upcoming.reduce((acc, evt) => {
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
  }, [upcoming])

  if (loading) return <p className="text-center py-20">Loading…</p>
  if (!tag)    return <p className="text-center py-20 text-red-600">Tag not found</p>

  const eventCount = filteredEvents.length
  const eventCountLabel = eventCount === 1 ? 'event' : 'events'
  const filterOptions = [
    { value: 'all', label: 'All dates' },
    { value: 'today', label: 'Today' },
    { value: 'weekend', label: 'This weekend' },
    { value: 'range', label: 'Custom range' },
  ]
  const showCustomRange = dateFilter === 'range'
  const heroDescription = tag.description || `Discover upcoming #${tag.name} things to do in Philadelphia, curated by Our Philly.`

  return (
    <>
      <Helmet>
        <title>#{tag.name} events in Philadelphia | Our Philly</title>
        <meta
          name="description"
          content={`Explore ${eventCount || 'upcoming'} ${tag.name} events in Philadelphia with Our Philly.`}
        />
      </Helmet>

      <div className="min-h-screen bg-neutral-50">
        <Navbar />
        <main className="pt-28 pb-16">
          <section className="bg-gradient-to-r from-[#fff1f0] via-[#fff8e8] to-[#eef2ff] border-b">
            <div className="max-w-screen-xl mx-auto px-4 py-12 flex flex-col gap-8">
              <div className="text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e]">#{tag.name} in Philadelphia</h1>
                  {tag.is_seasonal && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#d9e9ea] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#004C55]">
                      <Clock className="h-4 w-4" />
                      Seasonal tag
                    </span>
                  )}
                </div>
                <p className="mt-4 mx-auto md:mx-0 max-w-2xl text-lg text-gray-700">{heroDescription}</p>
              </div>
              <div className="rounded-2xl bg-white/80 backdrop-blur shadow-sm border border-white/60 px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-center sm:text-left">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#bf3d35]">Add your event</p>
                  <p className="mt-1 text-gray-700">
                    Know a #{tag.name} happening soon? Add it so your neighbors can plan it into their week.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <button
                    onClick={() => { setModalStartStep(1); setInitialFlyer(null); setShowFlyerModal(true); }}
                    className="inline-flex items-center justify-center rounded-full bg-[#bf3d35] px-6 py-3 text-sm font-semibold text-white shadow hover:opacity-90 transition"
                  >
                    Submit an event
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border-b">
            <div className="max-w-screen-xl mx-auto px-4 py-6 flex flex-col gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#28313e]">Upcoming #{tag.name} events</h2>
                  <p className="text-sm text-gray-600">
                    {eventCount > 0
                      ? `${eventCount} ${eventCountLabel} sorted by date`
                      : 'No upcoming events yet — add one to get things started.'}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                    {filterOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setDateFilter(option.value)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                          dateFilter === option.value
                            ? 'bg-[#28313e] text-white shadow-sm'
                            : 'bg-gray-100 text-[#28313e] hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {showCustomRange && (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <label className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">From</span>
                        <input
                          type="date"
                          value={customStart}
                          onChange={e => setCustomStart(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">To</span>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={e => setCustomEnd(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-screen-xl mx-auto px-4 py-10">
            {eventCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500">
                <p className="text-lg font-semibold text-gray-700">No #{tag.name} events match these dates yet.</p>
                <p className="mt-3">Be the first to add one and help the city discover it.</p>
                <button
                  onClick={() => { setModalStartStep(1); setInitialFlyer(null); setShowFlyerModal(true); }}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#bf3d35] px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-90 transition"
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
                  return <EventRow key={rowKey} evt={evt} tags={tagsForRow} profileMap={profileMap} />
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
