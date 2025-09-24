import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Filter, List, XCircle } from 'lucide-react';
import { RRule } from 'rrule';
import { FaStar } from 'react-icons/fa';
import Navbar from './Navbar';
import Footer from './Footer';
import FeaturedTraditionHero from './FeaturedTraditionHero';
import Seo from './components/Seo.jsx';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import {
  PHILLY_TIME_ZONE,
  parseISODate,
  parseMonthDayYear,
  overlaps,
  setEndOfDay,
  setStartOfDay,
  formatWeekdayAbbrev,
  formatMonthDay,
  formatDateRangeForTitle,
  getZonedDate,
} from './utils/dateUtils';

const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

const popularTags = [
  { slug: 'nomnomslurp', label: 'nomnomslurp' },
  { slug: 'markets', label: 'markets' },
  { slug: 'music', label: 'music' },
  { slug: 'family', label: 'family' },
  { slug: 'arts', label: 'arts' },
];

const dayViewOptions = ['weekend', 'friday', 'saturday', 'sunday'];

const dayViewLabels = {
  weekend: 'this weekend',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const DEFAULT_OG_IMAGE = 'https://ourphilly.org/og-image.png';
const CANONICAL_URL = 'https://ourphilly.org/this-weekend-in-philadelphia/';
const MAX_EVENT_DURATION_DAYS = 30;
const MAX_EVENT_DURATION_MS = MAX_EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000;

function toPhillyISODate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hoursStr, minutesStr] = timeStr.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr ? minutesStr.padStart(2, '0') : '00';
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function TagFilterModal({ open, tags, selectedTags, onToggle, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl p-8 relative">
        <h2 className="text-lg font-semibold mb-6 text-center">Select Tags</h2>
        <div className="flex flex-wrap gap-3 mb-6">
          {tags.map((tag, i) => {
            const isSel = selectedTags.includes(tag.slug);
            const cls = isSel ? pillStyles[i % pillStyles.length] : 'bg-gray-200 text-gray-700';
            return (
              <button
                key={tag.slug}
                onClick={() => onToggle(tag.slug, !isSel)}
                className={`${cls} px-4 py-2 rounded-full text-sm font-semibold`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700 transition"
          >
            Done
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-xl"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

function resolveGroup(groups) {
  if (!groups) return null;
  if (Array.isArray(groups)) return groups[0] || null;
  return groups;
}

export default function ThisWeekendInPhiladelphia() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { weekendStart, weekendEnd } = useMemo(() => {
    const zonedNow = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    const day = zonedNow.getDay();
    const friday = setStartOfDay(zonedNow);
    if (day >= 1 && day <= 4) {
      friday.setDate(friday.getDate() + (5 - day));
    } else if (day === 0) {
      friday.setDate(friday.getDate() - 2);
    } else if (day === 6) {
      friday.setDate(friday.getDate() - 1);
    }
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    return {
      weekendStart: friday,
      weekendEnd: setEndOfDay(sunday),
    };
  }, []);
  const weekendStartMs = weekendStart.getTime();
  const weekendEndMs = weekendEnd.getTime();
  const weekendTitle = 'Things to Do in Philadelphia This Weekend – Concerts, Festivals, Free Events';
  const introRange = `${formatMonthDay(weekendStart, PHILLY_TIME_ZONE)} through ${formatMonthDay(weekendEnd, PHILLY_TIME_ZONE)}`;
  const weekendDescription = `Plan this weekend in Philly (${introRange}) with free, family-friendly concerts, festivals, and markets curated by Our Philly.`;
  const [ogImage, setOgImage] = useState(DEFAULT_OG_IMAGE);

  const [allEventsData, setAllEventsData] = useState([]);
  const [bigBoardEvents, setBigBoardEvents] = useState([]);
  const [traditionEvents, setTraditionEvents] = useState([]);
  const [groupEvents, setGroupEvents] = useState([]);
  const [recurringRaw, setRecurringRaw] = useState([]);
  const [recurringEvents, setRecurringEvents] = useState([]);
  const [sportsEventsRaw, setSportsEventsRaw] = useState([]);
  const [sportsEvents, setSportsEvents] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedDayView, setSelectedDayView] = useState('weekend');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isListView, setIsListView] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE)), []);

  useEffect(() => {
    supabase
      .from('tags')
      .select('name,slug')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('tags load error', error);
          return;
        }
        setAllTags(data || []);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const clientId = import.meta.env.VITE_SEATGEEK_CLIENT_ID;
    if (!clientId) {
      setSportsEventsRaw([]);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const teamSlugs = [
          'philadelphia-phillies',
          'philadelphia-76ers',
          'philadelphia-eagles',
          'philadelphia-flyers',
          'philadelphia-union',
        ];

        const requests = teamSlugs.map(slug =>
          fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=50&sort=datetime_local.asc&client_id=${clientId}`
          )
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`SeatGeek request failed: ${res.status}`))))
            .catch(error => {
              console.error('SeatGeek fetch failed for', slug, error);
              return { events: [] };
            })
        );

        const results = await Promise.all(requests);
        const collected = results.flatMap(result => result.events || []);
        const mapped = collected
          .map(event => {
            const dt = new Date(event.datetime_local);
            const startIso = dt.toISOString().slice(0, 10);
            const startDate = parseISODate(startIso, PHILLY_TIME_ZONE);
            if (!startDate) return null;
            const endDate = setEndOfDay(new Date(startDate));
            const performers = event.performers || [];
            const home = performers.find(p => p.home_team) || performers[0] || {};
            const away = performers.find(p => p.id !== home.id) || {};
            const title =
              event.short_title ||
              `${(home.name || '').replace(/^Philadelphia\s+/, '')} vs ${(away.name || '').replace(/^Philadelphia\s+/, '')}`;
            const href =
              getDetailPathForItem({
                isSports: true,
                slug: event.id,
              }) || `/sports/${event.id}`;
            return {
              id: `sg-${event.id}`,
              title,
              imageUrl: home.image || away.image || '',
              start_date: startIso,
              start_time: dt.toTimeString().slice(0, 5),
              startDate,
              endDate,
              href,
              slug: event.id,
              url: event.url,
              isSports: true,
              isBigBoard: false,
              isTradition: false,
              isGroupEvent: false,
              isRecurring: false,
              source_table: 'sg_events',
              taggableId: `sg-${event.id}`,
            };
          })
          .filter(Boolean);
        if (!cancelled) {
          setSportsEventsRaw(mapped);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching sports events', error);
          setSportsEventsRaw([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchAllEvents = supabase
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
        venue_id,
        venues:venue_id (
          name,
          slug,
          latitude,
          longitude
        )
      `)
      .order('start_date', { ascending: true });

    const fetchBigBoard = supabase
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
      .order('start_date', { ascending: true });

    const fetchTraditions = supabase
      .from('events')
      .select(`
        id,
        "E Name",
        "E Description",
        Dates,
        "End Date",
        "E Image",
        slug
      `)
      .order('Dates', { ascending: true });

    const fetchGroupEvents = supabase
      .from('group_events')
      .select(`
        *,
        groups(Name, imag, slug)
      `)
      .order('start_date', { ascending: true });

    const fetchRecurring = supabase
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
      .eq('is_active', true);

    let cancelled = false;
    setLoading(true);

    Promise.all([fetchAllEvents, fetchBigBoard, fetchTraditions, fetchGroupEvents, fetchRecurring])
      .then(([allRes, bigRes, tradRes, groupRes, recurringRes]) => {
        if (cancelled) return;

        const weekendStartKey = toPhillyISODate(weekendStart);
        const weekendEndKey = toPhillyISODate(weekendEnd);

        const allRecords = (allRes.data || [])
          .map(evt => {
            const startKey = (evt.start_date || '').slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
            const rawEnd = (evt.end_date || evt.start_date || '').slice(0, 10);
            const endKey = /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? rawEnd : startKey;
            if (startKey > weekendEndKey || endKey < weekendStartKey) {
              return null;
            }

            const spanDays =
              Math.floor((Date.parse(endKey) - Date.parse(startKey)) / (1000 * 60 * 60 * 24)) + 1;
            if (spanDays > MAX_EVENT_DURATION_DAYS) return null;

            const [ys, ms, ds] = startKey.split('-').map(Number);
            const [ye, me, de] = endKey.split('-').map(Number);
            const startDate = setStartOfDay(new Date(ys, ms - 1, ds));
            const endDate = setEndOfDay(new Date(ye, me - 1, de));

            return {
              id: evt.id,
              title: evt.name,
              name: evt.name,
              description: evt.description,
              imageUrl: evt.image || '',
              start_date: evt.start_date,
              end_date: evt.end_date,
              startDate,
              endDate,
              start_time: evt.start_time,
              end_time: evt.end_time,
              slug: evt.slug,
              venues: evt.venues,
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: false,
              isSports: false,
              source_table: 'all_events',
              taggableId: String(evt.id),
            };
          })
          .filter(Boolean);

        const bigRecords = (bigRes.data || [])
          .map(evt => {
            const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
            const endDateRaw = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE);
            if (!startDate || !endDateRaw) return null;
            const endDate = setEndOfDay(new Date(endDateRaw));
            if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
            if (endDate.getTime() - startDate.getTime() > MAX_EVENT_DURATION_MS) return null;
            let imageUrl = '';
            const storageKey = evt.big_board_posts?.[0]?.image_url;
            if (storageKey) {
              const {
                data: { publicUrl },
              } = supabase.storage.from('big-board').getPublicUrl(storageKey);
              imageUrl = publicUrl || '';
            }
            return {
              id: evt.id,
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
              latitude: evt.latitude,
              longitude: evt.longitude,
              owner_id: evt.big_board_posts?.[0]?.user_id || null,
              isTradition: false,
              isBigBoard: true,
              isGroupEvent: false,
              isRecurring: false,
              isSports: false,
              source_table: 'big_board_events',
              taggableId: String(evt.id),
            };
          })
          .filter(Boolean);

        const traditionRecords = (tradRes.data || [])
          .map(evt => {
            const startDate = parseMonthDayYear(evt.Dates, PHILLY_TIME_ZONE);
            const endDateRaw = parseMonthDayYear(evt['End Date'], PHILLY_TIME_ZONE) || startDate;
            if (!startDate || !endDateRaw) return null;
            const endDate = setEndOfDay(new Date(endDateRaw));
            if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
            if (endDate.getTime() - startDate.getTime() > MAX_EVENT_DURATION_MS) return null;
            return {
              id: evt.id,
              title: evt['E Name'],
              name: evt['E Name'],
              description: evt['E Description'],
              imageUrl: evt['E Image'] || '',
              startDate,
              endDate,
              slug: evt.slug,
              isTradition: true,
              isBigBoard: false,
              isGroupEvent: false,
              isRecurring: false,
              isSports: false,
              source_table: 'events',
              taggableId: String(evt.id),
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
            if (endDate.getTime() - startDate.getTime() > MAX_EVENT_DURATION_MS) return null;
            const href = getDetailPathForItem({
              ...evt,
              group_slug: group?.slug,
              isGroupEvent: true,
            });
            return {
              id: evt.id,
              title: evt.title,
              name: evt.title,
              description: evt.description,
              imageUrl: group?.imag || '',
              start_date: evt.start_date,
              end_date: evt.end_date,
              startDate,
              endDate,
              start_time: evt.start_time,
              end_time: evt.end_time,
              href: href || null,
              group_slug: group?.slug || null,
              slug: evt.slug || String(evt.id),
              groupName: group?.Name || group?.name || '',
              isTradition: false,
              isBigBoard: false,
              isGroupEvent: true,
              isRecurring: false,
              isSports: false,
              source_table: 'group_events',
              taggableId: String(evt.id),
            };
          })
          .filter(Boolean);

        setAllEventsData(allRecords);
        setBigBoardEvents(bigRecords);
        setTraditionEvents(traditionRecords);
        setGroupEvents(groupRecords);
        setRecurringRaw(recurringRes.data || []);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading weekend data', error);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekendStartMs, weekendEndMs]);
  useEffect(() => {
    if (!recurringRaw.length) {
      setRecurringEvents([]);
      return;
    }
    const startBoundary = new Date(weekendStartMs);
    const endBoundary = new Date(weekendEndMs);

    const occs = recurringRaw.flatMap(series => {
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
          return {
            id: `${series.id}::${dateStr}`,
            title: series.name,
            name: series.name,
            description: series.description,
            imageUrl: series.image_url || '',
            start_date: dateStr,
            startDate,
            endDate,
            start_time: series.start_time,
            end_time: series.end_time,
            link: `/${series.slug}/${dateStr}`,
            address: series.address,
            isTradition: false,
            isBigBoard: false,
            isGroupEvent: false,
            isRecurring: true,
            isSports: false,
            source_table: 'recurring_events',
            taggableId: String(series.id),
            slug: series.slug,
          };
        })
        .filter(Boolean);
    });
    setRecurringEvents(occs);
  }, [recurringRaw, weekendStartMs, weekendEndMs]);

  useEffect(() => {
    const filtered = sportsEventsRaw
      .filter(evt => overlaps(evt.startDate, evt.endDate, weekendStart, weekendEnd))
      .map(evt => ({ ...evt }));
    setSportsEvents(filtered);
  }, [sportsEventsRaw, weekendStart, weekendEnd]);

  const combinedEvents = useMemo(
    () => [
      ...sportsEvents,
      ...bigBoardEvents,
      ...groupEvents,
      ...recurringEvents,
      ...traditionEvents,
      ...allEventsData,
    ],
    [sportsEvents, bigBoardEvents, groupEvents, recurringEvents, traditionEvents, allEventsData]
  );

  const weekendEventCount = combinedEvents.length;
  const formattedWeekendEventCount = useMemo(
    () => weekendEventCount.toLocaleString('en-US'),
    [weekendEventCount]
  );

  useEffect(() => {
    if (!combinedEvents.length) {
      setTagMap({});
      return;
    }
    const idsByType = combinedEvents.reduce((acc, evt) => {
      const table = evt.isSports ? 'sg_events' : evt.source_table;
      if (!table || !evt.taggableId) return acc;
      if (!acc[table]) acc[table] = new Set();
      acc[table].add(String(evt.taggableId));
      return acc;
    }, {});

    const promises = Object.entries(idsByType)
      .filter(([type]) => type !== 'sg_events')
      .map(([type, ids]) =>
        supabase
          .from('taggings')
          .select('tags(name,slug),taggable_id')
          .eq('taggable_type', type)
          .in('taggable_id', Array.from(ids))
      );

    Promise.all(promises)
      .then(results => {
        const map = {};
        results.forEach(({ data, error }) => {
          if (error) {
            console.error('taggings fetch failed:', error);
            return;
          }
          data.forEach(({ taggable_id, tags }) => {
            if (!taggable_id || !tags) return;
            const key = String(taggable_id);
            map[key] = map[key] || [];
            map[key].push(tags);
          });
        });
        const sportsTag = allTags.find(tag => tag.slug === 'sports');
        if (sportsTag && idsByType.sg_events) {
          Array.from(idsByType.sg_events).forEach(id => {
            const key = String(id);
            map[key] = map[key] || [];
            map[key].push(sportsTag);
          });
        }
        setTagMap(map);
      })
      .catch(err => {
        console.error('error loading tags for weekend', err);
      });
  }, [combinedEvents, allTags]);

  const filteredEvents = useMemo(() => {
    if (!selectedTags.length) return combinedEvents;
    return combinedEvents.filter(evt => {
      const key = String(evt.taggableId);
      const tags = tagMap[key] || [];
      return tags.some(tag => selectedTags.includes(tag.slug));
    });
  }, [combinedEvents, selectedTags, tagMap]);

  const dayWindows = useMemo(() => {
    const fridayStart = setStartOfDay(new Date(weekendStart));
    const fridayEnd = setEndOfDay(new Date(fridayStart));
    const saturdayStart = setStartOfDay(new Date(fridayStart));
    saturdayStart.setDate(fridayStart.getDate() + 1);
    const saturdayEnd = setEndOfDay(new Date(saturdayStart));
    const sundayStart = setStartOfDay(new Date(fridayStart));
    sundayStart.setDate(fridayStart.getDate() + 2);
    const sundayEnd = setEndOfDay(new Date(sundayStart));
    return {
      weekend: { start: new Date(weekendStart), end: new Date(weekendEnd) },
      friday: { start: fridayStart, end: fridayEnd },
      saturday: { start: saturdayStart, end: saturdayEnd },
      sunday: { start: sundayStart, end: sundayEnd },
    };
  }, [weekendStart, weekendEnd]);

  const dayFilteredEvents = useMemo(() => {
    if (!selectedDayView || selectedDayView === 'weekend') return filteredEvents;
    const window = dayWindows[selectedDayView];
    if (!window) return filteredEvents;
    return filteredEvents.filter(evt => overlaps(evt.startDate, evt.endDate, window.start, window.end));
  }, [filteredEvents, selectedDayView, dayWindows]);

  const sortedEvents = useMemo(() => {
    return [...dayFilteredEvents].sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      const diff = a.startDate.getTime() - b.startDate.getTime();
      if (diff !== 0) return diff;
      const timeA = a.start_time || '';
      const timeB = b.start_time || '';
      return timeA.localeCompare(timeB);
    });
  }, [dayFilteredEvents]);

  const firstImage = useMemo(() => {
    for (const evt of combinedEvents) {
      if (evt?.imageUrl) return evt.imageUrl;
      if (evt?.image) return evt.image;
    }
    return null;
  }, [combinedEvents]);

  useEffect(() => {
    setOgImage(firstImage || DEFAULT_OG_IMAGE);
  }, [firstImage]);

  const traditionLinks = useMemo(() => {
    const days = [0, 1, 2].map(offset => {
      const d = setStartOfDay(new Date(weekendStart));
      d.setDate(d.getDate() + offset);
      return d;
    });
    return traditionEvents
      .slice()
      .sort((a, b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0))
      .map((evt, index) => {
        const overlapDay = days.find(day => overlaps(evt.startDate, evt.endDate, day, setEndOfDay(new Date(day))));
        const label = formatWeekdayAbbrev(overlapDay || evt.startDate, PHILLY_TIME_ZONE);
        const detailPath = getDetailPathForItem(evt) || '/';
        return (
          <React.Fragment key={evt.id}>
            {index > 0 && ', '}
            <Link to={detailPath} className="text-indigo-600 hover:underline">
              {evt.title} ({label})
            </Link>
          </React.Fragment>
        );
      });
  }, [traditionEvents, weekendStart]);

  const rangeForTitle = formatDateRangeForTitle(weekendStart, weekendEnd, PHILLY_TIME_ZONE);

  const handleTagToggle = (slug, checked) => {
    setSelectedTags(prev => (checked ? [...prev, slug] : prev.filter(tag => tag !== slug)));
  };

  const hasFilters = selectedTags.length > 0 || selectedDayView !== 'weekend';

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title={weekendTitle}
        description={weekendDescription}
        canonicalUrl={CANONICAL_URL}
        ogImage={ogImage}
        ogType="website"
      />
      <Navbar />
      <div className="pt-24 sm:pt-28">
        <FeaturedTraditionHero />
      </div>
      <main className="flex-1 pb-16 pt-12 md:pt-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e] text-center">
            Things to Do in Philadelphia This Weekend
          </h1>
          <p className="mt-6 text-lg text-gray-700 text-center max-w-3xl mx-auto">
            Use this guide from the most comprehensive events calendar in Philadelphia to plan your {introRange} adventures. We curated {formattedWeekendEventCount} festivals, markets, concerts, and family-friendly events for you to make the most of your weekend.
          </p>

          <section className="max-w-4xl mx-auto px-4 mt-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Philly Traditions This Weekend</h2>
            <ul className="flex flex-wrap gap-3 text-sm">
              {traditionEvents
                .filter(evt => evt?.slug)
                .slice(0, 12)
                .map(e => (
                  <li key={e.slug}>
                    <Link to={getDetailPathForItem(e) || '/'} className="text-indigo-700 hover:underline">
                      {e['E Name'] || e.name || e.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>

          <div className="mt-10 flex justify-end items-center gap-2">
            {hasFilters && (
              <button
                onClick={() => {
                  setSelectedTags([]);
                  setSelectedDayView('weekend');
                }}
                className="text-sm text-gray-500 hover:underline"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => setIsListView(v => !v)}
              className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-indigo-600 border-2 border-indigo-600 rounded-full shadow-lg"
            >
              <List className="w-4 h-4" />
              {isListView ? 'Card View' : 'List View'}
            </button>
            <button
              onClick={() => setIsFiltersOpen(true)}
              className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-indigo-600 border-2 border-indigo-600 rounded-full shadow-lg"
            >
              <Filter className="w-4 h-4" />
              {`Filters${selectedTags.length ? ` (${selectedTags.length})` : ''}`}
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap pb-2">
            {dayViewOptions.map(option => {
              const isActive = selectedDayView === option;
              const label = option === 'weekend' ? 'All Weekend' : option.charAt(0).toUpperCase() + option.slice(1);
              return (
                <button
                  key={option}
                  onClick={() => setSelectedDayView(option)}
                  className={`text-sm px-4 py-2 rounded-full border-2 font-semibold shadow-lg transition-colors flex-shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap pb-2">
            <span className="text-sm text-gray-700 font-semibold flex-shrink-0">Popular tags:</span>
            {popularTags.map((tag, i) => {
              const isSel = selectedTags.includes(tag.slug);
              return (
                <button
                  key={tag.slug}
                  onClick={() => handleTagToggle(tag.slug, !isSel)}
                  className={`${pillStyles[i % pillStyles.length]} px-3 py-1 rounded-full text-sm font-semibold shadow-lg hover:opacity-80 transition flex-shrink-0 ${isSel ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                >
                  #{tag.label}
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="ml-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
                aria-label="Clear filters"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          <TagFilterModal
            open={isFiltersOpen}
            tags={allTags}
            selectedTags={selectedTags}
            onToggle={handleTagToggle}
            onClose={() => setIsFiltersOpen(false)}
          />

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-[#28313e] tracking-wide">PHILLY TRADITIONS THIS WEEKEND</h2>
            <p className="mt-2 text-gray-700">
              {traditionLinks.length ? traditionLinks : 'No traditions are on the calendar this weekend — check back soon!'}
            </p>
          </section>

          <section className="mt-12">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h2 className="text-2xl font-semibold text-[#28313e]">
                {sortedEvents.length} picks for {dayViewLabels[selectedDayView] || 'this weekend'}
              </h2>
              <span className="text-sm text-gray-500">Updated for {rangeForTitle}</span>
            </div>
            {loading ? (
              <p className="mt-8 text-gray-500">Loading events…</p>
            ) : sortedEvents.length === 0 ? (
              <p className="mt-8 text-gray-500">No events match the current filters. Try clearing a tag to see more.</p>
            ) : (
              <div className={isListView ? 'flex flex-col divide-y divide-gray-200' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8'}>
                {sortedEvents.map(evt => {
                  const key = evt.isRecurring ? `${evt.taggableId}-${evt.id}` : evt.id;
                  const tags = tagMap[String(evt.taggableId)] || [];
                  const shown = tags.slice(0, 2);
                  const extra = Math.max(0, tags.length - shown.length);
                  const startDate = evt.startDate || weekendStart;
                  const isToday = startDate.getTime() === today.getTime();
                  const diffDays = Math.round((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const bubbleLabel = isToday
                    ? 'Today'
                    : diffDays === 1
                      ? 'Tomorrow'
                      : formatMonthDay(startDate, PHILLY_TIME_ZONE);
                  const bubbleTime = evt.start_time ? ` ${formatTime(evt.start_time)}` : '';
                  const Wrapper = Link;
                  const detailPath =
                    evt.href ||
                    getDetailPathForItem({
                      ...evt,
                      venue_slug: evt.venues?.slug,
                    }) || '/';
                  const linkProps = { to: detailPath };

                  return (
                    <FavoriteState
                      key={key}
                      event_id={evt.isSports ? null : evt.isRecurring ? evt.taggableId : evt.id}
                      source_table={evt.isSports ? null : evt.source_table}
                    >
                      {({ isFavorite, toggleFavorite, loading: favLoading }) => (
                        isListView ? (
                          <Wrapper
                            {...linkProps}
                            className={`flex items-center justify-between p-4 transition-colors ${isFavorite ? 'bg-purple-100' : 'bg-white hover:bg-purple-50'}`}
                          >
                            <div className="flex items-center gap-4">
                              <img
                                src={evt.imageUrl || evt.image || ''}
                                alt={evt.title || evt.name}
                                className="w-20 h-20 object-cover rounded-lg"
                              />
                              <div>
                                <h3 className="text-lg font-semibold text-gray-800">{evt.title || evt.name}</h3>
                                <p className="text-sm text-gray-500">{formatMonthDay(startDate, PHILLY_TIME_ZONE)}{bubbleTime}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {shown.map((tag, i) => (
                                    <Link
                                      key={tag.slug}
                                      to={`/tags/${tag.slug}`}
                                      className={`${pillStyles[i % pillStyles.length]} text-xs px-2 py-1 rounded-full font-semibold`}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      #{tag.name}
                                    </Link>
                                  ))}
                                  {extra > 0 && <span className="text-xs text-gray-500">+{extra} more</span>}
                                </div>
                              </div>
                            </div>
                            {evt.isSports ? (
                              evt.url && (
                                <a
                                  href={evt.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-4 border border-indigo-600 rounded-md px-3 py-1 text-sm font-semibold text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors"
                                  onClick={e => e.stopPropagation()}
                                >
                                  Get Tickets
                                </a>
                              )
                            ) : (
                              <button
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!user) {
                                    navigate('/login');
                                    return;
                                  }
                                  toggleFavorite();
                                }}
                                disabled={favLoading}
                                className={`ml-4 border border-indigo-600 rounded-md px-3 py-1 text-sm font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                              >
                                {isFavorite ? 'In the Plans' : 'Add to Plans'}
                              </button>
                            )}
                          </Wrapper>
                        ) : (
                          <Wrapper
                            {...linkProps}
                            className={`block rounded-xl overflow-hidden shadow hover:shadow-lg transition flex flex-col ${
                              evt.isSports
                                ? 'bg-green-50 border-2 border-green-500'
                                : `bg-white ${isFavorite ? 'ring-2 ring-indigo-600' : ''}`
                            }`}
                          >
                            <div className="relative w-full h-48">
                              <img
                                src={evt.imageUrl || evt.image || ''}
                                alt={evt.title || evt.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded-full text-xs font-semibold text-gray-800">
                                {bubbleLabel}{bubbleTime}
                              </div>
                              {isFavorite && !evt.isSports && (
                                <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                                  In the plans!
                                </div>
                              )}
                              {evt.isGroupEvent && (
                                <div className="absolute inset-x-0 bottom-0 bg-green-600 text-white text-xs uppercase text-center py-1">
                                  Group Event
                                </div>
                              )}
                              {evt.isBigBoard && (
                                <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white text-xs uppercase text-center py-1">
                                  Submission
                                </div>
                              )}
                              {evt.isTradition && (
                                <div className="absolute inset-x-0 bottom-0 border-2 border-yellow-400 bg-yellow-100 text-yellow-800 text-xs uppercase font-semibold text-center py-1 flex items-center justify-center gap-1">
                                  <FaStar className="text-yellow-500" />
                                  Tradition
                                </div>
                              )}
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-between items-center text-center">
                              <div>
                                <h3 className="text-lg font-bold text-gray-800 line-clamp-2 mb-1">
                                  {evt.title || evt.name}
                                </h3>
                                {evt.isRecurring ? (
                                  evt.address && <p className="text-sm text-gray-600">at {evt.address}</p>
                                ) : (
                                  evt.venues?.name && <p className="text-sm text-gray-600">at {evt.venues.name}</p>
                                )}
                              </div>
                              <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
                                {shown.map((tag, i) => (
                                  <Link
                                    key={tag.slug}
                                    to={`/tags/${tag.slug}`}
                                    className={`${pillStyles[i % pillStyles.length]} text-[0.6rem] sm:text-sm px-2 sm:px-3 py-1 sm:py-2 rounded-full font-semibold`}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    #{tag.name}
                                  </Link>
                                ))}
                                {extra > 0 && <span className="text-[0.6rem] sm:text-sm text-gray-600">+{extra} more</span>}
                              </div>
                              {evt.isSports ? (
                                evt.url && (
                                  <a
                                    href={evt.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 w-full border border-indigo-600 rounded-md py-2 font-semibold text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors text-center"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    Get Tickets
                                  </a>
                                )
                              ) : (
                                <button
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!user) {
                                      navigate('/login');
                                      return;
                                    }
                                    toggleFavorite();
                                  }}
                                  disabled={favLoading}
                                  className={`mt-4 w-full border border-indigo-600 rounded-md py-2 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                                >
                                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                                </button>
                              )}
                            </div>
                          </Wrapper>
                        )
                      )}
                    </FavoriteState>
                  );
                })}
              </div>
            )}
          </section>

          {!user && (
            <section className="mt-20">
              <div className="bg-indigo-600/10 border border-indigo-200 rounded-3xl px-6 py-16 flex flex-col items-center text-center gap-6">
                <h2 className="text-3xl sm:text-4xl font-[Barrio] text-[#28313e]">Keep your weekend on track</h2>
                <p className="text-lg text-gray-700 max-w-2xl">
                  Save favorites, build plans, and unlock more from the most comprehensive events calendar in Philadelphia.
                </p>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center px-10 py-4 bg-indigo-600 text-white text-xl font-semibold rounded-full shadow-lg hover:bg-indigo-700 transition"
                >
                  Sign up to save your weekend plans
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

