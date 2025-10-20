import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import Seo from './components/Seo.jsx';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import PlansListRow from './components/PlansListRow.jsx';
import { AuthContext } from './AuthProvider.jsx';
import { supabase } from './supabaseClient.js';
import { useAreaCache, resolveNeighborhood } from './contexts/AreaCacheContext.jsx';
import {
  buildScheduleCopy,
  buildSeoDescription,
  ensureAbsoluteImage,
  normalizeEventRecord,
  toDateKey,
} from './utils/eventDetailHelpers.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  DEFAULT_OG_IMAGE,
  SITE_BASE_URL,
  buildEventJsonLd,
  ensureAbsoluteUrl,
} from './utils/seoHelpers.js';
import { PHILLY_TIME_ZONE } from './utils/dateUtils.js';
import useEventFavorite from './utils/useEventFavorite.js';

const FALLBACK_EVENT_TITLE = 'Philadelphia Event Details – Our Philly';
const FALLBACK_EVENT_DESCRIPTION =
  'Discover upcoming Philadelphia events and traditions with Our Philly.';
const HEADER_OFFSET =
  'calc((var(--app-nav-offset, 128px)) + (var(--app-tag-belt-height, 0px)) + 12px)';

const RECOMMENDATION_SOURCES = {
  events: {
    table: 'events',
    sourceTable: 'events',
    badge: 'Tradition',
    orderColumn: null,
    select: `
      id,
      slug,
      "E Name",
      "E Description",
      "E Image",
      "E Link",
      "E Address",
      area_id,
      start_date,
      end_date,
      start_time,
      end_time,
      Dates,
      "End Date",
      latitude,
      longitude,
      owner_username,
      submitted_by_username,
      venues:venue_id ( id, name, slug, short_address, address, area_id, latitude, longitude )
    `,
  },
  big_board_events: {
    table: 'big_board_events',
    sourceTable: 'big_board_events',
    badge: 'Submission',
    orderColumn: 'start_date',
    select: `
      id,
      slug,
      title,
      description,
      start_date,
      end_date,
      start_time,
      end_time,
      area_id,
      address,
      latitude,
      longitude,
      big_board_posts!big_board_posts_event_id_fkey ( image_url )
    `,
    resolveImage: row => {
      const storageKey = row?.big_board_posts?.[0]?.image_url;
      if (!storageKey) return '';
      const {
        data: { publicUrl },
      } = supabase.storage.from('big-board').getPublicUrl(storageKey);
      return publicUrl || '';
    },
  },
  all_events: {
    table: 'all_events',
    sourceTable: 'all_events',
    badge: 'Listed Event',
    orderColumn: 'start_date',
    select: `
      id,
      slug,
      name,
      description,
      image,
      link,
      start_date,
      end_date,
      start_time,
      end_time,
      area_id,
      venues:venue_id ( area_id, name, slug )
    `,
  },
  recurring_events: {
    table: 'recurring_events',
    sourceTable: 'recurring_events',
    badge: 'Recurring',
    orderColumn: 'start_date',
    select: `
      id,
      slug,
      name,
      description,
      address,
      link,
      image_url,
      start_date,
      end_date,
      start_time,
      end_time,
      rrule,
      area_id
    `,
  },
  group_events: {
    table: 'group_events',
    sourceTable: 'group_events',
    badge: 'Group Event',
    orderColumn: 'start_date',
    select: `
      id,
      title,
      description,
      slug,
      start_date,
      end_date,
      start_time,
      end_time,
      image_url,
      area_id,
      groups ( slug, Name )
    `,
  },
};

function safeUniqueKey(prefix, value) {
  if (value === null || value === undefined) return `${prefix}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${String(value)}`;
}

function occursOnDate(event, targetKey) {
  if (!event?.startDate || !targetKey) return false;
  const startKey = event.startDateKey || toDateKey(event.startDate);
  const endKey = event.endDate ? toDateKey(event.endDate) : startKey;
  return Boolean(startKey && endKey && startKey <= targetKey && targetKey <= endKey);
}

