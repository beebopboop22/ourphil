// src/TaggedEventsScroller.jsx
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import {
  getMyEventFavorites,
  addEventFavorite,
  removeEventFavorite,
} from './utils/eventFavorites';

export default function TaggedEventsScroller({
  tags = [],             // array of tag slugs to pull events from
  header = 'Upcoming Events',
}) {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favMap, setFavMap] = useState({});
  const [favCounts, setFavCounts] = useState({});
  const [busyFav, setBusyFav] = useState(false);

  // Normalize tags dependency so effect only runs when content changes
  const tagsKey = useMemo(
    () => Array.isArray(tags) ? [...tags].sort().join(',') : '',
    [tags]
  );

  // Helpers ------------------------------------------------------------------

  // parse "MM/DD/YYYY" or "MM/DD/YYYY – MM/DD/YYYY"
  function parseDate(datesStr) {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    const [m, d, y] = first.trim().split('/').map(Number);
    return new Date(y, m - 1, d);
  }

  // parse "YYYY-MM-DD" into local Date
  function parseLocalYMD(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Determine bubble text/color
  function getBubble(start, isActive) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isActive) return { text: 'Today', color: 'bg-green-500', pulse: false };
    const diff = Math.floor((start - today) / (1000 * 60 * 60 * 24));
    if (diff === 1) return { text: 'Tomorrow!', color: 'bg-blue-500', pulse: false };
    const weekday = start.toLocaleDateString('en-US', { weekday: 'long' });
    if (diff > 1 && diff < 7) return { text: `This ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false };
    if (diff >= 7 && diff < 14) return { text: `Next ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false };
    return { text: weekday, color: 'bg-[#ba3d36]', pulse: false };
  }

  function isThisWeekend(date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const fri = new Date(today); fri.setDate(today.getDate() + ((5 - dow + 7) % 7));
    const sun = new Date(today); sun.setDate(today.getDate() + ((0 - dow + 7) % 7));
    fri.setHours(0, 0, 0, 0); sun.setHours(23, 59, 59, 999);
    return date >= fri && date <= sun;
  }

  // Fetch tagged events ------------------------------------------------------
  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        // 1) get tag IDs for these slugs
        const { data: tagRows, error: tagErr } = await supabase
          .from('tags')
          .select('id')
          .in('slug', tags);
        if (tagErr) throw tagErr;
        const tagIds = tagRows.map(t => t.id);

        if (tagIds.length === 0) {
          setItems([]);
          return;
        }

        // 2) get taggings for those tag IDs
        const { data: taggings, error: taggingsErr } = await supabase
          .from('taggings')
          .select('taggable_id,taggable_type')
          .in('tag_id', tagIds);
        if (taggingsErr) throw taggingsErr;

        // 3) split IDs by type
        const evIds = [], bbIds = [], aeIds = [];
        taggings.forEach(({ taggable_id, taggable_type }) => {
          if (taggable_type === 'events') evIds.push(taggable_id);
          if (taggable_type === 'big_board_events') bbIds.push(taggable_id);
          if (taggable_type === 'all_events') aeIds.push(taggable_id);
        });

        // 4) fetch each source in parallel
        const [eRes, bbRes, aeRes] = await Promise.all([
          evIds.length
            ? supabase
                .from('events')
                .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
                .in('id', evIds)
            : { data: [] },
          bbIds.length
            ? supabase
                .from('big_board_events')
                .select(`
                  id, title, slug, start_date, end_date,
                  big_board_posts!big_board_posts_event_id_fkey(image_url)
                `)
                .in('id', bbIds)
            : { data: [] },
          aeIds.length
            ? supabase
                .from('all_events')
                .select(`id, slug, name, start_date, image`)
                .in('id', aeIds)
            : { data: [] },
        ]);

        // 5) normalize into one array
        const merged = [];

        // standard events
        eRes.data.forEach(e => {
          const start = parseDate(e.Dates);
          const end   = e['End Date'] ? parseDate(e['End Date']) : start;
          merged.push({
            id: e.id,
            title: e['E Name'],
            slug: e.slug,
            imageUrl: e['E Image'] || '',
            start, end,
            href: `/events/${e.slug}`,
          });
        });

        // big board events
        bbRes.data.forEach(ev => {
          const key = ev.big_board_posts?.[0]?.image_url;
          const url = key
            ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
            : '';
          const start = parseLocalYMD(ev.start_date);
          const end   = ev.end_date ? parseLocalYMD(ev.end_date) : start;
          merged.push({
            id: ev.id,
            title: ev.title,
            slug: ev.slug,
            imageUrl: url,
            start, end,
            href: `/big-board/${ev.slug}`,
          });
        });

        // all_events
        aeRes.data.forEach(ev => {
          const start = parseLocalYMD(ev.start_date);
          merged.push({
            id: ev.id,
            title: ev.name,
            slug: ev.slug,
            imageUrl: ev.image || '',
            start, end: start,
            href: `/${ev.slug}`,
          });
        });

        // 6) filter + sort + limit
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const upcoming = merged
          .filter(e => e.end >= today)
          .sort((a, b) => {
            const aActive = a.start <= today && today <= a.end;
            const bActive = b.start <= today && today <= b.end;
            if (aActive !== bActive) return aActive ? -1 : 1;
            return a.start - b.start;
          })
          .slice(0, 20);

        setItems(upcoming);
      } catch (err) {
        console.error('Error loading tagged events:', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [tagsKey]);


  // Render ------------------------------------------------------------------
  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-16 px-4 overflow-hidden">
      <div className="relative max-w-screen-xl mx-auto text-center z-20">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl sm:text-4xl font-[barrio] font-bold text-gray-700">{header}</h2>
        </div>

        {loading ? (
          <p className="text-center">Loading…</p>
        ) : !items.length ? (
          <p className="text-center">No upcoming events.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-4">
              {items.map(evt => {
                const { text, color, pulse } = getBubble(evt.start, evt.start <= new Date() && new Date() <= evt.end);
                const count = favCounts[evt.id] || 0;
                const isFav = Boolean(favMap[evt.id]);
                const weekendBadge = isThisWeekend(evt.start)
                  && [5, 6, 0].includes(evt.start.getDay());

                return (
                  <Link
                    key={`${evt.id}-${evt.start}`}
                    to={evt.href}
                    className="relative w-[260px] h-[380px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg"
                  >
                    <img
                      src={evt.imageUrl}
                      alt={evt.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />

                    {weekendBadge && (
                      <span className="absolute top-3 left-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full z-20">
                        Weekend Pick
                      </span>
                    )}

                    

                    <h3 className="absolute bottom-16 left-4 right-4 text-center text-white text-3xl font-bold z-20 leading-tight">
                      {evt.title}
                    </h3>

                    <span
                      className={`
                        absolute bottom-6 left-1/2 transform -translate-x-1/2
                        ${color} text-white text-base font-bold px-6 py-1 rounded-full
                        whitespace-nowrap min-w-[6rem]
                        ${pulse ? 'animate-pulse' : ''} z-20
                      `}
                    >
                      {text}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
