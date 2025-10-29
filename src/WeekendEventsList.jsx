import React, { useEffect, useMemo, useState } from 'react';
import { RRule } from 'rrule';
import { supabase } from './supabaseClient';
import { getDetailPathForItem } from './utils/eventDetailPaths';
import {
  PHILLY_TIME_ZONE,
  getWeekendWindow,
  parseISODate,
  parseMonthDayYear,
  overlaps,
  setEndOfDay,
  setStartOfDay,
} from './utils/dateUtils';

function toPhillyISODate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PHILLY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '';
  const [rawHours, rawMinutes] = value.split(':');
  let hours = Number(rawHours);
  if (Number.isNaN(hours)) return '';
  const minutes = rawMinutes ? rawMinutes.padStart(2, '0') : '00';
  const meridiem = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${meridiem}`;
}

function resolveGroup(groups) {
  if (!groups) return null;
  if (Array.isArray(groups)) return groups[0] || null;
  return groups;
}

function buildLocationString(location) {
  if (!location) return '';
  const { venueName, address, city, state, postal } = location;
  const parts = [venueName, address, city, state, postal].filter(Boolean);
  return parts.join(', ');
}

const SPORTS_FALLBACK_TAG = { name: 'Sports', slug: 'sports' };

function createLocationFromEvent(evt) {
  if (!evt) return null;
  return {
    venueName:
      evt.venue_name ||
      evt.venueName ||
      evt.location_name ||
      evt.locationName ||
      evt.venues?.name ||
      '',
    address:
      evt.address ||
      evt.street_address ||
      evt.streetAddress ||
      evt.location ||
      evt.location_summary ||
      evt.locationSummary ||
      evt.area_description ||
      evt.areaDescription ||
      '',
    city: evt.city || evt.city_name || evt.cityName || evt.town || '',
    state: evt.state || evt.state_code || evt.stateCode || '',
    postal: evt.zip || evt.zip_code || evt.postal_code || evt.postalCode || '',
  };
}

function enrichWithLocation(record, extraLocation = null) {
  if (record.location) return record;
  return {
    ...record,
    location: extraLocation || createLocationFromEvent(record),
  };
}

function buildDateRangeLabel(startDate, endDate) {
  if (!startDate) return '';
  const start = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (!endDate || endDate.getTime() === startDate.getTime()) {
    return start;
  }
  const end = endDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${start} – ${end}`;
}

function buildTimeRangeLabel(startTime, endTime) {
  const formattedStart = formatTime(startTime);
  const formattedEnd = formatTime(endTime);
  if (formattedStart && formattedEnd) return `${formattedStart} – ${formattedEnd}`;
  if (formattedStart) return formattedStart;
  if (formattedEnd) return formattedEnd;
  return '';
}

