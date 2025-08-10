// src/NavTagMenu.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RRule } from 'rrule';
import { supabase } from './supabaseClient';

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

export default function NavTagMenu() {
  const [tags, setTags] = useState([]);
  const [seasonalTags, setSeasonalTags] = useState([]);

  function parseLocalYMD(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function isTagActive(tag) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (tag.rrule) {
      try {
        const opts = RRule.parseString(tag.rrule);
        if (tag.season_start) opts.dtstart = parseLocalYMD(tag.season_start);
        const rule = new RRule(opts);
        const searchStart = new Date(today);
        searchStart.setDate(searchStart.getDate() - 8);
        const next = rule.after(searchStart, true);
        if (!next) return false;
        const start = new Date(next);
        start.setDate(start.getDate() - 7);
        const end = new Date(next);
        end.setDate(end.getDate() + 1);
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

  useEffect(() => {
    (async () => {
      try {
        const [trendRes, seasonRes] = await Promise.all([
          supabase.from('tags').select('name, slug').limit(10),
          supabase
            .from('tags')
            .select('name, slug, rrule, season_start, season_end')
            .eq('is_seasonal', true),
        ]);
        if (trendRes.error) throw trendRes.error;
        setTags(trendRes.data || []);
        if (seasonRes.error) throw seasonRes.error;
        const activeSeasonal = (seasonRes.data || []).filter(isTagActive);
        setSeasonalTags(activeSeasonal);
      } catch (err) {
        console.error('Error loading tags:', err);
        setTags([]);
        setSeasonalTags([]);
      }
    })();
  }, []);

  if (!tags.length && !seasonalTags.length) return null;

  return (
    <div className="border-t border-gray-200">
      <div className="px-4 py-1 flex items-center">
        <span className="text-sm sm:text-base font-bold text-gray-700 mr-4 flex-shrink-0">
          SEARCH TAGS:
        </span>
        <div className="flex-1 flex overflow-x-auto whitespace-nowrap">
          {seasonalTags.map(tag => (
            <Link
              key={tag.slug}
              to={`/tags/${tag.slug}`}
              className="bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-400 text-yellow-900 text-sm font-semibold px-3 py-1 mr-2 rounded-full border border-yellow-600 flex-shrink-0 hover:opacity-80 transition"
            >
              #{tag.name.toLowerCase()}
            </Link>
          ))}
          {tags.map((tag, i) => (
            <Link
              key={tag.slug}
              to={`/tags/${tag.slug}`}
              className={`${pillStyles[i % pillStyles.length]} text-sm font-semibold px-3 py-1 mr-2 rounded-full flex-shrink-0 hover:opacity-80 transition`}
            >
              #{tag.name.toLowerCase()}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
