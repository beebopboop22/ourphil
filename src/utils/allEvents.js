export const ALL_EVENTS_SELECT = `
  id,
  name,
  description,
  link,
  image,
  start_date,
  end_date,
  start_time,
  end_time,
  slug,
  venue_id,
  venues:venue_id (
    name,
    slug,
    latitude,
    longitude
  )
`

function normalizeVenue(venue) {
  if (!venue) return null
  const source = Array.isArray(venue) ? venue[0] : venue
  if (!source) return null
  return {
    name: source.name ?? null,
    slug: source.slug ?? null,
    latitude: source.latitude ?? null,
    longitude: source.longitude ?? null,
  }
}

export function normalizeAllEventRow(row) {
  if (!row) return null
  const venues = normalizeVenue(row.venues ?? row.venue_id)
  const startDate = row.start_date ?? null
  const endDate = row.end_date ?? startDate ?? null

  return {
    id: row.id ?? null,
    title: row.name || row.title || '',
    name: row.name || row.title || '',
    description: row.description || '',
    imageUrl: row.image || '',
    link: row.link || null,
    start_date: startDate,
    end_date: endDate,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    slug: row.slug || null,
    venues,
    venue_id: row.venue_id ?? null,
    isTradition: false,
    isBigBoard: false,
    isGroupEvent: false,
    isRecurring: false,
    isSports: false,
    source_table: 'all_events',
    taggableId: row.id != null ? String(row.id) : null,
  }
}

export function normalizeAllEvents(rows) {
  return (rows || []).map(normalizeAllEventRow).filter(Boolean)
}
