import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

export default function GroupNoticesSection({ groupId }) {
  const { user } = useContext(AuthContext);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    fetchNotices();
  }, [groupId]);

  async function fetchNotices() {
    setLoading(true);
    const { data } = await supabase
      .from('group_notices')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    const text = content.trim();
    const url = proofUrl.trim();
    if (!text || !url) return;
    setSubmitting(true);
    await supabase.from('group_notices').insert({
      group_id: groupId,
      user_id: user.id,
      content: text,
      proof_url: url,
    });
    setContent('');
    setProofUrl('');
    await fetchNotices();
    setSubmitting(false);
  }

  async function handleDelete(id) {
    await supabase.from('group_notices').delete().eq('id', id);
    setNotices(n => n.filter(x => x.id !== id));
  }

  return (
    <section className="max-w-screen-xl mx-auto mt-12 px-4">
      <h2 className="text-2xl font-bold mb-4">Community Notices</h2>
      {loading ? (
        <p>Loading…</p>
      ) : notices.length === 0 ? (
        <p className="text-gray-500">No notices yet.</p>
      ) : (
        <div className="space-y-4">
          {notices.map(n => (
            <div key={n.id} className="bg-white rounded-lg shadow p-4">
              <p className="text-lg">{n.content}</p>
              <a
                href={n.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 text-sm block mt-2"
              >
                Proof
              </a>
              <div className="text-xs text-gray-500 mt-2 flex justify-between">
                <span>{new Date(n.created_at).toLocaleString()}</span>
                {user?.id === n.user_id && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-red-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="mt-6 space-y-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="Add a notice…"
            className="w-full border rounded-lg p-2"
          />
          <input
            type="url"
            value={proofUrl}
            onChange={e => setProofUrl(e.target.value)}
            placeholder="Link to proof"
            className="w-full border rounded-lg p-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 text-white px-4 py-2 rounded"
          >
            {submitting ? 'Posting…' : 'Post Notice'}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-gray-600">
          <Link to="/login" className="text-indigo-600 underline">
            Log in
          </Link>{' '}
          to post a notice.
        </p>
      )}
    </section>
  );
}

