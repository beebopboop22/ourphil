// src/AdminReviews.jsx
import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';

export default function AdminReviews() {
  const { user } = useContext(AuthContext);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // pagination state
  const [page, setPage]             = useState(1);
  const PAGE_SIZE                   = 3;    // you said 3 per page
  const [totalCount, setTotalCount] = useState(0);

  const [reviews, setReviews]       = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [events, setEvents]         = useState({});
  const [users, setUsers]           = useState({});

  // ensure admin
  useEffect(() => {
    if (user !== undefined) setLoadingAuth(false);
  }, [user]);

  // fetch reviews + count
  const fetchReviews = async () => {
    setLoadingData(true);

    const from = (page - 1) * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data: revData, error: revErr, count } = await supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (revErr) {
      console.error('Error loading reviews:', revErr);
      setLoadingData(false);
      return;
    }

    setReviews(revData);
    setTotalCount(count);

    // fetch related event names
    const eventIds = [...new Set(revData.map(r => r.event_id))].filter(Boolean);
    if (eventIds.length) {
      const { data: evData } = await supabase
        .from('events')
        .select('id, "E Name"')
        .in('id', eventIds);
      const evMap = {};
      evData.forEach(e => evMap[e.id] = e['E Name']);
      setEvents(evMap);
    }

    // fetch user emails
    const userIds = [...new Set(revData.map(r => r.user_id))].filter(Boolean);
    if (userIds.length) {
      const { data: uData } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);
      const uMap = {};
      uData.forEach(u => uMap[u.id] = u.email);
      setUsers(uMap);
    }

    setLoadingData(false);
  };

  // reload on page or auth change
  useEffect(() => {
    if (!loadingAuth) fetchReviews();
  }, [loadingAuth, page]);

  const deleteReview = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    await supabase.from('reviews').delete().eq('id', id);
    // if we emptied the last item on this page, go back one
    if (reviews.length === 1 && page > 1) setPage(page - 1);
    else fetchReviews();
  };

  if (loadingAuth) {
    return <div className="text-center py-20">Checking auth…</div>;
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-screen-xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-[Barrio] text-center mb-8">User Reviews</h1>
        <div className="mb-6 text-center">
          <Link to="/admin" className="text-indigo-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        {loadingData ? (
          <p className="text-center">Loading reviews…</p>
        ) : (
          <>
            <div className="space-y-6">
              {reviews.map(r => {
                // normalize photo_urls
                let urls = [];
                if (Array.isArray(r.photo_urls)) {
                  urls = r.photo_urls;
                } else if (r.photo_urls) {
                  try { urls = JSON.parse(r.photo_urls); } catch {}
                } else if (r.photo_url) {
                  urls = [r.photo_url];
                }

                return (
                  <div key={r.id} className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm text-gray-500">
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                        <p className="font-semibold">Event: {events[r.event_id]}</p>
                        <p className="text-sm">User: {users[r.user_id]}</p>
                        <p className="mt-2">{r.comment}</p>
                      </div>
                      <button
                        onClick={() => deleteReview(r.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded self-start"
                      >
                        Delete
                      </button>
                    </div>

                    {urls.length > 0 && (
                      <div className="mt-4 flex space-x-2 overflow-x-auto">
                        {urls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Review ${r.id} photo ${i}`}
                            className="w-24 h-24 object-cover rounded"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* pagination */}
            <div className="flex justify-center items-center mt-8 space-x-4">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >Next</button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
