import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';

export default function AdminComments() {
  const { user } = useContext(AuthContext);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [comments, setComments] = useState([]);
  const [users, setUsers] = useState({});
  const [events, setEvents] = useState({});

  useEffect(() => {
    if (user !== undefined) setLoadingAuth(false);
  }, [user]);

  const fetchComments = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from('event_comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Error loading comments:', error);
      setLoadingData(false);
      return;
    }
    setComments(data);

    const evIds = [
      ...new Set(data.map(c => c.event_id || c.event_int_id).filter(Boolean)),
    ];
    if (evIds.length) {
      const { data: evRows } = await supabase
        .from('events')
        .select('id, "E Name"')
        .in('id', evIds);
      const map = {};
      evRows?.forEach(e => { map[e.id] = e['E Name']; });
      setEvents(map);
    }

    const userIds = [...new Set(data.map(c => c.user_id))];
    if (userIds.length) {
      const { data: uRows } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);
      const map = {};
      uRows?.forEach(u => { map[u.id] = u.email; });
      setUsers(map);
    }
    setLoadingData(false);
  };

  useEffect(() => { if (!loadingAuth) fetchComments(); }, [loadingAuth]);

  const deleteComment = async id => {
    if (!window.confirm('Delete this comment?')) return;
    await supabase.from('event_comments').delete().eq('id', id);
    setComments(c => c.filter(cm => cm.id !== id));
  };

  if (loadingAuth) {
    return <div className="text-center py-20">Checking auth…</div>;
  }
  if (user.email !== 'bill@solar-states.com') {
    return <div className="text-center py-20 text-red-600">Access denied.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-screen-xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-[Barrio] text-center mb-8">Comments</h1>
        <div className="mb-6 text-center">
          <Link to="/admin" className="text-indigo-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
        {loadingData ? (
          <p className="text-center">Loading…</p>
        ) : (
          <div className="space-y-6">
            {comments.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm">User: {users[c.user_id] || c.user_id}</p>
                    {(c.event_id || c.event_int_id) && (
                      <p className="text-sm">
                        Event: {events[c.event_id || c.event_int_id] || (c.event_id || c.event_int_id)}
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap">{c.content}</p>
                  </div>
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded self-start"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
