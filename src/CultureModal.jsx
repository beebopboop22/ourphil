import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function CultureModal({ initial = [], onSave, onClose }) {
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set(initial));

  useEffect(() => {
    supabase
      .from('culture_tags')
      .select('id,name,emoji')
      .order('name', { ascending: true })
      .then(({ data }) => setTags(data || []));
  }, []);

  const toggle = id => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleSave = () => {
    onSave(Array.from(selected));
  };

  const filtered = tags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-4 max-h-[80vh] overflow-y-auto w-80 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Select Cultures</h2>
          <button onClick={onClose} className="text-xl">×</button>
        </div>
        <input
          className="w-full border p-1"
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="space-y-1">
          {filtered.map(t => (
            <label key={t.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span>{t.emoji} {t.name}</span>
            </label>
          ))}
        </div>
        <button
          onClick={handleSave}
          className="mt-2 bg-indigo-600 text-white px-4 py-1 rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