function normalizePageUrl(detailPath, fallback) {
  if (detailPath) {
    if (/^https?:\/\//i.test(detailPath)) return detailPath;
    return `https://www.ourphilly.org${detailPath}`;
  }
  if (!fallback) return null;
  if (/^https?:\/\//i.test(fallback)) return fallback;
  return `https://www.ourphilly.org${fallback.startsWith('/') ? fallback : `/${fallback}`}`;
}

const WeekendEventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { start: weekendStart, end: weekendEnd } = getWeekendWindow(new Date(), PHILLY_TIME_ZONE);
        const fridayStart = setStartOfDay(new Date(weekendStart));
        const saturdayStart = setStartOfDay(new Date(fridayStart));
        saturdayStart.setDate(fridayStart.getDate() + 1);
        const sundayStart = setStartOfDay(new Date(fridayStart));
        sundayStart.setDate(fridayStart.getDate() + 2);

        const saturdayKey = toPhillyISODate(saturdayStart);
        const sundayKey = toPhillyISODate(sundayStart);
        const weekendDayKeys = [saturdayKey, sundayKey];
        const weekendRangeStartKey = saturdayKey;
        const weekendRangeEndKey = sundayKey;

        const clientId = import.meta.env.VITE_SEATGEEK_CLIENT_ID;
        let sportsRecords = [];
        if (clientId) {
          const teamSlugs = [
            'philadelphia-phillies',
            'philadelphia-76ers',
            'philadelphia-eagles',
            'philadelphia-flyers',
            'philadelphia-union',
          ];
          const sportsResponses = await Promise.all(
            teamSlugs.map(slug =>
              fetch(
                `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=50&sort=datetime_local.asc&client_id=${clientId}`
              )
                .then(res => (res.ok ? res.json() : Promise.reject(new Error(`SeatGeek ${res.status}`))))
                .catch(() => ({ events: [] }))
            )
          );
          const sportsEvents = sportsResponses.flatMap(result => result.events || []);
          sportsRecords = sportsEvents
            .map(event => {
              const date = new Date(event.datetime_local);
              if (Number.isNaN(date.getTime())) return null;
              const startIso = date.toISOString().slice(0, 10);
              const startDate = parseISODate(startIso, PHILLY_TIME_ZONE);
              if (!startDate) return null;
              const endDate = setEndOfDay(new Date(startDate));
              const performers = event.performers || [];
              const home = performers.find(p => p.home_team) || performers[0] || {};
              const away = performers.find(p => p.id && p.id !== home.id) || {};
              const title =
                event.short_title ||
                `${(home.name || '').replace(/^Philadelphia\s+/i, '')} vs ${(away.name || '').replace(/^Philadelphia\s+/i, '')}`;
              const venue = event.venue || {};
              const location = {
                venueName: venue.name || '',
                address: venue.address || venue.extended_address || '',
                city: venue.city || '',
                state: venue.state || '',
                postal: venue.postal_code || '',
              };
              return {
                id: `sg-${event.id}`,
                name: title,
                title,
                description: event.description || 'Ticketed sports event in Philadelphia.',
                imageUrl: home.image || away.image || '',
                start_date: startIso,
                startDate,
                endDate,
                start_time: date.toTimeString().slice(0, 5),
                end_time: null,
                slug: event.id,
                url: event.url,
                isSports: true,
                isBigBoard: false,
                isGroupEvent: false,
                isRecurring: false,
                source_table: 'sg_events',
                taggableId: String(event.id),
                location,
              };
            })
            .filter(Boolean)
            .filter(evt => overlaps(evt.startDate, evt.endDate, weekendStart, weekendEnd));
        }

        let fetchAllEvents = supabase
          .from('all_events')
          .select(`*, venues:venue_id ( name, slug, latitude, longitude )`);

        if (weekendRangeStartKey && weekendRangeEndKey) {
          fetchAllEvents = fetchAllEvents
            .lte('start_date', weekendRangeEndKey)
            .or(
              `and(end_date.is.null,start_date.gte.${weekendRangeStartKey},start_date.lte.${weekendRangeEndKey}),` +
                `end_date.gte.${weekendRangeStartKey}`
            );
        }

        const fetchBigBoard = supabase
          .from('big_board_events')
          .select(`*, big_board_posts ( image_url, user_id )`)
          .order('start_date', { ascending: true });

        const fetchTraditions = supabase
          .from('events')
          .select(`id, slug, "E Name", "E Description", "E Image", Dates, "End Date"`);

        const fetchGroupEvents = supabase
          .from('group_events')
          .select(`*, groups(Name, imag, slug)`)
          .order('start_date', { ascending: true });

        const fetchRecurring = supabase
          .from('recurring_events')
          .select(`id, name, slug, description, address, link, start_date, end_date, start_time, end_time, rrule, image_url, latitude, longitude`)
          .eq('is_active', true);

        const fetchTags = supabase
          .from('tags')
          .select('name, slug');

        const [allRes, bigRes, tradRes, groupRes, recurringRes, tagsRes] = await Promise.all([
          fetchAllEvents,
          fetchBigBoard,
          fetchTraditions,
          fetchGroupEvents,
          fetchRecurring,
          fetchTags,
        ]);

        if (cancelled) return;

        const allTags = tagsRes.data || [];

        const rawAllEvents = allRes.data || [];
        const allRecords = rawAllEvents
          .map(evt => {
            const startKey = (evt.start_date || '').slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
            const rawEnd = (evt.end_date || evt.start_date || '').slice(0, 10);
            const endKey = /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? rawEnd : startKey;
            if (!weekendRangeStartKey || !weekendRangeEndKey) return null;
            const overlapsWeekendDay = weekendDayKeys.some(day => startKey <= day && endKey >= day);
            if (!overlapsWeekendDay) return null;

            const startMs = Date.parse(startKey);
            const endMs = Date.parse(endKey);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

            const spanDays = Math.floor(Math.max(0, endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
            const startsOnWeekendDay = weekendDayKeys.includes(startKey);
            if (spanDays > 10 && !startsOnWeekendDay) return null;

            const [ys, ms, ds] = startKey.split('-').map(Number);
            const [ye, me, de] = endKey.split('-').map(Number);
            const startDate = setStartOfDay(new Date(ys, ms - 1, ds));
            const endDate = setEndOfDay(new Date(ye, me - 1, de));

            return enrichWithLocation({
              id: evt.id,
              name: evt.name,
              title: evt.name,
              description: evt.description,
              link: evt.link,
              imageUrl: evt.image || '',
              start_date: evt.start_date,
              end_date: evt.end_date,
              startDate,
              endDate,
              start_time: evt.start_time,
              end_time: evt.end_time,
              slug: evt.slug,
              venues: evt.venues,
              source_table: 'all_events',
              taggableId: String(evt.id),
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: false,
              isSports: false,
            }, createLocationFromEvent(evt));
          })
          .filter(Boolean);

        const bigRecords = (bigRes.data || [])
          .map(evt => {
            const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
            const endDateRaw = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE);
            if (!startDate || !endDateRaw) return null;
            const endDate = setEndOfDay(new Date(endDateRaw));
            if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
            let imageUrl = '';
            const storageKey = evt.big_board_posts?.[0]?.image_url;
            if (storageKey) {
              const { data } = supabase.storage.from('big-board').getPublicUrl(storageKey);
              imageUrl = data?.publicUrl || '';
            }
            return enrichWithLocation({
              id: evt.id,
              name: evt.title,
              title: evt.title,
              description: evt.description,
              imageUrl,
              start_date: evt.start_date,
              end_date: evt.end_date,
              startDate,
              endDate,
              start_time: evt.start_time,
              end_time: evt.end_time,
              slug: evt.slug,
              source_table: 'big_board_events',
              taggableId: String(evt.id),
              isTradition: false,
              isBigBoard: true,
              isGroupEvent: false,
              isRecurring: false,
              isSports: false,
            }, createLocationFromEvent(evt));
          })
          .filter(Boolean);

        const traditionRecords = (tradRes.data || [])
          .map(evt => {
            const startDate = parseMonthDayYear(evt.Dates, PHILLY_TIME_ZONE);
            const endDateRaw = parseMonthDayYear(evt['End Date'], PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateRaw) return null;
            const endDate = setEndOfDay(new Date(endDateRaw));
            if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
            return {
              id: evt.id,
              name: evt['E Name'],
              title: evt['E Name'],
              description: evt['E Description'],
              imageUrl: evt['E Image'] || '',
              startDate,
              endDate,
              slug: evt.slug,
              source_table: 'events',
              taggableId: String(evt.id),
              isTradition: true,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: false,
              isSports: false,
            };
          })
          .filter(Boolean);

        const groupRecords = (groupRes.data || [])
          .map(evt => {
            const group = resolveGroup(evt.groups);
            const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
            const endDateRaw = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE);
            if (!startDate || !endDateRaw) return null;
            const endDate = setEndOfDay(new Date(endDateRaw));
            if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
            return enrichWithLocation({
              id: evt.id,
              name: evt.title,
              title: evt.title,
              description: evt.description,
              imageUrl: group?.imag || '',
              start_date: evt.start_date,
              end_date: evt.end_date,
              startDate,
              endDate,
              start_time: evt.start_time,
              end_time: evt.end_time,
              group_slug: group?.slug || null,
              slug: evt.slug || String(evt.id),
              groupName: group?.Name || group?.name || '',
              source_table: 'group_events',
              taggableId: String(evt.id),
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: true,
              isRecurring: false,
              isSports: false,
            }, createLocationFromEvent(evt));
          })
          .filter(Boolean);

        const recurringRaw = recurringRes.data || [];
        const startBoundary = new Date(weekendStart.getTime());
        const endBoundary = new Date(weekendEnd.getTime());
        const recurringRecords = recurringRaw.flatMap(series => {
          if (!series.rrule) return [];
          let opts;
          try {
            opts = RRule.parseString(series.rrule);
          } catch (error) {
            console.error('Invalid recurring rule', series.id, error);
            return [];
          }
          opts.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
          if (series.end_date) {
            opts.until = new Date(`${series.end_date}T23:59:59`);
          }
          const rule = new RRule(opts);
          return rule
            .between(startBoundary, endBoundary, true)
            .map(instance => {
              const local = new Date(instance.getFullYear(), instance.getMonth(), instance.getDate());
              const yyyy = local.getFullYear();
              const mm = String(local.getMonth() + 1).padStart(2, '0');
              const dd = String(local.getDate()).padStart(2, '0');
              const dateStr = `${yyyy}-${mm}-${dd}`;
              const startDate = parseISODate(dateStr, PHILLY_TIME_ZONE);
              if (!startDate) return null;
              const endDate = setEndOfDay(new Date(startDate));
              return enrichWithLocation({
                id: `${series.id}::${dateStr}`,
                name: series.name,
                title: series.name,
                description: series.description,
                imageUrl: series.image_url || '',
                start_date: dateStr,
                startDate,
                endDate,
                start_time: series.start_time,
                end_time: series.end_time,
                link: `/${series.slug}/${dateStr}`,
                address: series.address,
                slug: series.slug,
                source_table: 'recurring_events',
                taggableId: String(series.id),
                isTradition: false,
                isBigBoard: false,
                isGroupEvent: false,
                isRecurring: true,
                isSports: false,
              }, {
                venueName: '',
                address: series.address || '',
                city: '',
                state: '',
                postal: '',
              });
            })
            .filter(Boolean);
        });

        const combined = [
          ...sportsRecords,
          ...bigRecords,
          ...groupRecords,
          ...recurringRecords,
          ...traditionRecords,
          ...allRecords,
        ];

        const idsByType = combined.reduce((acc, evt) => {
          const type = evt.isSports ? 'sg_events' : evt.source_table;
          if (!type || !evt.taggableId) return acc;
          if (!acc[type]) acc[type] = new Set();
          acc[type].add(String(evt.taggableId));
          return acc;
        }, {});

        const tagMap = {};
        const tagRequests = Object.entries(idsByType)
          .filter(([type]) => type !== 'sg_events')
          .map(async ([type, ids]) => {
            const { data, error } = await supabase
              .from('taggings')
              .select('tags(name, slug), taggable_id')
              .eq('taggable_type', type)
              .in('taggable_id', Array.from(ids));
            if (error) {
              console.error('Failed to load tags', type, error);
              return;
            }
            data.forEach(({ taggable_id, tags }) => {
              if (!taggable_id || !tags) return;
              const key = `${type}:${taggable_id}`;
              tagMap[key] = tagMap[key] || [];
              tagMap[key].push(tags);
            });
          });

        await Promise.all(tagRequests);

        const sportsTag = allTags.find(tag => tag.slug === 'sports') || SPORTS_FALLBACK_TAG;
        if (idsByType.sg_events) {
          idsByType.sg_events.forEach(id => {
            const key = `sg_events:${id}`;
            tagMap[key] = tagMap[key] || [];
            tagMap[key].push(sportsTag);
          });
        }

        const enriched = combined.map(evt => {
          const type = evt.isSports ? 'sg_events' : evt.source_table;
          const key = type && evt.taggableId ? `${type}:${evt.taggableId}` : null;
          const tags = key ? tagMap[key] || [] : [];
          const detailPath = getDetailPathForItem(evt);
          const fallback = evt.href || evt.link || evt.url || null;
          const pageUrl = normalizePageUrl(detailPath, fallback);
          return {
            ...evt,
            tags,
            detailPath,
            pageUrl,
          };
        });

        const sorted = enriched.sort((a, b) => {
          if (!a.startDate || !b.startDate) return 0;
          const diff = a.startDate.getTime() - b.startDate.getTime();
          if (diff !== 0) return diff;
          const timeA = a.start_time || '';
          const timeB = b.start_time || '';
          return timeA.localeCompare(timeB);
        });

        if (!cancelled) {
          setEvents(sorted);
        }
      } catch (error) {
        console.error('Error building weekend events list', error);
        if (!cancelled) {
          setEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return <p className="text-gray-600">Loading the full weekend lineup…</p>;
    }

    if (!events.length) {
      return <p className="text-gray-600">We couldn’t find any events for this weekend yet.</p>;
    }

    return (
      <div className="space-y-10">
        {events.map(evt => {
          const dateLabel = buildDateRangeLabel(evt.startDate, evt.endDate);
          const timeLabel = buildTimeRangeLabel(evt.start_time, evt.end_time);
          const locationLabel = buildLocationString(evt.location);
          const tagsLabel = evt.tags?.length ? evt.tags.map(tag => tag.name).join(', ') : '';
          const description = evt.description || 'No description available.';
          return (
            <article key={`${evt.source_table || 'event'}-${evt.id}`} className="border-b border-gray-200 pb-6">
              <h3 className="text-2xl font-semibold text-indigo-800">{evt.name || evt.title}</h3>
              {dateLabel && (
                <p className="mt-2 text-sm text-gray-700">
                  <span className="font-semibold">Dates:</span> {dateLabel}
                </p>
              )}
              {timeLabel && (
                <p className="mt-1 text-sm text-gray-700">
                  <span className="font-semibold">Time:</span> {timeLabel}
                </p>
              )}
              {locationLabel && (
                <p className="mt-1 text-sm text-gray-700">
                  <span className="font-semibold">Location:</span> {locationLabel}
                </p>
              )}
              <p className="mt-3 text-base text-gray-800 whitespace-pre-line">{description}</p>
              {tagsLabel && (
                <p className="mt-3 text-sm text-gray-600">
                  <span className="font-semibold">Tags:</span> {tagsLabel}
                </p>
              )}
              {evt.pageUrl && (
                <p className="mt-4 text-sm text-indigo-700 break-words">
                  <span className="font-semibold">Our Philly link:</span>{' '}
                  <a href={evt.pageUrl} className="underline" target="_blank" rel="noopener noreferrer">
                    {evt.pageUrl}
                  </a>
                </p>
              )}
            </article>
          );
        })}
      </div>
    );
  }, [events, loading]);

  return (
    <section className="max-w-screen-xl mx-auto px-4 pb-16">
      <h2 className="text-3xl font-[Barrio] text-gray-900 mb-6 text-left">Full Weekend Event Lineup</h2>
      <p className="text-sm text-gray-600 mb-8">
        Every event we&apos;re tracking for this weekend, including descriptions, locations, tags, and quick links to the Our
        Philly event pages.
      </p>
      {content}
    </section>
  );
};

export default WeekendEventsList;
