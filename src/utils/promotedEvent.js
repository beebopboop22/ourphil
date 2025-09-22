import { supabase } from '../supabaseClient';
import {
  PHILLY_TIME_ZONE,
  getZonedDate,
  parseEventDateValue,
  setEndOfDay,
} from './dateUtils';
import { getDetailPathForItem } from './eventDetailPaths';
import { ensureAbsoluteUrl, DEFAULT_OG_IMAGE, SITE_BASE_URL } from './seoHelpers';

const CACHE_TTL_MS = 1000 * 60 * 3;

let cachedValue = null;
let cacheExpiresAt = 0;
let inflightPromise = null;

function normalizeText(value) {
  if (!value) return '';
  if (typeof value !== 'string') return String(value);
  return value.trim();
}

function truncateText(text, maxLength = 200) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const truncated = trimmed.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength - 40) {
    return `${truncated.slice(0, lastSpace)}…`;
  }
  return `${truncated}…`;
}

function parseTimeValue(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2] || '0');
    const suffix = ampmMatch[3]?.toLowerCase();
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (suffix) {
      const isPm = suffix.includes('p');
      hours = hours % 12 + (isPm ? 12 : 0);
    }
    return { hours, minutes };
  }

  const twentyFourMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
  if (twentyFourMatch) {
    const hours = Number(twentyFourMatch[1]);
    const minutes = Number(twentyFourMatch[2] || '0');
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return { hours, minutes };
  }

  return null;
}

function combineDateAndTime(date, timeString) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = parseTimeValue(timeString);
  if (!parts) return new Date(date);
  const combined = new Date(date);
  combined.setHours(parts.hours, parts.minutes, 0, 0);
  return combined;
}

function normalizeNationality(value) {
  const text = normalizeText(value);
  if (!text) return { label: null, emoji: null };
  const normalized = text.replace(/\s+/g, ' ').trim();
  const lookup = normalized.toLowerCase();
  const emojiMap = {
    'puerto rican': '🇵🇷',
    'mexican': '🇲🇽',
    'irish': '🇮🇪',
    'italian': '🇮🇹',
    'german': '🇩🇪',
    'polish': '🇵🇱',
    'ukrainian': '🇺🇦',
    'indian': '🇮🇳',
    'chinese': '🇨🇳',
    'japanese': '🇯🇵',
    'korean': '🇰🇷',
    'vietnamese': '🇻🇳',
    'jamaican': '🇯🇲',
    'dominican': '🇩🇴',
    'haitian': '🇭🇹',
    'nigerian': '🇳🇬',
    'ethiopian': '🇪🇹',
    'french': '🇫🇷',
    'spanish': '🇪🇸',
    'philippine': '🇵🇭',
    'filipino': '🇵🇭',
    'thai': '🇹🇭',
    'cambodian': '🇰🇭',
  };
  const emoji = emojiMap[lookup] || null;
  return { label: normalized, emoji };
}

function normalizeGroup(group) {
  if (!group) return null;
  return {
    id: group.id,
    name: normalizeText(group.Name || group.name),
    slug: normalizeText(group.slug),
    imageUrl: normalizeText(group.imag || group.image_url || ''),
    nationality: normalizeText(group.Nationality || group.nationality || ''),
  };
}

