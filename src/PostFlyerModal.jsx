// src/PostFlyerModal.jsx
import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import imageCompression from 'browser-image-compression';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

export default function PostFlyerModal({ isOpen, onClose }) {
  const { user } = useContext(AuthContext);

  // ── Step state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [tagsList, setTagsList] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Holds the final event URL once created
  const [confirmationUrl, setConfirmationUrl] = useState('');

  // inside PostFlyerModal.jsx, near the top of the component:
const pillStyles = [
    'bg-red-100 text-red-800',
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',    
  ];

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // load tags once
      loadTags();
    } else {
      document.body.style.overflow = '';
      resetForm();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  async function loadTags() {
    const { data, error } = await supabase.from('tags').select('id,name');
    if (!error) setTagsList(data);
  }

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
    setSelectedTags([]);
    setUploading(false);
    setConfirmationUrl('');
    setStep(1);
  }

  async function handleSubmit() {
    if (!user) {
      alert('You must be logged in to post an event');
      return;
    }
    if (!selectedFile || !title || !startDate) {
      alert('Please provide an image, title, and start date.');
      return;
    }

    setUploading(true);

    try {
      // 1) Compress & upload image
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressed = await imageCompression(selectedFile, options);
      const cleanName = compressed.name.replace(/[^a-z0-9.\-_]/gi,'_').toLowerCase();
      const key = `${user.id}-${Date.now()}-${cleanName}`;
      await supabase.storage.from('big-board').upload(key, compressed);

      // 2) Insert post
      const { data: postData } = await supabase
        .from('big_board_posts')
        .insert({ user_id: user.id, image_url: key })
        .select('id')
        .single();
      const postId = postData.id;

      // 3) Make slug
      const slugBase = title
        .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
      const slug = `${slugBase}-${Date.now()}`;

      // 4) Insert event
      const { data: eventData } = await supabase
        .from('big_board_events')
        .insert({
          post_id: postId,
          title,
          description: description || null,
          link: link || null,
          start_date: startDate.toISOString().split('T')[0],
          end_date: (endDate||startDate).toISOString().split('T')[0],
          slug,
        })
        .select('id')
        .single();
      const eventId = eventData.id;

      // 5) Link post→event
      await supabase
        .from('big_board_posts')
        .update({ event_id: eventId })
        .eq('id', postId);

      // 6) Taggings: attach selected tags
      if (selectedTags.length) {
        const taggings = selectedTags.map(tag_id => ({
          tag_id,
          taggable_type: 'big_board_events',
          taggable_id: eventId
        }));
        await supabase.from('taggings').insert(taggings);
      }

      // 7) Show confirmation
      const fullUrl = `https://ourphilly.org/big-board/${slug}`;
      setConfirmationUrl(fullUrl);
    } catch (err) {
      console.error(err);
      alert(err.message);
      setUploading(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(confirmationUrl);
  }

  function canProceed() {
    if (step === 1) return Boolean(selectedFile);
    if (step === 2) return Boolean(title.trim());
    if (step === 3) return Boolean(startDate);
    if (step === 4) return true;
    return false;
  }

  function handleNext() {
    if (step < totalSteps) setStep(step + 1);
    else handleSubmit();
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg border border-gray-200 shadow-lg mx-4 max-w-full md:max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
            initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 z-10"
            >✕</button>
            <h2 className="text-xl font-bold mb-2 text-center">Post an Event Flyer</h2>

            {confirmationUrl ? (
              // Confirmation view
              <div className="flex flex-col items-center">
                <h3 className="text-2xl font-bold mb-4 text-center">Your event is live!</h3>
                <p className="text-center mb-4">Here’s your link:</p>
                <div className="flex w-full items-center mb-4">
                  <input
                    type="text" readOnly value={confirmationUrl}
                    className="flex-1 border rounded-l-lg px-3 py-2 text-sm truncate"
                    onFocus={e => e.target.select()}
                  />
                  <button
                    onClick={copyToClipboard}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-r-lg hover:bg-indigo-700"
                  >Copy</button>
                </div>
                <button
                  onClick={onClose}
                  className="mt-2 bg-gray-200 text-gray-800 px-6 py-2 rounded-lg"
                >Done</button>
              </div>
            ) : (
              // Multi-step form
              <div>
                {/* Step 1: Upload */}
                {step === 1 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Flyer <span className="text-xs font-normal">(required)</span>
                    </label>
                    <input
                      type="file" accept="image/*"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="mt-4 w-full h-48 object-cover rounded"
                      />
                    )}
                  </div>
                )}

                {/* Step 2: Title & Description */}
                {step === 2 && (
                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title <span className="text-xs font-normal">(required)</span>
                      </label>
                      <input
                        type="text" value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full border p-2 rounded"
                        disabled={uploading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Why should we go? <span className="text-xs font-normal">(optional)</span>
                      </label>
                      <textarea
                        rows={3} value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full border p-2 rounded"
                        disabled={uploading}
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Link & Dates */}
                {step === 3 && (
                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link <span className="text-xs font-normal">(optional)</span>
                      </label>
                      <input
                        type="url" value={link}
                        onChange={e => setLink(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full border p-2 rounded"
                        disabled={uploading}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date <span className="text-xs font-normal">(required)</span>
                        </label>
                        <DatePicker
                          selected={startDate}
                          onChange={setStartDate}
                          className="w-full border p-2 rounded"
                          disabled={uploading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date <span className="text-xs font-normal">(optional)</span>
                        </label>
                        <DatePicker
                          selected={endDate}
                          onChange={setEndDate}
                          className="w-full border p-2 rounded"
                          disabled={uploading}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Tags */}
{step === 4 && (
  <div className="mb-6">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Tag this Event <span className="text-xs font-normal">(optional)</span>
    </label>
    <div className="flex flex-wrap gap-3">
      {tagsList.map((tagOpt, i) => {
        const isSelected = selectedTags.includes(tagOpt.id)
        const styleClass = isSelected
          ? pillStyles[i % pillStyles.length]
          : 'bg-gray-200 text-gray-700'
        return (
          <button
            key={tagOpt.id}
            type="button"
            onClick={() => {
              setSelectedTags(prev =>
                isSelected
                  ? prev.filter(x => x !== tagOpt.id)
                  : [...prev, tagOpt.id]
              )
            }}
            className={`
              ${styleClass}
              px-4 py-2 rounded-full
              text-sm font-semibold
              focus:outline-none focus:ring-2 focus:ring-indigo-400
              transition
            `}
          >
            {tagOpt.name}
          </button>
        )
      })}
    </div>
  </div>
)}

                {/* Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Step {step} of {totalSteps}</span>
                    <span>{Math.round((step/totalSteps)*100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded">
                    <div
                      className="h-2 bg-indigo-600 rounded"
                      style={{ width: `${(step/totalSteps)*100}%` }}
                    />
                  </div>
                </div>

                {/* Nav buttons */}
                <div className="flex justify-between">
                  <button
                    onClick={handleBack}
                    disabled={step===1}
                    className={`px-4 py-2 rounded ${
                      step===1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                    }`}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()||uploading}
                    className={`px-4 py-2 rounded text-white ${
                      canProceed()
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-indigo-300 cursor-not-allowed'
                    }`}
                  >
                    {step<totalSteps ? 'Next' : uploading ? 'Posting…' : 'Post Event'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