function buildMetaLabel(event) {
  if (event?.startDateTime instanceof Date && !Number.isNaN(event.startDateTime.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: PHILLY_TIME_ZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(event.startDateTime);
  }
  if (event?.startDate instanceof Date && !Number.isNaN(event.startDate.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: PHILLY_TIME_ZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(event.startDate);
  }
  return '';
}

function attachAreaName(event, areaMap) {
  if (!event) return event;
  const areaId = event.area_id ?? event.areaId ?? null;
  const fallbackVenueArea = event.venueAreaId ?? null;
  const firstMatch = resolveNeighborhood(areaMap, areaId);
  if (firstMatch) {
    event.neighborhood = firstMatch.name || '';
    event.neighborhoodSlug = firstMatch.slug || '';
    return event;
  }
  const secondMatch = resolveNeighborhood(areaMap, fallbackVenueArea);
  if (secondMatch) {
    event.neighborhood = secondMatch.name || '';
    event.neighborhoodSlug = secondMatch.slug || '';
    return event;
  }
  event.neighborhood = '';
  event.neighborhoodSlug = '';
  return event;
}

function mapRowToRecommendation(row, type) {
  const config = RECOMMENDATION_SOURCES[type];
  if (!config) return null;
  const normalized = normalizeEventRecord({ ...row, source_table: config.sourceTable });
  if (!normalized || !normalized.title) {
    return null;
  }
  let imageUrl = normalized.heroImageUrl || '';
  if (!imageUrl) {
    if (config.sourceTable === 'big_board_events') {
      imageUrl = config.resolveImage ? config.resolveImage(row) : '';
    } else if (config.sourceTable === 'all_events') {
      imageUrl = row.image || '';
    } else if (config.sourceTable === 'group_events') {
      imageUrl = row.image_url || '';
    } else if (config.sourceTable === 'recurring_events') {
      imageUrl = row.image_url || '';
    }
  }
  const detailPath =
    getDetailPathForItem({ ...row, source_table: config.sourceTable, table: config.table, slug: normalized.slug }) ||
    (normalized.slug ? `/events/${normalized.slug}` : null);
  return {
    key: safeUniqueKey(config.sourceTable, normalized.id ?? normalized.slug),
    sourceType: config.sourceTable,
    source_table: config.sourceTable,
    sourceId: normalized.id ?? null,
    slug: normalized.slug || null,
    title: normalized.title || 'Untitled Event',
    description: normalized.description || '',
    startDate: normalized.startDate || null,
    endDate: normalized.endDate || null,
    startDateTime: normalized.startDateTime || null,
    endDateTime: normalized.endDateTime || null,
    startDateKey: normalized.startDateKey || '',
    area_id: normalized.areaId ?? null,
    venueAreaId: normalized.venueAreaId ?? null,
    venueName: normalized.venue?.name || '',
    address: normalized.address || '',
    imageUrl,
    detailPath,
    favoriteId: normalized.id ?? null,
    tags: [],
    matchedTagSlugs: [],
    matchCount: 0,
    badges: config.badge ? [config.badge] : [],
  };
}

async function fetchRecordsByIds(type, ids) {
  const config = RECOMMENDATION_SOURCES[type];
  if (!config || !ids || !ids.length) return [];
  const uniqueIds = Array.from(new Set(ids));
  const chunkSize = 100;
  const rows = [];
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    let query = supabase.from(config.table).select(config.select);
    query = query.in('id', chunk);
    const { data, error } = await query;
    if (error) {
      console.error(`Failed to load ${config.table} candidates`, error);
      continue;
    }
    rows.push(...(data || []));
  }
  return rows.map(row => mapRowToRecommendation(row, type)).filter(Boolean);
}

async function fetchTagMapForType(type, ids) {
  if (!ids.length) return new Map();
  const results = new Map();
  const chunkSize = 100;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from('taggings')
      .select('taggable_id, tags(name, slug)')
      .eq('taggable_type', type)
      .in('taggable_id', chunk);
    if (error) {
      console.error(`Failed to load tags for ${type}`, error);
      continue;
    }
    (data || []).forEach(row => {
      const key = String(row.taggable_id);
      const current = results.get(key) || [];
      if (row.tags) {
        current.push(row.tags);
      }
      results.set(key, current);
    });
  }
  return results;
}

