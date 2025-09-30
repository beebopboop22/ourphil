// src/TaggedEventsScroller.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { supabase } from './supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { RRule } from 'rrule';
import useEventFavorite from './utils/useEventFavorite';
import { AuthContext } from './AuthProvider';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

export default function TaggedEventsScroller({
  tags = [],             // array of tag slugs to pull events from
  header,
  embedded = false,      // if true, omit outer section & header markup
  fullWidth = true,      // stretch to viewport edges by default
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagMeta, setTagMeta] = useState({
    isSeasonal: false,
    name: '',
  });
  const [active, setActive] = useState(true);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

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
  function isTagActive(tag) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (tag.rrule) {
      try {
        const opts = RRule.parseString(tag.rrule);
        if (tag.season_start) opts.dtstart = parseLocalYMD(tag.season_start);
        const rule = new RRule(opts);
        const searchStart = new Date(today); searchStart.setDate(searchStart.getDate() - 8);
        const next = rule.after(searchStart, true);
        if (!next) return false;
        const start = new Date(next); start.setDate(start.getDate() - 7);
        const end = new Date(next); end.setDate(end.getDate() + 1);
        return today >= start && today < end;
      } catch (err) {
        console.error('rrule parse', err);
        return false;
      }
    }
    if (tag.season_start && tag.season_end) {
      const start = parseLocalYMD(tag.season_start);
      const end = parseLocalYMD(tag.season_end);
      return start && end && today >= start && today <= end;
    }
    return true;
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
          .select('id, name, is_seasonal, season_start, season_end, rrule')
          .in('slug', tags);
        if (tagErr) throw tagErr;
        const tagIds = (tagRows || []).map(t => t.id);
        if (tagRows && tagRows.length) {
          const seasonal = tagRows.some(t => t.is_seasonal || t.rrule || (t.season_start && t.season_end));
          const activeNow = seasonal ? tagRows.some(t => isTagActive(t)) : true;
          setTagMeta({
            isSeasonal: seasonal,
            name: tagRows[0]?.name || '',
          });
          setActive(activeNow);
          if (seasonal && !activeNow) {
            setItems([]);
            return;
          }
        } else {
          setTagMeta({ isSeasonal: false, name: '' });
          setActive(true);
        }
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
                .select(`id, slug, name, start_date, image, venue_id(slug)`)
                .in('id', aeIds)
            : { data: [] },
          geIds.length
            ? supabase
                .from('group_events_calendar')
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
          const href =
            getDetailPathForItem({
              ...e,
              slug: e.slug,
            }) || '/';
          merged.push({
            id: e.id,
            source_table: 'events',
            title: e['E Name'],
            imageUrl: e['E Image'] || '',
            start, end,
            href,
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
          const href =
            getDetailPathForItem({
              ...ev,
              isBigBoard: true,
            }) || '/';
          merged.push({
            id: ev.id,
            source_table: 'big_board_events',
            title: ev.title,
            imageUrl: url,
            start, end,
            href,
          });
        });

        // all_events
        (aeRes.data || []).forEach(ev => {
          const start = parseLocalYMD(ev.start_date);
          const venueSlug = ev.venue_id?.slug;
          const href =
            getDetailPathForItem({
              ...ev,
              venue_slug: venueSlug,
              venues: ev.venue_id
                ? { name: ev.venue_id.name, slug: venueSlug }
                : null,
            }) || '/';
          merged.push({
            id: ev.id,
            source_table: 'all_events',
            title: ev.name,
            imageUrl: ev.image || '',
            start,
            end: start,
            href,
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
          const href =
            getDetailPathForItem({
              ...ev,
              group_slug: groupSlug,
              isGroupEvent: true,
            }) || '/';
          merged.push({
            id: ev.id,
            source_table: 'group_events',
            title: ev.title,
            imageUrl: url,
            start, end,
            href,
          });
        });

        // SeatGeek sports events when #sports is requested
        if (tags.includes('sports')) {
          try {
            const teamSlugs = [
              'philadelphia-phillies',
              'philadelphia-76ers',
              'philadelphia-eagles',
              'philadelphia-flyers',
              'philadelphia-union',
            ];
            let sgEvents = [];
            for (const slug of teamSlugs) {
              const res = await fetch(
                `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=20&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
              );
              const json = await res.json();
              sgEvents.push(...(json.events || []));
            }
            sgEvents.forEach(e => {
              const start = new Date(e.datetime_local);
              const href =
                getDetailPathForItem({
                  isSports: true,
                  slug: e.id,
                }) || `/sports/${e.id}`;
              merged.push({
                id: `sg-${e.id}`,
                source_table: 'sg_events',
                title: e.short_title,
                imageUrl: e.performers?.[0]?.image || '',
                start,
                end: start,
                href,
                url: e.url,
              });
            });
          } catch (err) {
            console.error('Error loading sports events', err);
          }
        }

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

  if (tagMeta.isSeasonal && !active) return null;

  const baseSectionClass = tagMeta.isSeasonal
    ? 'relative w-full bg-white border-y-4 border-[#004C55] py-16 overflow-hidden'
    : 'relative w-full bg-white border-b border-gray-200 py-16 overflow-hidden';
  const sectionClass = fullWidth ? `${baseSectionClass} px-0` : `${baseSectionClass} px-4`;
  const innerClass = fullWidth
    ? 'relative text-center z-20'
    : 'relative max-w-screen-xl mx-auto text-center z-20';

  const tagLabel = tagMeta.name || (tags[0] || '');
  const defaultHeader = (
    <Link
      to={tags.length === 1 ? `/tags/${tags[0]}` : '#'}
      className="text-3xl sm:text-5xl font-[Barrio] px-6 py-2 border-4 border-[#004C55] bg-[#d9e9ea] text-[#004C55] rounded-full hover:bg-gray-100"
    >
      #{tagLabel}
    </Link>
  );
  const headerNode = header || defaultHeader;

  const content = (
    loading ? (
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
            if (evt.source_table === 'sg_events') {
              return (
                <div key={`${evt.id}-${evt.start}`} className="flex-shrink-0 w-[260px]">
                  <Link
                    to={evt.href}
                    className="relative block w-full h-[380px] rounded-2xl overflow-hidden shadow-lg bg-green-50 border-2 border-green-500"
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
                  {evt.url && (
                    <a
                      href={evt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 w-full border border-indigo-600 rounded-md py-2 font-semibold text-center text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      Get Tickets
                    </a>
                  )}
                </div>
              );
            }
            return (
              <FavoriteState
                key={`${evt.id}-${evt.start}`}
                event_id={evt.id}
                source_table={evt.source_table}
              >
                {({ isFavorite, toggleFavorite, loading }) => (
                  <div className="flex-shrink-0 w-[260px]">
                    <Link
                      to={evt.href}
                      className={`relative block w-full h-[380px] rounded-2xl overflow-hidden shadow-lg ${
                        tagMeta.isSeasonal
                          ? isFavorite
                            ? 'ring-4 ring-indigo-600'
                            : 'ring-4 ring-[#004C55]'
                          : isFavorite
                            ? 'ring-2 ring-indigo-600'
                            : ''
                      }`}
                    >
                      <img
                        src={evt.imageUrl}
                        alt={evt.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                      {tagMeta.isSeasonal && tagMeta.name && (
                        <div className="absolute top-4 left-4 z-30 text-[10px] sm:text-xs font-medium text-gray-800">
                          <span className="flex items-center gap-1">
                            <span className="bg-[#004C55] text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                              {tagMeta.name}
                            </span>
                            <span className="bg-white/80 px-2 py-1 rounded-full">Series</span>
                          </span>
                        </div>
                      )}
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
                      disabled={loading}
                      className={`mt-2 w-full border border-indigo-600 rounded-md py-2 font-semibold transition-colors ${
                        isFavorite
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                      }`}
                    >
                      {isFavorite ? 'In the Plans' : 'Add to Plans'}
                    </button>
                  </div>
                )}
              </FavoriteState>
            );
          })}
        </div>
      </div>
    )
  );

  if (embedded) return content;

  return (
    <section className={sectionClass}>
      <div className={innerClass}>
        <div className="flex items-center justify-center gap-4 mb-6">
          {headerNode}
          {tagMeta.isSeasonal && (
            <div className="flex items-center gap-2 bg-[#d9e9ea] text-[#004C55] px-4 py-1.5 rounded-full text-sm sm:text-base font-semibold">
              <Clock className="w-5 h-5" />
              Seasonal Tag
            </div>
          )}
        </div>
        {content}
      </div>
    </section>
  );
}
