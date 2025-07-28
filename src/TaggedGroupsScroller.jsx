import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function TaggedGroupsScroller({ tags = [] }) {
  const [selected, setSelected] = useState(tags[0]?.slug || '');
  const [groups, setGroups] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    supabase
      .from('tags')
      .select('name,slug')
      .then(({ data, error }) => {
        if (!error) setAllTags(data || []);
      });
  }, []);

  useEffect(() => {
    if (!tags.length) return;
    if (!selected || !tags.some(t => t.slug === selected)) {
      setSelected(tags[0].slug);
    }
  }, [tags.map(t => t.slug).join(',')]);

  useEffect(() => {
    if (!selected) { setGroups([]); setTagMap({}); setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const { data: tagRow } = await supabase
          .from('tags')
          .select('id')
          .eq('slug', selected)
          .single();
        const tagId = tagRow?.id;
        if (!tagId) { setGroups([]); setTagMap({}); setLoading(false); return; }
        const { data: taggings } = await supabase
          .from('taggings')
          .select('taggable_id')
          .eq('taggable_type', 'groups')
          .eq('tag_id', tagId);
        const ids = (taggings || []).map(t => t.taggable_id);
        if (!ids.length) { setGroups([]); setTagMap({}); setLoading(false); return; }
        const { data: groupRows } = await supabase
          .from('groups')
          .select('id, Name, slug, imag, Type')
          .in('id', ids)
          .limit(12);
        setGroups(groupRows || []);

        const { data: tagRows } = await supabase
          .from('taggings')
          .select('taggable_id, tags(name,slug)')
          .eq('taggable_type','groups')
          .in('taggable_id', ids);
        const map = {};
        (tagRows || []).forEach(({ taggable_id, tags }) => {
          if (!tags) return;
          map[taggable_id] = map[taggable_id] || [];
          map[taggable_id].push(tags);
        });
        setTagMap(map);
      } catch (err) {
        console.error('Error loading tagged groups:', err);
        setGroups([]); setTagMap({});
      } finally {
        setLoading(false);
      }
    })();
  }, [selected]);

  if (!tags.length) return null;

  return (
    <section className="py-8 max-w-screen-xl mx-auto">
      <h2 className="text-center text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-6">
        Groups you might like
      </h2>
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {(tags.length >= 5 ? tags : [...tags, ...allTags.filter(t => !tags.some(tt => tt.slug === t.slug)).slice(0, 5 - tags.length)]).map((t, i) => (
          <button
            key={t.slug}
            onClick={() => setSelected(t.slug)}
            className={`${selected === t.slug ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} px-4 py-2 rounded-full text-base font-semibold`}
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
            {groups.map(g => {
              const gTags = tagMap[g.id] || [];
              const extras = allTags
                .filter(t => !gTags.some(gt => gt.slug === t.slug))
                .slice(0, Math.max(0, 5 - gTags.length));
              const pills = [...gTags, ...extras];
              return (
                <Link
                  key={g.id}
                  to={`/groups/${g.slug}`}
                  className="relative w-[260px] h-[420px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-transform hover:scale-105 bg-white"
                >
                  {g.imag && (
                    <img src={g.imag} alt={g.Name} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <h3 className="absolute bottom-20 left-3 right-3 text-center text-white text-2xl font-bold z-20 leading-tight">
                    {g.Name}
                  </h3>
                  <div className="absolute bottom-4 left-3 right-3 flex flex-wrap justify-center gap-1 z-20">
                    {pills.map((t,i) => (
                      <span key={t.slug} className={`${selected === t.slug ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'} px-2 py-1 rounded-full text-xs font-semibold`}>#{t.name}</span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
