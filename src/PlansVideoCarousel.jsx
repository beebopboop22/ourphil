// src/PlansVideoCarousel.jsx
import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import { RRule } from 'rrule'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'

const parseDate = datesStr => {
  if (!datesStr) return null
  const [first] = datesStr.split(/through|–|-/)
  const parts = first.trim().split('/')
  if (parts.length !== 3) return null
  const [m, d, y] = parts.map(Number)
  const dt = new Date(y, m - 1, d)
  return isNaN(dt) ? null : dt
}
const parseLocalYMD = str => {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return isNaN(dt) ? null : dt
}

const expandRecurring = (rows, windowStart = null, windowEnd = null) => {
  const out = []
  const today0 = new Date()
  today0.setHours(0, 0, 0, 0)
  ;(rows || []).forEach(r => {
    if (!r.rrule || !r.start_date) return
    const opts = RRule.parseString(r.rrule)
    const startTime = r.start_time || '00:00:00'
    const dtstart = new Date(`${r.start_date}T${startTime}`)
    if (isNaN(dtstart)) return
    opts.dtstart = dtstart
    if (r.end_date) opts.until = new Date(`${r.end_date}T23:59:59`)
    const rule = new RRule(opts)
    let dates = []
    if (windowStart && windowEnd) {
      dates = rule.between(windowStart, windowEnd, true)
    } else {
      const next = rule.after(today0, true)
      if (next) dates = [next]
    }
    dates.forEach(d => {
      const dateStr = d.toISOString().slice(0, 10)
      const detailPath =
        getDetailPathForItem({
          ...r,
          slug: r.slug,
          start_date: dateStr,
        }) || `/series/${r.slug}/${dateStr}`
      out.push({
        key: `re-${r.id}-${dateStr}`,
        id: r.id,
        type: 'recurring_events',
        slug: detailPath,
        name: r.name,
        start: d,
        end: d,
        image: r.image_url || '',
        description: r.description || ''
      })
    })
  })
  return out
}

const formatDate = date => {
  if (!date) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24))
  const monthDay = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
  if (diffDays === 0) return `Today, ${monthDay}`
  if (diffDays === 1) return `Tomorrow, ${monthDay}`
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const weekDiff = Math.floor(diffDays / 7)
  if (weekDiff === 0) return `This ${weekday}, ${monthDay}`
  if (weekDiff === 1) return `Next ${weekday}, ${monthDay}`
  return `${weekday}, ${monthDay}`
}

