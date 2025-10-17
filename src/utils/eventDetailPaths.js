const INTERNAL_PATH_REGEX = /^\//

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizePath(path) {
  if (!isNonEmptyString(path)) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const hostname = url.hostname.toLowerCase()
      if (hostname === 'ourphilly.org' || hostname === 'www.ourphilly.org') {
        const relative = `${url.pathname || '/'}` + `${url.search}` + `${url.hash}`
        const normalizedRelative = relative.startsWith('/') ? relative : `/${relative}`
        return INTERNAL_PATH_REGEX.test(normalizedRelative) ? normalizedRelative : null
      }
    } catch (err) {
      // fall through to null below for malformed URLs
    }
    return null
  }
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return INTERNAL_PATH_REGEX.test(normalized) ? normalized : null
}

function pickSlug(candidate) {
  if (isNonEmptyString(candidate)) return candidate.trim()
  if (candidate && typeof candidate === 'object') {
    if (isNonEmptyString(candidate.slug)) return candidate.slug.trim()
    if (Array.isArray(candidate) && candidate.length) {
      for (const entry of candidate) {
        const slug = pickSlug(entry)
        if (slug) return slug
      }
    }
  }
  return null
}

function extractGroupSlug(item) {
  return (
    pickSlug(item.group_slug) ||
    pickSlug(item.groupSlug) ||
    pickSlug(item.group) ||
    pickSlug(item.groups) ||
    null
  )
}

function extractVenueSlug(item) {
  return (
    pickSlug(item.venue_slug) ||
    pickSlug(item.venueSlug) ||
    pickSlug(item.venue) ||
    pickSlug(item.venues) ||
    (item.venue_id ? pickSlug(item.venue_id) : null) ||
    null
  )
}

function extractSlug(item) {
  return (
    pickSlug(item.slug) ||
    pickSlug(item.event_slug) ||
    pickSlug(item.eventSlug) ||
    null
  )
}

function extractGroupEventId(item) {
  if (isNonEmptyString(item.event_id)) return item.event_id.trim()
  if (typeof item.event_id === 'number') return String(item.event_id)
  if (isNonEmptyString(item.eventId)) return item.eventId.trim()
  if (typeof item.eventId === 'number') return String(item.eventId)
  if (typeof item.id === 'number') return String(item.id)
  if (isNonEmptyString(item.id) && !item.id.includes('::')) return item.id.trim()
  return null
}

function extractOccurrenceDate(item) {
  if (isNonEmptyString(item.date)) return item.date.trim()
  if (isNonEmptyString(item.start_date)) return item.start_date.trim()
  if (isNonEmptyString(item.startDate)) return item.startDate.trim()
  if (isNonEmptyString(item.occurrence_date)) return item.occurrence_date.trim()
  if (isNonEmptyString(item.occurrenceDate)) return item.occurrenceDate.trim()
  if (isNonEmptyString(item.next_start_date)) return item.next_start_date.trim()
  if (isNonEmptyString(item.nextStartDate)) return item.nextStartDate.trim()
  if (isNonEmptyString(item.id) && item.id.includes('::')) {
    const [, datePart] = item.id.split('::')
    if (datePart) return datePart.trim()
  }
  return null
}

function looksLikeGroupEvent(item) {
  return (
    item?.isGroupEvent === true ||
    item?.source_table === 'group_events' ||
    item?.sourceTable === 'group_events' ||
    item?.table === 'group_events'
  )
}

function looksLikeRecurring(item) {
  return (
    item?.isRecurring === true ||
    item?.rrule ||
    item?.source_table === 'recurring_events' ||
    item?.sourceTable === 'recurring_events' ||
    item?.table === 'recurring_events'
  )
}

function looksLikeBigBoard(item) {
  return (
    item?.isBigBoard === true ||
    item?.source_table === 'big_board_events' ||
    item?.sourceTable === 'big_board_events' ||
    item?.table === 'big_board_events' ||
    item?.post_id ||
    item?.postId
  )
}

function looksLikeLegacyEvent(item) {
  return (
    item?.isTradition === true ||
    item?.source_table === 'events' ||
    item?.sourceTable === 'events' ||
    item?.table === 'events' ||
    isNonEmptyString(item?.['E Name'])
  )
}

function looksLikeSeasonal(item) {
  return (
    item?.isSeasonal === true ||
    item?.source_table === 'seasonal_events' ||
    item?.sourceTable === 'seasonal_events' ||
    item?.table === 'seasonal_events'
  )
}

function looksLikeSports(item) {
  return (
    item?.isSports === true ||
    item?.source_table === 'sports_events' ||
    item?.sourceTable === 'sports_events'
  )
}

export function getDetailPathForItem(item) {
  if (!item) return null

  if (typeof item === 'string') return normalizePath(item)

  const explicit = normalizePath(item.detailPath || item.path)
  if (explicit) return explicit

  const hrefPath = normalizePath(item.href)
  if (hrefPath) return hrefPath

  if (looksLikeSports(item)) {
    const slug = extractSlug(item) || extractGroupEventId(item)
    return slug ? normalizePath(`/sports/${slug}`) : null
  }

  if (looksLikeGroupEvent(item)) {
    const groupSlug = extractGroupSlug(item)
    const eventId = extractGroupEventId(item)
    if (groupSlug && eventId) {
      return normalizePath(`/groups/${groupSlug}/events/${eventId}`)
    }
  }

  if (looksLikeRecurring(item)) {
    const slug = extractSlug(item)
    const occurrenceDate = extractOccurrenceDate(item)
    if (slug && occurrenceDate) {
      return normalizePath(`/series/${slug}/${occurrenceDate}`)
    }
    if (slug) return normalizePath(`/series/${slug}`)
  }

  if (looksLikeBigBoard(item)) {
    const slug = extractSlug(item)
    return slug ? normalizePath(`/big-board/${slug}`) : null
  }

  if (looksLikeSeasonal(item)) {
    const slug = extractSlug(item)
    return slug ? normalizePath(`/seasonal/${slug}`) : null
  }

  if (looksLikeLegacyEvent(item)) {
    const slug = extractSlug(item)
    return slug ? normalizePath(`/events/${slug}`) : null
  }

  const venueSlug = extractVenueSlug(item)
  const slug = extractSlug(item)
  if (venueSlug && slug) {
    return normalizePath(`/${venueSlug}/${slug}`)
  }

  if (slug) {
    return normalizePath(`/events/${slug}`)
  }

  return null
}

export function getCanonicalUrlForItem(item, baseUrl) {
  const path = getDetailPathForItem(item)
  if (!path) return null
  if (!isNonEmptyString(baseUrl)) return path
  const trimmedBase = baseUrl.trim().replace(/\/$/, '')
  return `${trimmedBase}${path}`
}

export default getDetailPathForItem
