import React, { useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import Seo from './components/Seo.jsx'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider.jsx'
import { COMMUNITY_REGIONS } from './communityIndexData.js'
import { getDetailPathForItem } from './utils/eventDetailPaths.js'

const REVIEW_CHUNK_SIZE = 50
const SITE_BASE_URL = 'https://www.ourphilly.org'

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
  const { user } = useContext(AuthContext)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [traditions, setTraditions] = useState([])
  const [groups, setGroups] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [photos, setPhotos] = useState([])

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
        const [traditionsRes, groupsRes, postsRes] = await Promise.all([
          supabase.from('events').select('*'),
          supabase.from('groups').select('*'),
          supabase
            .from('big_board_posts')
            .select(
              'id, image_url, Area, created_at, big_board_events!big_board_posts_event_id_fkey(title, slug)'
            )
            .order('created_at', { ascending: false })
            .limit(60),
        ])

        if (!isActive) return

        if (traditionsRes.error) console.error('Traditions load error', traditionsRes.error)
        if (groupsRes.error) console.error('Groups load error', groupsRes.error)
        if (postsRes.error) console.error('Community photo load error', postsRes.error)

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
          .slice(0, 3)
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

        const combined = dedupeByUrl([...reviewPhotos, ...postPhotos]).slice(0, 18)
        setPhotos(combined)
      } catch (err) {
        if (!isActive) return
        console.error('Community index load error', err)
        setError('We had trouble loading this region. Please try again soon.')
        setTraditions([])
        setGroups([])
        setUpcoming([])
        setPhotos([])
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
  const featuredGroups = groups.slice(0, 4)
  const allTraditions = traditions
  const allGroups = groups

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
              {region.heroDescription}{' '}
              <Link to="/philadelphia-events/" className="text-indigo-600 underline font-medium">
                Browse the citywide traditions calendar
              </Link>{' '}
              or hop into the{' '}
              <Link to="/groups" className="text-indigo-600 underline font-medium">
                full groups directory
              </Link>{' '}
              for even more crews to join.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-white shadow-sm border border-indigo-100 p-6">
                <p className="text-sm uppercase tracking-wide text-indigo-500">Traditions</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{loading ? '—' : traditionsCount}</p>
                <p className="mt-2 text-sm text-gray-600">Legacy events and annual staples rooted in {region.name}.</p>
              </div>
              <div className="rounded-2xl bg-white shadow-sm border border-indigo-100 p-6">
                <p className="text-sm uppercase tracking-wide text-indigo-500">Groups</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{loading ? '—' : groupsCount}</p>
                <p className="mt-2 text-sm text-gray-600">Neighborhood collectives, teams, and volunteer crews.</p>
              </div>
              <div className="rounded-2xl bg-white shadow-sm border border-indigo-100 p-6">
                <p className="text-sm uppercase tracking-wide text-indigo-500">Coming Up</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{loading ? '—' : upcoming.length || 0}</p>
                <p className="mt-2 text-sm text-gray-600">Next traditions on the calendar for {region.name}.</p>
              </div>
            </div>

            {!user && (
              <div className="mt-10">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition"
                >
                  Sign Up to Add Yours
                </Link>
                <p className="mt-2 text-sm text-gray-600">
                  Already contributing photos or events?{' '}
                  <Link to="/login" className="text-indigo-600 underline">
                    Log in here
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="max-w-screen-xl mx-auto px-4 py-16">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <h2 className="text-3xl font-[Barrio] text-gray-900">Coming Up in {region.name}</h2>
            <Link to="/this-weekend-in-philadelphia/" className="text-indigo-600 underline text-sm font-medium">
              See more weekend picks
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-600">Loading events…</p>
          ) : upcoming.length === 0 ? (
            <p className="text-gray-600">No upcoming traditions are scheduled right now. Check back soon or explore the citywide calendar.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {upcoming.map(tradition => {
                const href = getDetailPathForItem({ ...tradition, source_table: 'events' }) || '/events'
                const image = tradition['E Image'] || tradition.image_url || tradition.image
                const start = tradition.__startDate
                const end = tradition.__endDate || tradition.__startDate
                return (
                  <Link
                    key={tradition.id}
                    to={href}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition flex flex-col"
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
          )}
        </section>

        <section className="bg-white border-t border-b border-gray-100">
          <div className="max-w-screen-xl mx-auto px-4 py-16">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
              <h2 className="text-3xl font-[Barrio] text-gray-900">Featured Groups</h2>
              <Link to="/groups" className="text-indigo-600 underline text-sm font-medium">
                Explore all Philly groups
              </Link>
            </div>
            {loading ? (
              <p className="text-gray-600">Loading groups…</p>
            ) : featuredGroups.length === 0 ? (
              <p className="text-gray-600">No groups have been added for this region yet. Know one? Sign up and share it.</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {featuredGroups.map(group => (
                  <Link
                    key={group.id}
                    to={`/groups/${group.slug}`}
                    className="bg-indigo-50/40 hover:bg-indigo-100 transition border border-indigo-100 rounded-2xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-square bg-white overflow-hidden">
                      {group.imag ? (
                        <img
                          src={group.imag}
                          alt={group.Name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-indigo-400 text-sm">No photo yet</div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <p className="text-xs uppercase tracking-wide text-indigo-500">Local Group</p>
                      <h3 className="mt-2 text-lg font-semibold text-gray-900">{group.Name}</h3>
                      {group.Type && (
                        <p className="mt-2 text-xs font-medium text-indigo-700 uppercase">{group.Type}</p>
                      )}
                      <p className="mt-3 text-sm text-gray-700 flex-1">
                        {buildSummary(group.Description || '')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="max-w-screen-xl mx-auto px-4 py-16">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-[Barrio] text-gray-900 mb-6">All Traditions</h2>
              {loading ? (
                <p className="text-gray-600">Loading traditions…</p>
              ) : allTraditions.length === 0 ? (
                <p className="text-gray-600">We have not logged any traditions here yet. Add one to help neighbors discover it.</p>
              ) : (
                <ul className="space-y-5">
                  {allTraditions.map(tradition => {
                    const href = getDetailPathForItem({ ...tradition, source_table: 'events' }) || '/events'
                    const start = tradition.__startDate
                    const end = tradition.__endDate || tradition.__startDate
                    return (
                      <li key={tradition.id} className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition">
                        <Link to={href} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-indigo-500">
                              {formatDateRange(start, end)}
                            </p>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {tradition['E Name'] || tradition.name || 'Community Tradition'}
                            </h3>
                          </div>
                          <span className="text-sm font-medium text-indigo-600">View tradition →</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-3xl font-[Barrio] text-gray-900 mb-6">All Groups</h2>
              {loading ? (
                <p className="text-gray-600">Loading groups…</p>
              ) : allGroups.length === 0 ? (
                <p className="text-gray-600">No groups have been tagged for this area yet. Know a crew? Share it with the community.</p>
              ) : (
                <ul className="space-y-5">
                  {allGroups.map(group => (
                    <li key={group.id} className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition">
                      <Link to={`/groups/${group.slug}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-indigo-500">Community Group</p>
                          <h3 className="text-lg font-semibold text-gray-900">{group.Name}</h3>
                          {group.Type && (
                            <p className="mt-1 text-sm text-gray-600">{group.Type}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium text-indigo-600">View group →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((photo, index) => {
                  const Wrapper = photo.href ? Link : 'div'
                  const wrapperProps = photo.href
                    ? { to: photo.href }
                    : {}
                  return (
                    <Wrapper
                      key={`${photo.url}-${index}`}
                      {...wrapperProps}
                      className={`group relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white ${
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

        {error && (
          <section className="max-w-screen-xl mx-auto px-4 pb-16">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
              {error}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
