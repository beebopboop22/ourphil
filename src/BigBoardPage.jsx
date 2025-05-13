// src/BigBoardPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import Footer from './Footer';

export default function BigBoardPage() {
  const { user } = useContext(AuthContext);

  // ─── State ────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lightboxPost, setLightboxPost] = useState(null);

  // ─── Fetch posts on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from('big_board_posts')
      .select('id, image_url, user_id, created_at')
      .order('created_at', { ascending: false });
    if (error) console.error('fetchPosts error:', error);
    else setPosts(data);
    setLoadingPosts(false);
  }

  // ─── Permission: any logged-in user can post (no limit) ─────────────────────
  const canPost = !!user;

  // ─── Resolve storage key or full URL ──────────────────────────────────────
  function resolveImageUrl(val) {
    let key = val;
    if (val.startsWith('http')) {
      const m = val.match(/\/public\/big-board\/(.+)$/);
      if (m) key = m[1];
      else return val.replace(/([^:]\/)\/+/g, '$1');
    }
    const { data } = supabase
      .storage
      .from('big-board')
      .getPublicUrl(key);
    return data.publicUrl;
  }

  // ─── File upload handlers ─────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUpload() {
    if (!selectedFile || !user) return;
    setUploading(true);

    try {
      // compress
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressed = await imageCompression(selectedFile, options);

      // sanitize filename
      const cleanName = compressed.name
        .replace(/[^a-z0-9.\-_]/gi, '_')
        .toLowerCase();
      const key = `${user.id}-${Date.now()}-${cleanName}`;

      // upload to bucket
      const { error: upErr } = await supabase
        .storage
        .from('big-board')
        .upload(key, compressed);
      if (upErr) throw upErr;

      // insert row
      const { error: insErr } = await supabase
        .from('big_board_posts')
        .insert({ user_id: user.id, image_url: key });
      if (insErr) throw insErr;

      // refresh
      await fetchPosts();
      setShowUploadModal(false);
      setSelectedFile(null);
      setPreviewUrl('');
    } catch (err) {
      console.error('Upload error:', err);
      alert(err.message);
    }

    setUploading(false);
  }

  // ─── Delete handler ───────────────────────────────────────────────────────
  async function handleDelete(post) {
    if (!user || post.user_id !== user.id) return;
    if (!window.confirm('Delete this post?')) return;
    await supabase.from('big_board_posts').delete().eq('id', post.id);
    await supabase.storage.from('big-board').remove([post.image_url]);
    setPosts(ps => ps.filter(p => p.id !== post.id));
    if (lightboxPost?.id === post.id) setLightboxPost(null);
  }

  // ─── Predefined size classes for variety ─────────────────────────────────
  const sizeClasses = [
    'w-32 h-32',
    'w-40 h-48',
    'w-48 h-40',
    'w-56 h-56',
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow bg-gray-50 pt-20">
        <div className="max-w-6xl mx-auto p-6">
          {/* centered, huge Barrio title */}
          <h1 className="font-[Barrio] text-6xl text-center mb-8">
            THE BIG BOARD
          </h1>

          {/* upload control */}
          <div className="flex justify-center mb-6">
            {canPost ? (
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-indigo-600 text-white px-6 py-3 rounded shadow hover:bg-indigo-700"
              >
                New Post
              </button>
            ) : (
              <p className="text-gray-600">Log in to post</p>
            )}
          </div>

          {/* grid with varied sizes and padding */}
          {loadingPosts ? (
            <p className="text-center">Loading…</p>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center">
              {posts.map((post, i) => {
                const url = resolveImageUrl(post.image_url);
                const sizeCls = sizeClasses[i % sizeClasses.length];
                return (
                  <motion.div
                    key={post.id}
                    className={`${sizeCls} relative overflow-hidden shadow-lg rounded-lg`}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setLightboxPost({ ...post, url })}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {post.user_id === user?.id && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(post); }}
                        className="absolute top-1 right-1 bg-white/80 p-1 rounded-full hover:bg-red-100"
                      >
                        🗑️
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* upload modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg p-8 w-full max-w-sm"
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
            >
              <h2 className="text-2xl font-semibold mb-4">New Board Post</h2>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mb-4"
              />
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="preview"
                  className="mb-4 w-full h-48 object-cover rounded"
                />
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="px-4 py-2 rounded border"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* lightbox */}
      <AnimatePresence>
        {lightboxPost && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxPost(null)}
          >
            <motion.img
              src={lightboxPost.url}
              alt=""
              className="max-w-full max-h-full rounded-lg"
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer flush */}
      <Footer />
    </div>
  );
}
