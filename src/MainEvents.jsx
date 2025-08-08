// src/MainEvents.jsx
import React, { useState, useEffect, lazy, Suspense, useContext } from 'react';
import { supabase } from './supabaseClient';
import { Helmet } from 'react-helmet';

import Navbar from './Navbar';
import Footer from './Footer';
import { Link, useParams, useNavigate } from 'react-router-dom';
import SportsTonightSidebar from './SportsTonightSidebar';
import RecentActivity from './RecentActivity';
import EventsPageHero from './EventsPageHero';
import PopularGroups from './PopularGroups';
import BigBoardEventsGrid from './BigBoardEventsGrid';
import CityHolidayAlert from './CityHolidayAlert';
import HeroLanding from './HeroLanding';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'
import SportsEventsGrid from './SportsEventsGrid';
import SeasonalEventsGrid from './SeasonalEvents';
import FloatingAddButton from './FloatingAddButton'
import PostFlyerModal from './PostFlyerModal'
import TriviaTonightBanner from './TriviaTonightBanner';
import TrendingTags from './TrendingTags';
import NewsletterSection from './NewsletterSection';
import { Share2 } from 'lucide-react';
import { RRule } from 'rrule';
import TaggedEventScroller from './TaggedEventsScroller';
import UpcomingTraditionsScroller from './UpcomingTraditionsScroller';
const EventsMap = lazy(() => import('./EventsMap'));
import 'mapbox-gl/dist/mapbox-gl.css'
import RecurringEventsScroller from './RecurringEventsScroller'
import useEventFavorite from './utils/useEventFavorite.js'
import { AuthContext } from './AuthProvider'
import { FaStar } from 'react-icons/fa';




// ── Helpers ───────────────────────────────
function parseISODateLocal(str) {
  // Parse 'YYYY-MM-DD' as local date, NOT UTC.
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hour = parseInt(h,10);
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.';
  hour = hour % 12 || 12;
  return `${hour}:${m.padStart(2,'0')} ${ampm}`;
}

// NEW: Parse 'MM/DD/YYYY' as local date
function parseDate(datesStr) {
  if (!datesStr) return null;
  const [first] = datesStr.split(/through|–|-/);
  const parts = first.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt) ? null : dt;
}

// inside your component render:
const startOfWeek = new Date()
startOfWeek.setHours(0, 0, 0, 0)
const endOfWeek = new Date(startOfWeek)
endOfWeek.setDate(endOfWeek.getDate() + 6)

