import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { RRule } from 'rrule';
import Navbar from './Navbar';
import { supabase } from './supabaseClient';
import { getDetailPathForItem } from './utils/eventDetailPaths';

const SOURCE_LABELS = {
  events: 'Tradition',
  big_board_events: 'Submission',
  all_events: 'Event',
  group_events: 'Group Event',
  recurring_events: 'Recurring',
};

const SOURCE_STYLES = {
  events: 'bg-yellow-100 text-yellow-800',
  big_board_events: 'bg-purple-100 text-purple-800',
  all_events: 'bg-blue-100 text-blue-800',
  group_events: 'bg-emerald-100 text-emerald-800',
  recurring_events: 'bg-orange-100 text-orange-800',
};

const TAG_PILL_STYLES = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

const PRIORITY_TAGS = [
  'arts',
  'fitness',
  'halloween',
  'family',
  'music',
  'markets',
  'nomnomslurp',
  'pride',
  'traditions',
  'sports',
];

const parseTraditionDate = datesStr => {
  if (!datesStr) return null;
  const [first] = datesStr.split(/through|–|-/);
  const parts = first.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const parseLocalYMD = str => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const toPhillyMidnight = date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const formatTime = timeStr => {
  if (!timeStr) return '';
  const [hourRaw, minuteRaw = '00'] = timeStr.split(':');
  let hour = Number.parseInt(hourRaw, 10);
  if (Number.isNaN(hour)) return '';
  const minutes = minuteRaw.slice(0, 2);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
};

const startOfWeek = date => {
  const start = toPhillyMidnight(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const formatRelativeDay = (date, today, timeStr) => {
  if (!date) return '';
  const eventDay = toPhillyMidnight(date);
  const baseDay = toPhillyMidnight(today);
  const diffMs = eventDay.getTime() - baseDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const longDay = eventDay.toLocaleDateString('en-US', { weekday: 'long' });
  const shortDay = eventDay.toLocaleDateString('en-US', { weekday: 'short' });
  let prefix;

  if (diffDays === 0) {
    prefix = 'Today';
  } else if (diffDays === 1) {
    prefix = 'Tomorrow';
  } else {
    const currentWeekStart = startOfWeek(baseDay);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

    if (eventDay >= currentWeekStart && eventDay <= currentWeekEnd) {
      prefix = `This ${longDay}`;
    } else if (eventDay >= nextWeekStart && eventDay <= nextWeekEnd) {
      prefix = `Next ${shortDay}`;
    } else {
      const formattedDate = eventDay.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      prefix = `${shortDay}, ${formattedDate}`;
    }
  }

  const timeLabel = formatTime(timeStr);
  return timeLabel ? `${prefix} • ${timeLabel}` : prefix;
};

const expandRecurring = (rows, today) => {
  const output = [];
  const windowEnd = new Date(today);
  windowEnd.setMonth(windowEnd.getMonth() + 3);

  (rows || []).forEach(row => {
    if (!row.rrule || !row.start_date) return;
    try {
      const opts = RRule.parseString(row.rrule);
      const startTime = row.start_time || '00:00:00';
      const dtstart = new Date(`${row.start_date}T${startTime}`);
      if (Number.isNaN(dtstart.getTime())) return;
      opts.dtstart = dtstart;
      if (row.end_date) {
        const until = new Date(`${row.end_date}T23:59:59`);
        if (!Number.isNaN(until.getTime())) opts.until = until;
      }
      const rule = new RRule(opts);
      const occurrences = rule.between(today, windowEnd, true).slice(0, 6);
      occurrences.forEach((occ, idx) => {
        const dateStr = occ.toISOString().slice(0, 10);
        const detailPath =
          getDetailPathForItem({
            ...row,
            slug: row.slug,
            start_date: dateStr,
            source_table: 'recurring_events',
          }) || `/series/${row.slug}/${dateStr}`;
        output.push({
          key: `rec-${row.id}-${dateStr}-${idx}`,
          id: row.id,
          type: 'recurring_events',
          slug: detailPath,
          name: row.name,
          start: occ,
          end: occ,
          image: row.image_url || '',
          area_id: row.area_id ?? null,
          start_time: row.start_time || null,
        });
      });
    } catch (err) {
      console.error('recurring parse error', err);
    }
  });

  return output;
};

const resolveAreaName = (lookup, rawId) => {
  if (rawId === null || rawId === undefined) return '';
  if (lookup[rawId]) return lookup[rawId];
  const key = typeof rawId === 'number' ? rawId.toString() : rawId;
  return lookup[key] || '';
};

export default function ScreenshotsPage() {
  const [navHeight, setNavHeight] = useState(0);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const navEl = document.querySelector('nav');
    if (!navEl) return;
    const updateHeight = () => setNavHeight(navEl.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(navEl);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    supabase
      .from('tags')
      .select('name,slug')
      .order('name', { ascending: true })
      .then(({ data, error: tagError }) => {
        if (tagError) {
          console.error(tagError);
          return;
        }
        if (!data) {
          setTags([]);
          return;
        }
        const prioritySet = new Set(PRIORITY_TAGS);
        const prioritized = [...data].sort((a, b) => {
          const aPriority = prioritySet.has(a.slug) ? 0 : 1;
          const bPriority = prioritySet.has(b.slug) ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.name.localeCompare(b.name);
        });
        setTags(prioritized);
      });
  }, []);

  useEffect(() => {
    const loadEvents = async tagSlug => {
      setLoading(true);
      setError(null);
      const today = toPhillyMidnight(new Date());
      const todayIso = today.toISOString().slice(0, 10);

      try {
        const { data: areaRows = [], error: areasError } = await supabase
          .from('areas')
          .select('id,name');
        if (areasError) {
          throw new Error(`Failed to load neighborhoods: ${areasError.message}`);
        }
        const lookup = {};
        areaRows.forEach(area => {
          if (area?.id === undefined || area?.id === null) return;
          lookup[area.id] = area.name || '';
        });

        const filteredTag = tagSlug && tagSlug !== 'all' ? tagSlug : null;
        let idsByType = {
          events: [],
          big_board_events: [],
          all_events: [],
          group_events: [],
          recurring_events: [],
        };

        if (filteredTag) {
          const { data: tagRow, error: tagLookupError } = await supabase
            .from('tags')
            .select('id')
            .eq('slug', filteredTag)
            .single();
          if (tagLookupError) throw tagLookupError;
          if (!tagRow?.id) {
            setEvents([]);
            setLoading(false);
            return;
          }
          const { data: taggings = [] } = await supabase
            .from('taggings')
            .select('taggable_id,taggable_type')
            .eq('tag_id', tagRow.id)
            .in('taggable_type', [
              'events',
              'big_board_events',
              'all_events',
              'group_events',
              'recurring_events',
            ]);
          taggings.forEach(row => {
            if (idsByType[row.taggable_type]) {
              idsByType[row.taggable_type].push(row.taggable_id);
            }
          });
          const hasAny = Object.values(idsByType).some(arr => arr.length > 0);
          if (!hasAny) {
            setEvents([]);
            setLoading(false);
            return;
          }
        }

        const queryWithIds = (query, type) => {
          if (!filteredTag) return query;
          const ids = idsByType[type];
          if (!ids?.length) return null;
          return query.in('id', ids);
        };

        const eventsQuery = queryWithIds(
          supabase
            .from('events')
            .select('id,"E Name","E Image",slug,Dates,"End Date",start_time,area_id'),
          'events'
        );

        const bigBoardQuery = queryWithIds(
          supabase
            .from('big_board_events')
            .select(
              'id,title,slug,start_date,end_date,start_time,description,area_id,big_board_posts!big_board_posts_event_id_fkey(image_url)'
            )
            .or(
              `start_date.gte.${todayIso},and(end_date.not.is.null,end_date.gte.${todayIso})`
            )
            .order('start_date', { ascending: true }),
          'big_board_events'
        );

        const allEventsQuery = queryWithIds(
          supabase
            .from('all_events')
            .select(
              'id,name,slug,image,description,start_date,end_date,start_time,area_id,venue_id(name,slug,area_id)'
            )
            .or(
              `start_date.gte.${todayIso},and(end_date.not.is.null,end_date.gte.${todayIso})`
            )
            .order('start_date', { ascending: true }),
          'all_events'
        );

        const groupEventsQuery = queryWithIds(
          supabase
            .from('group_events')
            .select('id,title,slug,start_date,end_date,start_time,image_url,group_id,area_id')
            .or(
              `start_date.gte.${todayIso},and(end_date.not.is.null,end_date.gte.${todayIso})`
            )
            .order('start_date', { ascending: true }),
          'group_events'
        );

        const recurringQuery = queryWithIds(
          supabase
            .from('recurring_events')
            .select('id,name,slug,start_date,end_date,start_time,rrule,image_url,area_id')
            .eq('is_active', true),
          'recurring_events'
        );

        const safeQuery = query => (query ? query : Promise.resolve({ data: [], error: null }));
        const [eventsRes, bigBoardRes, allRes, groupRes, recurringRes] = await Promise.all([
          safeQuery(eventsQuery),
          safeQuery(bigBoardQuery),
          safeQuery(allEventsQuery),
          safeQuery(groupEventsQuery),
          safeQuery(recurringQuery),
        ]);

        const firstError = [eventsRes, bigBoardRes, allRes, groupRes, recurringRes]
          .map(res => res?.error)
          .find(Boolean);
        if (firstError) {
          throw new Error(`Failed to load events: ${firstError.message}`);
        }

        let groupLookup = {};
        if (groupRes?.data?.length) {
          const groupIds = [...new Set(groupRes.data.map(ev => ev.group_id).filter(Boolean))];
          if (groupIds.length) {
            const { data: groupsData = [], error: groupsError } = await supabase
              .from('groups')
              .select('id,slug,name')
              .in('id', groupIds);
            if (groupsError) {
              console.error('Failed to load groups', groupsError);
            } else if (Array.isArray(groupsData)) {
              groupLookup = groupsData.reduce((acc, row) => {
                if (!row?.id) return acc;
                acc[row.id] = { slug: row.slug, name: row.name };
                return acc;
              }, {});
            }
          }
        }

        const merged = [];

        (eventsRes?.data || []).forEach(row => {
          const start = parseTraditionDate(row.Dates);
          const end = row['End Date'] ? parseTraditionDate(row['End Date']) : start;
          if (!start) return;
          if (end && end < today) return;
          const detailPath =
            getDetailPathForItem({
              ...row,
              slug: row.slug,
            }) || `/events/${row.slug}`;
          merged.push({
            key: `events-${row.id}`,
            id: row.id,
            type: 'events',
            slug: detailPath,
            name: row['E Name'],
            start,
            end: end || start,
            image: row['E Image'] || '',
            area_id: row.area_id ?? null,
            start_time: row.start_time || null,
          });
        });

        (bigBoardRes?.data || []).forEach(row => {
          const start = parseLocalYMD(row.start_date);
          const end = row.end_date ? parseLocalYMD(row.end_date) : start;
          if (!start) return;
          if (end && end < today) return;
          const storageKey = row.big_board_posts?.[0]?.image_url;
          let imageUrl = '';
          if (storageKey) {
            const { data } = supabase.storage.from('big-board').getPublicUrl(storageKey);
            imageUrl = data?.publicUrl || '';
          }
          const detailPath =
            getDetailPathForItem({
              ...row,
              isBigBoard: true,
            }) || `/big-board/${row.slug}`;
          merged.push({
            key: `big-${row.id}`,
            id: row.id,
            type: 'big_board_events',
            slug: detailPath,
            name: row.title,
            start,
            end: end || start,
            image: imageUrl,
            area_id: row.area_id ?? null,
            start_time: row.start_time || null,
          });
        });

        (allRes?.data || []).forEach(row => {
          const start = parseLocalYMD(row.start_date);
          const end = row.end_date ? parseLocalYMD(row.end_date) : start;
          if (!start) return;
          if (end && end < today) return;
          const detailPath =
            getDetailPathForItem({
              ...row,
              slug: row.slug,
              venues: row.venue_id
                ? { name: row.venue_id.name, slug: row.venue_id.slug }
                : null,
            }) || (row.venue_id?.slug ? `/${row.venue_id.slug}/${row.slug}` : `/${row.slug}`);
          merged.push({
            key: `all-${row.id}`,
            id: row.id,
            type: 'all_events',
            slug: detailPath,
            name: row.name,
            start,
            end: end || start,
            image: row.image || '',
            area_id: row.area_id ?? row.venue_id?.area_id ?? null,
            start_time: row.start_time || null,
            venue_name: row.venue_id?.name || null,
          });
        });

        (groupRes?.data || []).forEach(row => {
          const start = parseLocalYMD(row.start_date);
          const end = row.end_date ? parseLocalYMD(row.end_date) : start;
          if (!start) return;
          if (end && end < today) return;
          const groupInfo = row.group_id ? groupLookup[row.group_id] : null;
          const groupSlug = groupInfo?.slug || null;
          const detailPath =
            getDetailPathForItem({
              ...row,
              group_slug: groupSlug,
              isGroupEvent: true,
            }) || (groupSlug ? `/groups/${groupSlug}/events/${row.slug}` : null);
          let imageUrl = '';
          if (row.image_url) {
            imageUrl = row.image_url.startsWith('http')
              ? row.image_url
              : supabase.storage.from('big-board').getPublicUrl(row.image_url).data?.publicUrl || '';
          }
          merged.push({
            key: `group-${row.id}`,
            id: row.id,
            type: 'group_events',
            slug: detailPath,
            name: row.title,
            start,
            end: end || start,
            image: imageUrl,
            area_id: row.area_id ?? null,
            start_time: row.start_time || null,
            group_name: groupInfo?.name || null,
          });
        });

        const recurringItems = recurringRes ? expandRecurring(recurringRes.data || [], today) : [];
        merged.push(...recurringItems);

        const upcoming = merged
          .filter(item => {
            if (!item.start) return false;
            if (item.end && item.end < today) return false;
            return item.start >= today || (item.end && item.end >= today);
          })
          .sort((a, b) => a.start - b.start)
          .slice(0, 25)
          .map(item => {
            const url = item.slug || '';
            const isExternal = typeof url === 'string' && url.startsWith('http');
            const href = isExternal
              ? url
              : url
              ? `${url.startsWith('/') ? '' : '/'}${url}`
              : '';
            return {
              ...item,
              href,
              isExternal,
              dateLabel: formatRelativeDay(item.start, today, item.start_time),
              areaName: resolveAreaName(lookup, item.area_id),
              venueName: item.venue_name || null,
              groupName: item.group_name || null,
            };
          });

        setEvents(upcoming);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Something went wrong loading events.');
        setEvents([]);
        setLoading(false);
      }
    };

    loadEvents(selectedTag);
  }, [selectedTag]);

  const tagButtons = useMemo(() => {
    return [
      { slug: 'all', name: 'All' },
      ...tags.map(tag => ({ slug: tag.slug, name: tag.name })),
    ];
  }, [tags]);

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 pb-24" style={{ paddingTop: navHeight + 24 }}>
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Screenshot-ready Philly events
          </h1>
          <p className="text-lg text-slate-600">
            Toggle a tag to load the next 25 events from our traditions, recurring series, group happenings, and submissions.
          </p>
        </header>

        <div className="flex overflow-x-auto gap-3 pb-4 mb-8">
          {tagButtons.map((tag, index) => {
            const isActive = tag.slug === selectedTag;
            const baseClass = TAG_PILL_STYLES[index % TAG_PILL_STYLES.length];
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => setSelectedTag(tag.slug)}
                className={`whitespace-nowrap rounded-full px-5 py-2.5 text-base md:text-lg font-semibold transition ${
                  baseClass
                } ${
                  isActive
                    ? 'ring-2 ring-offset-2 ring-[#bf3d35] ring-offset-slate-50 shadow-md scale-105'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="py-20 text-center text-xl text-slate-600">Loading events…</div>
        )}

        {error && !loading && (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-lg">
            {error}
          </div>
        )}

        {!loading && !events.length && !error && (
          <div className="py-20 text-center text-xl text-slate-600">
            No upcoming events found for this tag.
          </div>
        )}

        <div className="grid gap-6">
          {events.map(event => {
            const typeLabel = SOURCE_LABELS[event.type] || '';
            const typeClass = SOURCE_STYLES[event.type] || 'bg-slate-200 text-slate-700';
            const imageContent = event.image ? (
              <img
                src={event.image}
                alt={event.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-500">
                No image
              </div>
            );

            const Wrapper = event.href
              ? event.isExternal
                ? 'a'
                : Link
              : 'div';

            const wrapperProps = event.href
              ? event.isExternal
                ? { href: event.href, target: '_blank', rel: 'noopener noreferrer' }
                : { to: event.href }
              : {};

            return (
              <Wrapper
                key={event.key}
                {...wrapperProps}
                className="block rounded-3xl bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    <div className="h-48 w-full overflow-hidden rounded-2xl bg-slate-200 md:w-60">
                      {imageContent}
                    </div>
                    <div className="flex-1">
                      <div className="mb-4 flex flex-wrap items-center gap-3 text-lg md:text-xl">
                        {event.dateLabel && (
                          <span className="rounded-full bg-indigo-100 px-4 py-2 font-semibold text-indigo-800">
                            {event.dateLabel}
                          </span>
                        )}
                        {event.areaName && (
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#f2cfc3] px-4 py-2 font-semibold text-[#29313f]">
                            <MapPin className="h-4 w-4 text-[#bf3d35]" aria-hidden="true" />
                            {event.areaName}
                          </span>
                        )}
                        {typeLabel && (
                          <span className={`rounded-full px-4 py-2 font-semibold ${typeClass}`}>
                            {typeLabel}
                          </span>
                        )}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 leading-tight">
                        {event.name}
                      </h2>
                      {(event.venueName || event.groupName) && (
                        <div className="space-y-1 text-base text-slate-600">
                          {event.venueName && <p>at {event.venueName}</p>}
                          {event.groupName && <p>by {event.groupName}</p>}
                        </div>
                      )}
                    </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}
