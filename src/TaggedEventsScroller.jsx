// src/TaggedEventsScroller.jsx
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

export default function TaggedEventsScroller({
  tags = [],             // array of tag slugs to pull events from
  header = 'Upcoming Events',
}) {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // only re-run when the **content** of tags changes
  const tagsKey = useMemo(
    () => Array.isArray(tags) ? [...tags].sort().join(',') : '',
    [tags]
  );

  // ── date parsing & bubble helpers ──────────────────────────────
  function parseDate(datesStr) {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    const [m, d, y] = first.trim().split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  function parseLocalYMD(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function getBubble(start, isActive) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isActive) return { text: 'Today', color: 'bg-green-500', pulse: false };
    const diff = Math.floor((start - today) / (1000 * 60 * 60 * 24));
    if (diff === 1) return { text: 'Tomorrow!', color: 'bg-blue-500', pulse: false };
    const weekday = start.toLocaleDateString('en-US', { weekday: 'long' });
    if (diff > 1 && diff < 7)  return { text: `This ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false };
    if (diff >= 7 && diff < 14) return { text: `Next ${weekday}!`, color: 'bg-[#ba3d36]', pulse: false };
    return { text: weekday, color: 'bg-[#ba3d36]', pulse: false };
  }

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        // 1) lookup tag IDs
        const { data: tagRows, error: tagErr } = await supabase
          .from('tags')
          .select('id')
          .in('slug', tags);
        if (tagErr) throw tagErr;
        const tagIds = (tagRows || []).map(t => t.id);
        if (!tagIds.length) {
          setItems([]);
          return;
        }

        // 2) fetch taggings
        const { data: taggings, error: taggErr } = await supabase
          .from('taggings')
          .select('taggable_id,taggable_type')
          .in('tag_id', tagIds);
        if (taggErr) throw taggErr;

        // 3) split by type
        const evIds = [], bbIds = [], aeIds = [], geIds = [];
        (taggings || []).forEach(({ taggable_id, taggable_type }) => {
          if (taggable_type === 'events')               evIds.push(taggable_id);
          else if (taggable_type === 'big_board_events') bbIds.push(taggable_id);
          else if (taggable_type === 'all_events')      aeIds.push(taggable_id);
          else if (taggable_type === 'group_events')    geIds.push(taggable_id);
        });

        // 4) fetch all four sources in parallel
        const [eRes, bbRes, aeRes, geRes] = await Promise.all([
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
          geIds.length
            ? supabase
                .from('group_events')
                .select(`
                  id,
                  title,
                  slug,
                  start_date,
                  end_date,
                  image_url,
                  group_id
                `)
                .in('id', geIds)
            : { data: [] },
        ]);

        // 5) build map of group_id → slug
        const groupIds = [...new Set((geRes.data || []).map(ev => ev.group_id))];
        let groupMap = {};
        if (groupIds.length) {
          const { data: groupsData, error: grpErr } = await supabase
            .from('groups')
            .select('id,slug')
            .in('id', groupIds);
          if (!grpErr && groupsData) {
            groupsData.forEach(g => {
              groupMap[g.id] = g.slug;
            });
          }
        }

        // 6) normalize into one array
        const merged = [];

        // standard events
        (eRes.data || []).forEach(e => {
          const start = parseDate(e.Dates);
          const end   = e['End Date'] ? parseDate(e['End Date']) : start;
          merged.push({
            id: e.id,
            title: e['E Name'],
            imageUrl: e['E Image'] || '',
            start, end,
            href: `/events/${e.slug}`,
          });
        });

        // big board
        (bbRes.data || []).forEach(ev => {
          const key = ev.big_board_posts?.[0]?.image_url;
          const url = key
            ? supabase.storage.from('big-board').getPublicUrl(key).data.publicUrl
            : '';
          const start = parseLocalYMD(ev.start_date);
          const end   = ev.end_date ? parseLocalYMD(ev.end_date) : start;
          merged.push({
            id: ev.id,
            title: ev.title,
            imageUrl: url,
            start, end,
            href: `/big-board/${ev.slug}`,
          });
        });

        // all_events
        (aeRes.data || []).forEach(ev => {
          const start = parseLocalYMD(ev.start_date);
          merged.push({
            id: ev.id,
            title: ev.name,
            imageUrl: ev.image || '',
            start, end: start,
            href: `/${ev.slug}`,
          });
        });

        // group_events
        (geRes.data || []).forEach(ev => {
          const start = parseLocalYMD(ev.start_date);
          const end   = ev.end_date ? parseLocalYMD(ev.end_date) : start;

          let url = '';
          if (ev.image_url?.startsWith('http')) {
            url = ev.image_url; 
          } else if (ev.image_url) {
            url = supabase
              .storage.from('big-board')
              .getPublicUrl(ev.image_url)
              .data.publicUrl;
          }

          const groupSlug = groupMap[ev.group_id];
          merged.push({
            id: ev.id,
            title: ev.title,
            imageUrl: url,
            start, end,
            href: groupSlug
              ? `/groups/${groupSlug}/events/${ev.slug}`
              : '/',
          });
        });

        // 7) filter + sort + limit
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

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-16 px-4 overflow-hidden">
      <div className="relative max-w-screen-xl mx-auto text-center z-20">
        <h2 className="text-2xl sm:text-4xl font-[barrio] font-bold text-gray-700 mb-6">
          {header}
        </h2>
        {loading ? (
          <p>Loading…</p>
        ) : !items.length ? (
          <p>No upcoming events.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-4">
              {items.map(evt => {
                const { text, color, pulse } = getBubble(
                  evt.start,
                  evt.start <= new Date() && new Date() <= evt.end
                );
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
                    <h3 className="absolute bottom-16 left-4 right-4 text-center text-white text-3xl font-bold z-20 leading-tight">
                      {evt.title}
                    </h3>
                    <span
                      className={`
                        absolute bottom-6 left-1/2 transform -translate-x-1/2
                        ${color} text-white text-base font-bold px-6 py-1 rounded-full
                        whitespace-nowrap min-w-[6rem]
                        ${pulse ? 'animate-pulse' : ''}
                        z-20
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