async function attachTagsToEvents(events) {
  const byType = new Map();
  events.forEach(event => {
    if (!event || !event.source_table) return;
    if (!byType.has(event.source_table)) {
      byType.set(event.source_table, new Set());
    }
    if (event.favoriteId != null) {
      byType.get(event.source_table).add(event.favoriteId);
    }
  });

  for (const [type, idSet] of byType.entries()) {
    const ids = Array.from(idSet).filter(id => id !== null && id !== undefined);
    if (!ids.length) continue;
    const tagMap = await fetchTagMapForType(type, ids);
    events.forEach(event => {
      if (event.source_table !== type) return;
      if (event.favoriteId == null) return;
      const tags = tagMap.get(String(event.favoriteId)) || [];
      event.tags = tags;
    });
  }
}

function computeLikeThisScore(event, currentEvent) {
  let score = 0;
  if (event.matchCount >= 2) {
    score += 3;
  } else if (event.matchCount >= 1) {
    score += 2;
  }
  if (
    event.area_id != null &&
    currentEvent?.areaId != null &&
    Number(event.area_id) === Number(currentEvent.areaId)
  ) {
    score += 2;
  }
  if (event.startDateKey && currentEvent?.startDateKey && event.startDateKey === currentEvent.startDateKey) {
    score += 1;
  }
  return score;
}

function computeSameDayScore(event, currentEvent, currentTagSlugs) {
  let score = 0;
  if (
    event.area_id != null &&
    currentEvent?.areaId != null &&
    Number(event.area_id) === Number(currentEvent.areaId)
  ) {
    score += 3;
  }
  const eventTagSlugs = new Set((event.tags || []).map(tag => tag.slug));
  const shared = currentTagSlugs.some(slug => eventTagSlugs.has(slug));
  if (shared) {
    score += 2;
  }
  return score;
}

async function buildLikeThisRecommendations(currentEvent, tagSlugs, excludeKey) {
  if (!tagSlugs.length) return [];
  const { data: tagRows, error: tagError } = await supabase
    .from('tags')
    .select('id, slug')
    .in('slug', tagSlugs);
  if (tagError) {
    console.error('Failed to load tag metadata', tagError);
    return [];
  }
  const tagIdToSlug = new Map();
  (tagRows || []).forEach(row => {
    if (row?.id != null && row.slug) {
      tagIdToSlug.set(String(row.id), row.slug);
    }
  });
  const tagIds = Array.from(tagIdToSlug.keys()).map(id => Number(id));
  if (!tagIds.length) return [];

  const { data: taggingRows, error: taggingError } = await supabase
    .from('taggings')
    .select('tag_id, taggable_id, taggable_type')
    .in('tag_id', tagIds);
  if (taggingError) {
    console.error('Failed to load taggings for recommendations', taggingError);
    return [];
  }

  const candidateMap = new Map();
  (taggingRows || []).forEach(row => {
    if (!row?.taggable_type || row.taggable_id == null) return;
    const key = `${row.taggable_type}:${row.taggable_id}`;
    if (key === excludeKey) return;
    if (!candidateMap.has(key)) {
      candidateMap.set(key, {
        type: row.taggable_type,
        id: row.taggable_id,
        tagIds: new Set(),
      });
    }
    const entry = candidateMap.get(key);
    entry.tagIds.add(String(row.tag_id));
  });

  const typeToIds = new Map();
  for (const entry of candidateMap.values()) {
    if (!RECOMMENDATION_SOURCES[entry.type]) continue;
    if (!typeToIds.has(entry.type)) {
      typeToIds.set(entry.type, new Set());
    }
    typeToIds.get(entry.type).add(entry.id);
  }

  const allEvents = [];

  for (const [type, idSet] of typeToIds.entries()) {
    const ids = Array.from(idSet);
    const events = await fetchRecordsByIds(type, ids);
    events.forEach(event => {
      const matchKey = `${type}:${event.sourceId}`;
      const sourceMatch = candidateMap.get(matchKey);
      if (!sourceMatch) return;
      const slugs = Array.from(sourceMatch.tagIds)
        .map(tagId => tagIdToSlug.get(tagId))
        .filter(Boolean);
      event.matchedTagSlugs = slugs;
      event.matchCount = slugs.length;
      allEvents.push(event);
    });
  }

  await attachTagsToEvents(allEvents);

  return allEvents;
}

