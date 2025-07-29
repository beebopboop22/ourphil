import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import SubmitEventSection from './SubmitEventSection';
import { RRule } from 'rrule';
import { Link } from 'react-router-dom';

const pillStyles = [
  'bg-red-100 text-red-800',
  'bg-orange-100 text-orange-800',
  'bg-amber-100 text-amber-800',
  'bg-yellow-100 text-yellow-800',
  'bg-lime-100 text-lime-800',
  'bg-green-100 text-green-800',
  'bg-emerald-100 text-emerald-800',
  'bg-teal-100 text-teal-800',
  'bg-cyan-100 text-cyan-800',
  'bg-sky-100 text-sky-800',
  'bg-blue-100 text-blue-800',
  'bg-indigo-100 text-indigo-800',
  'bg-violet-100 text-violet-800',
  'bg-purple-100 text-purple-800',
  'bg-fuchsia-100 text-fuchsia-800',
  'bg-pink-100 text-pink-800',
  'bg-rose-100 text-rose-800',
  'bg-gray-100 text-gray-800',
  'bg-slate-100 text-slate-800',
  'bg-zinc-100 text-zinc-800',
  'bg-neutral-100 text-neutral-800',
  'bg-stone-100 text-stone-800',
  'bg-lime-200 text-lime-900',
  'bg-orange-200 text-orange-900',
];

function parseISODateLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function parseDate(str) {
  if (!str) return null;
  const [first] = str.split(/through|–|-/);
  const [m, d, y] = first.trim().split('/').map(Number);
  return new Date(y, m - 1, d);
}

function getUpcomingWeekend() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun
  const friday = new Date(today);
  if (dow === 0) friday.setDate(today.getDate() - 2);
  else if (dow === 1) friday.setDate(today.getDate() + 4);
  else if (dow === 2) friday.setDate(today.getDate() + 3);
  else if (dow === 3) friday.setDate(today.getDate() + 2);
  else if (dow === 4) friday.setDate(today.getDate() + 1);
  else if (dow === 5) friday.setDate(today.getDate());
  else if (dow === 6) friday.setDate(today.getDate() - 1);
  const saturday = new Date(friday); saturday.setDate(friday.getDate() + 1);
  const sunday = new Date(friday); sunday.setDate(friday.getDate() + 2);
  friday.setHours(0, 0, 0, 0);
  saturday.setHours(0, 0, 0, 0);
  sunday.setHours(0, 0, 0, 0);
  return [friday, saturday, sunday];
}