function normalizeEventRow(row) {
  if (!row) return null;
  const startRaw = row['E Start Date'] || row.Dates || row['Start Date'] || row.start_date;
  const endRaw = row['E End Date'] || row['End Date'] || row.end_date || startRaw;
  const startDate = parseEventDateValue(startRaw, PHILLY_TIME_ZONE);
  const endDate = setEndOfDay(parseEventDateValue(endRaw, PHILLY_TIME_ZONE) || startDate || null);
  if (!startDate) return null;

  const startDateTime = combineDateAndTime(startDate, row['Start Time'] || row.start_time);
  const endDateTime = combineDateAndTime(endDate || startDate, row['End Time'] || row.end_time);

  const title = normalizeText(row['E Name'] || row.title || row.name);
  const headline = normalizeText(row.Headline) || title;
  const description = normalizeText(row['E Description'] || row.description || '');
  const summary = normalizeText(row['E Summary']) || description;
  const trimmedSummary = truncateText(summary || description || '', 200);
  const detailPath = getDetailPathForItem(row);
  const externalUrl = normalizeText(row['E Link'] || row.link || '');
  const learnMoreUrl = detailPath || externalUrl || null;
  const canonicalUrl = ensureAbsoluteUrl(learnMoreUrl, SITE_BASE_URL);
  const imageUrl = ensureAbsoluteUrl(row['E Image']) || normalizeText(row['E Image']) || DEFAULT_OG_IMAGE;
  const venueName = normalizeText(row['Venue Name'] || row.venue_name || row.venue);
  const venueAddress = normalizeText(row['Venue Address'] || row.venue_address || row.address);
  const { label: nationality, emoji: nationalityEmoji } = normalizeNationality(row.Nationality || row.nationality);

  return {
    id: row.id,
    slug: normalizeText(row.slug || row.event_slug),
    title,
    headline,
    description,
    summary: trimmedSummary,
    fullSummary: summary || description,
    startDate,
    endDate,
    startDateTime,
    endDateTime,
    startTimeLabel: normalizeText(row['Start Time'] || row.start_time),
    endTimeLabel: normalizeText(row['End Time'] || row.end_time),
    imageUrl: imageUrl || DEFAULT_OG_IMAGE,
    venueName,
    venueAddress,
    nationality,
    nationalityEmoji,
    detailPath,
    externalUrl,
    learnMoreUrl,
    canonicalUrl,
    sourceRow: row,
  };
}

function isUpcoming(event, now) {
  if (!event) return false;
  const start = event.startDateTime || event.startDate;
  if (!start) return false;
  return start.getTime() >= now.getTime();
}

export async function fetchPromotedEvent(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedValue && cacheExpiresAt > now) {
    return cachedValue;
  }
  if (!forceRefresh && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    const nowInPhilly = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        slug,
        "E Name",
        "E Description",
        "E Summary",
        "E Start Date",
        "E End Date",
        "E Image",
        "E Link",
        "Venue Name",
        "Venue Address",
        Dates,
        "End Date",
        "Start Time",
        "End Time",
        Nationality,
        Headline,
        Promoted
      `)
      .eq('Promoted', 'Yes')
      .order('Dates', { ascending: true })
      .limit(12);

    if (error) {
      if (typeof console !== 'undefined') {
        console.error('Failed to load promoted event', error);
      }
      cachedValue = null;
      cacheExpiresAt = 0;
      inflightPromise = null;
      return null;
    }

    const normalized = (data || [])
      .map(normalizeEventRow)
      .filter(Boolean)
      .filter(evt => isUpcoming(evt, nowInPhilly))
      .sort((a, b) => {
        const aStart = a.startDateTime || a.startDate || new Date(8640000000000000);
        const bStart = b.startDateTime || b.startDate || new Date(8640000000000000);
        return aStart.getTime() - bStart.getTime();
      });

    const nextEvent = normalized[0] || null;
    if (!nextEvent) {
      cachedValue = null;
      cacheExpiresAt = now + CACHE_TTL_MS;
      inflightPromise = null;
      return null;
    }

    let relatedGroups = [];
    if (nextEvent.nationality) {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, Name, slug, imag, Nationality')
        .ilike('Nationality', nextEvent.nationality);

      if (!groupsError && Array.isArray(groupsData)) {
        relatedGroups = groupsData.map(normalizeGroup).filter(Boolean).slice(0, 6);
      }
    }

    const result = { ...nextEvent, relatedGroups };
    cachedValue = result;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    inflightPromise = null;
    return result;
  })().catch(err => {
    if (typeof console !== 'undefined') {
      console.error('Failed to load promoted event', err);
    }
    cachedValue = null;
    cacheExpiresAt = 0;
    inflightPromise = null;
    return null;
  });

  return inflightPromise;
}

export function clearPromotedEventCache() {
  cachedValue = null;
  cacheExpiresAt = 0;
  inflightPromise = null;
}