async function buildSameDayRecommendations(currentEvent, excludeKey) {
  if (!currentEvent?.startDateKey) return [];
  const targetKey = currentEvent.startDateKey;
  const results = [];
  const seenKeys = new Set();
  for (const [type, config] of Object.entries(RECOMMENDATION_SOURCES)) {
    let query = supabase.from(config.table).select(config.select);
    if (config.orderColumn) {
      query = query.order(config.orderColumn, { ascending: true });
    }
    query = query.limit(250);
    const { data, error } = await query;
    if (error) {
      console.error(`Failed to load ${config.table} for day matching`, error);
      continue;
    }
    (data || [])
      .map(row => mapRowToRecommendation(row, type))
      .filter(Boolean)
      .forEach(event => {
        const key = `${type}:${event.sourceId}`;
        if (key === excludeKey) return;
        if (occursOnDate(event, targetKey)) {
          if (seenKeys.has(event.key)) return;
          seenKeys.add(event.key);
          results.push(event);
        }
      });
  }

  await attachTagsToEvents(results);
  return results;
}

function prepareRowForDisplay(event, areaMap) {
  const schedule = buildScheduleCopy(event);
  event.metaLabel = buildMetaLabel(event);
  event.timeLabel = schedule.timeLabel;
  attachAreaName(event, areaMap);
  return event;
}

