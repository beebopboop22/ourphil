import { RRule } from 'rrule';
import { supabase } from '../supabaseClient.js';
import { getDetailPathForItem } from './eventDetailPaths.js';
import {
  PHILLY_TIME_ZONE,
  getZonedDate,
  setEndOfDay,
  setStartOfDay,
  parseISODate,
  parseEventDateValue,
} from './dateUtils.js';

const DEFAULT_RADIUS_M = 1609;
const FALLBACK_LOOKAHEAD_DAYS = 45;

function getResolverUrl() {
  const url = import.meta.env?.VITE_NEARBY_RESOLVER_URL || import.meta.env?.VITE_NEARBY_RESOLVER_ENDPOINT;
  if (typeof url === 'string' && url.trim()) {
    return url.trim();
  }
  return null;
}

function toIsoDateString(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeRadius(radius) {
  if (!radius || Number.isNaN(Number(radius))) return DEFAULT_RADIUS_M;
  const value = Number(radius);
  return value > 0 ? value : DEFAULT_RADIUS_M;
}

function parseISODateInPhilly(value) {
  if (!value) return null;
  if (value instanceof Date) return setStartOfDay(value);
  const str = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!str) return null;
  return parseISODate(str, PHILLY_TIME_ZONE);
}

function computeDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null;
  }
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeResolverEvent(event, areaLookup = {}, areaMeta = {}) {
  if (!event) return null;
  const startDate = parseEventDateValue(event.start_date || event.startDate || event.date);
  const endDate = parseEventDateValue(event.end_date || event.endDate) || startDate;
  const areaId = event.area_id ?? event.areaId ?? null;
  const base = {
    id: event.id || event.uuid || `${event.source_table || 'event'}:${event.favorite_id || event.id}`,
    title: event.title || event.name || '',
    description: event.description || '',
    imageUrl: event.image_url || event.imageUrl || event.image || '',
    startDate,
    endDate,
    start_time: event.start_time || null,
    end_time: event.end_time || null,
    detailPath: event.detail_path || event.detailPath || (event.slug ? getDetailPathForItem(event) : null),
    source_table: event.source_table || event.sourceTable || null,
    favoriteId: event.favorite_id ?? event.favoriteId ?? event.id ?? null,
    area_id: areaId,
    areaName: areaId != null ? areaLookup[areaId] || areaLookup[String(areaId)] || null : null,
    badges: Array.isArray(event.badges) ? event.badges : [],
    latitude: Number.isFinite(event.latitude) ? event.latitude : Number(event.latitude ?? event.lat),
    longitude: Number.isFinite(event.longitude) ? event.longitude : Number(event.longitude ?? event.lng),
    tags: Array.isArray(event.tags) ? event.tags : [],
  };

  const lat = Number(base.latitude);
  const lon = Number(base.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    base.latitude = lat;
    base.longitude = lon;
  } else {
    base.latitude = null;
    base.longitude = null;
  }

  let distance = null;
  if (Number.isFinite(event.distance) || Number.isFinite(event.distance_m) || Number.isFinite(event.distanceMeters)) {
    distance = Number(event.distance ?? event.distance_m ?? event.distanceMeters);
  } else if (areaId != null) {
    const meta = areaMeta[areaId] || areaMeta[String(areaId)];
    if (meta && Number.isFinite(meta.latitude) && Number.isFinite(meta.longitude) && Number.isFinite(base.latitude) && Number.isFinite(base.longitude)) {
      distance = computeDistanceMeters(meta.latitude, meta.longitude, base.latitude, base.longitude);
    }
  }
  base.distance_meters = Number.isFinite(distance) ? distance : null;

  return base;
}

async function fetchViaResolver({ areaId, startDate, radius, limit, signal, areaLookup, areaMeta }) {
  const resolverUrl = getResolverUrl();
  if (!resolverUrl) return null;
  const params = new URLSearchParams();
  params.set('area_id', String(areaId));
  params.set('start', startDate);
  params.set('radius', String(radius));
  if (limit) params.set('limit', String(limit));
  const url = resolverUrl.includes('?') ? `${resolverUrl}&${params.toString()}` : `${resolverUrl}?${params.toString()}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Nearby resolver failed with status ${response.status}`);
  }
  const payload = await response.json();
  const events = Array.isArray(payload?.events) ? payload.events : Array.isArray(payload) ? payload : [];
  return events
    .map(evt => normalizeResolverEvent(evt, areaLookup, areaMeta))
    .filter(event => event && event.startDate && !Number.isNaN(event.startDate.getTime()))
    .sort((a, b) => {
      const distanceA = Number.isFinite(a.distance_meters) ? a.distance_meters : Number.POSITIVE_INFINITY;
      const distanceB = Number.isFinite(b.distance_meters) ? b.distance_meters : Number.POSITIVE_INFINITY;
      if (distanceA !== distanceB) return distanceA - distanceB;
      const timeA = a.startDate?.getTime?.() || 0;
      const timeB = b.startDate?.getTime?.() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.title || '').localeCompare(b.title || '');
    });
}

