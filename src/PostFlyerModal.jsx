// src/PostFlyerModal.jsx
import React, { useState, useContext, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

export default function PostFlyerModal({ isOpen, onClose }) {
  const { user } = useContext(AuthContext);

  // ── Local state ─────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Holds the final event URL once created
  const [confirmationUrl, setConfirmationUrl] = useState('');

  // Prevent background from scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // reset all fields when closed
      resetForm();
      setConfirmationUrl('');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ── Helpers ───────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function resetForm() {
    setSelectedFile(null);
    setPreviewUrl('');
    setTitle('');
    setDescription('');
    setLink('');
    setStartDate(null);
    setEndDate(null);
    setUploading(false);
  }

  async function handleSubmit() {
    if (!user) {
      alert('You must be logged in to post an event');
      return;
    }
    if (!selectedFile || !title || !startDate) {
      alert('Please provide at least an image, a title, and a start date.');
      return;
    }

    setUploading(true);
    try {
      // 1) Compress & upload image to Supabase Storage
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressed = await imageCompression(selectedFile, options);
      const cleanName = compressed.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
      const key = `${user.id}-${Date.now()}-${cleanName}`;
      await supabase.storage.from('big-board').upload(key, compressed);

      // 2) Insert into big_board_posts
      const { data: postData, error: postError } = await supabase
        .from('big_board_posts')
        .insert({ user_id: user.id, image_url: key })
        .select('id')
        .single();
      if (postError) throw postError;
      const postId = postData.id;

      // 3) Generate a slug from title + timestamp
      const slug = `${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}-${Date.now()}`;

      // 4) Insert into big_board_events (with description + link)
      const { error: eventError } = await supabase
        .from('big_board_events')
        .insert({
          post_id: postId,
          title,
          description: description || null,
          link: link || null,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate
            ? endDate.toISOString().split('T')[0]
            : startDate.toISOString().split('T')[0],
          slug,
        });
      if (eventError) throw eventError;

      // 5) Build the confirmation URL and show the confirmation view
      const fullUrl = `https://ourphilly.org/big-board/${slug}`;
      setConfirmationUrl(fullUrl);
    } catch (err) {
      console.error(err);
      alert(err.message);
      setUploading(false);
    }
  }

  // Copy the confirmation URL to clipboard
  function copyToClipboard() {
    navigator.clipboard.writeText(confirmationUrl);
  }

  // ── Render ─────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="
              bg-white
              rounded-lg
              mx-4            /* small horizontal padding on mobile */
              max-w-lg
              w-full
              max-h-[90vh]    /* cap height to 90% of viewport */
              overflow-y-auto /* scrollable if content is tall */
              relative
              p-6
            "
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
          >
            {/* Close button (always visible) */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 z-10"
            >
              ✕
            </button>

            {/*** If confirmationUrl exists, show the elegant confirmation card ***/}
            {confirmationUrl ? (
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  Your event is live!
                </h2>
                <p className="text-center mb-4">
                  Here’s the link to your event page:
                </p>
                <div className="flex w-full items-center mb-4">
                  <input
                    type="text"
                    readOnly
                    value={confirmationUrl}
                    className="
                      flex-1
                      border
                      rounded-l-lg
                      px-3 py-2
                      text-sm
                      truncate
                    "
                    onFocus={e => e.target.select()}
                  />
                  <button
                    onClick={copyToClipboard}
                    className="
                      bg-indigo-600
                      text-white
                      px-4 py-2
                      rounded-r-lg
                      hover:bg-indigo-700
                      transition
                    "
                  >
                    Copy
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="
                    mt-2
                    bg-gray-200
                    text-gray-800
                    px-6 py-2
                    rounded-lg
                    hover:bg-gray-300
                    transition
                  "
                >
                  Done
                </button>
              </div>
            ) : (
              /*** Otherwise, render the standard “upload flyer” form ***/
              <div>
                <h2 className="text-xl font-bold mb-4 text-center">
                  Post an Event Flyer
                </h2>

                {/* Image Picker */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Image <span className="font-normal text-xs">(required)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full"
                    disabled={uploading}
                  />
                </div>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="mb-4 w-full h-48 object-cover rounded"
                  />
                )}

                {/* Title, Description, Link */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="font-normal text-xs">(required)</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full border p-2 rounded"
                    disabled={uploading}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="font-normal text-xs">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full border p-2 rounded"
                    disabled={uploading}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link <span className="font-normal text-xs">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={link}
                    onChange={e => setLink(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full border p-2 rounded"
                    disabled={uploading}
                  />
                </div>

                {/* Start/End Dates */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date <span className="font-normal text-xs">(required)</span>
                    </label>
                    <DatePicker
                      selected={startDate}
                      onChange={date => setStartDate(date)}
                      placeholderText="Pick a start date"
                      className="w-full border p-2 rounded"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date <span className="font-normal text-xs">(optional)</span>
                    </label>
                    <DatePicker
                      selected={endDate}
                      onChange={date => setEndDate(date)}
                      placeholderText="Pick an end date"
                      className="w-full border p-2 rounded"
                      disabled={uploading}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={uploading || !selectedFile || !title || !startDate}
                  className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
                >
                  {uploading ? 'Posting…' : 'Post Event'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
