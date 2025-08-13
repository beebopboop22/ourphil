import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function CommunityNotices() {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    supabase
      .from('community_bulletin_latest')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setNotices(data || []));
  }, []);

  if (!notices.length) return null;

  return (
    <section className="max-w-3xl mx-auto mt-8 px-4">
      <h2 className="text-2xl font-bold mb-4">Community Notices</h2>
      <div className="space-y-4">
        {notices.map(n => (
          <div key={n.id} className="bg-white rounded-lg shadow p-4">
            <Link to={`/groups/${n.group_slug}`} className="font-semibold text-indigo-600">
              {n.group_name}
            </Link>
            <p className="mt-2">{n.content}</p>
          </div>
        ))}
      </div>
      <div className="text-right mt-4">
        <Link to="/big-board" className="text-indigo-600 underline">
          See more notices →
        </Link>
      </div>
    </section>
  );
}

