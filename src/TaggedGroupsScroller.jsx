import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function TaggedGroupsScroller({ tags = [] }) {
  const [selected, setSelected] = useState(tags[0]?.slug || '');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selected) { setGroups([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const { data: tagRow } = await supabase
          .from('tags')
          .select('id')
          .eq('slug', selected)
          .single();
        const tagId = tagRow?.id;
        if (!tagId) { setGroups([]); setLoading(false); return; }
        const { data: taggings } = await supabase
          .from('taggings')
          .select('taggable_id')
          .eq('taggable_type', 'groups')
          .eq('tag_id', tagId);
        const ids = (taggings || []).map(t => t.taggable_id);
        if (!ids.length) { setGroups([]); setLoading(false); return; }
        const { data: groupRows } = await supabase
          .from('groups')
          .select('id, Name, slug, imag, Type')
          .in('id', ids)
          .limit(12);
        setGroups(groupRows || []);
      } catch (err) {
        console.error('Error loading tagged groups:', err);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selected]);

  if (!tags.length) return null;

  return (
    <section className="py-8 max-w-screen-xl mx-auto">
      <h2 className="text-center text-2xl font-semibold text-gray-800 mb-4">
        More groups like this
      </h2>
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {tags.map((t, i) => (
          <button
            key={t.slug}
            onClick={() => setSelected(t.slug)}
            className={`${selected === t.slug ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} px-3 py-1 rounded-full text-sm font-semibold`}
          >
            #{t.name}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-center text-gray-500">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-center text-gray-600">No groups found.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4 px-2">
            {groups.map(g => (
              <Link
                key={g.id}
                to={`/groups/${g.slug}`}
                className="flex-none w-[200px] sm:w-[240px] bg-white border rounded-xl overflow-hidden shadow hover:shadow-lg transition"
              >
                <div className="h-32 bg-gray-100">
                  {g.imag && (
                    <img src={g.imag} alt={g.Name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-3 text-center">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{g.Name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
