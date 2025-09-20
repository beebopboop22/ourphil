import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RRule } from 'rrule';
import Navbar from './Navbar';
import Footer from './Footer';
import Seo from './components/Seo.jsx';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  PHILLY_TIME_ZONE,
  monthSlugToIndex,
  indexToMonthSlug,
  getMonthWindow,
  getWeekendWindow,
  setEndOfDay,
  setStartOfDay,
  overlaps,
  parseISODate,
  parseMonthDayYear,
  formatMonthYear,
  formatEventDateRange,
  getZonedDate,
} from './utils/dateUtils';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  buildEventJsonLd,
} from './utils/seoHelpers.js';

const FAMILY_TAG_SLUGS = ['family', 'kids'];
const CANONICAL_BASE = 'https://ourphilly.org/family-friendly-events-in-philadelphia-';
const FALLBACK_DESCRIPTION =
  'Discover kid-friendly things to do in Philadelphia: free and low-cost events, indoor/outdoor picks, and family fun updated monthly.';
const FAMILY_VIEW_REGEX = /^family-friendly-events-in-philadelphia-([a-z-]+)-(\d{4})$/i;

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

function formatListWithAnd(items) {
  if (!items?.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const head = items.slice(0, -1).join(', ');
  const tail = items[items.length - 1];
  return `${head}, and ${tail}`;
}

function LinkedEventList({ events }) {
  if (!events?.length) return null;
  return events.map((evt, index) => {
    const key = `${evt.source_table}-${evt.id}`;
    const label = evt.title || 'Untitled event';
    const detailPath = evt.detailPath && typeof evt.detailPath === 'string' ? evt.detailPath : null;
    const isLast = index === events.length - 1;
    const isSecondLast = index === events.length - 2;
    let separator = '';
    if (!isLast) {
      if (events.length === 2) {
        separator = ' and ';
      } else if (isSecondLast) {
        separator = ', and ';
      } else {
        separator = ', ';
      }
    }

    return (
      <React.Fragment key={key}>
        {detailPath ? (
          <Link to={detailPath} className="text-indigo-600 hover:text-indigo-800 font-semibold">
            {label}
          </Link>
        ) : (
          <span className="font-semibold text-[#28313e]">{label}</span>
        )}
        {separator}
      </React.Fragment>
    );
  });
}

function EventHighlightsSentence({ events, intro, emptyText }) {
  if (!events?.length) {
    return <p className="text-base text-gray-700">{emptyText}</p>;
  }

  return (
    <p className="text-base text-gray-700">
      {intro}
      <LinkedEventList events={events} />
      .
    </p>
  );
}

function formatUpdatedStamp(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function FamilyFriendlyMonthlyPage() {
  const { user } = useContext(AuthContext);
  const params = useParams();
  const navigate = useNavigate();

  const viewParam = params.view;
  const viewMatch = useMemo(() => {
    if (!viewParam) return null;
    const match = viewParam.match(FAMILY_VIEW_REGEX);
    if (!match) return null;
    return { monthSlug: match[1].toLowerCase(), year: match[2] };
  }, [viewParam]);

  const rawMonthSlug = params.month || (viewMatch ? viewMatch.monthSlug : null);
  const rawYear = params.year || (viewMatch ? viewMatch.year : null);

  const monthSlugParam = rawMonthSlug ? rawMonthSlug.toLowerCase() : null;
  const yearParam = rawYear || null;

  const monthIndex = monthSlugParam ? monthSlugToIndex(monthSlugParam) : null;
  const yearNum = yearParam ? Number(yearParam) : NaN;
  const hasValidYear = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100;
  const hasValidParams = Boolean(monthIndex && hasValidYear);

  const monthWindow = useMemo(() => {
    if (!hasValidParams) return { start: null, end: null };
    return getMonthWindow(yearNum, monthIndex, PHILLY_TIME_ZONE);
  }, [hasValidParams, monthIndex, yearNum]);

  const monthStart = monthWindow.start;
  const monthEnd = monthWindow.end;
  const monthStartMs = monthStart ? monthStart.getTime() : null;
  const monthEndMs = monthEnd ? monthEnd.getTime() : null;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ogImage, setOgImage] = useState(DEFAULT_OG_IMAGE);

  const todayWindow = useMemo(() => {
    const zonedNow = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    const start = setStartOfDay(zonedNow);
    const end = setEndOfDay(zonedNow);
    return {
      start,
      end,
      startMs: start ? start.getTime() : null,
      endMs: end ? end.getTime() : null,
    };
  }, []);

  const weekendWindow = useMemo(() => {
    const window = getWeekendWindow(new Date(), PHILLY_TIME_ZONE);
    const start = window?.start || null;
    const end = window?.end || null;
    return {
      start,
      end,
      startMs: start ? start.getTime() : null,
      endMs: end ? end.getTime() : null,
    };
  }, []);

  useEffect(() => {
    if (hasValidParams) return;
    const now = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    const fallbackSlug = indexToMonthSlug(now.getMonth() + 1);
    const fallbackYear = now.getFullYear();
    if (!fallbackSlug) return;
    const timer = setTimeout(() => {
      navigate(`/family-friendly-events-in-philadelphia-${fallbackSlug}-${fallbackYear}/`, { replace: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [hasValidParams, navigate]);

  useEffect(() => {
    if (!hasValidParams || !monthStart || !monthEnd) {
      setEvents([]);
      setLoading(false);
      setOgImage(DEFAULT_OG_IMAGE);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setOgImage(DEFAULT_OG_IMAGE);

    const startIso = monthStart.toISOString().slice(0, 10);
    const endIso = monthEnd.toISOString().slice(0, 10);

    (async () => {
      try {
        const [allRes, bigRes, tradRes, groupRes, recurringRes, seasonalRes, tagRes] = await Promise.all([
          supabase
            .from('all_events')
            .select(`
              id,
              name,
              description,
              image,
              start_date,
              end_date,
              start_time,
              end_time,
              slug,
              venues:venue_id (
                name,
                slug
              )
            `)
            .lte('start_date', endIso)
            .or(`end_date.gte.${startIso},end_date.is.null`),
          supabase
            .from('big_board_events')
            .select(`
              id,
              title,
              description,
              start_date,
              end_date,
              start_time,
              end_time,
              slug,
              latitude,
              longitude,
              big_board_posts!big_board_posts_event_id_fkey (
                image_url,
                user_id
              )
            `)
            .lte('start_date', endIso)
            .or(`end_date.gte.${startIso},end_date.is.null`),
          supabase
            .from('events')
            .select(`
              id,
              "E Name",
              "E Description",
              Dates,
              "End Date",
              "E Image",
              slug
            `),
          supabase
            .from('group_events')
            .select(`
              id,
              title,
              description,
              image_url,
              start_date,
              end_date,
              start_time,
              end_time,
              slug,
              group_id,
              groups:group_id (
                Name,
                imag,
                slug
              )
            `)
            .lte('start_date', endIso)
            .or(`end_date.gte.${startIso},end_date.is.null`),
          supabase
            .from('recurring_events')
            .select(`
              id,
              name,
              slug,
              description,
              address,
              link,
              start_date,
              end_date,
              start_time,
              end_time,
              rrule,
              image_url,
              latitude,
              longitude
            `)
            .eq('is_active', true),
          supabase
            .from('seasonal_events')
            .select(`
              id,
              name,
              description,
              slug,
              start_date,
              end_date,
              image_url,
              location
            `)
            .lte('start_date', endIso)
            .or(`end_date.gte.${startIso},end_date.is.null`),
          supabase
            .from('tags')
            .select('id, slug')
            .in('slug', FAMILY_TAG_SLUGS),
        ]);

        if (cancelled) return;

        const tagRows = tagRes.data || [];
        const allowedTagIds = tagRows.map(row => row.id);
        if (!allowedTagIds.length) {
          setEvents([]);
          setLoading(false);
          return;
        }

        const allRecords = (allRes.data || [])
          .map(evt => {
            const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
            const endDateBase = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateBase) return null;
            const endDate = setEndOfDay(new Date(endDateBase));
            if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
            const detailPath = getDetailPathForItem({
              ...evt,
              venues: evt.venues,
              venue_slug: evt.venues?.slug,
            });
            return {
              id: evt.id,
              title: evt.name,
              description: evt.description,
              imageUrl: evt.image || '',
              startDate,
              endDate,
              start_date: evt.start_date,
              end_date: evt.end_date,
              start_time: evt.start_time,
              end_time: evt.end_time,
              slug: evt.slug,
              venueName: evt.venues?.name || '',
              detailPath: detailPath || null,
              source_table: 'all_events',
              taggableId: String(evt.id),
              favoriteId: evt.id,
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: false,
              isSeasonal: false,
            };
          })
          .filter(Boolean);

        const bigRecords = (bigRes.data || [])
          .map(evt => {
            const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
            const endDateBase = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateBase) return null;
            const endDate = setEndOfDay(new Date(endDateBase));
            if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
            let imageUrl = '';
            const storageKey = evt.big_board_posts?.[0]?.image_url;
            if (storageKey) {
              const { data } = supabase.storage.from('big-board').getPublicUrl(storageKey);
              imageUrl = data?.publicUrl || '';
            }
            const detailPath = getDetailPathForItem({
              ...evt,
              isBigBoard: true,
            });
            return {
              id: evt.id,
              title: evt.title,
              description: evt.description,
              imageUrl,
              startDate,
              endDate,
              start_date: evt.start_date,
              end_date: evt.end_date,
              start_time: evt.start_time,
              end_time: evt.end_time,
              slug: evt.slug,
              detailPath: detailPath || null,
              source_table: 'big_board_events',
              taggableId: String(evt.id),
              favoriteId: evt.id,
              isTradition: false,
              isBigBoard: true,
              isGroupEvent: false,
              isRecurring: false,
              isSeasonal: false,
            };
          })
          .filter(Boolean);

        const traditionRecords = (tradRes.data || [])
          .map(evt => {
            const startDate = parseMonthDayYear(evt.Dates, PHILLY_TIME_ZONE);
            const endDateBase = parseMonthDayYear(evt['End Date'], PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateBase) return null;
            const endDate = setEndOfDay(new Date(endDateBase));
            if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
            const detailPath = getDetailPathForItem({
              ...evt,
              isTradition: true,
            });
            return {
              id: evt.id,
              title: evt['E Name'],
              description: evt['E Description'],
              imageUrl: evt['E Image'] || '',
              startDate,
              endDate,
              start_date: evt.Dates,
              end_date: evt['End Date'],
              slug: evt.slug,
              detailPath: detailPath || null,
              source_table: 'events',
              taggableId: String(evt.id),
              favoriteId: evt.id,
              isTradition: true,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: false,
              isSeasonal: false,
            };
          })
          .filter(Boolean);

        const groupRecords = (groupRes.data || [])
          .map(evt => {
            const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
            const endDateBase = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateBase) return null;
            const endDate = setEndOfDay(new Date(endDateBase));
            if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
            let imageUrl = '';
            if (evt.image_url) {
              imageUrl = evt.image_url.startsWith('http')
                ? evt.image_url
                : supabase.storage.from('big-board').getPublicUrl(evt.image_url).data?.publicUrl || '';
            } else if (evt.groups?.imag) {
              imageUrl = evt.groups.imag;
            }
            const detailPath = getDetailPathForItem({
              ...evt,
              group_slug: evt.groups?.slug,
              isGroupEvent: true,
            });
            return {
              id: evt.id,
              title: evt.title,
              description: evt.description,
              imageUrl,
              startDate,
              endDate,
              start_date: evt.start_date,
              end_date: evt.end_date,
              start_time: evt.start_time,
              end_time: evt.end_time,
              slug: evt.slug,
              groupName: evt.groups?.Name || '',
              detailPath: detailPath || null,
              source_table: 'group_events',
              taggableId: String(evt.id),
              favoriteId: evt.id,
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: true,
              isRecurring: false,
              isSeasonal: false,
            };
          })
          .filter(Boolean);

        const seasonalRecords = (seasonalRes.data || [])
          .map(evt => {
            const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
            const endDateBase = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateBase) return null;
            const endDate = setEndOfDay(new Date(endDateBase));
            if (!overlaps(startDate, endDate, monthStart, monthEnd)) return null;
            const detailPath = getDetailPathForItem({
              ...evt,
              isSeasonal: true,
            });
            return {
              id: evt.id,
              title: evt.name,
              description: evt.description,
              imageUrl: evt.image_url || '',
              startDate,
              endDate,
              start_date: evt.start_date,
              end_date: evt.end_date,
              slug: evt.slug,
              venueName: evt.location || '',
              detailPath: detailPath || null,
              source_table: 'seasonal_events',
              taggableId: String(evt.id),
              favoriteId: evt.id,
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: false,
              isSeasonal: true,
            };
          })
          .filter(Boolean);

        const recurringOccurrences = [];
        (recurringRes.data || []).forEach(series => {
          if (!series.start_date || !series.rrule) return;
          let options;
          try {
            options = RRule.parseString(series.rrule);
          } catch (error) {
            console.error('Invalid recurring rule', series.id, error);
            return;
          }
          const startTime = series.start_time || '00:00';
          const dtstart = new Date(`${series.start_date}T${startTime}`);
          if (Number.isNaN(dtstart.getTime())) return;
          options.dtstart = dtstart;
          if (series.end_date) {
            options.until = new Date(`${series.end_date}T23:59:59`);
          }
          const rule = new RRule(options);
          const occurrences = rule.between(monthStart, monthEnd, true);
          occurrences.forEach(instance => {
            const local = new Date(instance.getFullYear(), instance.getMonth(), instance.getDate());
            const startDate = setStartOfDay(local);
            const endDate = setEndOfDay(new Date(startDate));
            const yyyy = local.getFullYear();
            const mm = String(local.getMonth() + 1).padStart(2, '0');
            const dd = String(local.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            const detailPath = getDetailPathForItem({
              ...series,
              isRecurring: true,
              occurrence_date: dateStr,
              start_date: dateStr,
            });
            recurringOccurrences.push({
              id: `${series.id}::${dateStr}`,
              title: series.name,
              description: series.description,
              imageUrl: series.image_url || '',
              startDate,
              endDate,
              start_date: dateStr,
              end_date: dateStr,
              start_time: series.start_time,
              end_time: series.end_time,
              slug: series.slug,
              venueName: series.address || '',
              detailPath: detailPath || null,
              source_table: 'recurring_events',
              taggableId: String(series.id),
              favoriteId: String(series.id),
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: true,
              isSeasonal: false,
            });
          });
        });

        const combined = [
          ...allRecords,
          ...bigRecords,
          ...traditionRecords,
          ...groupRecords,
          ...seasonalRecords,
          ...recurringOccurrences,
        ];

        if (!combined.length) {
          setEvents([]);
          setLoading(false);
          return;
        }

        const idsByType = combined.reduce((acc, evt) => {
          const type = evt.source_table;
          if (!type || !evt.taggableId) return acc;
          if (!acc[type]) acc[type] = new Set();
          acc[type].add(String(evt.taggableId));
          return acc;
        }, {});

        const taggingPromises = Object.entries(idsByType).map(([type, idSet]) =>
          supabase
            .from('taggings')
            .select('taggable_id, tag_id')
            .eq('taggable_type', type)
            .in('tag_id', allowedTagIds)
            .in('taggable_id', Array.from(idSet))
        );

        const taggingResults = await Promise.all(taggingPromises);
        if (cancelled) return;

        const allowedByType = {};
        taggingResults.forEach((res, index) => {
          const type = Object.keys(idsByType)[index];
          if (res.error) {
            console.error('Failed to load taggings for type', type, res.error);
            allowedByType[type] = new Set();
            return;
          }
          allowedByType[type] = new Set((res.data || []).map(row => String(row.taggable_id)));
        });

        const filtered = combined.filter(evt => {
          const type = evt.source_table;
          const key = String(evt.taggableId);
          return allowedByType[type]?.has(key);
        });

        const sorted = filtered
          .slice()
          .sort((a, b) => {
            const diff = (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0);
            if (diff !== 0) return diff;
            const timeDiff = (a.start_time || '').localeCompare(b.start_time || '');
            if (timeDiff !== 0) return timeDiff;
            return (a.title || '').localeCompare(b.title || '');
          });

        const dedupedMap = new Map();
        sorted.forEach(evt => {
          const key = evt.detailPath || `${evt.source_table}:${evt.id}`;
          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, evt);
          }
        });

        const dedupedList = Array.from(dedupedMap.values());
        setEvents(dedupedList);
        const firstWithImage = dedupedList.find(evt => evt.imageUrl);
        if (firstWithImage?.imageUrl) {
          setOgImage(firstWithImage.imageUrl);
        } else {
          setOgImage(DEFAULT_OG_IMAGE);
        }
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading family-friendly events', error);
        setEvents([]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasValidParams, monthStartMs, monthEndMs, monthStart, monthEnd]);

  const monthLabel = monthStart ? formatMonthYear(monthStart, PHILLY_TIME_ZONE) : '';
  const monthSlug = monthIndex ? indexToMonthSlug(monthIndex) : null;
  const canonicalUrl = hasValidParams && monthSlug
    ? `${CANONICAL_BASE}${monthSlug}-${yearNum}/`
    : `${SITE_BASE_URL}/family-friendly-events-in-philadelphia/`;

  const seoTitle = hasValidParams && monthLabel
    ? `Family-Friendly Events in Philadelphia – ${monthLabel}`
    : 'Family-Friendly Events in Philadelphia – Our Philly';

  const seoDescription = hasValidParams && monthLabel
    ? `Discover kid-friendly things to do in Philadelphia this ${monthLabel}: free & low-cost events, indoor/outdoor picks, and what's on this weekend & today.`
    : FALLBACK_DESCRIPTION;

  const totalEvents = events.length;

  const weekendEvents = useMemo(() => {
    if (!events.length || !weekendWindow.start || !weekendWindow.end) return [];
    return events.filter(evt =>
      overlaps(evt.startDate, evt.endDate, weekendWindow.start, weekendWindow.end)
    );
  }, [events, weekendWindow.startMs, weekendWindow.endMs]);

  const todayEvents = useMemo(() => {
    if (!events.length || !todayWindow.start || !todayWindow.end) return [];
    return events.filter(evt =>
      overlaps(evt.startDate, evt.endDate, todayWindow.start, todayWindow.end)
    );
  }, [events, todayWindow.startMs, todayWindow.endMs]);

  const weekendEventNames = useMemo(
    () => weekendEvents.map(evt => evt.title).filter(Boolean),
    [weekendEvents]
  );

  const todayEventNames = useMemo(
    () => todayEvents.map(evt => evt.title).filter(Boolean),
    [todayEvents]
  );

  const updatedStamp = formatUpdatedStamp(getZonedDate(new Date(), PHILLY_TIME_ZONE));

  const navLinks = useMemo(() => {
    if (!hasValidParams || !monthSlug) return [];
    return [
      {
        label: 'All Events',
        path: `/philadelphia-events-${monthSlug}-${yearNum}/`,
      },
      {
        label: 'Family-Friendly',
        path: `/family-friendly-events-in-philadelphia-${monthSlug}-${yearNum}/`,
      },
      {
        label: 'Arts & Culture',
        path: `/arts-and-culture-events-in-philadelphia-${monthSlug}-${yearNum}/`,
      },
      {
        label: 'Food & Drink',
        path: `/food-and-drink-events-in-philadelphia-${monthSlug}-${yearNum}/`,
      },
      {
        label: 'Fitness & Wellness',
        path: `/fitness-and-wellness-events-in-philadelphia-${monthSlug}-${yearNum}/`,
      },
      {
        label: 'Music',
        path: `/music-events-in-philadelphia-${monthSlug}-${yearNum}/`,
      },
    ];
  }, [hasValidParams, monthSlug, yearNum]);

  const peerLinks = useMemo(
    () => navLinks.filter(link => link.label !== 'Family-Friendly'),
    [navLinks]
  );

  const itemListJsonLd = useMemo(() => {
    if (!hasValidParams || !monthLabel || !events.length) return null;
    const elements = events.slice(0, 20).map((evt, index) => {
      const detailPath = evt.detailPath;
      if (!detailPath) return null;
      const canonical = `${SITE_BASE_URL}${detailPath}`;
      const eventJson = buildEventJsonLd({
        name: evt.title,
        canonicalUrl: canonical,
        startDate: evt.startDate,
        endDate: evt.endDate,
        locationName: evt.venueName || evt.groupName || 'Philadelphia',
        description: evt.description,
        image: evt.imageUrl,
      });
      if (!eventJson) return null;
      return {
        '@type': 'ListItem',
        position: index + 1,
        item: eventJson,
      };
    }).filter(Boolean);
    if (!elements.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Family-Friendly Events in Philadelphia – ${monthLabel}`,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: events.length,
      itemListElement: elements,
    };
  }, [events, hasValidParams, monthLabel]);

  const faqJsonLd = useMemo(() => {
    if (!hasValidParams || !monthLabel) return null;

    const faqs = [];
    const monthlyAnswer = totalEvents
      ? `Our Philly curates ${totalEvents} kid-friendly events across Philadelphia for ${monthLabel}, highlighting markets, museums, storytimes, and community festivals tagged family or kids.`
      : `Our Philly tracks kid-friendly events across Philadelphia for ${monthLabel}, highlighting markets, museums, storytimes, and community festivals tagged family or kids.`;
    faqs.push({
      question: `What are the best family-friendly events in Philadelphia in ${monthLabel}?`,
      answer: monthlyAnswer,
    });

    const weekendAnswer = weekendEventNames.length
      ? `Family-friendly events this weekend include ${formatListWithAnd(weekendEventNames)}.`
      : 'We are updating this weekend’s kid-friendly lineup—check back soon or explore our This Weekend in Philadelphia guide for fresh picks.';
    faqs.push({
      question: 'Are there family-friendly events in Philadelphia this weekend?',
      answer: weekendAnswer,
    });

    const todayAnswer = todayEventNames.length
      ? `Family-friendly events today include ${formatListWithAnd(todayEventNames)}.`
      : 'No tagged family-friendly events are listed for today yet—browse the full monthly calendar for more ideas.';
    faqs.push({
      question: 'What family-friendly events are happening in Philadelphia today?',
      answer: todayAnswer,
    });

    if (updatedStamp) {
      faqs.push({
        question: 'How often is the Our Philly family-friendly guide updated?',
        answer: `We refresh this guide as new events are published and last updated it on ${updatedStamp}. Bookmark it to catch new kid-friendly things to do each week.`,
      });
    }

    if (!faqs.length) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }, [hasValidParams, monthLabel, todayEventNames, totalEvents, updatedStamp, weekendEventNames]);

  const combinedJsonLd = useMemo(() => {
    const payloads = [];
    if (itemListJsonLd) payloads.push(itemListJsonLd);
    if (faqJsonLd) payloads.push(faqJsonLd);
    if (!payloads.length) return null;
    return payloads.length === 1 ? payloads[0] : payloads;
  }, [faqJsonLd, itemListJsonLd]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="website"
        jsonLd={combinedJsonLd}
      />
      <Navbar />
      <main className="flex-1 pt-36 md:pt-40 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          {hasValidParams ? (
            <>
              <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e] text-center">
                Family-Friendly Events in Philadelphia – {monthLabel}
              </h1>
              <p className="mt-6 text-lg text-gray-700 text-center max-w-3xl mx-auto">
                {totalEvents
                  ? `Discover ${totalEvents} kid-friendly festivals, storytimes, and hands-on adventures happening across Philadelphia in ${monthLabel}.`
                  : `Discover kid-friendly festivals, storytimes, and hands-on adventures happening across Philadelphia in ${monthLabel}.`}{' '}
                We pulled every event tagged family or kids so you can plan this month's outings.
              </p>
              <p className="mt-2 text-sm text-gray-500 text-center">Updated {updatedStamp}</p>
              <div className="mt-4 flex justify-center gap-4">
                <a
                  href="#this-weekend"
                  className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-full hover:text-indigo-800 hover:border-indigo-400 transition"
                >
                  This Weekend
                </a>
                <a
                  href="#today"
                  className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-full hover:text-indigo-800 hover:border-indigo-400 transition"
                >
                  Today
                </a>
              </div>
              <p className="mt-3 text-sm text-gray-600 text-center">
                Planning sooner? Explore the{' '}
                <Link
                  to="/this-weekend-in-philadelphia/"
                  className="text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  This Weekend in Philadelphia guide
                </Link>
                .
              </p>

              {navLinks.length > 0 && (
                <nav className="mt-8 flex flex-wrap justify-center gap-3">
                  {navLinks.map(link => {
                    const isActive = link.path === canonicalUrl.replace(SITE_BASE_URL, '');
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`px-4 py-2 rounded-full border font-semibold text-sm transition ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
              )}

              <section id="this-weekend" className="mt-10">
                <details className="border border-gray-200 rounded-2xl bg-gray-50 px-6 py-5" open>
                  <summary className="cursor-pointer text-left list-none">
                    <h3 className="text-xl font-semibold text-[#28313e]">This Weekend</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Family events happening Friday through Sunday in Philadelphia.
                    </p>
                  </summary>
                  <div className="mt-4 space-y-3">
                    <EventHighlightsSentence
                      events={weekendEvents}
                      intro="Family-friendly events this weekend include: "
                      emptyText="We don't have any tagged family-friendly events for this weekend yet—check back soon."
                    />
                    <p className="text-sm text-gray-600">
                      Need more ideas?{' '}
                      <Link
                        to="/this-weekend-in-philadelphia/"
                        className="text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        See the full weekend guide →
                      </Link>
                    </p>
                  </div>
                </details>
              </section>

              <section id="today" className="mt-6">
                <details className="border border-gray-200 rounded-2xl bg-gray-50 px-6 py-5" open>
                  <summary className="cursor-pointer text-left list-none">
                    <h3 className="text-xl font-semibold text-[#28313e]">Family-friendly events today</h3>
                    <p className="mt-1 text-sm text-gray-600">Quick ideas for kid-approved fun happening today.</p>
                  </summary>
                  <div className="mt-4">
                    <EventHighlightsSentence
                      events={todayEvents}
                      intro="Family-friendly events today include: "
                      emptyText="No tagged family-friendly events are listed for today—browse the calendar below for more options."
                    />
                  </div>
                </details>
              </section>

              <section className="mt-10 bg-white border border-gray-200 rounded-2xl shadow-sm">
                {loading ? (
                  <p className="p-6 text-gray-500">Loading family-friendly events…</p>
                ) : events.length === 0 ? (
                  <p className="p-6 text-gray-500">
                    No tagged family or kids events are listed for {monthLabel} yet. Check back soon or submit one!
                  </p>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {events.map(evt => {
                      const detailPath = evt.detailPath || '/';
                      const summary = evt.description?.trim() || 'Details coming soon.';
                      return (
                        <article key={`${evt.source_table}-${evt.id}`} className="flex flex-col md:flex-row gap-4 px-6 py-6">
                          <div className="md:w-48 w-full flex-shrink-0">
                            <div className="relative w-full overflow-hidden rounded-xl bg-gray-100 aspect-[4/3]">
                              <img
                                src={evt.imageUrl || DEFAULT_OG_IMAGE}
                                alt={evt.title}
                                loading="lazy"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              {evt.isTradition && (
                                <span className="absolute top-2 left-2 bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                  Tradition
                                </span>
                              )}
                              {evt.isBigBoard && (
                                <span className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                  Submission
                                </span>
                              )}
                              {evt.isGroupEvent && (
                                <span className="absolute bottom-2 left-2 bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                  Group Event
                                </span>
                              )}
                              {evt.isSeasonal && (
                                <span className="absolute bottom-2 right-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                  Seasonal
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col">
                            <Link
                              to={detailPath}
                              className="text-2xl font-semibold text-[#28313e] hover:underline"
                            >
                              {evt.title}
                            </Link>
                            <p className="mt-2 text-sm font-semibold text-gray-700">
                              {formatEventDateRange(evt.startDate, evt.endDate, PHILLY_TIME_ZONE)}
                            </p>
                            {(evt.venueName || evt.groupName) && (
                              <p className="mt-1 text-sm text-gray-500">
                                {evt.venueName || evt.groupName}
                              </p>
                            )}
                            <p className="mt-2 text-sm text-gray-600 line-clamp-3">{summary}</p>
                            <div className="mt-4">
                              <FavoriteState event_id={evt.favoriteId} source_table={evt.source_table}>
                                {({ isFavorite, toggleFavorite, loading: favLoading }) => (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!user) {
                                        navigate('/login');
                                        return;
                                      }
                                      toggleFavorite();
                                    }}
                                    disabled={favLoading}
                                    className={`inline-flex items-center px-4 py-2 border border-indigo-600 rounded-full font-semibold transition-colors ${
                                      isFavorite
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                                    }`}
                                  >
                                    {isFavorite ? 'In the Plans' : 'Add to Plans'}
                                  </button>
                                )}
                              </FavoriteState>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {peerLinks.length > 0 && (
                <div className="mt-12 text-center text-sm text-gray-600 space-y-2">
                  <p>
                    Browse more {monthLabel} guides:{' '}
                    {peerLinks.map((link, index) => {
                      const isLast = index === peerLinks.length - 1;
                      const isSecondLast = index === peerLinks.length - 2;
                      let separator = '';
                      if (!isLast) {
                        if (peerLinks.length === 2) {
                          separator = ' and ';
                        } else if (isSecondLast) {
                          separator = ', and ';
                        } else {
                          separator = ', ';
                        }
                      }
                      return (
                        <React.Fragment key={link.path}>
                          <Link
                            to={link.path}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            {link.label}
                          </Link>
                          {separator}
                        </React.Fragment>
                      );
                    })}
                    .
                  </p>
                  <p>
                    Want everything in one place? Visit the{' '}
                    <Link
                      to="/all-guides/"
                      className="text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      All Guides hub
                    </Link>{' '}
                    for more roundups.
                  </p>
                </div>
              )}

            </>
          ) : (
            <div className="py-24 text-center text-gray-600">
              <p>Loading the latest family-friendly events…</p>
            </div>
          )}
        </div>
        <div className="mt-16 px-4">
          <p className="text-center text-sm text-gray-500">
            Our Philly helps families discover kid-friendly events and traditions across Philadelphia, updated monthly.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

