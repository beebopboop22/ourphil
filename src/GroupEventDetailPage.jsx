// src/GroupEventDetailPage.jsx
import React, { useEffect, useState, useContext } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, ExternalLink, MapPin } from 'lucide-react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import { AuthContext } from './AuthProvider'
import Seo from './components/Seo.jsx'
import PlansCard from './components/PlansCard.jsx'
import useEventFavorite from './utils/useEventFavorite'
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
  buildIsoDateTime,
} from './utils/seoHelpers.js'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'

const FALLBACK_GROUP_EVENT_TITLE = 'Group Event – Our Philly'
const FALLBACK_GROUP_EVENT_DESCRIPTION =
  'Discover events hosted by Philadelphia community groups on Our Philly.'

const pillStyles = [
  'bg-red-100 text-red-800',
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
]

// parse "YYYY-MM-DD" or "MM/DD/YYYY"
function parseYMD(str) {
  if (!str) return null
  if (str.includes('-')) {
    const [y,m,d] = str.split('-').map(Number)
    return new Date(y, m-1, d)
  }
  const [m,d,y] = str.split('/').map(Number)
  return new Date(y, m-1, d)
}

// format "HH:MM" into "h:mm a.m./p.m."
function formatTime(t) {
  if (!t) return ''
  let [h,m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`
}

function parseLegacyDate(str) {
  if (!str) return null
  const [first] = str.split(/through|–|-/)
  const parts = first.trim().split('/')
  if (parts.length !== 3) return null
  const [m, d, y] = parts.map(Number)
  const dt = new Date(y, m - 1, d)
  return isNaN(dt) ? null : dt
}

function resolveGroupEventImage(imageUrl) {
  if (!imageUrl) return ''
  if (imageUrl.startsWith('http')) return imageUrl
  const { data } = supabase.storage.from('big-board').getPublicUrl(imageUrl)
  return data?.publicUrl || ''
}

export default function GroupEventDetailPage() {
  const { slug, eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [group, setGroup] = useState(null)
  const [evt,   setEvt]   = useState(null)
  const [loading, setLoading] = useState(true)

  const [tagsList, setTagsList]         = useState([])
  const [selectedTags, setSelectedTags] = useState([])

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData]   = useState({})
  const [saving, setSaving]       = useState(false)

  const [subs, setSubs]             = useState([])
  const [loadingSubs, setLoadingSubs] = useState(true)
  const [moreEvents, setMoreEvents] = useState([])
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false)
  const [navOffset, setNavOffset] = useState(0)

  const {
    isFavorite,
    toggleFavorite,
    loading: togglingFavorite,
  } = useEventFavorite({ event_id: evt?.id, source_table: 'group_events' })

  // ── LOAD GROUP, EVENT, TAGS, IMAGE ─────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      // 1) group
      const { data: grp } = await supabase
        .from('groups')
        .select('id,Name,slug,Description,imag')
        .eq('slug', slug)
        .single()

      // 2) event
      const { data: ev } = await supabase
        .from('group_events_calendar')
        .select('*')
        .eq('id', eventId)
        .single()

      if (!ev) {
        setEvt(null)
        setLoading(false)
        return
      }

      let eventLink = ev?.link ?? null
      if (!eventLink) {
        const { data: baseEvent } = await supabase
          .from('group_events')
          .select('link')
          .eq('id', eventId)
          .single()
        eventLink = baseEvent?.link ?? null
      }

      // 3) existing taggings
      const { data: tgs } = await supabase
        .from('taggings')
        .select('tag_id')
        .eq('taggable_type','group_events')
        .eq('taggable_id', ev.id)

      // 4) all tags
      const { data: allTags } = await supabase
        .from('tags')
        .select('id,name')

      // 5) resolve public URL
      let evImgUrl = ''
      if (ev.image_url) {
        if (ev.image_url.startsWith('http')) {
          // already a full URL
          evImgUrl = ev.image_url
        } else {
          // storage key → public URL
          evImgUrl = supabase
            .storage
            .from('big-board')
            .getPublicUrl(ev.image_url)
            .data
            .publicUrl
        }
      }

      setGroup(grp)
      setEvt({ ...ev, image: evImgUrl, link: eventLink || null })
      setSelectedTags(tgs?.map(x=>x.tag_id) || [])
      setTagsList(allTags || [])
      setLoading(false)
    }
    load()
  }, [slug, eventId])

  // ── LOAD COMMUNITY SUBMISSIONS ──────────────────────────────────────
  useEffect(() => {
    async function loadSubs() {
      setLoadingSubs(true)
      const today = new Date().toISOString().slice(0,10)
      const { data:list } = await supabase
        .from('big_board_events')
        .select('id,post_id,title,start_date,slug')
        .gte('start_date', today)
        .order('start_date',{ ascending:true })
        .limit(32)

      const enriched = await Promise.all(
        (list||[]).map(async item => {
          const { data:p } = await supabase
            .from('big_board_posts')
            .select('image_url')
            .eq('id', item.post_id)
            .single()
          let url = ''
          if (p?.image_url) {
            const { data:{ publicUrl }} = supabase
              .storage.from('big-board')
              .getPublicUrl(p.image_url)
            url = publicUrl
          }
          return { ...item, image: url }
        })
      )

      setSubs(enriched)
      setLoadingSubs(false)
    }
    loadSubs()
  }, [])

  useEffect(() => {
    if (!group?.id || !evt?.id) return
    let active = true

    const loadMore = async () => {
      setLoadingMoreEvents(true)
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString().slice(0, 10)
        const { data, error } = await supabase
          .from('group_events_calendar')
          .select('*')
          .eq('group_id', group.id)
          .neq('id', evt.id)
          .gte('start_date', todayStr)
          .order('start_date', { ascending: true })
          .limit(4)
        if (error) throw error
        const mapped = (data || []).map(item => {
          const image =
            resolveGroupEventImage(item.image_url) || evt.image || group.imag || ''
          const href =
            getDetailPathForItem({
              ...item,
              group_slug: group.slug,
              isGroupEvent: true,
            }) || `/groups/${group.slug}/events/${item.id}`
          return { ...item, image, href }
        })
        if (active) setMoreEvents(mapped)
      } catch (err) {
        console.error('Error loading more group events:', err)
        if (active) setMoreEvents([])
      } finally {
        if (active) setLoadingMoreEvents(false)
      }
    }

    loadMore()
    return () => {
      active = false
    }
  }, [group?.id, group?.slug, group?.imag, evt?.id, evt?.image])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const measure = () => {
      const navEl = document.querySelector('nav')
      if (!navEl) return
      setNavOffset(navEl.getBoundingClientRect().height)
    }

    measure()

    const handleResize = () => measure()
    window.addEventListener('resize', handleResize)

    let observer
    const navEl = document.querySelector('nav')
    if (typeof ResizeObserver !== 'undefined' && navEl) {
      observer = new ResizeObserver(measure)
      observer.observe(navEl)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (observer) observer.disconnect()
    }
  }, [])

  // ── EDIT HANDLERS ─────────────────────────────────────────────────
  const startEditing = () => {
    setFormData({
      title:       evt.title,
      description: evt.description||'',
      address:     evt.address||'',
      start_date:  evt.start_date||'',
      end_date:    evt.end_date||'',
      start_time:  evt.start_time||'',
      end_time:    evt.end_time||''
    })
    setIsEditing(true)
  }
  const handleChange = e => {
    const { name, value } = e.target
    setFormData(fd => ({ ...fd, [name]: value }))
  }
  const toggleTag = id => {
    setSelectedTags(sel =>
      sel.includes(id) ? sel.filter(x=>x!==id) : [...sel, id]
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // 1) update event
      const payload = {
        title:       formData.title,
        description: formData.description,
        address:     formData.address||null,
        start_date:  formData.start_date,
        end_date:    formData.end_date||null,
        start_time:  formData.start_time||null,
        end_time:    formData.end_time||null,
      }
      const { data: updated, error: updErr } = await supabase
        .from('group_events')
        .update(payload)
        .select('*')
        .eq('id', evt.id)
        .single()

      if (updErr) throw updErr

      // 2) reset taggings
      await supabase
        .from('taggings')
        .delete()
        .eq('taggable_type','group_events')
        .eq('taggable_id', evt.id)

      if (selectedTags.length) {
        const ins = selectedTags.map(tag_id => ({
          tag_id, taggable_type:'group_events', taggable_id:evt.id
        }))
        await supabase.from('taggings').insert(ins)
      }

      // 3) re-resolve image public URL
      const imageKey = updated.image_url || evt.image_url
      let publicUrl = ''
      if (imageKey) {
        publicUrl = supabase
          .storage.from('big-board')
          .getPublicUrl(imageKey).data.publicUrl
      }

      // 4) update state & exit edit mode
      setEvt({ ...updated, image: publicUrl })
      setIsEditing(false)
    } catch(err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return
    await supabase
      .from('group_events')
      .delete()
      .eq('id', evt.id)
    navigate(`/groups/${group.slug}`)
  }

  const canonicalUrl = `${SITE_BASE_URL}/groups/${slug}/events/${eventId}`
  const eventTitle = evt?.title?.trim?.() ? evt.title.trim() : evt?.title || ''
  const groupName = group?.Name?.trim?.() ? group.Name.trim() : group?.Name || ''
  const seoTitle = eventTitle
    ? `${eventTitle} – ${groupName || 'Our Philly'}`
    : FALLBACK_GROUP_EVENT_TITLE
  const seoDescription =
    (evt?.description && evt.description.trim()) ||
    (group?.Description && group.Description.trim()) ||
    FALLBACK_GROUP_EVENT_DESCRIPTION
  const resolvedImage = ensureAbsoluteUrl(evt?.image || evt?.image_url)
  const ogImage = resolvedImage || DEFAULT_OG_IMAGE
  const startIso = buildIsoDateTime(evt?.start_date, evt?.start_time)
  const endIso = buildIsoDateTime(
    evt?.end_date || evt?.start_date,
    evt?.end_time || evt?.start_time
  )
  const eventJsonLd = evt?.start_date
    ? buildEventJsonLd({
        name: eventTitle || 'Group Event',
        canonicalUrl,
        startDate: startIso || evt.start_date,
        endDate: endIso || evt.end_date || evt.start_date,
        locationName: evt?.address || groupName || 'Philadelphia',
        description: seoDescription,
        image: ogImage,
      })
    : null
  const stickyStyle = { top: `${navOffset}px` }
  const mainStyle = { paddingTop: `${navOffset}px` }

  let content
  if (loading) {
    content = (
      <div className="py-20 text-center text-gray-500">Loading…</div>
    )
  } else if (!group || !evt) {
    content = (
      <div className="py-20 text-center text-gray-500">
        Group event not found.
      </div>
    )
  } else {
    const startDate = parseYMD(evt.start_date) || new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.round((startDate - today) / (1000 * 60 * 60 * 24))
    const when =
      diff === 0
        ? 'Today'
        : diff === 1
        ? 'Tomorrow'
        : startDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
    const t1 = formatTime(evt.start_time)
    const t2 = formatTime(evt.end_time)
    const timeRange = t1 && t2 ? `${t1} – ${t2}` : t1 || ''
    const dateTimeDisplay = [when, timeRange].filter(Boolean).join(' · ')
    const locationDisplay = evt.address?.trim() || ''
    const mapsUrl = locationDisplay
      ? `https://maps.google.com?q=${encodeURIComponent(locationDisplay)}`
      : ''
    const aboutText = group?.Description?.trim?.()
      ? group.Description.trim()
      : 'Learn more about this group and explore their upcoming events.'
    const descriptionText = evt?.description?.trim?.()
      ? evt.description.trim()
      : 'Details coming soon.'

    content = (
      <>
        <header className="sticky z-40" style={stickyStyle}>
          <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-indigo-600">
                  Created by{' '}
                  <Link to={`/groups/${group.slug}`} className="hover:underline">
                    {group.Name}
                  </Link>
                </p>
                <h1 className="mt-2 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                  {evt.title}
                </h1>
                <div className="mt-2 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  {dateTimeDisplay && (
                    <span className="font-medium text-gray-900">{dateTimeDisplay}</span>
                  )}
                  {locationDisplay && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                    >
                      <MapPin className="h-4 w-4 text-rose-500" aria-hidden="true" />
                      <span className="truncate">{locationDisplay}</span>
                    </a>
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsList
                      .filter(tag => selectedTags.includes(tag.id))
                      .map((tg, i) => (
                        <span
                          key={tg.id}
                          className={`${pillStyles[i % pillStyles.length]} px-3 py-1 rounded-full text-xs font-semibold`}
                        >
                          #{tg.name}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="hidden sm:flex flex-shrink-0 items-center">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  disabled={togglingFavorite}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
                    isFavorite
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  } ${togglingFavorite ? 'opacity-70' : ''}`}
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {!user && (
          <div className="mt-6 w-full bg-indigo-600 py-4 text-center text-xl text-white sm:text-2xl">
            <Link to="/login" className="font-semibold underline">
              Log in
            </Link>{' '}
            or{' '}
            <Link to="/signup" className="font-semibold underline">
              sign up
            </Link>{' '}
            free to add to your Plans
          </div>
        )}

        <div className="mx-auto mt-8 w-full max-w-5xl px-4 pb-8 sm:pb-12">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Event title"
                    className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Description"
                    className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows="4"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Address"
                    className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Tags</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tagsList.map((tg, i) => {
                      const sel = selectedTags.includes(tg.id)
                      const cls = sel
                        ? pillStyles[i % pillStyles.length]
                        : 'bg-gray-200 text-gray-700'
                      return (
                        <button
                          key={tg.id}
                          type="button"
                          onClick={() => toggleTag(tg.id)}
                          className={`${cls} px-3 py-1 rounded-full text-sm font-medium transition hover:opacity-80`}
                        >
                          #{tg.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start date</label>
                  <input
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End date</label>
                  <input
                    name="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start time</label>
                  <input
                    name="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End time</label>
                  <input
                    name="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded bg-indigo-600 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded bg-gray-200 py-2 font-semibold text-gray-800 transition hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="space-y-8">
                <section>
                  <h2 className="text-xl font-semibold text-gray-900">About this Group</h2>
                  <p className="mt-3 text-gray-700 whitespace-pre-line">{aboutText}</p>
                </section>

                <section className="space-y-4">
                  <div className="sm:hidden">
                    <button
                      type="button"
                      onClick={toggleFavorite}
                      disabled={togglingFavorite}
                      className={`w-full rounded-full border border-indigo-600 px-4 py-2 font-semibold transition ${
                        isFavorite
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-600 hover:bg-indigo-50'
                      } disabled:opacity-50`}
                    >
                      <CalendarCheck className="mr-2 inline h-4 w-4" aria-hidden="true" />
                      {isFavorite ? 'In the Plans' : 'Add to Plans'}
                    </button>
                  </div>

                  <h2 className="text-xl font-semibold text-gray-900">Event Description</h2>
                  <p className="text-gray-700 whitespace-pre-line">{descriptionText}</p>

                  {evt.link && (
                    <a
                      href={ensureAbsoluteUrl(evt.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-indigo-600 px-4 py-2 font-semibold text-indigo-600 transition hover:bg-indigo-50 sm:w-auto"
                    >
                      <ExternalLink className="h-5 w-5" />
                      Visit Site
                    </a>
                  )}

                  {evt.user_id === user?.id && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        onClick={startEditing}
                        className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"
                      >
                        Edit event
                      </button>
                      <button
                        onClick={handleDelete}
                        className="rounded bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </section>
              </div>
              <div className="flex flex-col items-stretch gap-4">
                {evt.image ? (
                  <img
                    src={evt.image}
                    alt={evt.title}
                    className="w-full rounded-xl object-cover shadow"
                  />
                ) : (
                  <div className="flex h-64 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-500">
                    Event image coming soon
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {(loadingMoreEvents || moreEvents.length > 0) && (
          <section className="w-full bg-neutral-100 py-12 border-t border-neutral-200">
            <div className="max-w-7xl mx-auto px-4">
              <h2 className="text-2xl font-semibold text-center mb-6">
                More from {group?.Name || 'this group'}
              </h2>
              {loadingMoreEvents ? (
                <p className="text-center text-gray-500">Loading…</p>
              ) : moreEvents.length === 0 ? (
                <p className="text-center text-gray-600">
                  No other upcoming events from this group.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {moreEvents.map(ev => {
                    const start = parseYMD(ev.start_date)
                    const dateLabel = start
                      ? start.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                      : ''
                    const timeLabel = formatTime(ev.start_time)
                    const secondary = [timeLabel, ev.address].filter(Boolean).join(' · ')
                    return (
                      <PlansCard
                        key={ev.id}
                        title={ev.title}
                        imageUrl={ev.image}
                        href={ev.href}
                        badge={{ label: 'Group Event', className: 'bg-emerald-500 text-white' }}
                        meta={dateLabel}
                        secondaryMeta={secondary}
                        eventId={ev.id}
                        sourceTable="group_events"
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="w-full bg-neutral-100 py-12 border-t border-neutral-200">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-semibold text-center mb-6">
              Upcoming Community Submissions
            </h2>
            {loadingSubs ? (
              <p className="text-center text-gray-500">Loading…</p>
            ) : subs.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming submissions.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {subs.map(s => {
                  const d = parseYMD(s.start_date)
                  const label = d
                    ? d.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : ''
                  return (
                    <PlansCard
                      key={s.id}
                      title={s.title}
                      imageUrl={s.image}
                      href={`/big-board/${s.slug}`}
                      badge="Submission"
                      meta={label}
                      eventId={s.id}
                      sourceTable="big_board_events"
                    />
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="event"
        jsonLd={eventJsonLd}
      />

      <Navbar />

      <main className="flex-grow relative pb-24 sm:pb-0" style={mainStyle}>
        {content}
      </main>

      <Footer />
    </div>
  )
}
