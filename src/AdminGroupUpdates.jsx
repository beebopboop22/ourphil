// src/AdminGroupUpdates.jsx
import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';

export default function AdminGroupUpdates() {
  const { user } = useContext(AuthContext);
  const [loadingAuth, setLoadingAuth]   = useState(true);
  const [loadingData, setLoadingData]   = useState(true);
  const [updates, setUpdates]           = useState([]);
  const [groupsMap, setGroupsMap]       = useState({});
  const [usersMap, setUsersMap]         = useState({});

  // 1️⃣ Check admin
  useEffect(() => {
    if (user !== undefined) {
      setLoadingAuth(false);
    }
  }, [user]);

  // 2️⃣ Fetch updates + related group & user info
  const fetchUpdates = async () => {
    setLoadingData(true);

    // fetch all updates, newest first
    const { data: upd, error } = await supabase
      .from('group_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading updates:', error);
      setLoadingData(false);
      return;
    }
    setUpdates(upd);

    // build a unique list of group_ids & user_ids
    const groupIds = [...new Set(upd.map(u => u.group_id))].filter(Boolean);
    const userIds  = [...new Set(upd.map(u => u.user_id))].filter(Boolean);

    // fetch group names
    if (groupIds.length) {
      const { data: groups } = await supabase
        .from('groups')
        .select('id, Name')
        .in('id', groupIds);
      const gm = {};
      groups.forEach(g => { gm[g.id] = g.Name; });
      setGroupsMap(gm);
    }

    // fetch user emails
    if (userIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);
      const um = {};
      users.forEach(u => { um[u.id] = u.email; });
      setUsersMap(um);
    }

    setLoadingData(false);
  };

  useEffect(() => {
    if (!loadingAuth) fetchUpdates();
  }, [loadingAuth]);

  // 3️⃣ Edit & Delete handlers
  const handleEdit = async (id, oldContent) => {
    const content = prompt('Edit this update:', oldContent);
    if (!content) return;
    const { error } = await supabase
      .from('group_updates')
      .update({ content })
      .eq('id', id);
    if (error) {
      console.error('Update failed', error);
      alert('Failed to update.');
    } else {
      fetchUpdates();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this update?')) return;
    const { error } = await supabase
      .from('group_updates')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Delete failed', error);
      alert('Failed to delete.');
    } else {
      fetchUpdates();
    }
  };

  if (loadingAuth) {
    return <div className="text-center py-20">Checking admin…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-screen-xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-[Barrio] text-center mb-8">Admin: Group Updates</h1>

        {loadingData ? (
          <p className="text-center">Loading updates…</p>
        ) : (
          <div className="space-y-6">
            {updates.length === 0 ? (
              <p className="text-center text-gray-500">No group updates yet.</p>
            ) : updates.map(u => (
              <div key={u.id} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleString()}
                    </p>
                    <p className="font-semibold">
                      Group: {groupsMap[u.group_id] || u.group_id}
                    </p>
                    <p className="text-sm">User: {usersMap[u.user_id] || u.user_id}</p>
                    <p className="mt-2">{u.content}</p>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleEdit(u.id, u.content)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                    >
                      Delete
                    </button>
                  </div>
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