async function fetchFromSupabase({ areaId, startDate, endDate, limit, areaLookup, areaMeta, signal }) {
  const startIso = startDate;
  const endIso = endDate;

  const [allEventsRes, legacyEventsRes, groupEventsRes, recurringRes, bigBoardRes] = await Promise.all([
    supabase
      .from('all_events')
      .select(`
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
        area_id,
        latitude,
        longitude,
        venue_id(area_id, name, slug, latitude, longitude)
      `)
      .eq('area_id', areaId)
      .gte('start_date', startIso)
      .lte('start_date', endIso)
      .order('start_date', { ascending: true }),
    supabase
      .from('events')
      .select('id,"E Name","E Description","E Image",slug,Dates,"End Date",start_time,end_time,area_id,latitude,longitude')
      .eq('area_id', areaId)
      .order('Dates', { ascending: true }),
    supabase
      .from('group_events')
      .select('id,title,description,start_date,end_date,start_time,end_time,image_url,address,slug,area_id,latitude,longitude,group_id,groups(slug,imag)')
      .eq('area_id', areaId)
      .gte('start_date', startIso)
      .order('start_date', { ascending: true }),
    supabase
      .from('recurring_events')
      .select('id,name,description,address,link,slug,start_date,end_date,start_time,end_time,rrule,image_url,area_id,latitude,longitude')
      .eq('area_id', areaId)
      .eq('is_active', true),
    supabase
      .from('big_board_events')
      .select('id,title,description,start_date,end_date,start_time,end_time,image_url,slug,area_id,latitude,longitude,big_board_posts!big_board_posts_event_id_fkey(image_url)')
      .eq('area_id', areaId)
      .gte('start_date', startIso)
      .order('start_date', { ascending: true }),
  ]);

  const errors = [allEventsRes.error, legacyEventsRes.error, groupEventsRes.error, recurringRes.error, bigBoardRes.error].filter(Boolean);
  if (errors.length) {
    console.error('Nearby fallback errors', errors);
  }

  const areaName = areaLookup?.[areaId] || areaLookup?.[String(areaId)] || null;

  const events = [];

  (allEventsRes.data || []).forEach(row => {
    const start = parseISODateInPhilly(row.start_date);
    if (!start) return;
    const end = parseISODateInPhilly(row.end_date) || start;
    const venue = Array.isArray(row.venue_id) ? row.venue_id[0] : row.venue_id;
    const latitude = Number.isFinite(row.latitude) ? row.latitude : Number(venue?.latitude);
    const longitude = Number.isFinite(row.longitude) ? row.longitude : Number(venue?.longitude);
    events.push({
      id: `all_events:${row.id}`,
      title: row.name,
      description: row.description,
      imageUrl: row.image || '',
      startDate: start,
      endDate: end,
      start_time: row.start_time,
      end_time: row.end_time,
      detailPath: getDetailPathForItem(row),
      source_table: 'all_events',
      favoriteId: row.id,
      area_id: row.area_id,
      areaName,
      latitude,
      longitude,
    });
  });

  (legacyEventsRes.data || []).forEach(row => {
    const start = parseEventDateValue(row.Dates);
    if (!start) return;
    const end = parseEventDateValue(row['End Date']) || start;
    events.push({
      id: `events:${row.id}`,
      title: row['E Name'],
      description: row['E Description'] || '',
      imageUrl: row['E Image'] || '',
      startDate: start,
      endDate: end,
      start_time: row.start_time ?? null,
      end_time: row.end_time ?? null,
      detailPath: getDetailPathForItem({ ...row, slug: row.slug }),
      source_table: 'events',
      favoriteId: row.id,
      area_id: row.area_id,
      areaName,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });
  });

  (groupEventsRes.data || []).forEach(row => {
    const start = parseISODateInPhilly(row.start_date);
    if (!start) return;
    const end = parseISODateInPhilly(row.end_date) || start;
    const imageUrl = row.image_url || row.groups?.imag || '';
    events.push({
      id: `group_events:${row.id}`,
      title: row.title,
      description: row.description || '',
      imageUrl,
      startDate: start,
      endDate: end,
      start_time: row.start_time,
      end_time: row.end_time,
      detailPath: getDetailPathForItem({ ...row, isGroupEvent: true, group_slug: row.groups?.slug }),
      source_table: 'group_events',
      favoriteId: row.id,
      area_id: row.area_id,
      areaName,
      address: row.address || '',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      badges: ['Group Event'],
    });
  });

  (recurringRes.data || []).forEach(series => {
    try {
      const opts = RRule.parseString(series.rrule);
      opts.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
      if (series.end_date) {
        opts.until = new Date(`${series.end_date}T23:59:59`);
      }
      const rule = new RRule(opts);
      const startWindow = parseISODate(startIso, PHILLY_TIME_ZONE);
      const endWindow = parseISODate(endIso, PHILLY_TIME_ZONE);
      const occurrences = rule.between(startWindow, endWindow, true);
      occurrences.forEach(occurrence => {
        const start = new Date(occurrence);
        events.push({
          id: `recurring_events:${series.id}:${start.toISOString().slice(0, 10)}`,
          title: series.name,
          description: series.description || '',
          imageUrl: series.image_url || '',
          startDate: start,
          endDate: start,
          start_time: series.start_time,
          end_time: series.end_time,
          detailPath: getDetailPathForItem({
            id: `${series.id}::${start.toISOString().slice(0, 10)}`,
            slug: series.slug,
            start_date: start.toISOString().slice(0, 10),
            isRecurring: true,
          }),
          source_table: 'recurring_events',
          favoriteId: series.id,
          area_id: series.area_id,
          areaName,
          address: series.address || '',
          latitude: Number(series.latitude),
          longitude: Number(series.longitude),
          badges: ['Recurring'],
        });
      });
    } catch (err) {
      console.error('Failed to expand recurring series', err);
    }
  });

  (bigBoardRes.data || []).forEach(row => {
    const start = parseISODateInPhilly(row.start_date);
    if (!start) return;
    const end = parseISODateInPhilly(row.end_date) || start;
    let imageUrl = row.image_url || '';
    const storageKey = row.big_board_posts?.[0]?.image_url;
    if (!imageUrl && storageKey) {
      const {
        data: { publicUrl },
      } = supabase.storage.from('big-board').getPublicUrl(storageKey);
      imageUrl = publicUrl;
    }
    events.push({
      id: `big_board_events:${row.id}`,
      title: row.title,
      description: row.description || '',
      imageUrl,
      startDate: start,
      endDate: end,
      start_time: row.start_time,
      end_time: row.end_time,
      detailPath: getDetailPathForItem(row),
      source_table: 'big_board_events',
      favoriteId: row.id,
      area_id: row.area_id,
      areaName,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      badges: ['Submission'],
    });
  });

  events.forEach(evt => {
    if (!Number.isFinite(evt.latitude) || !Number.isFinite(evt.longitude)) {
      evt.latitude = null;
      evt.longitude = null;
    }
    if (evt.area_id == null) {
      evt.area_id = areaId;
      evt.areaName = areaName;
    }
    const meta = areaMeta[areaId] || areaMeta[String(areaId)];
    if (!evt.distance_meters && meta && Number.isFinite(meta.latitude) && Number.isFinite(meta.longitude)) {
      const distance = computeDistanceMeters(meta.latitude, meta.longitude, evt.latitude ?? meta.latitude, evt.longitude ?? meta.longitude);
      if (Number.isFinite(distance)) {
        evt.distance_meters = distance;
      }
    }
  });

  const sorted = events
    .filter(evt => evt.startDate)
    .sort((a, b) => {
      const distA = Number.isFinite(a.distance_meters) ? a.distance_meters : Number.POSITIVE_INFINITY;
      const distB = Number.isFinite(b.distance_meters) ? b.distance_meters : Number.POSITIVE_INFINITY;
      if (distA !== distB) return distA - distB;
      const startA = a.startDate?.getTime?.() || 0;
      const startB = b.startDate?.getTime?.() || 0;
      if (startA !== startB) return startA - startB;
      return (a.title || '').localeCompare(b.title || '');
    });

  return limit && Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
}

