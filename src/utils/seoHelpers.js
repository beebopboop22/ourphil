const SITE_BASE_URL = 'https://ourphilly.org'
const DEFAULT_OG_IMAGE = `${SITE_BASE_URL}/og-image.png`

const ORGANIZER = {
  '@type': 'Organization',
  name: 'Our Philly',
  url: SITE_BASE_URL,
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function ensureAbsoluteUrl(value, base = SITE_BASE_URL) {
  if (!isNonEmptyString(value)) return null
  try {
    const trimmed = value.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (trimmed.startsWith('//')) return `https:${trimmed}`
    const url = new URL(trimmed, base)
    return url.href
  } catch {
    return null
  }
}

function toIsoDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const direct = new Date(trimmed)
    if (!Number.isNaN(direct.getTime())) return direct.toISOString()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const date = new Date(`${trimmed}T00:00:00`)
      if (!Number.isNaN(date.getTime())) return date.toISOString()
    }
  }
  return null
}

function buildLocation(name) {
  const resolvedName = isNonEmptyString(name) ? name.trim() : 'Philadelphia'
  return {
    '@type': 'Place',
    name: resolvedName,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Philadelphia',
      addressRegion: 'PA',
      addressCountry: 'US',
    },
  }
}

export function buildEventJsonLd({
  name,
  canonicalUrl,
  startDate,
  endDate,
  locationName,
  description,
  image,
}) {
  if (!isNonEmptyString(name) || !isNonEmptyString(canonicalUrl)) return null
  const startIso = toIsoDate(startDate)
  if (!startIso) return null
  const endIso = toIsoDate(endDate) || startIso

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: name.trim(),
    url: canonicalUrl.trim(),
    startDate: startIso,
    endDate: endIso,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: buildLocation(locationName),
    organizer: ORGANIZER,
  }

  if (isNonEmptyString(description)) {
    data.description = description.trim()
  }

  if (isNonEmptyString(image)) {
    data.image = [image.trim()]
  }

  return data
}

export function buildEventSeriesJsonLd({
  name,
  canonicalUrl,
  description,
  locationName,
  image,
  subEvents = [],
}) {
  if (!isNonEmptyString(name) || !isNonEmptyString(canonicalUrl)) return null

  const baseLocation = buildLocation(locationName)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'EventSeries',
    name: name.trim(),
    url: canonicalUrl.trim(),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: baseLocation,
    organizer: ORGANIZER,
  }

  if (isNonEmptyString(description)) {
    data.description = description.trim()
  }

  if (isNonEmptyString(image)) {
    data.image = [image.trim()]
  }

  const normalizedSubEvents = subEvents
    .map(sub => {
      const startIso = toIsoDate(sub?.startDate)
      if (!startIso) return null
      const endIso = toIsoDate(sub?.endDate) || startIso
      const subName = isNonEmptyString(sub?.name) ? sub.name.trim() : name.trim()
      const subLocation = isNonEmptyString(sub?.locationName)
        ? buildLocation(sub.locationName)
        : baseLocation
      return {
        '@type': 'Event',
        name: subName,
        startDate: startIso,
        endDate: endIso,
        location: subLocation,
      }
    })
    .filter(Boolean)

  if (normalizedSubEvents.length) {
    data.subEvent = normalizedSubEvents.slice(0, 12)
  }

  return data
}

export function buildIsoDateTime(datePart, timePart) {
  if (!datePart) return null
  if (datePart instanceof Date) return toIsoDate(datePart)
  if (typeof datePart === 'string') {
    const trimmedDate = datePart.trim()
    if (!trimmedDate) return null
    if (timePart && typeof timePart === 'string') {
      const normalizedTime = timePart.trim()
      if (normalizedTime) {
        const composite = `${trimmedDate}T${normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime}`
        const dt = new Date(composite)
        if (!Number.isNaN(dt.getTime())) return dt.toISOString()
      }
    }
    return toIsoDate(trimmedDate)
  }
  return null
}

export { SITE_BASE_URL, DEFAULT_OG_IMAGE }
