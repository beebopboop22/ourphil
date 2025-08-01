// src/AdminActivity.jsx
import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import Footer from './Footer';

export default function AdminActivity() {
  const { user } = useContext(AuthContext);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [feed, setFeed]             = useState([]);

  useEffect(() => {
    if (user?.email === 'bill@solar-states.com') {
      setAuthorized(true);
      loadActivity();
    }
  }, [user]);

  async function loadActivity() {
    setLoading(true);
    // fetch latest 10 from each
    const [u, c, r, g] = await Promise.all([
      // users table (if you have one; else adjust to supabase.auth.admin.listUsers)
      supabase
        .from('users')
        .select('id, email, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('group_claim_requests')
        .select('id, user_email, group_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('reviews')
        .select('id, user_id, event_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('group_updates')
        .select('id, user_id, group_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // tag each record
    const items = [];
    u.data?.forEach(x => items.push({ ...x, kind: 'user' }));
    c.data?.forEach(x => items.push({ ...x, kind: 'claim' }));
    r.data?.forEach(x => items.push({ ...x, kind: 'review' }));
    g.data?.forEach(x => items.push({ ...x, kind: 'update' }));

    // sort by timestamp
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setFeed(items.slice(0, 20));
    setLoading(false);
  }

  if (!authorized) {
    return <div className="text-center py-20 text-gray-500">Access denied.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-screen-xl mx-auto p-6">
        <h1 className="text-4xl font-[Barrio] mb-8 text-center">Activity Feed</h1>
        <div className="mb-6 text-center">
          <Link to="/admin" className="text-indigo-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
        {loading ? (
          <p className="text-center">Loading…</p>
        ) : (
          <ul className="space-y-4">
            {feed.map(item => {
              const t = new Date(item.created_at).toLocaleString();
              switch (item.kind) {
                case 'user':
                  return (
                    <li key={`u-${item.id}`}>
                      <strong>🆕 New User:</strong> {item.email} — {t}
                    </li>
                  );
                case 'claim':
                  return (
                    <li key={`c-${item.id}`}>
                      <strong>📢 Claim Request:</strong> {item.user_email} for group {item.group_id} — {t}
                    </li>
                  );
                case 'review':
                  return (
                    <li key={`r-${item.id}`}>
                      <strong>⭐ Review:</strong> user {item.user_id} on event {item.event_id} — {t}
                    </li>
                  );
                case 'update':
                  return (
                    <li key={`g-${item.id}`}>
                      <strong>✏️ Group Update:</strong> user {item.user_id} on group {item.group_id} — {t}
                    </li>
                  );
                default:
                  return null;
              }
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
