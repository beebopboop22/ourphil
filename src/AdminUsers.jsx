// src/AdminUsers.jsx
import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import Footer from './Footer';

export default function AdminUsers() {
  const { user } = useContext(AuthContext);
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Only allow your super-admin email in here
  useEffect(() => {
    if (user?.email === 'bill@solar-states.com') {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) console.error('Error loading users:', error);
    else setUsers(data);

    setLoading(false);
  };

  const updateRole = async (id, newRole) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', id);

    if (error) console.error('Error updating role:', error);
    else fetchUsers();
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Really delete this user?')) return;
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting user:', error);
    else fetchUsers();
  };

  // Not authorized?
  if (!user) {
    return <div className="text-center py-20">Loading auth…</div>;
  }
  if (user.email !== 'bill@solar-states.com') {
    return <div className="text-center py-20 text-red-600">Access denied.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-screen-xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-[Barrio] text-gray-800 mb-8 text-center">
          User Management
        </h1>
        <div className="mb-6 text-center">
          <Link to="/admin" className="text-indigo-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <p className="text-center">Loading users…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Joined</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-2 text-sm">{u.email}</td>
                    <td className="px-4 py-2">
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
