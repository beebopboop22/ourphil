/* eslint-disable no-console */
import { RRule } from 'rrule';
import { supabase } from '../supabaseClient';
import {
  PHILLY_TIME_ZONE,
  parseEventDateValue,
  setEndOfDay,
  setStartOfDay,
  overlaps,
} from './dateUtils';
import { ensureAbsoluteUrl } from './seoHelpers.js';
import { getDetailPathForItem } from './eventDetailPaths.js';

const SOURCE_PRIORITY = {
  events: 0,
  all_events: 1,
  big_board_events: 2,
};

const EVENT_SOURCES = [
  { table: 'events', taggableType: 'events', priority: SOURCE_PRIORITY.events },
  { table: 'all_events', taggableType: 'all_events', priority: SOURCE_PRIORITY.all_events },
  { table: 'big_board_events', taggableType: 'big_board_events', priority: SOURCE_PRIORITY.big_board_events },
  { table: 'group_events', taggableType: 'group_events', priority: 10 },
  { table: 'recurring_events', taggableType: 'recurring_events', priority: 11 },
  { table: 'seasonal_events', taggableType: 'seasonal_events', priority: 12 },
];

function pickFirst(...candidates) {
  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'boolean') return value;
    if (value) return value;
  }
  return null;
}

function normalizeTime(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const [h, m] = str.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }
  return str;
}

function formatDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateRange(row, { monthStart, monthEnd }) {
  const startRaw = pickFirst(
    row.start_date,
    row.startDate,
    row.Dates,
    row.date,
    row['Start Date'],
    row['E Start Date'],
  );
  const endRaw = pickFirst(
    row.end_date,
    row.endDate,
    row['End Date'],
    row['E End Date'],
    startRaw,
  );
  const startDate = parseEventDateValue(startRaw, PHILLY_TIME_ZONE);
  const endDateBase = parseEventDateValue(endRaw, PHILLY_TIME_ZONE) || startDate;
  if (!startDate || !endDateBase) return null;
  const endDate = setEndOfDay(endDateBase);
  if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
  return { startDate, endDate };
}

function normalizeTags(candidate) {
  const set = new Set();
  if (!candidate) return set;
  if (Array.isArray(candidate)) {
    candidate.forEach(entry => {
      if (typeof entry === 'string') {
        const slug = entry.trim().toLowerCase();
        if (slug) set.add(slug);
      } else if (entry && typeof entry === 'object') {
        const slug = pickFirst(entry.slug, entry.name);
        if (typeof slug === 'string') {
          const normalized = slug.trim().toLowerCase();
          if (normalized) set.add(normalized);
        }
      }
    });
  } else if (typeof candidate === 'string') {
    candidate
      .split(/[,|]/)
      .map(part => part.trim().toLowerCase())
      .filter(Boolean)
      .forEach(slug => set.add(slug));
  }
  return set;
}

function normalizePriceFlag(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 'free' : '$$';
  const str = String(value).trim();
  if (!str) return null;
  if (str === '0') return 'free';
  if (str.toLowerCase() === 'free') return 'free';
  return str;
}

function normalizeAgeFlag(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 'all-ages' : null;
  const str = String(value).trim();
  if (!str) return null;
  return str;
}

