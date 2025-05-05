// src/ProfilePage.jsx
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import GroupProgressBar from './GroupProgressBar';
import Footer from './Footer';
import { getMyFavorites } from './utils/favorites';

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [favRows, setFavRows] = useState([]);
  const [favGroups, setFavGroups] = useState([]);
  const [loadingFav, setLoadingFav] = useState(true);

  const [updates, setUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  const [email, setEmail] = useState('');
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState('');

  const [deleting, setDeleting] = useState(false);

  // Load current email
  useEffect(() => {
    if (user) setEmail(user.email);
  }, [user]);

  // Load favorites
  useEffect(() => {
    if (!user) return setLoadingFav(false);
    setLoadingFav(true);
    getMyFavorites()
      .then(async (rows) => {
        setFavRows(rows);
        if (rows.length) {
          const ids = rows.map((r) => r.group_id);
          const { data: groups, error } = await supabase
            .from('groups')
            .select('id, Name, slug, imag')
            .in('id', ids);
          if (!error) setFavGroups(groups);
        } else {
          setFavGroups([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingFav(false));
  }, [user]);

  // Load updates
  useEffect(() => {
    if (favRows.length === 0) return setLoadingUpdates(false);
    setLoadingUpdates(true);
    const ids = favRows.map((r) => r.group_id);
    supabase
      .from('group_updates')
      .select(`
        id,
        content,
        created_at,
        group_id,
        groups (
          Name,
          slug,
          imag
        )
      `)
      .in('group_id', ids)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching updates:', error);
          setUpdates([]);
        } else {
          setUpdates(data);
        }
      })
      .finally(() => setLoadingUpdates(false));
  }, [favRows]);

  const updateEmail = async () => {
    setUpdating(true);
    setStatus('');
    const { error } = await supabase.auth.updateUser({ email });
    if (error) setStatus(`❌ ${error.message}`);
    else setStatus('✅ Email update requested. Check your inbox to confirm.');
    setUpdating(false);
  };

  const sendPasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.ourphilly.org/update-password',
    });
    if (error) alert('Error sending reset link: ' + error.message);
    else alert('Check your email for the password reset link.');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to permanently delete your account?')) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete_user_account');
    if (error) {
      alert('Unable to delete account: ' + error.message);
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="text-center py-20 text-gray-600">
          Please{' '}
          <a href="/login" className="text-indigo-600 hover:underline">
            log in
          </a>{' '}
          to view your profile.
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <GroupProgressBar />

      <div className="max-w-screen-xl mx-auto px-4 py-12 space-y-12">
        {/* Updates from Favorites */}
        <section>
          <h2 className="text-4xl font-[Barrio] text-gray-800 mb-4 text-left">
            Updates from Your Favorites
          </h2>
          {loadingUpdates ? (
            <p className="text-center">Loading updates…</p>
          ) : updates.length === 0 ? (
            <p className="text-center text-gray-600">
              No recent updates from your favorited groups.
            </p>
          ) : (
            <div className="space-y-4">
              {updates.map((u) => (
                <Link
                  key={u.id}
                  to={`/groups/${u.groups.slug}`}
                  className="block bg-white rounded-xl shadow p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <img
                        src={u.groups.imag}
                        alt={u.groups.Name}
                        className="w-12 h-12 object-cover rounded-full"
                      />
                      <span className="font-semibold text-gray-800">
                        {u.groups.Name}
                      </span>
                    </div>
                    <time
                      dateTime={u.created_at}
                      className="text-sm font-medium text-indigo-600"
                    >
                      {new Date(u.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </time>
                  </div>
                  <p className="mt-2 text-gray-700">{u.content}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Your Favorites */}
        <section>
          <h2 className="text-4xl font-[Barrio] text-gray-800 mb-4 text-center">
            Your Favorites
          </h2>
          {loadingFav ? (
            <p className="text-center">Loading favorites…</p>
          ) : favGroups.length === 0 ? (
            <p className="text-center text-gray-600">
              You haven’t favorited any groups yet.
            </p>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="grid grid-flow-col auto-cols-max gap-4">
                {favGroups.map((g) => (
                  <Link
                    key={g.id}
                    to={`/groups/${g.slug}`}
                    className="flex-shrink-0 w-24 flex flex-col items-center"
                  >
                    <img
                      src={g.imag}
                      alt={g.Name}
                      className="w-24 h-24 object-cover rounded-md"
                    />
                    <span className="text-xs text-center mt-1 truncate w-full">
                      {g.Name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* My Account */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-3xl font-[Barrio] text-gray-800 mb-4">My Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={updateEmail}
                disabled={updating}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
              >
                Update Email
              </button>
              <button
                onClick={sendPasswordReset}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition"
              >
                Reset Password
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
              >
                {deleting ? 'Deleting…' : 'Delete My Account'}
              </button>
            </div>
            {status && <p className="text-sm mt-2 text-gray-700">{status}</p>}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
