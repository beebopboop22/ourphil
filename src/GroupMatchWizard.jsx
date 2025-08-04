import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

/**
 * GroupMatchWizard
 * A lightweight modal that lets the user choose interest tags and an optional
 * area, then suggests matching groups. No selections are persisted.
 */
export default function GroupMatchWizard({ onClose }) {
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [matches, setMatches] = useState(null); // null = not yet searched

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
    const { data } = await supabase
      .from('groups')
      .select('id, Name, slug, imag, Area, Type');

    const results = (data || [])
      .map(g => {
        const groupTags = (g.Type?.split(',').map(t => t.trim()) || []);
        const overlap = groupTags.filter(t => selectedTags.includes(t)).length;
        if (overlap === 0) return null;
        const areaMatch = selectedArea && g.Area === selectedArea ? 1 : 0;
        const score = overlap * 10 + areaMatch;
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
          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
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
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`${
                        selectedTags.includes(tag)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      } px-3 py-1 rounded-full text-sm`}
                    >
                      {tag}
                    </button>
                  ))}
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

            <div className="flex justify-end">
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
            <h2 className="mb-4 text-2xl font-bold">Suggested Groups</h2>
            {matches.length === 0 ? (
              <p className="text-gray-600">No groups found.</p>
            ) : (
              <ul className="max-h-96 space-y-4 overflow-y-auto">
                {matches.map(g => (
                  <li key={g.id} className="flex items-center gap-4">
                    <img
                      src={g.imag || '/favicon.ico'}
                      alt={g.Name}
                      className="h-16 w-16 rounded object-cover"
                    />
                    <div>
                      <Link
                        to={`/groups/${g.slug}`}
                        className="font-semibold text-indigo-600 hover:underline"
                      >
                        {g.Name}
                      </Link>
                      {g.Area && (
                        <p className="text-sm text-gray-500">{g.Area}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex justify-between">
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
        )}
      </div>
    </div>
  );
}

