// src/FilteredGroupSection.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import GroupCard from './GroupCard';
import SubmitGroupModal from './SubmitGroupModal';

export default function FilteredGroupSection({ tag = '', title }) {
  const [groups, setGroups] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    async function fetchGroups() {
      const { data } = await supabase.from('groups').select('*');
      const normalized = tag.toLowerCase();
      setGroups(
        data.filter(g => (g.Type || '').toLowerCase().includes(normalized))
      );
    }
    fetchGroups();
  }, [tag]);

  const visibleGroups = useMemo(
    () => groups.slice(0, visibleCount),
    [groups, visibleCount]
  );

  const getSubtitle = (t = '') => {
    switch (t.toLowerCase()) {
      /* your cases… */
      default: return 'Explore active groups in Philly';
    }
  };

  const slugify = text => text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return (
    <section className="…">
      <header>…</header>
      <div className="overflow-x-auto">
        <div className="flex space-x-4 pb-4">
          {/* Add-group card */}
          <div onClick={() => setShowSubmitModal(true)} className="…">…</div>
          {visibleGroups.map(g => (
            <div key={g.id} className="flex-none w-56 h-96">
              <GroupCard group={g} isAdmin={false} />
            </div>
          ))}
        </div>
      </div>
      {visibleCount < groups.length && (
        <div className="text-right mt-4">
          <Link to={`/groups/type/${slugify(tag)}`}>See More</Link>
        </div>
      )}
      {showSubmitModal && <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />}
    </section>
  );
}