export default function PlansVideoCarousel({
  tag,
  onlyEvents = false,
  headline,
  weekend = false,
  today = false,
  sunday = false,
  limit = 15,
}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const listRef = useRef(null)
  const [current, setCurrent] = useState(0)
  const [added, setAdded] = useState(false)
  const [pillConfigs, setPillConfigs] = useState([])
  const [navHeight, setNavHeight] = useState(0)
  const [groups, setGroups] = useState([])
  const [slides, setSlides] = useState([])
  const [tagMap, setTagMap] = useState({})

  const colors = [
    '#22C55E', // green
    '#0D9488', // teal
    '#DB2777', // pink
    '#3B82F6', // blue
    '#F97316', // orange
    '#EAB308', // yellow
    '#8B5CF6', // purple
    '#EF4444', // red
  ]

  useEffect(() => {
    supabase
      .from('tags')
      .select('name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) return
        const configs = (data || []).map((t, i) => ({
          name: t.name,
          color: colors[i % colors.length],
          left: Math.random() * 100,
          duration: 12 + Math.random() * 8,
          delay: -Math.random() * 20,
        }))
        setPillConfigs(configs)
      })
  }, [])

  useEffect(() => {
    const navEl = document.querySelector('nav')
    if (!navEl) return
    const updateHeight = () => setNavHeight(navEl.offsetHeight)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(navEl)
    window.addEventListener('resize', updateHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [])

  useEffect(() => {
    if (tag !== 'fitness') { setGroups([]); return }
    ;(async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, slug, Name, Type')
      if (!error) {
        const fitnessTags = ['climbing','cycling','running','sports leagues','outdoors & adventure','yoga']
        const filtered = (data || [])
          .filter(g => {
            const types = (g.Type || '').toLowerCase()
            return fitnessTags.some(t => types.includes(t))
          })
          .map(g => ({
            ...g,
            Type: (g.Type || '')
              .split(',')
              .map(t => t.trim())
              .filter(t => t.toLowerCase() !== 'health & fitness')
              .join(', '),
          }))
          .slice(0, 5)
        setGroups(filtered)
      }
    })()
  }, [tag])

  useEffect(() => {
    ;(async () => {
      try {
        if (weekend || sunday) {
          const todayDate = new Date(); todayDate.setHours(0,0,0,0)
          const day = todayDate.getDay()
          let friday = new Date(todayDate)
          if (day === 0) friday.setDate(todayDate.getDate() - 2)
          else if (day >= 5) friday.setDate(todayDate.getDate() - (day - 5))
          else friday.setDate(todayDate.getDate() + (5 - day))
          const sundayDate = new Date(friday); sundayDate.setDate(friday.getDate() + 2)

          const [eRes, bbRes, aeRes, geRes, reRes, gRes] = await Promise.all([
            supabase
              .from('events')
              .select('id, slug, "E Name", Dates, "End Date", "E Image", "E Description"'),
            supabase
              .from('big_board_events')
              .select('id, title, slug, start_date, end_date, description, big_board_posts!big_board_posts_event_id_fkey(image_url)'),
            supabase
              .from('all_events')
              .select('id, slug, name, start_date, image, description, venue_id(slug)'),
            supabase
              .from('group_events')
              .select('id, title, slug, description, start_date, end_date, image_url, group_id'),
            supabase
              .from('recurring_events')
              .select('id, name, slug, description, image_url, start_date, end_date, start_time, rrule')
              .eq('is_active', true),
            supabase
              .from('games')
              .select('*'),
          ])

          let groupMap = {}
          if (geRes.data?.length) {
            const groupIds = [...new Set(geRes.data.map(ev => ev.group_id))]
            if (groupIds.length) {
              const { data: groupsData } = await supabase
                .from('groups')
                .select('id, slug')
                .in('id', groupIds)
              groupsData?.forEach(g => { groupMap[g.id] = g.slug })
            }
          }

          const merged = []
          ;(eRes.data || []).forEach(e => {
            const start = parseDate(e.Dates)
            const end = e['End Date'] ? parseDate(e['End Date']) : start
            const detailPath =
              getDetailPathForItem({
                ...e,
                slug: e.slug,
              }) || `/events/${e.slug}`
            merged.push({
              key: `ev-${e.id}`,
              id: e.id,
              type: 'events',
              slug: detailPath,
              name: e['E Name'],
              start,
              end,
              image: e['E Image'] || '',
              description: e['E Description'] || ''
            })
          })
          ;(bbRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
            const key = ev.big_board_posts?.[0]?.image_url
            const image = key
              ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
              : ''
            const detailPath =
              getDetailPathForItem({
                ...ev,
                isBigBoard: true,
              }) || `/big-board/${ev.slug}`
            merged.push({
              key: `bb-${ev.id}`,
              id: ev.id,
              type: 'big_board_events',
              slug: detailPath,
              name: ev.title,
              start,
              end,
              image,
              description: ev.description || ''
            })
          })
          ;(aeRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const venueSlug = ev.venue_id?.slug
            const detailPath =
              getDetailPathForItem({
                ...ev,
                venue_slug: venueSlug,
                venues: ev.venue_id
                  ? { name: ev.venue_id.name, slug: venueSlug }
                  : null,
              }) || (venueSlug ? `/${venueSlug}/${ev.slug}` : `/${ev.slug}`)
            merged.push({
              key: `ae-${ev.id}`,
              id: ev.id,
              type: 'all_events',
              slug: detailPath,
              name: ev.name,
              start,
              end: start,
              image: ev.image || '',
              description: ev.description || ''
            })
          })
          ;(geRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
            let image = ''
            if (ev.image_url?.startsWith('http')) image = ev.image_url
            else if (ev.image_url)
              image = supabase.storage.from('big-board').getPublicUrl(ev.image_url).data.publicUrl
            const groupSlug = groupMap[ev.group_id]
            const detailPath =
              getDetailPathForItem({
                ...ev,
                group_slug: groupSlug,
                isGroupEvent: true,
              }) || (groupSlug ? `/groups/${groupSlug}/events/${ev.slug}` : null)
            if (detailPath) {
              merged.push({
                key: `ge-${ev.id}`,
                id: ev.id,
                type: 'group_events',
                slug: detailPath,
                name: ev.title,
                start,
                end,
                image,
                description: ev.description || ''
              })
            }
          })

          ;(gRes.data || []).forEach(game => {
            if (!game.Date) return
            const [m, d, y] = game.Date.split('/').map(Number)
            const start = new Date(2000 + y, m - 1, d)
            merged.push({
              key: `g-${game.id}`,
              id: game.id,
              type: 'games',
              slug: game['Ticket link'] || '',
              name: game.Subject,
              start,
              end: start,
              image: game.Image || '',
              description: game.Location || ''
            })
          })

          merged.push(...expandRecurring(reRes.data || [], friday, sundayDate))

          let rangeStart = weekend ? friday : sundayDate
          let rangeEnd = weekend ? new Date(sundayDate) : new Date(sundayDate)
          if (!weekend) rangeEnd.setDate(rangeEnd.getDate() + 1)

          const filteredEvents = merged
            .filter(ev => ev.start && ev.start >= rangeStart && ev.start < rangeEnd)
            .sort((a, b) => a.start - b.start)
          setEvents(filteredEvents.slice(0, limit))
          setLoading(false)
          return
        }

        if (today) {
          const todayDate = new Date(); todayDate.setHours(0,0,0,0)
          const tomorrow = new Date(todayDate); tomorrow.setDate(todayDate.getDate() + 1)

          const [eRes, bbRes, aeRes, geRes, reRes] = await Promise.all([
            supabase
              .from('events')
              .select('id, slug, "E Name", Dates, "End Date", "E Image", "E Description"'),
            supabase
              .from('big_board_events')
              .select('id, title, slug, start_date, end_date, description, big_board_posts!big_board_posts_event_id_fkey(image_url)'),
            supabase
              .from('all_events')
              .select('id, slug, name, start_date, image, description, venue_id(slug)'),
            supabase
              .from('group_events')
              .select('id, title, slug, description, start_date, end_date, image_url, group_id'),
            supabase
              .from('recurring_events')
              .select('id, name, slug, description, image_url, start_date, end_date, start_time, rrule')
              .eq('is_active', true),
          ])

          let groupMap = {}
          if (geRes.data?.length) {
            const groupIds = [...new Set(geRes.data.map(ev => ev.group_id))]
            if (groupIds.length) {
              const { data: groupsData } = await supabase
                .from('groups')
                .select('id, slug')
                .in('id', groupIds)
              groupsData?.forEach(g => { groupMap[g.id] = g.slug })
            }
          }

          const merged = []
          ;(eRes.data || []).forEach(e => {
            const start = parseDate(e.Dates)
            const end = e['End Date'] ? parseDate(e['End Date']) : start
            const detailPath =
              getDetailPathForItem({
                ...e,
                slug: e.slug,
              }) || `/events/${e.slug}`
            merged.push({
              key: `ev-${e.id}`,
              id: e.id,
              type: 'events',
              slug: detailPath,
              name: e['E Name'],
              start,
              end,
              image: e['E Image'] || '',
              description: e['E Description'] || ''
            })
          })
          ;(bbRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
            const key = ev.big_board_posts?.[0]?.image_url
            const image = key
              ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
              : ''
            const detailPath =
              getDetailPathForItem({
                ...ev,
                isBigBoard: true,
              }) || `/big-board/${ev.slug}`
            merged.push({
              key: `bb-${ev.id}`,
              id: ev.id,
              type: 'big_board_events',
              slug: detailPath,
              name: ev.title,
              start,
              end,
              image,
              description: ev.description || ''
            })
          })
          ;(aeRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const venueSlug = ev.venue_id?.slug
            const detailPath =
              getDetailPathForItem({
                ...ev,
                venue_slug: venueSlug,
                venues: ev.venue_id
                  ? { name: ev.venue_id.name, slug: venueSlug }
                  : null,
              }) || (venueSlug ? `/${venueSlug}/${ev.slug}` : `/${ev.slug}`)
            merged.push({
              key: `ae-${ev.id}`,
              id: ev.id,
              type: 'all_events',
              slug: detailPath,
              name: ev.name,
              start,
              end: start,
              image: ev.image || '',
              description: ev.description || ''
            })
          })
          ;(geRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
            let image = ''
            if (ev.image_url?.startsWith('http')) image = ev.image_url
            else if (ev.image_url)
              image = supabase.storage.from('big-board').getPublicUrl(ev.image_url).data.publicUrl
            const groupSlug = groupMap[ev.group_id]
            const detailPath =
              getDetailPathForItem({
                ...ev,
                group_slug: groupSlug,
                isGroupEvent: true,
              }) || (groupSlug ? `/groups/${groupSlug}/events/${ev.slug}` : null)
            if (detailPath) {
              merged.push({
                key: `ge-${ev.id}`,
                id: ev.id,
                type: 'group_events',
                slug: detailPath,
                name: ev.title,
                start,
                end,
                image,
                description: ev.description || ''
              })
            }
          })

          merged.push(...expandRecurring(reRes.data || [], todayDate, tomorrow))

          const todayEvents = merged
            .filter(ev => ev.start && ev.start >= todayDate && ev.start < tomorrow)
            .sort((a, b) => a.start - b.start)
          setEvents(todayEvents.slice(0, limit))
          setLoading(false)
          return
        }

        if (!tag) {
          if (onlyEvents) {
            const { data: eRes } = await supabase
              .from('events')
              .select('id, slug, "E Name", Dates, "End Date", "E Image", "E Description"')

            const merged = []
            ;(eRes || []).forEach(e => {
              const start = parseDate(e.Dates)
              const end = e['End Date'] ? parseDate(e['End Date']) : start
              const detailPath =
                getDetailPathForItem({
                  ...e,
                  slug: e.slug,
                }) || `/events/${e.slug}`
              merged.push({
                key: `ev-${e.id}`,
                id: e.id,
                type: 'events',
                slug: detailPath,
                name: e['E Name'],
                start,
                end,
                image: e['E Image'] || '',
                description: e['E Description'] || ''
              })
            })
            const todayDate = new Date(); todayDate.setHours(0,0,0,0)
            const upcoming = merged
              .filter(ev => ev.start && ev.start >= todayDate)
              .sort((a, b) => a.start - b.start)
            setEvents(upcoming.slice(0, limit))
            setLoading(false)
            return
          }

          const [eRes, bbRes, aeRes, geRes, reRes] = await Promise.all([
            supabase
              .from('events')
              .select('id, slug, "E Name", Dates, "End Date", "E Image", "E Description"'),
            supabase
              .from('big_board_events')
              .select('id, title, slug, start_date, end_date, description, big_board_posts!big_board_posts_event_id_fkey(image_url)'),
            supabase
              .from('all_events')
              .select('id, slug, name, start_date, image, description, venue_id(slug)'),
            supabase
              .from('group_events')
              .select('id, title, slug, description, start_date, end_date, image_url, group_id'),
            supabase
              .from('recurring_events')
              .select('id, name, slug, description, image_url, start_date, end_date, start_time, rrule')
              .eq('is_active', true),
          ])

          let groupMap = {}
          if (geRes.data?.length) {
            const groupIds = [...new Set(geRes.data.map(ev => ev.group_id))]
            if (groupIds.length) {
              const { data: groupsData } = await supabase
                .from('groups')
                .select('id, slug')
                .in('id', groupIds)
              groupsData?.forEach(g => { groupMap[g.id] = g.slug })
            }
          }

          const merged = []
            ;(eRes.data || []).forEach(e => {
              const start = parseDate(e.Dates)
              const end = e['End Date'] ? parseDate(e['End Date']) : start
              const detailPath =
                getDetailPathForItem({
                  ...e,
                  slug: e.slug,
                }) || `/events/${e.slug}`
              merged.push({
                key: `ev-${e.id}`,
                id: e.id,
                type: 'events',
                slug: detailPath,
                name: e['E Name'],
                start,
                end,
                image: e['E Image'] || '',
                description: e['E Description'] || ''
              })
            })
            ;(bbRes.data || []).forEach(ev => {
              const start = parseLocalYMD(ev.start_date)
              const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
              const key = ev.big_board_posts?.[0]?.image_url
              const image = key
                ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
                : ''
              const detailPath =
                getDetailPathForItem({
                  ...ev,
                  isBigBoard: true,
                }) || `/big-board/${ev.slug}`
              merged.push({
                key: `bb-${ev.id}`,
                id: ev.id,
                type: 'big_board_events',
                slug: detailPath,
                name: ev.title,
                start,
                end,
                image,
                description: ev.description || ''
              })
            })
            ;(aeRes.data || []).forEach(ev => {
              const start = parseLocalYMD(ev.start_date)
              const venueSlug = ev.venue_id?.slug
              const detailPath =
                getDetailPathForItem({
                  ...ev,
                  venue_slug: venueSlug,
                  venues: ev.venue_id
                    ? { name: ev.venue_id.name, slug: venueSlug }
                    : null,
                }) || (venueSlug ? `/${venueSlug}/${ev.slug}` : `/${ev.slug}`)
              merged.push({
                key: `ae-${ev.id}`,
                id: ev.id,
                type: 'all_events',
                slug: detailPath,
                name: ev.name,
                start,
                end: start,
                image: ev.image || '',
                description: ev.description || ''
              })
            })
            ;(geRes.data || []).forEach(ev => {
              const start = parseLocalYMD(ev.start_date)
              const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
              let image = ''
              if (ev.image_url?.startsWith('http')) image = ev.image_url
              else if (ev.image_url)
                image = supabase.storage.from('big-board').getPublicUrl(ev.image_url).data.publicUrl
              const groupSlug = groupMap[ev.group_id]
              const detailPath =
                getDetailPathForItem({
                  ...ev,
                  group_slug: groupSlug,
                  isGroupEvent: true,
                }) || (groupSlug ? `/groups/${groupSlug}/events/${ev.slug}` : null)
              if (detailPath) {
                merged.push({
                  key: `ge-${ev.id}`,
                  id: ev.id,
                  type: 'group_events',
                  slug: detailPath,
                  name: ev.title,
                  start,
                  end,
                  image,
                  description: ev.description || ''
              })
            }
          })

          merged.push(...expandRecurring(reRes.data || []))

          const todayDate = new Date(); todayDate.setHours(0,0,0,0)
          const upcoming = merged
            .filter(ev => ev.start && ev.start >= todayDate)
            .sort((a, b) => a.start - b.start)
          setEvents(upcoming.slice(0, limit))
          setLoading(false)
          return
        }

        const { data: tagRow } = await supabase
          .from('tags')
          .select('id')
          .eq('slug', tag)
          .single()
        const tagId = tagRow?.id
        if (!tagId) { setEvents([]); setLoading(false); return }

        const allowedTypes = onlyEvents
          ? ['events']
          : ['events', 'big_board_events', 'all_events', 'group_events', 'recurring_events']

        const { data: taggings } = await supabase
          .from('taggings')
          .select('taggable_id, taggable_type')
          .eq('tag_id', tagId)
          .in('taggable_type', allowedTypes)

        const idsByType = { events: [], big_board_events: [], all_events: [], group_events: [], recurring_events: [] }
        ;(taggings || []).forEach(t => {
          if (idsByType[t.taggable_type]) idsByType[t.taggable_type].push(t.taggable_id)
        })

        const [eRes, bbRes, aeRes, geRes, reRes] = await Promise.all([
          allowedTypes.includes('events') && idsByType.events.length
            ? supabase
                .from('events')
                .select('id, slug, "E Name", Dates, "End Date", "E Image", "E Description"')
                .in('id', idsByType.events)
            : { data: [] },
          allowedTypes.includes('big_board_events') && idsByType.big_board_events.length
            ? supabase
                .from('big_board_events')
                .select('id, title, slug, start_date, end_date, description, big_board_posts!big_board_posts_event_id_fkey(image_url)')
                .in('id', idsByType.big_board_events)
            : { data: [] },
          allowedTypes.includes('all_events') && idsByType.all_events.length
            ? supabase
                .from('all_events')
                .select('id, slug, name, start_date, image, description, venue_id(slug)')
                .in('id', idsByType.all_events)
            : { data: [] },
          allowedTypes.includes('group_events') && idsByType.group_events.length
            ? supabase
                .from('group_events')
                .select('id, title, slug, description, start_date, end_date, image_url, group_id')
                .in('id', idsByType.group_events)
            : { data: [] },
          allowedTypes.includes('recurring_events') && idsByType.recurring_events.length
            ? supabase
                .from('recurring_events')
                .select('id, name, slug, description, image_url, start_date, end_date, start_time, rrule')
                .in('id', idsByType.recurring_events)
            : { data: [] },
        ])

        let groupMap = {}
        if (geRes.data?.length) {
          const groupIds = [...new Set(geRes.data.map(ev => ev.group_id))]
          if (groupIds.length) {
            const { data: groupsData } = await supabase
              .from('groups')
              .select('id, slug')
              .in('id', groupIds)
            groupsData?.forEach(g => { groupMap[g.id] = g.slug })
          }
        }

        const merged = []
        if (allowedTypes.includes('events')) {
          ;(eRes.data || []).forEach(e => {
            const start = parseDate(e.Dates)
            const end = e['End Date'] ? parseDate(e['End Date']) : start
            const detailPath =
              getDetailPathForItem({
                ...e,
                slug: e.slug,
              }) || `/events/${e.slug}`
            merged.push({
              key: `ev-${e.id}`,
              id: e.id,
              type: 'events',
              slug: detailPath,
              name: e['E Name'],
              start,
              end,
              image: e['E Image'] || '',
              description: e['E Description'] || ''
            })
          })
        }
        if (allowedTypes.includes('big_board_events')) {
          ;(bbRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
            const key = ev.big_board_posts?.[0]?.image_url
            const image = key
              ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
              : ''
            const detailPath =
              getDetailPathForItem({
                ...ev,
                isBigBoard: true,
              }) || `/big-board/${ev.slug}`
            merged.push({
              key: `bb-${ev.id}`,
              id: ev.id,
              type: 'big_board_events',
              slug: detailPath,
              name: ev.title,
              start,
              end,
              image,
              description: ev.description || ''
            })
          })
        }
        if (allowedTypes.includes('all_events')) {
          ;(aeRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const venueSlug = ev.venue_id?.slug
            const detailPath =
              getDetailPathForItem({
                ...ev,
                venue_slug: venueSlug,
                venues: ev.venue_id
                  ? { name: ev.venue_id.name, slug: venueSlug }
                  : null,
              }) || (venueSlug ? `/${venueSlug}/${ev.slug}` : `/${ev.slug}`)
            merged.push({
              key: `ae-${ev.id}`,
              id: ev.id,
              type: 'all_events',
              slug: detailPath,
              name: ev.name,
              start,
              end: start,
              image: ev.image || '',
              description: ev.description || ''
            })
          })
        }
        if (allowedTypes.includes('group_events')) {
          ;(geRes.data || []).forEach(ev => {
            const start = parseLocalYMD(ev.start_date)
            const end = ev.end_date ? parseLocalYMD(ev.end_date) : start
            let image = ''
            if (ev.image_url?.startsWith('http')) image = ev.image_url
            else if (ev.image_url)
              image = supabase.storage.from('big-board').getPublicUrl(ev.image_url).data.publicUrl
            const groupSlug = groupMap[ev.group_id]
            const detailPath =
              getDetailPathForItem({
                ...ev,
                group_slug: groupSlug,
                isGroupEvent: true,
              }) || (groupSlug ? `/groups/${groupSlug}/events/${ev.slug}` : null)
            if (detailPath) {
              merged.push({
                key: `ge-${ev.id}`,
                id: ev.id,
                type: 'group_events',
                slug: detailPath,
                name: ev.title,
                start,
                end,
                image,
                description: ev.description || ''
              })
            }
          })
        }
        if (allowedTypes.includes('recurring_events')) {
          merged.push(...expandRecurring(reRes.data || []))
        }

        const todayDate = new Date(); todayDate.setHours(0,0,0,0)
        const upcoming = merged
          .filter(ev => ev.start && ev.start >= todayDate)
          .sort((a, b) => a.start - b.start)
        setEvents(upcoming.slice(0, limit))
        setLoading(false)
      } catch (err) {
        console.error(err)
        setEvents([])
        setLoading(false)
      }
    })()
  }, [tag, onlyEvents, weekend, today, sunday, limit])

  useEffect(() => {
    if (!events.length) { setTagMap({}); return }

    const idsByType = {
      events: [],
      big_board_events: [],
      all_events: [],
      group_events: [],
      recurring_events: [],
      games: []
    }

    events.forEach(ev => {
      if (idsByType[ev.type]) idsByType[ev.type].push(ev.id)
    })

    const fetches = Object.entries(idsByType)
      .filter(([, ids]) => ids.length)
      .map(([type, ids]) =>
        supabase
          .from('taggings')
          .select('taggable_id, tags(name,slug)')
          .eq('taggable_type', type)
          .in('taggable_id', ids)
          .then(({ data, error }) => {
            if (error) { console.error('tags load error', error); return [] }
            return data.map(r => ({ ...r, type }))
          })
      )

    Promise.all(fetches).then(results => {
      const map = {}
      results.flat().forEach(({ taggable_id, tags, type }) => {
        const key = `${type}-${taggable_id}`
        if (!map[key]) map[key] = []
        map[key].push(tags)
      })
      setTagMap(map)
    })
  }, [events])

  useEffect(() => {
    if (!events.length) { setSlides([]); return }
    if (tag === 'fitness' && groups.length) {
      const combined = []
      let gIdx = 0
      const sampleGroups = () => {
        const shuffled = [...groups].sort(() => Math.random() - 0.5)
        return shuffled.slice(0,5)
      }
      for (let i = 0; i < events.length; i++) {
        if (i > 0 && i % 4 === 0) {
          const sample = sampleGroups()
          if (sample.length) {
            combined.push({ slideType: 'groups', key: `g-${gIdx++}`, groups: sample })
          }
        }
        combined.push({ slideType: 'event', ...events[i] })
      }
      setSlides(combined)
    } else {
      setSlides(events.map(ev => ({ slideType: 'event', ...ev })))
    }
  }, [events, groups, tag])

  useEffect(() => {
    setCurrent(0)
  }, [slides.length])

  useEffect(() => {
    if (!slides.length) return
    setAdded(false)
    const borderTimer = setTimeout(() => setAdded(true), 1000)
    const currentSlide = slides[current]
    const delay = currentSlide?.slideType === 'groups' ? 3000 : 2000
    const slideTimer = setTimeout(() => {
      setCurrent(c => (c + 1) % slides.length)
    }, delay)
    return () => {
      clearTimeout(borderTimer)
      clearTimeout(slideTimer)
    }
  }, [current, slides])

  useEffect(() => {
    const el = containerRef.current
    if (el) {
      el.scrollTo({ left: current * el.clientWidth, behavior: 'smooth' })
    }
  }, [current])

    return (
      <div className="relative flex flex-col min-h-screen overflow-x-hidden">
        <Navbar />

        <div className="pill-container fixed inset-0 pointer-events-none z-0">
          {pillConfigs.map((p, i) => (
            <span
              key={i}
              className="pill"
              style={{
                left: `${p.left}%`,
                backgroundColor: p.color,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            >
              #{p.name}
            </span>
          ))}
        </div>

        <div
          className="bg-[#ba3d36] text-white py-3 text-center font-[Barrio] text-lg z-10"
          style={{ marginTop: navHeight }}
        >
          {headline || (tag ? `Upcoming #${tag} events in Philly` : 'Upcoming events in Philly')}
        </div>

        <div
          className="flex-1 overflow-hidden relative z-10 pb-16"
          style={{ height: `calc(100dvh - ${navHeight}px)` }}
        >
          {loading ? (
            <p className="text-center py-20">Loading…</p>
          ) : (
            <div ref={containerRef} className="flex w-full h-full overflow-hidden">
              {slides.map((slide, idx) => (
                slide.slideType === 'event' ? (
                  <div
                    key={slide.key}
                    className="flex-shrink-0 w-full h-full flex items-center justify-center p-4"
                    style={{ minWidth: '100%' }}
                  >
                    <div
                      className={`plans-carousel-card w-11/12 max-w-md mx-auto flex flex-col overflow-hidden rounded-xl bg-white transition-all duration-500 ${
                        idx === current && added
                          ? 'border-4 border-indigo-600'
                          : 'border border-transparent'
                      }`}
                      style={{ maxHeight: 'calc(100dvh - var(--bottom-bar, 5rem) - env(safe-area-inset-bottom))' }}
                    >
                      {slide.image && (
                        <div className="shrink-0 relative w-full aspect-video">
                          <img
                            src={slide.image}
                            alt={slide.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-center">
                        <h3 className="font-bold text-xl">{slide.name}</h3>
                        <p className="text-gray-700 mb-4">{formatDate(slide.start)}</p>
                      </div>
                      <div className="shrink-0 border-t p-3 bg-white">
                        <button
                          className={`w-full border rounded-md py-2 font-semibold transition-colors ${
                            idx === current && added
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-indigo-600 border-indigo-600'
                          }`}
                        >
                          {idx === current && added ? 'In the Plans' : 'Add to Plans'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={slide.key}
                    className="flex-shrink-0 w-full h-full flex items-center justify-center p-4"
                    style={{ minWidth: '100%' }}
                  >
                    <div className="w-11/12 max-w-md mx-auto bg-white rounded-xl overflow-hidden border">
                      <p className="px-4 py-2 font-semibold">#fitness groups in the city</p>
                      {slide.groups.map(g => (
                        <Link
                          key={g.id}
                          to={`/groups/${g.slug}`}
                          className="block px-4 py-3 border-t first:border-t-0"
                        >
                          <p className="font-semibold">{g.Name}</p>
                          <p className="text-xs text-gray-600">{g.Type}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {events.length > 0 && (
          <>
            <div className="px-4 py-8 z-10" ref={listRef}>
              {events.map(ev => (
                <p key={`list-${ev.key}`} className="mb-4">
                  {ev.name}, {formatDate(ev.start)}
                  {ev.description ? `: ${ev.description}` : ''}
                  {(() => {
                    const tags = tagMap[`${ev.type}-${ev.id}`] || []
                    return tags.length ? ' ' + tags.map(t => `#${t.slug}`).join(' ') : ''
                  })()}
                </p>
              ))}
            </div>
            {tag === 'fitness' && (
              <div className="px-4 pb-8 z-10">
                <button
                  className="w-full border rounded-md py-2 font-semibold text-indigo-600 border-indigo-600"
                  onClick={() => {
                    const text = Array.from(listRef.current.querySelectorAll('p'))
                      .map(p => p.innerText)
                      .join('\n')
                    navigator.clipboard.writeText(text)
                  }}
                >
                  Copy Text
                </button>
              </div>
            )}
          </>
        )}

        <div className="mb-96"></div>

        <div className="fixed bottom-0 w-full bg-gray-200 text-center py-3 font-[Barrio] text-lg text-gray-800 z-20">
          make your Philly plans at ourphilly.org
        </div>

        <style>{`
          .pill {
            position: absolute;
            top: -3rem;
            padding: .5rem 1rem;
            border-radius: 9999px;
            color: #fff;
            font-size: 1.25rem;
            white-space: nowrap;
            opacity: .15;
            animation-name: fall;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
          @keyframes fall {
            to { transform: translateY(110vh); }
          }
        `}</style>
        <style>{`
          @supports not (height: 100dvh) {
            .plans-carousel-card {
              max-height: calc(100vh - var(--bottom-bar, 5rem));
            }
          }
        `}</style>
      </div>
    )
  }