function baseEventShape({ row, source_table, priority, monthStart, monthEnd }) {
  const range = parseDateRange(row, { monthStart, monthEnd });
  if (!range) return null;
  const { startDate, endDate } = range;
  const start_date = formatDateValue(startDate);
  const end_date = formatDateValue(endDate);
  const statusRaw = pickFirst(row.status, row.Status) || 'scheduled';
  const tags = normalizeTags(pickFirst(row.tags, row.tag_slugs, row.tagList));
  const title = pickFirst(row.title, row.name, row['E Name'], row.event_name) || 'Untitled Event';
  const primaryId = pickFirst(row.id, row.event_id, row.eventId, row.uuid, row.slug);
  const fallbackId = `${source_table}-${start_date || 'unknown'}-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)}`;
  const resolvedId = primaryId != null ? String(primaryId) : fallbackId;

  const event = {
    id: resolvedId,
    originalId: primaryId ?? null,
    source_table,
    priority,
    global_event_id: pickFirst(row.global_event_id, row.globalEventId, row.global_id),
    title,
    description: pickFirst(row.description, row['E Description'], row.summary, row.details) || '',
    startDate,
    endDate,
    start_date,
    end_date,
    start_time: normalizeTime(pickFirst(row.start_time, row['E Start Time'], row.time)),
    end_time: normalizeTime(pickFirst(row.end_time, row['E End Time'])),
    neighborhood: pickFirst(row.neighborhood, row.neighborhood_name, row['E Neighborhood']),
    venue: pickFirst(row.venue, row.venue_name, row['E Venue'], row.location),
    zip: pickFirst(row.zip, row.postal_code, row['E Zip'], row['E Zip Code']),
    address: pickFirst(row.address, row.street, row.street_address),
    status: typeof statusRaw === 'string' ? statusRaw.toLowerCase() : String(statusRaw).toLowerCase(),
    image_url: pickFirst(row.image_url, row.image, row['E Image']),
    link: pickFirst(row.detail_url, row['Detail URL'], row.link, row.url, row['E Link']),
    age_flag: normalizeAgeFlag(pickFirst(row.age_flag, row['Age Flag'], row.age_restriction, row.kid_flag)),
    price_flag: normalizePriceFlag(pickFirst(row.price_flag, row['Price Flag'], row.price_level, row.is_free)),
    taggableId: primaryId ?? null,
    tags: Array.from(tags),
    raw: row,
    favoriteId: primaryId ?? null,
    isTradition: source_table === 'events',
  };

  return event;
}

function finalizeEvent(event) {
  if (!event) return null;
  const detailCandidate = getDetailPathForItem({
    ...event.raw,
    source_table: event.source_table,
  });
  const canonicalPath = detailCandidate || null;
  const detailUrl = canonicalPath
    ? `https://ourphilly.org${canonicalPath}`
    : ensureAbsoluteUrl(event.link);

  return {
    ...event,
    canonicalPath,
    detailUrl,
  };
}

async function fetchEventsSource({ monthStart, monthEnd }) {
  const { data, error } = await supabase.from('events').select('*');
  if (error) {
    console.error('Failed to load events table', error);
    return [];
  }
  return data
    .map(row => baseEventShape({ row, source_table: 'events', priority: SOURCE_PRIORITY.events, monthStart, monthEnd }))
    .map(finalizeEvent)
    .filter(Boolean);
}

async function fetchAllEventsSource({ monthStart, monthEnd }) {
  const { data, error } = await supabase
    .from('all_events')
    .select('*, venues:venue_id (slug, name, neighborhood, zip)');
  if (error) {
    console.error('Failed to load all_events', error);
    return [];
  }
  return data
    .map(row => {
      const event = baseEventShape({ row, source_table: 'all_events', priority: SOURCE_PRIORITY.all_events, monthStart, monthEnd });
      if (!event) return null;
      event.venues = row.venues;
      if (!event.venue && row.venues?.name) event.venue = row.venues.name;
      if (!event.zip && row.venues?.zip) event.zip = row.venues.zip;
      return finalizeEvent(event);
    })
    .filter(Boolean);
}

function resolveBigBoardImage(row) {
  if (row.image_url) return row.image_url;
  const storageKey = row.big_board_posts?.[0]?.image_url;
  if (!storageKey) return null;
  const { data } = supabase.storage.from('big-board').getPublicUrl(storageKey);
  return data?.publicUrl || null;
}

async function fetchBigBoardEvents({ monthStart, monthEnd }) {
  const { data, error } = await supabase
    .from('big_board_events')
    .select('*, big_board_posts!big_board_posts_event_id_fkey(image_url)');
  if (error) {
    console.error('Failed to load big_board_events', error);
    return [];
  }
  return data
    .map(row => {
      const event = baseEventShape({ row, source_table: 'big_board_events', priority: SOURCE_PRIORITY.big_board_events, monthStart, monthEnd });
      if (!event) return null;
      event.image_url = event.image_url || resolveBigBoardImage(row);
      event.favoriteId = row.id;
      return finalizeEvent(event);
    })
    .filter(Boolean);
}

