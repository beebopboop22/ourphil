import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

/**
 * GroupMatchWizard
 * A lightweight modal that lets the user choose interest tags and an optional
 * area, then suggests matching groups. No selections are persisted.
 */
export default function GroupMatchWizard({ onClose, onAddGroup }) {
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [matches, setMatches] = useState(null); // null = not yet searched
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

  // Fetch unique group types to use as tags
  useEffect(() => {
    supabase
      .from('groups')
      .select('Type')
      .then(({ data }) => {
        const types = new Set();
        (data || []).forEach(g => {
          (g.Type?.split(',').map(t => t.trim()) || []).forEach(t => types.add(t));
        });
        setAllTags(Array.from(types).sort());
      });
  }, []);

  // Fetch unique areas from groups table
  useEffect(() => {
    supabase
      .from('groups')
      .select('Area')
      .not('Area', 'is', null)
      .then(({ data }) => {
        const uniques = Array.from(
          new Set((data || []).map(g => g.Area).filter(Boolean))
        ).sort();
        setAreas(uniques);
      });
  }, []);

  const toggleTag = tag => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const findMatches = async () => {
    if (!selectedTags.length) return;
    const [{ data: groupData }, { data: eventData }] = await Promise.all([
      supabase.from('groups').select('*'),
      supabase.from('group_events').select('group_id, start_date'),
    ]);

    const now = new Date();
    const eventMap = new Map();
    (eventData || []).forEach(ev => {
      const key = ev.group_id;
      if (!eventMap.has(key)) {
        eventMap.set(key, { hasAny: true, hasUpcoming: false });
      }
      if (ev.start_date && new Date(ev.start_date) >= now) {
        eventMap.get(key).hasUpcoming = true;
      }
    });

    const results = (groupData || [])
      .map(g => {
        const groupTags = g.Type?.split(',').map(t => t.trim()) || [];
        const overlap = groupTags.filter(t => selectedTags.includes(t)).length;
        if (overlap === 0) return null;
        const areaMatch = selectedArea && g.Area === selectedArea ? 1 : 0;
        let score = overlap * 10 + areaMatch;
        const ev = eventMap.get(g.id);
        if (ev?.hasUpcoming) score += 100;
        else if (ev?.hasAny) score += 50;
        return { ...g, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    setMatches(results);
  };

  const reset = () => {
    setMatches(null);
    setSelectedTags([]);
    setSelectedArea('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-2xl rounded bg-white p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-2 top-2 p-2 text-2xl text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          ✕
        </button>

        {matches === null ? (
          <div>
            <h2 className="mb-4 text-2xl font-bold">Find your group</h2>

            <div className="mb-4">
              <h3 className="mb-2 font-semibold">Interests</h3>
              <div className="max-h-48 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag, i) => {
                    const style = pillStyles[i % pillStyles.length];
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`${style} ${
                          selectedTags.includes(tag) ? 'ring-2 ring-indigo-500' : ''
                        } px-4 py-2 rounded-full text-base font-medium`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold">Area</h3>
              <select
                className="w-full rounded border p-2"
                value={selectedArea}
                onChange={e => setSelectedArea(e.target.value)}
              >
                <option value="">Any area</option>
                {areas.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between">
              <button
                onClick={onAddGroup}
                className="rounded bg-gray-200 px-4 py-2"
              >
                Add Your Group
              </button>
              <button
                onClick={findMatches}
                disabled={!selectedTags.length}
                className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
              >
                Find Groups
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="mb-4 text-3xl font-[barrio]">Suggested Groups</h2>
            {matches.length === 0 ? (
              <p className="text-gray-600">No groups found.</p>
            ) : (
              <ul className="max-h-96 space-y-4 overflow-y-auto">
                {matches.map(g => {
                  const isClaimed = g.claimed_by || g.claimedBy || g.claimed || g.ClaimedBy;
                  return (
                    <li key={g.id}>
                      <Link
                        to={`/groups/${g.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-3"
                      >
                        <img
                          src={g.imag || '/favicon.ico'}
                          alt={g.Name}
                          className="h-20 w-20 flex-shrink-0 rounded object-cover"
                        />
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="font-semibold text-indigo-600 hover:underline">
                              {g.Name}
                            </span>
                            {isClaimed && (
                              <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                Claimed
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-700">
                            {g.Description || 'No description available.'}
                          </p>
                          {g.Type && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {g.Type.split(',').map((type, i) => {
                                const t = type.trim();
                                const slug = t.toLowerCase().replace(/\s+/g, '-');
                                const style = pillStyles[i % pillStyles.length];
                                return (
                                  <Link
                                    key={t}
                                    to={`/groups/type/${slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${style} rounded-full px-2 py-0.5 text-[10px] font-semibold`}
                                  >
                                    {t}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={onAddGroup}
                className="rounded bg-gray-200 px-4 py-2"
              >
                Add Your Group
              </button>
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="rounded bg-gray-200 px-4 py-2"
                >
                  Start Over
                </button>
                <button
                  onClick={onClose}
                  className="rounded bg-indigo-600 px-4 py-2 text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