export async function fetchNearbyEvents({
  areaId,
  start,
  radius = DEFAULT_RADIUS_M,
  limit = 20,
  lookaheadDays = FALLBACK_LOOKAHEAD_DAYS,
  areaLookup = {},
  areaMeta = {},
  signal,
} = {}) {
  if (!areaId) return [];
  const radiusMeters = normalizeRadius(radius);
  const reference = start instanceof Date ? start : parseEventDateValue(start) || getZonedDate(new Date(), PHILLY_TIME_ZONE);
  const windowStart = setStartOfDay(reference);
  const windowEnd = setEndOfDay(new Date(windowStart));
  windowEnd.setDate(windowEnd.getDate() + lookaheadDays);

  const startDate = toIsoDateString(windowStart);
  const endDate = toIsoDateString(windowEnd);

  try {
    const resolverEvents = await fetchViaResolver({
      areaId,
      startDate,
      radius: radiusMeters,
      limit,
      signal,
      areaLookup,
      areaMeta,
    });
    if (Array.isArray(resolverEvents) && resolverEvents.length) {
      return limit && Number.isFinite(limit) ? resolverEvents.slice(0, limit) : resolverEvents;
    }
  } catch (err) {
    console.error('Nearby resolver failed, using fallback', err);
  }

  return fetchFromSupabase({
    areaId,
    startDate,
    endDate,
    limit,
    areaLookup,
    areaMeta,
    signal,
  });
}

export function buildAreaMetaMap(areas = []) {
  const meta = {};
  areas.forEach(area => {
    if (area?.id == null) return;
    meta[area.id] = {
      id: area.id,
      name: area.name || '',
      slug: area.slug || '',
      latitude: Number(area.latitude ?? area.centroid_lat ?? area.lat ?? area.center_lat),
      longitude: Number(area.longitude ?? area.centroid_lng ?? area.lng ?? area.center_lng),
    };
  });
  return meta;
}

export function buildAreaSlugMap(areas = []) {
  const map = {};
  areas.forEach(area => {
    if (!area?.slug || area.id == null) return;
    map[area.slug] = area.id;
  });
  return map;
}