export default function EventDetailPage() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);
  const { areaMap } = useAreaCache();

  const [rawEvent, setRawEvent] = useState(null);
  const [tags, setTags] = useState([]);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [likeThis, setLikeThis] = useState([]);
  const [sameDay, setSameDay] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadEvent() {
      setLoadingEvent(true);
      setLoadError('');
      setRawEvent(null);
      setTags([]);
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            venues:venue_id ( id, name, slug, short_address, address, area_id, latitude, longitude )
          `)
          .eq('slug', slug)
          .maybeSingle();
        if (!active) return;
        if (error) {
          console.error('Failed to load event', error);
          setLoadError('We could not load this event right now.');
          setRawEvent(null);
          return;
        }
        setRawEvent(data || null);
        if (data?.id) {
          const { data: tagRows, error: tagError } = await supabase
            .from('taggings')
            .select('tags(name, slug)')
            .eq('taggable_type', 'events')
            .eq('taggable_id', data.id);
          if (!active) return;
          if (tagError) {
            console.error('Failed to load event tags', tagError);
            setTags([]);
          } else {
            setTags((tagRows || []).map(row => row.tags).filter(Boolean));
          }
        }
      } catch (err) {
        if (!active) return;
        console.error('Unexpected event load error', err);
        setLoadError('We could not load this event right now.');
        setRawEvent(null);
        setTags([]);
      } finally {
        if (active) {
          setLoadingEvent(false);
        }
      }
    }

    loadEvent();
    return () => {
      active = false;
    };
  }, [slug]);

  const normalizedEvent = useMemo(() => normalizeEventRecord(rawEvent), [rawEvent]);
  const schedule = useMemo(() => buildScheduleCopy(normalizedEvent), [normalizedEvent]);
  const favoriteState = useEventFavorite({
    event_id: normalizedEvent?.id ?? null,
    source_table: 'events',
  });

  const tagSlugs = useMemo(
    () => tags.map(tag => (tag?.slug || '').toLowerCase()).filter(Boolean),
    [tags],
  );

  const isOwner = useMemo(() => {
    if (!user || !rawEvent) return false;
    const userId = String(user.id);
    const candidates = [
      rawEvent.owner_id,
      rawEvent.owner_user_id,
      rawEvent.user_id,
      rawEvent.created_by,
    ]
      .map(value => {
        if (value === null || value === undefined) return '';
        return String(value);
      })
      .filter(Boolean);
    return candidates.includes(userId);
  }, [user, rawEvent]);

  const neighborhoodEntry = useMemo(() => {
    if (!normalizedEvent) return null;
    const primary = resolveNeighborhood(areaMap, normalizedEvent.areaId);
    if (primary) return primary;
    if (normalizedEvent.venueAreaId != null) {
      const secondary = resolveNeighborhood(areaMap, normalizedEvent.venueAreaId);
      if (secondary) return secondary;
    }
    return null;
  }, [normalizedEvent, areaMap]);

  useEffect(() => {
    if (!normalizedEvent) {
      setLikeThis([]);
      setSameDay([]);
      return;
    }
    let active = true;
    const excludeKey = normalizedEvent?.id != null ? `events:${normalizedEvent.id}` : null;
    async function loadRecommendations() {
      setLoadingRecommendations(true);
      try {
        const [likeResults, sameDayResults] = await Promise.all([
          buildLikeThisRecommendations(normalizedEvent, tagSlugs, excludeKey),
          buildSameDayRecommendations(normalizedEvent, excludeKey),
        ]);
        if (!active) return;
        setLikeThis(likeResults);
        setSameDay(sameDayResults);
      } catch (err) {
        if (!active) return;
        console.error('Recommendation load error', err);
        setLikeThis([]);
        setSameDay([]);
      } finally {
        if (active) {
          setLoadingRecommendations(false);
        }
      }
    }

    loadRecommendations();
    return () => {
      active = false;
    };
  }, [normalizedEvent?.id, normalizedEvent?.startDateKey, tagSlugs.join(',')]);

  const canonicalUrl = `${SITE_BASE_URL}/events/${slug}`;
  const eventTitle = normalizedEvent?.title || (loadingEvent ? 'Loading event…' : '');
  const seoDescription = buildSeoDescription(normalizedEvent?.description) || FALLBACK_EVENT_DESCRIPTION;
  const heroImage = ensureAbsoluteImage(normalizedEvent?.heroImageUrl) || DEFAULT_OG_IMAGE;
  const ogImage = ensureAbsoluteUrl(heroImage) || DEFAULT_OG_IMAGE;
  const locationName = normalizedEvent?.venue?.name || neighborhoodEntry?.name || 'Philadelphia';
  const startForJson = normalizedEvent?.startDateTime || normalizedEvent?.startDate || null;
  const endForJson = normalizedEvent?.endDateTime || normalizedEvent?.endDate || startForJson;
  const jsonLd =
    eventTitle && startForJson
      ? buildEventJsonLd({
          name: eventTitle,
          canonicalUrl,
          startDate: startForJson.toISOString(),
          endDate: endForJson ? endForJson.toISOString() : startForJson.toISOString(),
          locationName,
          description: seoDescription,
          image: ogImage,
        })
      : null;

  const neighborhoodLabel = neighborhoodEntry?.name || 'Neighborhood TBA';
  const shortAddress = normalizedEvent?.address || normalizedEvent?.fullAddress || '';
  const mapEvents = useMemo(() => {
    if (!normalizedEvent) return [];
    const { latitude, longitude } = normalizedEvent;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return [];
    }
    return [
      {
        id: normalizedEvent.id || slug,
        latitude,
        longitude,
        title: normalizedEvent.title || 'Event',
        startDate: normalizedEvent.startDateTime || normalizedEvent.startDate || null,
        endDate: normalizedEvent.endDateTime || normalizedEvent.endDate || normalizedEvent.startDate || null,
        detailPath: `/events/${slug}`,
      },
    ];
  }, [normalizedEvent, slug]);

  const preparedLikeThis = useMemo(() => {
    return likeThis
      .map(event => prepareRowForDisplay({ ...event }, areaMap))
      .map(event => ({
        ...event,
        score: computeLikeThisScore(event, normalizedEvent),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aTime = a.startDateTime ? a.startDateTime.getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.startDateTime ? b.startDateTime.getTime() : Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 15);
  }, [likeThis, areaMap, normalizedEvent]);

  const preparedSameDay = useMemo(() => {
    const currentTagSet = new Set(tagSlugs);
    return sameDay
      .map(event => prepareRowForDisplay({ ...event }, areaMap))
      .map(event => ({
        ...event,
        score: computeSameDayScore(event, normalizedEvent, Array.from(currentTagSet)),
      }))
      .filter(event => occursOnDate(event, normalizedEvent?.startDateKey))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aTime = a.startDateTime ? a.startDateTime.getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.startDateTime ? b.startDateTime.getTime() : Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 15);
  }, [sameDay, areaMap, normalizedEvent, tagSlugs]);

  const ownerUsername = normalizedEvent?.ownerUsername;
  const headerAddToPlans = (
    <button
      type="button"
      onClick={() => {
        if (!normalizedEvent?.id) return;
        if (!user) {
          window.location.href = '/login';
          return;
        }
        favoriteState.toggleFavorite();
      }}
      disabled={favoriteState.loading || !normalizedEvent?.id}
      className={`hidden md:inline-flex items-center gap-2 rounded-full border border-indigo-600 px-5 py-2 text-sm font-semibold transition ${
        favoriteState.isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      {favoriteState.isFavorite ? 'In the Plans' : 'Add to Plans'}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Seo
        title={eventTitle ? `${eventTitle} – Our Philly` : FALLBACK_EVENT_TITLE}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="event"
        jsonLd={jsonLd}
      />
      <Navbar />
      <main className="flex-1 pb-24">
        <header
          className="sticky z-30"
          style={{ top: HEADER_OFFSET }}
        >
          <div
            className="border-b border-gray-200 bg-white/90 backdrop-blur"
            style={{
              marginLeft: 'calc(50% - 50vw)',
              width: '100vw',
            }}
          >
            <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-2">
                <h1 className="text-xl font-semibold text-slate-900 md:text-2xl lg:text-3xl">
                  {eventTitle || 'Event details coming soon'}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  {schedule.dateLabel && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">When:</span>
                      <span>{schedule.dateLabel}</span>
                    </div>
                  )}
                  {schedule.timeLabel && schedule.timeLabel !== 'Time TBA' && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">Time:</span>
                      <span>{schedule.timeLabel}</span>
                    </div>
                  )}
                  {schedule.timeLabel === 'Time TBA' && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">Time:</span>
                      <span>Time TBA</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">Where:</span>
                    <span className="font-semibold text-indigo-600">📍 {neighborhoodLabel}</span>
                    {shortAddress && <span className="text-slate-500">{shortAddress}</span>}
                  </div>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <Link
                        key={tag.slug}
                        to={`/tags/${tag.slug}`}
                        className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700"
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
                {ownerUsername && (
                  <div className="text-sm text-slate-600">
                    Submitted by <span className="font-semibold">@{ownerUsername}</span>
                  </div>
                )}
              </div>
              {headerAddToPlans}
            </div>
          </div>
        </header>

        {loadError && (
          <div className="mx-auto max-w-screen-xl px-4 pt-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {loadError}
            </div>
          </div>
        )}

        <section className="mx-auto grid max-w-screen-xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <article className="flex flex-col gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">About this event</h2>
              {normalizedEvent?.description ? (
                <p className="text-base leading-7 text-slate-700 whitespace-pre-line">
                  {normalizedEvent.description}
                </p>
              ) : (
                <p className="text-base text-slate-500">Details coming soon.</p>
              )}
              {(normalizedEvent?.websiteUrl || isOwner) && (
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-indigo-600">
                  {normalizedEvent?.websiteUrl && (
                    <a
                      href={normalizedEvent.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      See original listing
                    </a>
                  )}
                  {isOwner && normalizedEvent?.id && (
                    <>
                      <Link to={`/events/${slug}/edit`} className="hover:underline">
                        Edit
                      </Link>
                      <Link to={`/events/${slug}/delete`} className="text-rose-600 hover:underline">
                        Delete
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {mapEvents.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Map</h3>
                <MonthlyEventsMap events={mapEvents} height={320} />
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Event image</h3>
              <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow">
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt={eventTitle || 'Event image'}
                    className="h-full w-full max-h-[520px] object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                    Image coming soon
                  </div>
                )}
              </div>
            </div>
          </article>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow">
              <h3 className="text-base font-semibold text-slate-900">Event details</h3>
              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <div>
                  <dt className="font-semibold text-slate-800">When</dt>
                  <dd>{schedule.dateLabel || 'Date coming soon'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800">Time</dt>
                  <dd>{schedule.timeLabel || 'Time TBA'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800">Neighborhood</dt>
                  <dd>{neighborhoodLabel}</dd>
                </div>
                {shortAddress && (
                  <div>
                    <dt className="font-semibold text-slate-800">Address</dt>
                    <dd>{shortAddress}</dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </section>

        <section className="mx-auto flex max-w-screen-xl flex-col gap-8 px-4 py-12">
          {preparedLikeThis.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">More events like this</h2>
              </div>
              <div className="space-y-4">
                {preparedLikeThis.map(event => (
                  <PlansListRow key={event.key} event={event} tags={event.tags || []} />
                ))}
              </div>
            </div>
          )}

          {normalizedEvent?.startDateKey && preparedSameDay.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">More happening nearby this day</h2>
              </div>
              <div className="space-y-4">
                {preparedSameDay.map(event => (
                  <PlansListRow key={event.key} event={event} tags={event.tags || []} />
                ))}
              </div>
            </div>
          )}

          {!loadingRecommendations && preparedLikeThis.length === 0 && tagSlugs.length > 0 && (
            <p className="text-sm text-slate-500">No similar events found right now. Check back later!</p>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