function formatShortDate(d) {
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

// 🟡 Sidebar "Bulletin" (duplicate design, no desc)
function UpcomingSidebarBulletin({ previewCount = 10 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const today0 = new Date(); today0.setHours(0,0,0,0);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
          .order('Dates', { ascending: true });
        if (error) throw error;

        const dynamic = data
          .map((e) => {
            const start = parseDate(e.Dates);
            if (!start) return null;
            const end = parseDate(e['End Date']) || start;
            if (!end) return null;
            const sd = new Date(start); sd.setHours(0, 0, 0, 0);
            const ed = new Date(end);   ed.setHours(0, 0, 0, 0);
            const single = !e['End Date'] || e['End Date'].trim() === e.Dates.trim();
            let updateText;
            if (today0.getTime() === sd.getTime()) {
              updateText = single
                ? `${e['E Name']} is today!`
                : `${e['E Name']} starts today!`;
            } else if (!single && today0.getTime() === ed.getTime()) {
              updateText = `${e['E Name']} ends today!`;
            } else if (today0 < sd) {
              updateText = single
                ? `${e['E Name']} is ${formatShortDate(sd)}!`
                : `${e['E Name']} starts ${formatShortDate(sd)}!`;
            } else if (today0 > ed) {
              updateText = null;
            } else {
              updateText = `${e['E Name']} is on!`;
            }
            return { ...e, start: sd, end: ed, updateText };
          })
          .filter((evt) => evt && evt.end >= today0 && !!evt.updateText)
          .slice(0, previewCount);

        setEvents(dynamic);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [previewCount]);

  if (loading) return <div className="text-center py-4 text-gray-500">Loading…</div>;

  return (
    <div>
      <h3 className="font-[Barrio] text-2xl text-indigo-900 mb-2">Upcoming Traditions</h3>
      <div>
        {events.map((evt, idx) => {
          const isActive = evt.start && evt.end && today0 >= evt.start && today0 <= evt.end;
          const bgCls = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
          const href = evt.slug
            ? evt.slug.startsWith('http')
              ? evt.slug
              : `/events/${evt.slug}`
            : null;
          const Wrapper = href ? 'a' : 'div';
          const linkProps = href
            ? { href, ...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }
            : {};
          return React.createElement(
            Wrapper,
            {
              key: evt.id,
              className: `${bgCls} flex items-center space-x-4 border-b border-gray-200 py-3 px-2 ${href ? 'hover:bg-gray-100 cursor-pointer' : ''}`,
              ...linkProps,
            },
            isActive && <span className="block w-3 h-3 bg-green-500 rounded-full animate-ping flex-shrink-0" />,
            evt['E Image'] && (
              <img
                src={evt['E Image']}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ),
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-800">{evt.updateText}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ── Falling Pills Setup ───────────────────────────────────
const colors = ['#22C55E','#0D9488','#DB2777','#3B82F6','#F97316','#EAB308','#8B5CF6','#EF4444']

function FallingPills() {
  const [pillConfigs, setPillConfigs] = useState([])

  useEffect(() => {
    supabase
      .from('tags')
      .select('id,name,slug')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const configs = data.map((t, i) => ({
          key:      t.slug,
          name:     t.name,
          color:    colors[i % colors.length],
          left:     Math.random() * 100,             // anywhere across the screen
          duration: 20 + Math.random() * 10,         // slow: 20–30s
          delay:    -Math.random() * 20,             // start at random offsets
        }))
        setPillConfigs(configs)
      })
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <style>{`
        .pill {
          position: absolute;
          top: -4rem;
          padding: .6rem 1.2rem;
          border-radius: 9999px;
          color: #fff;
          font-size: 1rem;
          white-space: nowrap;
          opacity: .1;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes fall {
          to { transform: translateY(120vh); }
        }
      `}</style>

      {pillConfigs.map((p) => (
        <span
          key={p.key}
          className="pill"
          style={{
            left:              `${p.left}%`,
            backgroundColor:   p.color,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
          }}
        >
          #{p.name}
        </span>
      ))}
    </div>
  )
}

// ── MainEvents Component ───────────────────────────────
export default function MainEvents() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

   // Recurring‐series state
 const [recurringRaw, setRecurringRaw]   = useState([]);
 const [recurringOccs, setRecurringOccs] = useState([]);


// at the top of MainEvents()
const [allTags, setAllTags] = useState([]);

// fetch all tags on mount
useEffect(() => {
  supabase
    .from('tags')
    .select('name,slug')
    .then(({ data, error }) => {
      if (error) console.error('tags load error', error)
      else setAllTags(data)
    })
}, [])

// inside MainEvents(), alongside your other useState calls:
const [sportsEventsRaw, setSportsEventsRaw] = useState([]);    // all fetched games
const [sportsEvents, setSportsEvents]     = useState([]);    // filtered by date


useEffect(() => {
  (async () => {
    const teamSlugs = [
      'philadelphia-phillies',
      'philadelphia-76ers',
      'philadelphia-eagles',
      'philadelphia-flyers',
      'philadelphia-union',
    ];
    let all = [];
    for (const slug of teamSlugs) {
      const res  = await fetch(
        `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=50&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
      );
      const json = await res.json();
      all.push(...(json.events || []));
    }
    // normalize into your shape
    const mapped = all.map(e => {
      const dt   = new Date(e.datetime_local);
      const home = e.performers.find(p => p.home_team) || e.performers[0];
      const away = e.performers.find(p => !p.home_team) || home;
      return {
        id:         `sg-${e.id}`,
        title,
        start_date: dt.toISOString().slice(0,10),
        imageUrl:   local.image || other.image,
        href:       e.url,
        isSports:   true,
      }
    });
    setSportsEventsRaw(mapped);
  })();
}, []);


  // at the top of MainEvents()
const [tagMap, setTagMap] = useState({});


  const [showFlyerModal, setShowFlyerModal] = useState(false);

  

  // URL param logic for filter
  const filterFromParam = () => {
    if (!params.view) return 'today';
    if (['today', 'tomorrow', 'weekend'].includes(params.view)) return params.view;
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.view)) return 'custom';
    return 'today';
  };

    // Big Board Assets
  const iconUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png'
  const pinUrl  = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/push-pin-green.png'
  const boardBg = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/bulletin-board-2.jpeg'
  const paperBg = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/loose-leaf-paper.jpg'


  const [selectedOption, setSelectedOption] = useState(filterFromParam());
  const [customDate, setCustomDate] = useState(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.view || '')) return params.view;
    const t = new Date();
    return t.toISOString().slice(0, 10);
  });

  const [events, setEvents] = useState([]);
  const [bigBoardEvents, setBigBoardEvents] = useState([]);
  const [traditionEvents, setTraditionEvents] = useState([]);   // NEW
  const [loading, setLoading] = useState(true);
  // Community‐submitted group events
  const [groupEvents, setGroupEvents] = useState([]);
  const [profileMap, setProfileMap] = useState({});

  // Pagination state
  const [page, setPage] = useState(1);
  const [showAllToday, setShowAllToday] = useState(false);
  const EVENTS_PER_PAGE = 24;

  // Load profile info for big-board submitters
  useEffect(() => {
    const ids = Array.from(new Set(bigBoardEvents.map(e => e.owner_id).filter(Boolean)));
    if (ids.length === 0) { setProfileMap({}); return; }
    (async () => {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,username,image_url')
        .in('id', ids);
      const map = {};
      profs?.forEach(p => {
        let img = p.image_url || '';
        if (img && !img.startsWith('http')) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-images')
            .getPublicUrl(img);
          img = publicUrl;
        }
        map[p.id] = { username: p.username, image: img, cultures: [] };
      });
      const { data: rows } = await supabase
        .from('profile_tags')
        .select('profile_id, culture_tags(id,name,emoji)')
        .in('profile_id', ids)
        .eq('tag_type', 'culture');
      rows?.forEach(r => {
        if (!map[r.profile_id]) map[r.profile_id] = { username: '', image: '', cultures: [] };
        if (r.culture_tags?.emoji) {
          map[r.profile_id].cultures.push({ emoji: r.culture_tags.emoji, name: r.culture_tags.name });
        }
      });
      setProfileMap(map);
    })();
  }, [bigBoardEvents]);

  

  

  // "filterDay" for single days
  const getDay = () => {
    let d;
    if (selectedOption === 'today') {
      d = new Date();
    } else if (selectedOption === 'tomorrow') {
      d = new Date();
      d.setDate(d.getDate() + 1);
    } else if (selectedOption === 'custom') {
      d = new Date(customDate);
    }
    if (d) d.setHours(0, 0, 0, 0);
    return d;
  };

  // "weekend" start/end
  const getWeekend = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const sat = new Date(d);
    sat.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    sat.setHours(0, 0, 0, 0);
    sun.setHours(0, 0, 0, 0);
    return [sat, sun];
  };

  // import this from wherever you keep it, or just copy it in here:
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

    


  // Navigation for pills/date changes
  const goTo = (option, dateVal) => {
    if (option === 'today') navigate('/today');
    else if (option === 'tomorrow') navigate('/tomorrow');
    else if (option === 'weekend') navigate('/weekend');
    else if (option === 'custom' && dateVal)
      navigate(`/${dateVal}`);
  };

  // Fetch all_events, big_board_events, and events (traditions)
  useEffect(() => {
    setLoading(true);

    let isWeekend = false;
    let filterDay = null, weekendStart = null, weekendEnd = null;
    if (['today', 'tomorrow', 'custom'].includes(selectedOption)) {
      filterDay = getDay();
    }
    if (selectedOption === 'weekend') {
      [weekendStart, weekendEnd] = getWeekend();
      isWeekend = true;
    }

    const fetchAllEvents = supabase
  .from('all_events')
  .select(`
    id,
    name,
    description,
    link,
    image,
    start_date,
    start_time,
    end_time,
    end_date,
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
          start_time,
          end_time,
          end_date,
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
      .order('Dates', { ascending: true });  // ensure Dates is quoted

      const fetchGroupEvents = supabase
      .from('group_events')
      .select(`
        *,
        groups(Name, imag, slug)
      `)
      .order('start_date', { ascending: true });

      // <<< Fetch the active recurring series
      const fetchRecurring    = supabase
        .from('recurring_events')
        .select(`
          id, name, slug, description, address, link,
          start_date, end_date, start_time, end_time,
          rrule, image_url, latitude, longitude
        `)
        .eq('is_active', true);


    Promise.all([fetchAllEvents, fetchBigBoard, fetchTraditions, fetchGroupEvents, fetchRecurring ])
    .then(([allEventsRes, bigBoardRes, tradRes, geRes, recRes]) => {

        
        // ----- ALL_EVENTS FILTERING -----
        const allData = allEventsRes.data || [];

        // tag every “all_events” row
        const allTagged = allEventsRes.data?.map(evt => ({
            ...evt,
            isBigBoard: false,
            isTradition: false
        })) || [];

        let filtered = [];
        if (selectedOption === 'weekend') {
          const satStr = weekendStart.toISOString().slice(0, 10);
          const sunStr = weekendEnd.toISOString().slice(0, 10);
          filtered = allData.filter(evt => {
            const dbStart = evt.start_date;
            const dbEnd = evt.end_date || evt.start_date;
            const dur = Math.floor((Date.parse(dbEnd) - Date.parse(dbStart)) / (1000 * 60 * 60 * 24));
            const shortOrSingle = (!evt.end_date) || (evt.end_date === evt.start_date) || dur <= 10;
            const coversSat = dbStart <= satStr && dbEnd >= satStr;
            const coversSun = dbStart <= sunStr && dbEnd >= sunStr;
            return ((coversSat || coversSun) && shortOrSingle);
          });
        } else if (filterDay) {
          const dayStr = filterDay.toISOString().slice(0, 10);
          filtered = allData.filter(evt => {
            const dbStart = evt.start_date;
            const dbEnd = evt.end_date || evt.start_date;
            const dur = Math.floor((Date.parse(dbEnd) - Date.parse(dbStart)) / (1000 * 60 * 60 * 24));
            const shortOrSingle = (!evt.end_date) || (evt.end_date === evt.start_date) || dur <= 10;
            const isStartDay = dbStart === dayStr;
            const inRange = dbStart <= dayStr && dbEnd >= dayStr;
            return (isStartDay || (shortOrSingle && inRange));
          });
        }
        setEvents(filtered);

       // ----- BIG BOARD EVENTS FILTERING -----
let bigData = bigBoardRes.data || [];

// Resolve each storage key into a public URL *and* tag source
bigData = bigData.map(ev => {
    const key = ev.big_board_posts?.[0]?.image_url;
    const owner = ev.big_board_posts?.[0]?.user_id;
    let publicUrl = '';
    if (key) {
      const {
        data: { publicUrl: url }
      } = supabase
        .storage
        .from('big-board')
        .getPublicUrl(key);
      publicUrl = url;
    }
    return {
      ...ev,
      imageUrl: publicUrl,
      owner_id: owner,

      // ← NEW TAGS HERE:
      isBigBoard: true,
      isTradition: false
    };
  });
  
  

let bigFiltered = [];
if (selectedOption === 'weekend') {
  bigFiltered = bigData.filter(ev => {
    const start = parseISODateLocal(ev.start_date);
    const end   = parseISODateLocal(ev.end_date || ev.start_date);
    const dur   = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    if (dur > 10) return false;
    return (start <= weekendStart && end >= weekendStart)
        || (start <= weekendEnd   && end >= weekendEnd);
  });
} else if (filterDay) {
  const sel = filterDay;
  bigFiltered = bigData.filter(ev => {
    const start = parseISODateLocal(ev.start_date);
    const end   = parseISODateLocal(ev.end_date || ev.start_date);
    const dur   = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    if (dur > 10) return false;
    const isStartDay = sel.getTime() === start.getTime();
    const inRange    = sel >= start && sel <= end;
    return isStartDay || (dur <= 10 && inRange);
  });
}

setBigBoardEvents(bigFiltered);

const tradData = tradRes.data || [];
const tradFiltered = tradData
  .map(ev => {
    const start = parseDate(ev.Dates);
    if (!start) return null;
    const end   = parseDate(ev['End Date']) || start;
    if (!end) return null;
    return {
      id:          ev.id,
      title:       ev['E Name'],
      description: ev['E Description'],   // ← pull in here
      start,
      end,
      imageUrl:    ev['E Image'] || '',
      slug:        ev.slug,
      isTradition: true,
      isBigBoard:  false
    };
  })
  .filter(evt => {
    if (!evt) return false;
    // discard anything longer than 10 days
    const dur = Math.floor((evt.end - evt.start) / (1000 * 60 * 60 * 24));
    if (dur > 10) return false;

    if (selectedOption === 'weekend') {
      return (evt.start <= weekendStart && evt.end >= weekendStart)
          || (evt.start <= weekendEnd   && evt.end >= weekendEnd);
    } else if (filterDay) {
      return filterDay >= evt.start && filterDay <= evt.end;
    }
    return false;
  });

setTraditionEvents(tradFiltered);

// ── Community Group Events ────────────────────────────────────────
const geData = (geRes.data || []).map(ev => ({
  id: ev.id,
  title: ev.title,
  description: ev.description,
  imageUrl: ev.groups?.imag || '',          // fall back to group image
  start_date: ev.start_date,
  end_date: ev.end_date,
  href: `/groups/${ev.groups.slug}/events/${ev.id}`,
  isBigBoard: false,
  isTradition: false,
  isGroupEvent: true,                                       // tag it for styling
  groupName: ev.groups?.[0]?.Name,                          // to display “by [Group]”
}));
setGroupEvents(geData);

    // <<< store the raw recurring series
     setRecurringRaw(recRes.data || []);


        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedOption, customDate, params.view, sportsEventsRaw]);

  // Expand recurringRaw → recurringOccs whenever filter changes
useEffect(() => {
  if (!recurringRaw.length) return;

  // compute our window exactly like above
  let windowStart, windowEnd;
  if (selectedOption === 'weekend') {
    [windowStart, windowEnd] = getWeekend();
  } else {
    windowStart = getDay();
    windowEnd   = windowStart;
  }

  const occs = recurringRaw.flatMap(series => {
    const opts = RRule.parseString(series.rrule);
    opts.dtstart = new Date(`${series.start_date}T${series.start_time}`);
    if (series.end_date) {
      opts.until = new Date(`${series.end_date}T23:59:59`);
    }
    const rule = new RRule(opts);

    // clone and normalize boundaries
    const startBoundary = new Date(windowStart);
    startBoundary.setHours(0, 0, 0, 0);
    const endBoundary = new Date(windowEnd);
    endBoundary.setHours(23, 59, 59, 999);

    return rule
      .between(startBoundary, endBoundary, true)
      .map(raw => {
        // normalize to local date (midnight) to avoid UTC offsets
        const local = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
        const yyyy = local.getFullYear();
        const mm   = String(local.getMonth() + 1).padStart(2, '0');
        const dd   = String(local.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        return {
          id:          `${series.id}::${dateStr}`,
          title:       series.name,
          slug:        series.slug,
          description: series.description,
          address:     series.address,
          link:        `/${series.slug}/${dateStr}`,
          imageUrl:    series.image_url,
          start_date:  dateStr,
          start_time:  series.start_time,
          isRecurring: true,
          latitude:    series.latitude,
          longitude:   series.longitude
        };
        
      });
  });

  setRecurringOccs(occs);
}, [recurringRaw, selectedOption, customDate, params.view]);



  // ── FILTER SEATGEEK GAMES ─────────────────────────────
useEffect(() => {
  let f = [];
  if (selectedOption === 'weekend') {
    const [weekendStart, weekendEnd] = getWeekend();
    f = sportsEventsRaw.filter(e => {
      const d = parseISODateLocal(e.start_date);
      return d >= weekendStart && d <= weekendEnd;
    });
  } else {
    const day = getDay();
    if (day) {
      f = sportsEventsRaw.filter(e => {
        const d = parseISODateLocal(e.start_date);
        return d.getTime() === day.getTime();
      });
    }
  }
  setSportsEvents(f);
}, [selectedOption, customDate, params.view, sportsEventsRaw]);



  // Pagination
  const totalCount = events.length + bigBoardEvents.length + traditionEvents.length + groupEvents.length;;
  const pageCount = Math.ceil(totalCount / EVENTS_PER_PAGE);

  const allFilteredEvents = [
    ...groupEvents,
    ...bigBoardEvents,
    ...sportsEvents,
    ...recurringOccs,
    ...traditionEvents,
    ...events
  ];
  
  // Big Board first, then Traditions, then All Events
const allPagedEvents = [
    ...bigBoardEvents,
    ...traditionEvents,
    ...sportsEvents,
    ...recurringOccs,
    ...groupEvents,
    ...events
  ].slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE);

  const fullCount = allPagedEvents.length

  // normalize coords
const coordsEvents = allFilteredEvents
.map(evt => {
  if (evt.latitude != null && evt.longitude != null) {
    return { ...evt, lat: evt.latitude, lng: evt.longitude }
  }
  if (evt.venues?.latitude != null && evt.venues?.longitude != null) {
    return { ...evt, lat: evt.venues.latitude, lng: evt.venues.longitude }
  }
  return null
})
.filter(Boolean)

  let toShow = allPagedEvents;
if (selectedOption === 'today' && !showAllToday) {
  toShow = allPagedEvents.slice(0, 4);
}


  useEffect(() => {
    if (!allPagedEvents.length) return;
  
    // group IDs by their table
    const idsByType = allPagedEvents.reduce((acc, evt) => {
      let table;
      let id = String(evt.id);
      if (evt.isBigBoard) {
        table = 'big_board_events';
      } else if (evt.isTradition) {
        table = 'events';
      } else if (evt.isGroupEvent) {
        table = 'group_events';
      } else if (evt.isRecurring) {
        table = 'recurring_events';
        id = id.split('::')[0];
      } else {
        table = 'all_events';
      }
      acc[table] = acc[table] || [];
      acc[table].push(id);
      return acc;
    }, {});
  
    Promise.all(
      Object.entries(idsByType).map(([taggable_type, ids]) =>
        supabase
          .from('taggings')
          .select('tags(name,slug),taggable_id')      // <– returns `tags` field
          .eq('taggable_type', taggable_type)
          .in('taggable_id', ids)
      )
    ).then(results => {
      const map = {};
  
      results.forEach(res => {
        if (res.error) {
          console.error('taggings fetch failed:', res.error);
          return;
        }
        res.data.forEach(({ taggable_id, tags }) => {   // ← destructure `tags`
          map[taggable_id] = map[taggable_id] || [];
          map[taggable_id].push(tags);
        });
      });
  
      setTagMap(map);
    });
  }, [allPagedEvents]);
  
  
  
  

  // Sports summary for sidebar
  const [sportsSummary, setSportsSummary] = useState('');
  const [loadingSports, setLoadingSports] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const teamSlugs = [
          'philadelphia-phillies',
          'philadelphia-76ers',
          'philadelphia-eagles',
          'philadelphia-flyers',
          'philadelphia-union',
        ];
        let all = [];
        for (const slug of teamSlugs) {
          const res = await fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
          );
          const json = await res.json();
          all.push(...(json.events || []));
        }
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const now   = new Date(); 
        const gamesToday = all
          .filter(e => {
            const d = new Date(e.datetime_local);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
          })
          .map(e => {
            const local = e.performers.find(p => p.name.startsWith('Philadelphia '));
            const other = e.performers.find(p => p !== local) || local;
            const teamName = local.name.replace(/^Philadelphia\s+/, '');
            const oppName  = other.name.replace(/^Philadelphia\s+/, '');
            const title = local.home_team
            ? `${oppName} at ${teamName}`
            : `${teamName} at ${oppName}`;
            const team = local?.name.replace(/^Philadelphia\s+/, '') || '';
            const opponent = opp?.name.replace(/^Philadelphia\s+/, '') || '';
            const hour = new Date(e.datetime_local)
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
            return `${team} at ${opponent} at ${hour}`;
          });
        setSportsSummary(gamesToday.join(', '));
      } catch {
        // ignore
      }
      setLoadingSports(false);
    })();
  }, []);

  // derive the human-readable date for the header
let headerDateStr = '';
if (!loading) {
  let d;
  if (selectedOption === 'today') {
    d = new Date();
  } else if (selectedOption === 'tomorrow') {
    d = new Date();
    d.setDate(d.getDate() + 1);
  } else if (selectedOption === 'custom') {
    d = new Date(customDate);
  }
  if (d) {
    headerDateStr = d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });
  }
}
// how many of our results are “traditions”?
const traditionsCount = traditionEvents.length;

// after you’ve calculated headerDateStr and traditionsCount…
let headerText
if (loading) {
  headerText = 'Loading…'
} else if (fullCount === 0) {
  headerText = 'No events found'
} else {
  // base string: either “on DATE” or “this weekend”
  const base = selectedOption === 'weekend'
    ? `${fullCount} event${fullCount > 1 ? 's' : ''} this weekend`
    : `${fullCount} event${fullCount > 1 ? 's' : ''} on ${headerDateStr}`

  // append traditions if any
  headerText = traditionsCount
    ? `${base}, including ${traditionsCount} Philly tradition${traditionsCount > 1 ? 's' : ''}!`
    : base
}



    let pageTitle;
  if (selectedOption === 'today') {
    pageTitle = `Events in Philly Today`;
  } else if (selectedOption === 'tomorrow') {
    pageTitle = `Events in Philly Tomorrow`;
  } else if (selectedOption === 'weekend') {
    pageTitle = `Events in Philly This Weekend`;
  } else {
    pageTitle = `Events in Philly on ${headerDateStr}`;
  }

  const metaDescription = totalCount
    ? `Browse ${totalCount} event${totalCount>1?'s':''} ${
        selectedOption==='custom'
          ? `on ${headerDateStr}`
          : selectedOption==='weekend'
            ? `this weekend`
            : selectedOption
      } in Philadelphia.`
    : `No events found for ${
        selectedOption==='custom'
          ? headerDateStr
          : selectedOption
      } in Philadelphia.`;

  

      return (
        <>
          <Helmet>
            <title>Make Your Philly Plans | Our Philly</title>
            <link rel="icon" type="image/x-icon" href="/favicon.ico" />
            <meta
              name="description"
              content="Discover events and add them to your plans, subscribe to tags for daily e-mail roundups of what's coming, and more."
            />
          </Helmet>
      
          <div className="flex flex-col min-h-screen overflow-x-visible">
            <Navbar />
      
            <div className="mt-20">
            </div>
      
            {/* Hero */}
            <div className="relative w-full max-w-screen-3xl mx-auto pt-14 text-center overflow-hidden bg-gray-50">
              {/* falling pills background */}
              <FallingPills  />
      
              <div className="relative inline-block text-center z-10">
                <h1 className="text-6xl sm:text-5xl md:text-8xl font-[Barrio] font-black text-indigo-900 mb-4">
                  Make Your Philly Plans
                </h1>
                <p className="text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto">
                  Discover events and add them to your plans, subscribe to tags for daily e-mail roundups of what's coming, and more.
                </p>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                  <span className="absolute w-full h-px bg-white opacity-20" />
                  <img
                    src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png"
                    alt="Our Philly Mascot"
                    className="absolute right-0 w-24 h-auto -translate-y-1/3"
                  />
                </div>
              </div>
      
              <div className="max-w-screen-xl mx-auto px-4 py-2 z-10 text-left">
                <TrendingTags />
                <UpcomingTraditionsScroller />
                <TriviaTonightBanner />
              </div>
            </div>

            <div className="mt-12 text-center">
              <h2 className="text-4xl sm:text-5xl font-[Barrio] font-black text-indigo-900">PICK YOUR DATES!</h2>
            </div>

            {/* ─── Pills + Date Picker + Event Count ─── */}
            <div className="container mx-auto px-4 mt-12">
              <div className="flex flex-col sm:flex-row justify-start sm:justify-center items-start sm:items-center gap-2 sm:gap-4">
                {/* Pills row */}
                <div className="flex flex-nowrap sm:flex-wrap justify-start sm:justify-center items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  {['today', 'tomorrow', 'weekend'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setSelectedOption(opt); goTo(opt); }}
                      className={`
                        text-sm sm:text-base
                        px-3 sm:px-5 py-1 sm:py-2
                        rounded-full border-2
                        font-semibold
                        shadow-lg
                        transform transition-transform duration-200
                        ${
                          selectedOption === opt
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white'
                        }
                      `}
                    >
                      {opt === 'today' ? 'Today'
                        : opt === 'tomorrow' ? 'Tomorrow'
                        : 'This Weekend'}
                    </button>
                  ))}
                </div>
      
                {/* DatePicker below on mobile, inline on desktop */}
                <div className="relative w-full sm:w-auto">
                  <DatePicker
                    selected={new Date(customDate)}
                    onChange={date => {
                      const iso = date.toISOString().slice(0, 10)
                      setCustomDate(iso)
                      setSelectedOption('custom')
                      goTo('custom', iso)
                    }}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Pick a date"
                    className={`
                      w-full sm:w-auto
                      text-sm sm:text-base px-2 sm:px-4 py-1 sm:py-2
                      border-2 border-indigo-600 rounded-full
                      shadow-lg
                      focus:outline-none focus:ring-2 focus:ring-indigo-500
                      transition duration-200
                    `}
                    wrapperClassName="w-full sm:w-auto"
                    calendarClassName="bg-white shadow-lg rounded-lg p-2 text-base"
                    popperClassName="z-50"
                  />
                </div>
              </div>
            </div>
      
            <main className="container mx-auto px-4 py-8">
  <h2 className="text-3xl font-semibold mb-4 text-[#28313e]">
    {headerText}
  </h2>

  {!loading && (
    <>
  

    {/* MAP GOES HERE */}

    

    
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {toShow.map(evt => {
          const today = new Date(); today.setHours(0,0,0,0);
          const now = new Date();
          const startDate = evt.isTradition
            ? evt.start
            : parseISODateLocal(evt.start_date);

          const isToday = startDate.getTime() === today.getTime();
          const diffDays = Math.ceil((startDate - now) / (1000*60*60*24));
          const bubbleLabel = isToday
            ? 'Today'
            : diffDays === 1
            ? 'Tomorrow'
            : startDate.toLocaleDateString('en-US',{ month:'short', day:'numeric' });

          const bubbleTime = evt.start_time ? ` ${formatTime(evt.start_time)}` : '';

          const isExternal = evt.isSports;
          const Wrapper    = isExternal ? 'a' : Link;
          const linkProps = isExternal
          ? { href: evt.href, target: '_blank', rel: 'noopener noreferrer' }
          : evt.isGroupEvent
            ? { to: evt.href }
            : evt.isRecurring
              ? { to: `/series/${evt.slug}/${evt.start_date}` }
              : evt.isTradition
                ? { to: `/events/${evt.slug}` }
                : evt.isBigBoard
                  ? { to: `/big-board/${evt.slug}` }
                  : evt.venues?.slug && evt.slug
                    ? { to: `/${evt.venues.slug}/${evt.slug}` }
                    : { to: '/' };


          const tagKey = evt.isRecurring ? String(evt.id).split('::')[0] : evt.id;
          const tags = tagMap[tagKey] || [];
          const shown = tags.slice(0,2);
          const extra = tags.length - shown.length;

          // only pass ones with coords
const mapped = allPagedEvents.filter(e => e.latitude && e.longitude);

          return (
            <FavoriteState
              event_id={evt.isRecurring ? String(evt.id).split('::')[0] : evt.id}
              source_table={
                evt.isBigBoard
                  ? 'big_board_events'
                  : evt.isTradition
                    ? 'events'
                    : evt.isGroupEvent
                      ? 'group_events'
                      : evt.isRecurring
                        ? 'recurring_events'
                        : 'all_events'
              }
            >
            {({ isFavorite, toggleFavorite, loading }) => (
              <Wrapper
                key={evt.id}
                {...linkProps}
                className={`block bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition flex flex-col ${isFavorite ? 'ring-2 ring-indigo-600' : ''}`}
              >
              {/* IMAGE + BUBBLE + BADGES */}
              <div className="relative w-full h-48">
                <img
                  src={evt.imageUrl || evt.image || ''}
                  alt={evt.title || evt.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded-full text-xs font-semibold text-gray-800">
                  {bubbleLabel}{bubbleTime}
                </div>
                {isFavorite && (
                  <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                    In the plans!
                  </div>
                )}

                {/* Group Event comes first */}
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

              {/* FOOTER */}
              <div className="p-4 flex-1 flex flex-col justify-between items-center text-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 line-clamp-2 mb-1">
                    {evt.title || evt.name}
                  </h3>
                  {/* location line */}
                    {evt.isRecurring ? (
                      evt.address && (
                        <p className="text-sm text-gray-600">
                          at {evt.address}
                        </p>
                      )
                    ) : (
                      evt.venues?.name && (
                        <p className="text-sm text-gray-600">
                          at {evt.venues.name}
                        </p>
                      )
                    )}
                </div>

                <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
                  {shown.map((tag, i) => (
                    <Link
                      key={tag.slug}
                      to={`/tags/${tag.slug}`}
                      className={`
                        ${pillStyles[i % pillStyles.length]}
                        text-[0.6rem] sm:text-sm
                        px-2 sm:px-3
                        py-1 sm:py-2
                        rounded-full font-semibold
                      `}
                    >
                      #{tag.name}
                    </Link>
                  ))}
                  {extra > 0 && (
                    <span className="text-[0.6rem] sm:text-sm text-gray-600">
                      +{extra} more
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); if (!user) { navigate('/login'); return; } toggleFavorite(); }}
                  disabled={loading}
                  className={`mt-4 w-full border border-indigo-600 rounded-md py-2 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                >
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>
              {evt.isBigBoard && (
                <div className="w-full bg-blue-50 text-blue-900 py-2 text-center">
                  <div className="text-[0.55rem] uppercase font-semibold tracking-wide">SUBMITTED BY</div>
                  <div className="mt-1 flex justify-center gap-1 text-xs font-semibold">
                    <span>{profileMap[evt.owner_id]?.username}</span>
                    {profileMap[evt.owner_id]?.cultures?.map(c => (
                      <span key={c.emoji} className="relative group">
                        {c.emoji}
                        <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                          {c.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              </Wrapper>
            )}
            </FavoriteState>
          );
        })}
      </div>

      {selectedOption === 'today' && !showAllToday && allPagedEvents.length > 4 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAllToday(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
          >
            See all {allPagedEvents.length} events →
          </button>
        </div>
      )}
    </>
  )}

  {!loading && pageCount > 1 && (
    <div className="flex justify-center mt-6 space-x-2">
      {[...Array(pageCount)].map((_, i) => (
        <button
          key={i}
          onClick={() => setPage(i+1)}
          className={`px-4 py-2 rounded-full border ${
            page === i+1
              ? 'bg-[#28313e] text-white'
              : 'bg-white text-[#28313e] border-[#28313e] hover:bg-[#28313e] hover:text-white'
          } font-semibold transition`}
        >
          {i+1}
        </button>
      ))}
    </div>
  )}
</main>

      
            {/* ─── Recent Activity ─── */}
            <RecentActivity />
            <TaggedEventScroller tags={['peco-multicultural']} header="#PECO Multicultural"/>
            <TaggedEventScroller tags={['arts']} header="#Arts Coming Soon"/>
            <TaggedEventScroller tags={['nomnomslurp']} header="#NomNomSlurp Next Up"/>
            <RecurringEventsScroller windowStart={startOfWeek} windowEnd={endOfWeek} eventType="open_mic" header="Karaoke, Bingo, Open Mics Coming Up..." />

            {/* ─── Hero Banner ─── */}
            <HeroLanding />
      
            <BigBoardEventsGrid />
            <PopularGroups />
      
            {/* ─── Floating “+” (always on top) ─── */}
            <FloatingAddButton onClick={() => setShowFlyerModal(true)} />
      
            {/* ─── PostFlyerModal ─── */}
            <PostFlyerModal
              isOpen={showFlyerModal}
              onClose={() => setShowFlyerModal(false)}
            />
      
            <Footer />
          </div>
        </>
      )
      }
      