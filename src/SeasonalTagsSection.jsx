// src/SeasonalTagsSection.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import TaggedEventScroller from './TaggedEventsScroller';
import { RRule } from 'rrule';

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
    } catch {
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

export default function SeasonalTagsSection() {
  const [tags, setTags] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('name, slug, description, rrule, season_start, season_end')
        .eq('is_seasonal', true);
      if (error) {
        console.error('Error loading seasonal tags:', error);
        return;
      }
      const active = (data || []).filter(isTagActive);
      setTags(active);
    })();
  }, []);

  if (!tags.length) return null;

  const current = tags[index];

  return (
    <section className="relative w-full bg-[#e0f3f5] border-y-4 border-[#004C55] py-16 px-4 overflow-hidden">
      <div className="relative max-w-screen-xl mx-auto text-center z-20">
        <h2 className="text-2xl sm:text-4xl font-[barrio] font-bold text-gray-700 mb-6">SEASONAL TAGS</h2>
        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          {tags.map((t, i) => (
            <button
              key={t.slug}
              onClick={() => setIndex(i)}
              className={`px-4 py-2 rounded-full border font-semibold transition ${
                index === i
                  ? 'bg-[#004C55] text-white border-[#004C55]'
                  : 'bg-white text-[#004C55] border-[#004C55] hover:bg-[#004C55] hover:text-white'
              }`}
            >
              #{t.name}
            </button>
          ))}
        </div>
        {current && (
          <>
            <div className="flex items-center justify-center gap-2 mb-6">
              <h3 className="text-2xl sm:text-4xl font-[barrio] font-bold text-gray-700">
                #{current.name}
              </h3>
              <div className="flex items-center gap-2 bg-[#d9e9ea] text-[#004C55] px-4 py-1.5 rounded-full text-sm sm:text-base font-semibold">
                Seasonal Tag
              </div>
            </div>
            {current.description && (
              <div className="max-w-2xl mx-auto bg-white border-2 border-[#004C55] text-gray-800 p-4 rounded-lg shadow mb-8">
                {current.description}
              </div>
            )}
            <TaggedEventScroller tags={[current.slug]} embedded />
          </>
        )}
      </div>
    </section>
  );
}
