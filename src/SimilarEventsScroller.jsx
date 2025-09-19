import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';

export default function SimilarEventsScroller({ tagSlugs = [], excludeId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const parseDate = (str) => {
    if (!str) return null;
    if (str.includes('/')) {
      const [m, d, y] = str.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const fetchEvents = async () => {
    if (!tagSlugs.length) { setEvents([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: tagRows } = await supabase
        .from('tags')
        .select('id')
        .in('slug', tagSlugs);
      const tagIds = (tagRows || []).map(t => t.id);
      if (!tagIds.length) { setEvents([]); setLoading(false); return; }

      const { data: taggings } = await supabase
        .from('taggings')
        .select('taggable_id')
        .eq('taggable_type', 'events')
        .in('tag_id', tagIds);

      const ids = [...new Set((taggings || []).map(t => t.taggable_id))]
        .filter(id => id !== excludeId);
      if (!ids.length) { setEvents([]); setLoading(false); return; }

      const { data: evRows } = await supabase
        .from('events')
        .select('id, slug, "E Name", "E Image", Dates, "End Date"')
        .in('id', ids);

      const today = new Date(); today.setHours(0,0,0,0);
      const upcoming = (evRows || [])
        .map(ev => {
          const start = parseDate(ev.Dates);
          const end = ev['End Date'] ? parseDate(ev['End Date']) : start;
          return { ...ev, start, end };
        })
        .filter(ev => ev.start && ev.end >= today)
        .sort((a,b) => a.start - b.start)
        .slice(0,6);
      setEvents(upcoming);
    } catch (err) {
      console.error('Error loading similar events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [tagSlugs.join(','), excludeId]);

  const getBubble = (start) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((start - today) / (1000*60*60*24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff > 1 && diff < 7)
      return `This ${start.toLocaleDateString('en-US',{ weekday:'long' })}`;
    if (diff >= 7 && diff < 14)
      return `Next ${start.toLocaleDateString('en-US',{ weekday:'long' })}`;
    return start.toLocaleDateString('en-US',{ month:'short', day:'numeric' });
  };

  return (
    <section className="py-8 max-w-screen-xl mx-auto">
      <h2 className="text-center text-2xl font-semibold text-gray-800 mb-4">
        More traditions like this
      </h2>
      {loading ? (
        <p className="text-center text-gray-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-center text-gray-600">No similar events.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4 px-2">
            {events.map(ev => {
              const detailPath = getDetailPathForItem(ev) || '/';
              return (
                <Link
                  key={ev.id}
                  to={detailPath}
                  className="relative w-[240px] h-[340px] flex-shrink-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-transform hover:scale-105 bg-white"
                >
                  {ev['E Image'] && (
                    <img
                      src={ev['E Image']}
                      alt={ev['E Name']}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <h3 className="absolute bottom-16 left-3 right-3 text-center text-white text-xl font-bold z-20 leading-tight">
                    {ev['E Name']}
                  </h3>
                  <span className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-sm font-semibold px-3 py-1 rounded-full z-20">
                    {getBubble(ev.start)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
