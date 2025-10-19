// src/NavTagMenu.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { isTagActive } from './utils/tagUtils';

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

  useEffect(() => {
    (async () => {
      try {
        const [allRes, seasonRes] = await Promise.all([
          supabase
            .from('tags')
            .select('name, slug')
            .eq('is_seasonal', false)
            .order('name'),
          supabase
            .from('tags')
            .select('name, slug, rrule, season_start, season_end')
            .eq('is_seasonal', true),
        ]);
        if (allRes.error) throw allRes.error;
        setTags(allRes.data || []);
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
    <div className="border-t border-gray-200" data-nav-tag-menu>
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