async function fetchGroupEvents({ monthStart, monthEnd }) {
  const { data, error } = await supabase
    .from('group_events')
    .select('*, groups:group_id(slug,Name,imag)');
  if (error) {
    console.error('Failed to load group_events', error);
    return [];
  }
  return data
    .map(row => {
      const event = baseEventShape({ row, source_table: 'group_events', priority: 10, monthStart, monthEnd });
      if (!event) return null;
      const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
      const detailCandidate = getDetailPathForItem({
        ...row,
        source_table: 'group_events',
        group_slug: group?.slug,
        groups: row.groups,
      });
      const canonicalPath = detailCandidate || null;
      const detailUrl = canonicalPath
        ? `https://ourphilly.org${canonicalPath}`
        : ensureAbsoluteUrl(event.link);
      event.canonicalPath = canonicalPath;
      event.detailUrl = detailUrl;
      event.image_url = event.image_url || group?.imag || null;
      event.favoriteId = row.id;
      return event;
    })
    .filter(Boolean);
}

function buildRecurringOccurrences(row, { monthStart, monthEnd }) {
  if (!row.rrule) return [];
  try {
    const opts = RRule.parseString(row.rrule);
    const startTime = normalizeTime(pickFirst(row.start_time, row.startTime)) || '00:00';
    const baseStart = row.start_date ? new Date(`${row.start_date}T${startTime}:00`) : null;
    if (!baseStart || Number.isNaN(baseStart.getTime())) return [];
    opts.dtstart = baseStart;
    if (row.end_date) {
      const until = new Date(`${row.end_date}T23:59:59`);
      if (!Number.isNaN(until.getTime())) opts.until = until;
    }
    const rule = new RRule(opts);
    const occurrences = rule.between(monthStart, monthEnd, true);
    return occurrences.map(occurrence => {
      const startDate = setStartOfDay(new Date(occurrence));
      const endDate = setEndOfDay(new Date(occurrence));
      const start_date = formatDateValue(startDate);
      const end_date = formatDateValue(endDate);
      const statusRaw = pickFirst(row.status, row.Status) || 'scheduled';
      const tags = normalizeTags(row.tags);
      const event = {
        id: `${row.id}::${start_date}`,
        originalId: row.id,
        source_table: 'recurring_events',
        priority: 11,
        global_event_id: pickFirst(row.global_event_id, row.globalEventId),
        title: pickFirst(row.name, row.title) || 'Recurring Event',
        description: pickFirst(row.description, row.summary) || '',
        startDate,
        endDate,
        start_date,
        end_date,
        start_time: normalizeTime(pickFirst(row.start_time, row.startTime)),
        end_time: normalizeTime(pickFirst(row.end_time, row.endTime)),
        neighborhood: pickFirst(row.neighborhood, row.address_neighborhood),
        venue: pickFirst(row.venue, row.venue_name),
        zip: pickFirst(row.zip, row.postal_code),
        address: pickFirst(row.address, row.location),
        status: typeof statusRaw === 'string' ? statusRaw.toLowerCase() : String(statusRaw).toLowerCase(),
        image_url: pickFirst(row.image_url, row.image),
        link: pickFirst(row.detail_url, row.link, row.url),
        age_flag: pickFirst(row.age_flag, row.age_restriction),
        price_flag: pickFirst(row.price_flag, row.is_free),
        taggableId: row.id,
        tags: Array.from(tags),
        occurrenceDate: start_date,
        raw: row,
        favoriteId: row.id,
      };
      const detailCandidate = getDetailPathForItem({
        ...row,
        source_table: 'recurring_events',
        occurrence_date: start_date,
      });
      event.canonicalPath = detailCandidate || null;
      event.detailUrl = event.canonicalPath
        ? `https://ourphilly.org${event.canonicalPath}`
        : ensureAbsoluteUrl(event.link);
      return event;
    });
  } catch (error) {
    console.error('Failed to build recurring occurrences', error);
    return [];
  }
}

async function fetchRecurringEvents({ monthStart, monthEnd }) {
  const { data, error } = await supabase
    .from('recurring_events')
    .select('*')
    .eq('is_active', true);
  if (error) {
    console.error('Failed to load recurring_events', error);
    return [];
  }
  return data.flatMap(row => buildRecurringOccurrences(row, { monthStart, monthEnd }));
}