export default function WeekendRoundup() {
  const [events, setEvents] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [allTags, setAllTags] = useState([]);
  const [activeDay, setActiveDay] = useState('friday');
  const [loading, setLoading] = useState(true);
  const [weekendDates] = useState(() => getUpcomingWeekend());
  const [fri, sat, sun] = weekendDates;


  useEffect(() => {
    supabase
      .from('tags')
      .select('name,slug')
      .order('name', { ascending: true })
      .then(({ data }) => setAllTags(data || []));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [friday, saturday, sunday] = [fri, sat, sun];
      const fetchAllEvents = supabase
        .from('all_events')
        .select(
          `id,name,description,link,image,start_date,start_time,end_date,end_time,slug,venue_id,venues:venue_id(name,slug)`
        )
        .order('start_date', { ascending: true });
      const fetchBigBoard = supabase
        .from('big_board_events')
        .select(
          `id,title,description,start_date,start_time,end_date,end_time,slug,latitude,longitude,big_board_posts!big_board_posts_event_id_fkey(image_url)`
        )
        .order('start_date', { ascending: true });
      const fetchTraditions = supabase
        .from('events')
        .select(`id, "E Name", "E Description", Dates, "End Date", "E Image", slug`)
        .order('Dates', { ascending: true });
      const fetchGroupEvents = supabase
        .from('group_events')
        .select(`*, groups(Name, imag, slug)`)
        .order('start_date', { ascending: true });
      const fetchRecurring = supabase
        .from('recurring_events')
        .select(`id,name,slug,description,address,link,start_date,end_date,start_time,end_time,rrule,image_url,latitude,longitude`)
        .eq('is_active', true);

      const [aeRes, bbRes, trRes, geRes, recRes] = await Promise.all([
        fetchAllEvents,
        fetchBigBoard,
        fetchTraditions,
        fetchGroupEvents,
        fetchRecurring,
      ]);

      const weekendStart = friday;
      const weekendEnd = sunday;

      const ae = (aeRes.data || []).filter((ev) => {
        const start = parseISODateLocal(ev.start_date);
        const end = parseISODateLocal(ev.end_date || ev.start_date);
        const dur = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        if (dur > 10) return false;
        return (
          (start <= weekendStart && end >= weekendStart) ||
          (start <= weekendEnd && end >= weekendEnd)
        );
      }).map((ev) => ({
        ...ev,
        isBigBoard: false,
        isTradition: false,
      }));

      const bb = (bbRes.data || []).map((ev) => {
        const key = ev.big_board_posts?.[0]?.image_url;
        const url = key
          ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
          : '';
        return {
          ...ev,
          imageUrl: url,
          isBigBoard: true,
          isTradition: false,
        };
      }).filter((ev) => {
        const start = parseISODateLocal(ev.start_date);
        const end = parseISODateLocal(ev.end_date || ev.start_date);
        const dur = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        if (dur > 10) return false;
        return (
          (start <= weekendStart && end >= weekendStart) ||
          (start <= weekendEnd && end >= weekendEnd)
        );
      });

      const tr = (trRes.data || []).map((ev) => {
        const start = parseDate(ev.Dates);
        const end = ev['End Date'] ? parseDate(ev['End Date']) : start;
        return {
          id: ev.id,
          title: ev['E Name'],
          description: ev['E Description'],
          start,
          end,
          imageUrl: ev['E Image'] || '',
          slug: ev.slug,
          isTradition: true,
          isBigBoard: false,
        };
      }).filter((ev) => {
        const dur = Math.floor((ev.end - ev.start) / (1000 * 60 * 60 * 24));
        if (dur > 10) return false;
        return (
          (ev.start <= weekendStart && ev.end >= weekendStart) ||
          (ev.start <= weekendEnd && ev.end >= weekendEnd)
        );
      });

      const ge = (geRes.data || []).map((ev) => ({
        id: ev.id,
        title: ev.title,
        description: ev.description,
        imageUrl: ev.groups?.imag || '',
        start_date: ev.start_date,
        end_date: ev.end_date,
        href: `/groups/${ev.groups.slug}/events/${ev.id}`,
        isGroupEvent: true,
        isBigBoard: false,
        isTradition: false,
      })).filter((ev) => {
        const start = parseISODateLocal(ev.start_date);
        const end = parseISODateLocal(ev.end_date || ev.start_date);
        const dur = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        if (dur > 10) return false;
        return (
          (start <= weekendStart && end >= weekendStart) ||
          (start <= weekendEnd && end >= weekendEnd)
        );
      });

      const recSeries = recRes.data || [];
      const recOccs = recSeries.flatMap((series) => {
        const opts = RRule.parseString(series.rrule);
        opts.dtstart = new Date(`${series.start_date}T${series.start_time}`);
        if (series.end_date) {
          opts.until = new Date(`${series.end_date}T23:59:59`);
        }
        const rule = new RRule(opts);
        const startBoundary = new Date(weekendStart);
        startBoundary.setHours(0,0,0,0);
        const endBoundary = new Date(weekendEnd);
        endBoundary.setHours(23,59,59,999);
        return rule.between(startBoundary, endBoundary, true).map((raw) => {
          const local = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
          const yyyy = local.getFullYear();
          const mm = String(local.getMonth() + 1).padStart(2, '0');
          const dd = String(local.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          return {
            id: `${series.id}::${dateStr}`,
            title: series.name,
            slug: series.slug,
            description: series.description,
            address: series.address,
            link: `/${series.slug}/${dateStr}`,
            imageUrl: series.image_url,
            start_date: dateStr,
            start_time: series.start_time,
            isRecurring: true,
          };
        });
      });

      const combined = [...ae, ...bb, ...tr, ...ge, ...recOccs];
      combined.sort((a, b) => {
        const ad = parseISODateLocal(a.start_date || a.start);
        const bd = parseISODateLocal(b.start_date || b.start);
        return ad - bd;
      });

      setEvents(combined);
      setLoading(false);
    }
    load();
  }, [weekendDates]);

  useEffect(() => {
    if (!events.length) return;
    const idsByType = events.reduce((acc, evt) => {
      const table = evt.isBigBoard
        ? 'big_board_events'
        : evt.isTradition
        ? 'events'
        : evt.isGroupEvent
        ? 'group_events'
        : 'all_events';
      acc[table] = acc[table] || [];
      acc[table].push(String(evt.id));
      return acc;
    }, {});
    Promise.all(
      Object.entries(idsByType).map(([taggable_type, ids]) =>
        supabase
          .from('taggings')
          .select('tags(name,slug),taggable_id')
          .eq('taggable_type', taggable_type)
          .in('taggable_id', ids)
      )
    ).then((results) => {
      const map = {};
      results.forEach((res) => {
        if (res.error) return;
        res.data.forEach(({ taggable_id, tags }) => {
          map[taggable_id] = map[taggable_id] || [];
          map[taggable_id].push(tags);
        });
      });
      setTagMap(map);
    });
  }, [events]);

  const eventsByDay = {
    friday: events.filter((e) => {
      const d = parseISODateLocal(e.start_date || e.start);
      return d.getTime() === fri.getTime() || (d <= fri && parseISODateLocal(e.end_date || e.end || e.start_date).getTime() >= fri.getTime());
    }),
    saturday: events.filter((e) => {
      const d = parseISODateLocal(e.start_date || e.start);
      const end = parseISODateLocal(e.end_date || e.end || e.start_date);
      return d.getTime() === sat.getTime() || (d <= sat && end >= sat);
    }),
    sunday: events.filter((e) => {
      const d = parseISODateLocal(e.start_date || e.start);
      const end = parseISODateLocal(e.end_date || e.end || e.start_date);
      return d.getTime() === sun.getTime() || (d <= sun && end >= sun);
    }),
  };

  const dayLabels = {
    friday: `Friday ${fri.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    saturday: `Saturday ${sat.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    sunday: `Sunday ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  };

  return (
    <div className="min-h-screen flex flex-col bg-white pt-20">
      <Navbar />
      <main className="flex-1 max-w-screen-xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-[Barrio] text-center mb-6">Weekend Roundup</h1>
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {['friday','saturday','sunday'].map((day) => (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`px-4 py-2 rounded-full border text-sm font-semibold ${activeDay===day?'bg-indigo-600 text-white':'bg-white text-indigo-700'}`}
            >
              {dayLabels[day]}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="text-center">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {eventsByDay[activeDay].map((evt) => {
              const tagsFor = tagMap[evt.id] || [];
              const Wrapper = evt.isGroupEvent || evt.isRecurring || evt.isBigBoard || evt.isTradition ? Link : 'a';
              const linkProps = evt.isGroupEvent
                ? { to: evt.href }
                : evt.isRecurring
                ? { to: `/series/${evt.slug}/${evt.start_date}` }
                : evt.isTradition
                ? { to: `/events/${evt.slug}` }
                : evt.isBigBoard
                ? { to: `/big-board/${evt.slug}` }
                : evt.venues?.slug && evt.slug
                ? { to: `/${evt.venues.slug}/${evt.slug}` }
                : { href: evt.link || '#', target: '_blank', rel: 'noopener noreferrer' };
              return (
                <Wrapper
                  key={evt.id}
                  {...linkProps}
                  className={`block bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition ${evt.isTradition ? 'ring-4 ring-yellow-400 shadow-yellow-400/40' : ''}`}
                >
                  <div className="h-48 w-full relative">
                    <img src={evt.imageUrl || evt.image || ''} alt={evt.title || evt.name} className="w-full h-full object-cover" />
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
                      <div className="absolute inset-x-0 bottom-0 bg-yellow-500 text-white text-xs uppercase text-center py-1">
                        Tradition
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-1 line-clamp-2 text-center text-indigo-800">{evt.title || evt.name}</h3>
                    <div className="flex flex-wrap justify-center gap-1 mt-2">
                      {tagsFor.slice(0,2).map((tag,i)=>(
                        <span key={tag.slug} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">#{tag.name}</span>
                      ))}
                    </div>
                  </div>
                </Wrapper>
              );
            })}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="my-12 text-center">
            <h3 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-6">Explore these tags</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {allTags.map((tag, i) => (
                <Link
                  key={tag.slug}
                  to={`/tags/${tag.slug}`}
                  className={`${pillStyles[i % pillStyles.length]} px-5 py-3 rounded-full text-lg font-semibold hover:opacity-80 transition`}
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
      <SubmitEventSection onNext={() => {}} />
      <Footer />
    </div>
  );
}
