import React, { useState, useRef, useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from './AuthProvider';
import useEventComments from './utils/useEventComments';
import { supabase } from './supabaseClient';

export default function CommentsSection({ source_table, event_id }) {
  const { user } = useContext(AuthContext);
  const {
    comments,
    addComment,
    editComment,
    deleteComment,
  } = useEventComments({ source_table, event_id });
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [profiles, setProfiles] = useState({});

  const handleSubmit = async e => {
    e.preventDefault();
    if (!user) return;
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    await addComment(text);
    setContent('');
    setSubmitting(false);
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const startEdit = comment => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleEditSubmit = async e => {
    e.preventDefault();
    if (!editingId) return;
    const text = editContent.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    const { error } = await editComment(editingId, text);
    if (!error) {
      setEditingId(null);
    }
  };

  const handleDelete = async id => {
    await deleteComment(id);
  };

  const toggle = id => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const ids = Array.from(new Set(comments.map(c => c.user_id)));
    if (ids.length === 0) { setProfiles({}); return; }
    (async () => {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,username,image_url')
        .in('id', ids);
      const map = {};
      profs?.forEach(p => {
        let img = p.image_url || '';
        if (img && !img.startsWith('http')) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-images')
            .getPublicUrl(img);
          img = publicUrl;
        }
        map[p.id] = { username: p.username, image: img, cultures: [] };
      });
      const { data: rows } = await supabase
        .from('profile_tags')
        .select('profile_id, culture_tags(emoji)')
        .in('profile_id', ids)
        .eq('tag_type', 'culture');
      rows?.forEach(r => {
        if (!map[r.profile_id]) map[r.profile_id] = { username: '', image: '', cultures: [] };
        if (r.culture_tags?.emoji) {
          map[r.profile_id].cultures.push(r.culture_tags.emoji);
        }
      });
      setProfiles(map);
    })();
  }, [comments]);

  return (
    <section className="max-w-4xl mx-auto mt-12 px-4" ref={listRef}>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Comments</h2>
      {comments.length === 0 ? (
        <p className="text-gray-500">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map(c => {
            const isLong = c.content.length > 300;
            const isExpanded = expanded[c.id];
            const canModify = user?.id === c.user_id;
            const prof = profiles[c.user_id] || {};
            return (
              <div key={c.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start gap-3">
                  {prof.image ? (
                    <img src={prof.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-semibold text-sm">{prof.username}</span>
                      {prof.cultures?.map(e => (
                        <span key={e}>{e}</span>
                      ))}
                    </div>
                    {editingId === c.id ? (
                      <form onSubmit={handleEditSubmit} className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        className="bg-indigo-600 text-white px-3 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="bg-gray-200 px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className={isExpanded ? 'mb-2' : 'mb-2 line-clamp-3'}>{c.content}</p>
                    {isLong && (
                      <button
                        onClick={() => toggle(c.id)}
                        className="text-xs text-indigo-600 mb-2"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                    <div className="flex justify-between items-center">
                      <time className="text-xs text-gray-500">
                        {new Date(c.created_at).toLocaleString()}
                      </time>
                      {canModify && (
                        <div className="space-x-2 text-xs">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-indigo-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {user ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              disabled={submitting}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Share your thoughts…"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'Post Comment'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-center">
            <Link to="/login" className="text-indigo-600 hover:underline">
              Log in
            </Link>{' '}
            to leave a comment
          </p>
        )}
      </div>
    </section>
  );
}
