// src/MainEvents.jsx
import React, { useState, useEffect } from 'react';
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


// ── Helpers ───────────────────────────────
function parseISODateLocal(str) {
  // Parse 'YYYY-MM-DD' as local date, NOT UTC.
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// NEW: Parse 'MM/DD/YYYY' as local date
function parseDate(datesStr) {
  if (!datesStr) return null;
  const [first] = datesStr.split(/through|–|-/);
  const [m, d, y] = first.trim().split('/').map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(d) {
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
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
            const end = parseDate(e['End Date']) || start;
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
          .filter((evt) => evt.end >= today0 && !!evt.updateText)
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

// ── MainEvents Component ───────────────────────────────
export default function MainEvents() {
  const params = useParams();
  const navigate = useNavigate();


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

  // Pagination state
  const [page, setPage] = useState(1);
  const EVENTS_PER_PAGE = 9;

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
        id, name, link, image, start_date, start_time, end_time, end_date, description, slug, venue_id,
        venues:venue_id ( name, slug )
      `)
      .order('start_date', { ascending: true });

    const fetchBigBoard = supabase
      .from('big_board_events')
      .select(`
        id,
        title,
        start_date,
        end_date,
        slug,
        big_board_posts!big_board_posts_event_id_fkey (
          image_url
        )
      `)
      .order('start_date', { ascending: true });

    const fetchTraditions = supabase
      .from('events')
      .select(`
        id,
        "E Name",
        "E Link",
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


    Promise.all([fetchAllEvents, fetchBigBoard, fetchTraditions, fetchGroupEvents])
    .then(([allEventsRes, bigBoardRes, tradRes, geRes]) => {

        
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

        // ── TRADITIONS EVENTS FILTERING ───────────────────────────────
const tradData = tradRes.data || [];
const tradFiltered = tradData
  .map(ev => {
    const start = parseDate(ev.Dates);
    const end   = parseDate(ev['End Date']) || start;
    return {
      id: ev.id,
      title: ev['E Name'],
      start,
      end,
      imageUrl: ev['E Image'] || '',
      slug: ev.slug,
      // mark as tradition, not Big Board
      isTradition: true,
      isBigBoard: false
    };
  })
  .filter(evt => {
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


        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedOption, customDate, params.view]);

  // Pagination
  const totalCount = events.length + bigBoardEvents.length + traditionEvents.length + groupEvents.length;;
  const pageCount = Math.ceil(totalCount / EVENTS_PER_PAGE);
  // Big Board first, then Traditions, then All Events
const allPagedEvents = [
    ...bigBoardEvents,
    ...traditionEvents,
    ...groupEvents, 
    ...events
  ].slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE);

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
        const gamesToday = all
          .filter(e => {
            const d = new Date(e.datetime_local);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
          })
          .map(e => {
            const local = e.performers.find(p => p.name.startsWith('Philadelphia '));
            const opp = e.performers.find(p => p !== local);
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

let headerText;
if (loading) {
  headerText = 'Loading…';
} else if (!totalCount) {
  headerText = 'No events found';
} else {
  // base string: either “on DATE” or “this weekend”
  const base = selectedOption === 'weekend'
    ? `${totalCount} event${totalCount > 1 ? 's' : ''} this weekend`
    : `${totalCount} event${totalCount > 1 ? 's' : ''} on ${headerDateStr}`;

  // append traditions if any
  headerText = traditionsCount
    ? `${base}, including ${traditionsCount} tradition${traditionsCount > 1 ? 's' : ''}!`
    : base;
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
  <title>{pageTitle} | Our Philly - Dig Into Philly</title>
  <meta name="description" content={metaDescription} />
</Helmet>
    
    <div className="flex flex-col min-h-screen">
        
      <Navbar />
      <div className="pt-20">
      <CityHolidayAlert />

        {/* ─── Hero Banner ─── */}
        <EventsPageHero />

        {/* ─── Recent Activity ─── */}
        <RecentActivity />

{/* ─── Pills + Date Picker + Event Count ─── */}
<div className="container mx-auto px-4 mt-12">
  <div className="flex flex-wrap justify-center items-center gap-4">
    {['today', 'tomorrow', 'weekend'].map(opt => (
      <button
        key={opt}
        onClick={() => { setSelectedOption(opt); goTo(opt); }}
        className={`
          text-base                /* larger, more legible font */
          px-5 py-2                /* bigger pill padding */
          rounded-full border-2    /* thicker border and fully rounded */
          font-semibold 
          shadow-lg                /* subtle drop shadow for "pop" */
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

    {/* datepicker wrapper */}
    <div className="relative w-full sm:w-auto">
      <DatePicker
        selected={new Date(customDate)}
        onChange={date => {
          const iso = date.toISOString().slice(0, 10);
          setCustomDate(iso);
          setSelectedOption('custom');
          goTo('custom', iso);
        }}
        dateFormat="yyyy-MM-dd"
        placeholderText="Pick a date"
        className={`
          w-full sm:w-auto
          text-base px-4 py-2     /* match pill height */
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




<main className="flex flex-col md:flex-row gap-8 container mx-auto px-4 py-8">
  {/* Left: events */}
  <div className="md:w-2/3 w-full">
    <h2 className="text-3xl font-semibold mb-4 text-[#28313e]">
           {headerText}
    </h2>

    {!loading && (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {allPagedEvents.map(evt => {
          const { isBigBoard, isTradition } = evt;
          const d     = evt.start_date ? parseISODateLocal(evt.start_date) : evt.start;
          const day   = d.getDate();
          const month = d.toLocaleString('en-US',{ month:'short' }).slice(0,3);
          const raw   = evt.name || evt.title || '';
          const title = raw.length > 40 ? raw.slice(0,50) + '…' : raw;
          const venue = evt.venues?.name || '';
          // pick the correct link for each source:
          const href = evt.isGroupEvent
          ? evt.href
          : evt.isTradition
            ? `/events/${evt.slug}`
            : evt.isBigBoard
              ? `/big-board/${evt.slug}`
              : evt.venues?.slug && evt.slug
                ? `/${evt.venues.slug}/${evt.slug}`
                : '#';

          const isTrad = Boolean(evt.isTradition);

          // compute today, start and end objs
          const today = new Date(); today.setHours(0,0,0,0);
          let startDateObj, endDateObj;
          if (evt.isTradition) {
            startDateObj = evt.start;
            endDateObj   = evt.end;
          } else {
            startDateObj = parseISODateLocal(evt.start_date);
            endDateObj   = parseISODateLocal(evt.end_date || evt.start_date);
          }
          const daysLeft = Math.ceil((endDateObj - today) / (1000 * 60 * 60 * 24));

          return (
            <Link
      key={evt.id}
      to={href}
      className="
        relative
        bg-white
        rounded-xl
        shadow-md
        overflow-hidden
        flex flex-col
        hover:scale-105
        text-center
        hover:shadow-lg
        focus:outline-none focus:ring-2 focus:ring-indigo-500
        transition-transform
      "
    >
      {/* DATE BADGE (softened) */}
      <div className="absolute top-2 left-2 w-8 h-8 rounded bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
        <div className="text-center">
          <div className="font-bold text-lg leading-none">{day}</div>
          <div className="text-xs uppercase">{month}</div>
        </div>
      </div>

      {/* IMAGE + GRADIENT OVERLAY */}
      <div className="relative w-full">
        <img
          src={evt.imageUrl || evt.image || ''}
          alt={raw}
          className="w-full h-40 object-cover object-top"
        />
        {/* subtle gradient under text */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 to-transparent pointer-events-none" />

        {/* BIG BOARD PIN + STRIPE + ICON */}
        {isBigBoard && (
          <>
            <img
              src={pinUrl}
              alt=""
              className="absolute right-0 top-1 w-16 h-12 transform rotate-12 z-30 pointer-events-none"
            />
            <div className="absolute inset-x-0 bottom-0 h-6 bg-indigo-600 flex items-center justify-center z-20">
              <span className="text-xs font-bold text-white uppercase">
                BIG BOARD POST
              </span>
            </div>
            <img
              src={iconUrl}
              alt="Community"
              className="absolute bottom-2 right-2 w-12 h-12 z-30"
            />
          </>
        )}

{evt.isGroupEvent && (
  <div className="absolute inset-x-0 bottom-0 bg-blue-600 text-white text-xs uppercase text-center py-1">
    Approved Group
  </div>
)}

        {/* TRADITION STRIPE */}
        {isTradition && (
          <div className="absolute inset-x-0 bottom-0 h-6 bg-yellow-500 z-20 flex items-center justify-center">
            <span className="text-xs font-bold text-white uppercase">
              Annual Tradition
            </span>
          </div>
        )}

        {/* VENUE OVERLAY (bottom-right) */}
        {venue && (
          <div className="absolute bottom-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium z-20">
            {venue}
          </div>
        )}
      </div>

      {/* FOOTER WITH TITLE */}
      <div className="p-3 pb-7 flex flex-col justify-end relative">
        <p className="text-sm sm:text-base font-semibold text-gray-800 leading-snug tracking-wide mb-1">
          {title}
        </p>

        {/* “ENDS IN X DAYS” BADGE */}
        {startDateObj <= today && daysLeft > 0 && (
          <div className="mt-1 
          bg-green-500 
          text-white 
          font-bold 
          text-[0.6rem] sm:text-xs 
          flex justify-center items-center 
          px-2 py-0.5 
          rounded 
          w-full">
            {daysLeft === 1 ? 'Ends tomorrow!' : `${daysLeft} more days`}
            </div>
        
        )}
      </div>
    </Link>
          );
        })}
      </div>
    )}

    {/* pagination */}
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
  </div>

  {/* Right: sidebar */}
  <aside className="md:w-1/3 w-full space-y-8">
    <SportsTonightSidebar />
    <div className="bg-white p-4 rounded-lg shadow">
    <UpcomingSidebarBulletin previewCount={10} />
    </div>
  </aside>
</main>




        <BigBoardEventsGrid />
        <PopularGroups />
        {/* ─── Floating “+” (always on top) ───────────────────────────── */}
      <FloatingAddButton onClick={() => setShowFlyerModal(true)} />

{/* ─── PostFlyerModal: opens when showFlyerModal=true ────────── */}
<PostFlyerModal
  isOpen={showFlyerModal}
  onClose={() => setShowFlyerModal(false)}
/>
        <Footer />
      </div>
    </div>
    </>

  );
}