async function fetchSeasonalEvents({ monthStart, monthEnd }) {
  const { data, error } = await supabase
    .from('seasonal_events')
    .select('*');
  if (error) {
    console.error('Failed to load seasonal_events', error);
    return [];
  }
  return data
    .map(row => baseEventShape({ row, source_table: 'seasonal_events', priority: 12, monthStart, monthEnd }))
    .map(finalizeEvent)
    .filter(Boolean);
}

function getPriority(table) {
  if (typeof SOURCE_PRIORITY[table] === 'number') return SOURCE_PRIORITY[table];
  const matching = EVENT_SOURCES.find(entry => entry.table === table);
  if (matching?.priority !== undefined) return matching.priority;
  return 100 + (table ? table.charCodeAt(0) : 0);
}

function dedupeEvents(events) {
  const map = new Map();
  events.forEach(event => {
    if (!event) return;
    const key = event.global_event_id
      ? `gid:${String(event.global_event_id)}`
      : `fallback:${(event.title || '').toLowerCase().replace(/\s+/g, ' ').trim()}|${event.start_date || ''}|${(event.venue || event.zip || '').toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, event);
      return;
    }
    const currentPriority = getPriority(event.source_table);
    const existingPriority = getPriority(existing.source_table);
    if (currentPriority < existingPriority) {
      map.set(key, event);
    } else if (currentPriority === existingPriority && (event.source_table || '') < (existing.source_table || '')) {
      map.set(key, event);
    }
  });
  return Array.from(map.values());
}

async function attachTags(events) {
  const idsByType = new Map();
  events.forEach(event => {
    if (!event?.source_table || !event.taggableId) return;
    const type = event.source_table;
    const key = `${type}`;
    if (!idsByType.has(key)) idsByType.set(key, new Set());
    idsByType.get(key).add(String(event.taggableId));
  });
  const queries = [];
  idsByType.forEach((ids, type) => {
    if (ids.size === 0) return;
    queries.push(
      supabase
        .from('taggings')
        .select('taggable_id, tags(slug)')
        .eq('taggable_type', type)
        .in('taggable_id', Array.from(ids))
        .then(result => ({ type, result }))
    );
  });
  const responses = await Promise.all(queries);
  const tagMap = new Map();
  responses.forEach(({ type, result }) => {
    if (!result || result.error) {
      if (result?.error) console.error(`Tag load failed for ${type}`, result.error);
      return;
    }
    (result.data || []).forEach(({ taggable_id, tags }) => {
      if (!taggable_id) return;
      const slug = pickFirst(tags?.slug, tags?.name);
      if (!slug) return;
      const normalized = slug.trim().toLowerCase();
      if (!normalized) return;
      const key = `${type}:${String(taggable_id)}`;
      if (!tagMap.has(key)) tagMap.set(key, new Set());
      tagMap.get(key).add(normalized);
    });
  });
  return events.map(event => {
    if (!event?.source_table || !event.taggableId) return event;
    const key = `${event.source_table}:${String(event.taggableId)}`;
    const merged = new Set(event.tags || []);
    const extra = tagMap.get(key);
    if (extra) {
      extra.forEach(slug => merged.add(slug));
    }
    return {
      ...event,
      tags: Array.from(merged),
    };
  });
}

export async function fetchUnifiedEventRows({ monthStart, monthEnd }) {
  const ranges = { monthStart, monthEnd };
  const [eventsRows, allEventsRows, bigBoardRows, groupRows, recurringRows, seasonalRows] = await Promise.all([
    fetchEventsSource(ranges),
    fetchAllEventsSource(ranges),
    fetchBigBoardEvents(ranges),
    fetchGroupEvents(ranges),
    fetchRecurringEvents(ranges),
    fetchSeasonalEvents(ranges),
  ]);
  const combined = [
    ...eventsRows,
    ...allEventsRows,
    ...bigBoardRows,
    ...groupRows,
    ...recurringRows,
    ...seasonalRows,
  ].filter(Boolean);
  const deduped = dedupeEvents(combined);
  const withTags = await attachTags(deduped);
  return withTags;
}

export { dedupeEvents };
