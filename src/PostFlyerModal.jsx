// src/PostFlyerModal.jsx
import React, { useState, useContext, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import imageCompression from 'browser-image-compression';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

export default function PostFlyerModal({ isOpen, onClose }) {
  const { user } = useContext(AuthContext);
  const geocoderToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const sessionToken = useRef(crypto.randomUUID());
  const skipNextFetch = useRef(false);

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // ── Form state ─────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [tagsList, setTagsList] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [confirmationUrl, setConfirmationUrl] = useState('');

  const suggestRef = useRef(null);
  const pillStyles = [
    'bg-red-100 text-red-800',
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
  ];

  // Prevent background scroll & load tags
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      loadTags();
    } else {
      document.body.style.overflow = '';
      resetForm();
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  async function loadTags() {
    const { data, error } = await supabase.from('tags').select('id,name');
    if (!error) setTagsList(data);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function resetForm() {
    setSelectedFile(null);
    setPreviewUrl('');
    setTitle('');
    setDescription('');
    setLink('');
    setStartDate(null);
    setEndDate(null);
    setStartTime('');
    setEndTime('');
    setAddress('');
    setSuggestions([]);
    if (suggestRef.current) suggestRef.current.blur();
    setLat(null);
    setLng(null);
    setSelectedTags([]);
    setUploading(false);
    setConfirmationUrl('');
    setStep(1);
    sessionToken.current = crypto.randomUUID();
    skipNextFetch.current = false;
  }

  // ── Debounced Mapbox “suggest” ───────────────
  useEffect(() => {
    // if we just picked a suggestion, skip this fetch cycle
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    if (!address.trim()) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(() => {
      fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest` +
        `?q=${encodeURIComponent(address)}` +
        `&access_token=${geocoderToken}` +
        `&session_token=${sessionToken.current}` +
        `&limit=5` +
        `&proximity=-75.1652,39.9526` +            // bias to Philly center
        `&bbox=-75.2803,39.8670,-74.9558,40.1379`  // restrict to Philly bbox
      )
        .then(r => r.json())
        .then(json => setSuggestions(json.suggestions || []))
        .catch(console.error);
    }, 300);

    return () => clearTimeout(timeout);
  }, [address, geocoderToken]);

  // ── On select suggestion → retrieve full feature ───
  function pickSuggestion(feat) {
    // prevent the next suggest() call
    skipNextFetch.current = true;

    fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${feat.mapbox_id}` +
      `?access_token=${geocoderToken}` +
      `&session_token=${sessionToken.current}`
    )
      .then(r => r.json())
      .then(json => {
        const feature = json.features?.[0];
        if (feature) {
          const name = feature.properties.name_preferred || feature.properties.name;
          const context = feature.properties.place_formatted;
          setAddress(`${name}, ${context}`);
          const [lng_, lat_] = feature.geometry.coordinates;
          setLat(lat_);
          setLng(lng_);
        }
      })
      .catch(console.error);

    setSuggestions([]);
    if (suggestRef.current) suggestRef.current.blur();
  }

  function canProceed() {
    switch (step) {
      case 1: return Boolean(selectedFile);
      case 2: return Boolean(title.trim());
      case 3: return true;                  // location optional
      case 4: return Boolean(startDate);
      case 5: return true;
      default: return false;
    }
  }

  async function handleSubmit() {
    if (!user) return alert('Please log in first.');
    setUploading(true);
    try {
      // 1) Image upload
      const opts = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      const comp = await imageCompression(selectedFile, opts);
      const clean = comp.name.replace(/[^a-z0-9.\-_]/gi,'_').toLowerCase();
      const key = `${user.id}-${Date.now()}-${clean}`;
      await supabase.storage.from('big-board').upload(key, comp);

      // 2) Post record
      const { data: postData } = await supabase
        .from('big_board_posts')
        .insert({ user_id: user.id, image_url: key })
        .select('id')
        .single();
      const postId = postData.id;

      // 3) Slug
      const base = title.toLowerCase()
        .replace(/[^a-z0-9]+/g,'-')
        .replace(/(^-|-$)/g,'');
      const slug = `${base}-${Date.now()}`;

      // 4) Event insert
      const payload = {
        post_id:    postId,
        title,
        description: description || null,
        link:        link || null,
        start_date:  startDate.toISOString().split('T')[0],
        end_date:    (endDate || startDate).toISOString().split('T')[0],
        start_time:  startTime || null,
        end_time:    endTime   || null,
        address:     address   || null,
        latitude:    lat,
        longitude:   lng,
        slug,
      };
      const { data: ev } = await supabase
        .from('big_board_events')
        .insert(payload)
        .select('id')
        .single();
      const eventId = ev.id;

      // 5) Link post→event
      await supabase
        .from('big_board_posts')
        .update({ event_id: eventId })
        .eq('id', postId);

      // 6) Taggings
      if (selectedTags.length) {
        const taggings = selectedTags.map(tag_id => ({
          tag_id,
          taggable_type: 'big_board_events',
          taggable_id:   eventId,
        }));
        await supabase.from('taggings').insert(taggings);
      }

      // 7) Done
      setConfirmationUrl(`https://ourphilly.org/big-board/${slug}`);
    } catch (err) {
      console.error(err);
      alert(err.message);
      setUploading(false);
    }
  }

  function handleNext() {
    if (step < totalSteps) setStep(step + 1);
    else handleSubmit();
  }
  function handleBack() { if (step > 1) setStep(step - 1); }
  function copyToClipboard() { navigator.clipboard.writeText(confirmationUrl); }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg shadow-lg mx-4 max-w-full md:max-w-2xl w-full max-h-[95vh] overflow-y-auto p-8 relative"
            initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 z-10"
            >✕</button>
            <h2 className="text-xl font-bold mb-4 text-center">Post an Event Flyer</h2>

            {confirmationUrl ? (
              <div className="flex flex-col items-center">
                <h3 className="text-2xl font-bold mb-4">Your event is live!</h3>
                <div className="flex w-full items-center mb-4">
                  <input
                    type="text" readOnly
                    value={confirmationUrl}
                    onFocus={e => e.target.select()}
                    className="flex-1 border rounded-l-lg px-3 py-2 text-sm truncate"
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
              <div>
                {/* Step 1 */}
                {step === 1 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700">
                      Upload Flyer <span className="text-xs font-normal">(required)</span>
                    </label>
                    <input
                      type="file" accept="image/*"
                      onChange={handleFileChange}
                      disabled={uploading}
                      className="mt-1"
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

                {/* Step 2 */}
                {step === 2 && (
                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Title <span className="text-xs font-normal">(required)</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        disabled={uploading}
                        className="w-full border p-2 rounded mt-1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Why should we go? <span className="text-xs font-normal">(optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        disabled={uploading}
                        className="w-full border p-2 rounded mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <div className="mb-6 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location <span className="text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      disabled={uploading}
                      className="w-full border p-2 rounded"
                      placeholder="Search place or address"
                      ref={suggestRef}
                    />
                    {suggestions.length > 0 && (
                      <ul className="absolute z-20 bg-white border w-full mt-1 rounded max-h-48 overflow-auto">
                        {suggestions.map(feat => (
                          <li
                            key={feat.mapbox_id}
                            onClick={() => pickSuggestion(feat)}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            {feat.name} — {feat.full_address || feat.place_formatted}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Step 4 */}
                {step === 4 && (
                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Link <span className="text-xs font-normal">(optional)</span>
                      </label>
                      <input
                        type="url"
                        value={link}
                        onChange={e => setLink(e.target.value)}
                        disabled={uploading}
                        placeholder="https://example.com"
                        className="w-full border p-2 rounded mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Start Date <span className="text-xs font-normal">(required)</span>
                        </label>
                        <DatePicker
                          selected={startDate}
                          onChange={setStartDate}
                          disabled={uploading}
                          className="w-full border p-2 rounded mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          End Date <span className="text-xs font-normal">(optional)</span>
                        </label>
                        <DatePicker
                          selected={endDate}
                          onChange={setEndDate}
                          disabled={uploading}
                          className="w-full border p-2 rounded mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={e => setStartTime(e.target.value)}
                          disabled={uploading}
                          className="w-full border p-2 rounded mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={e => setEndTime(e.target.value)}
                          disabled={uploading}
                          className="w-full border p-2 rounded mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5 */}
                {step === 5 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tag this Event <span className="text-xs font-normal">(optional)</span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {tagsList.map((tagOpt, i) => {
                        const isSel = selectedTags.includes(tagOpt.id);
                        const cls = isSel
                          ? pillStyles[i % pillStyles.length]
                          : 'bg-gray-200 text-gray-700';
                        return (
                          <button
                            key={tagOpt.id}
                            type="button"
                            onClick={() =>
                              setSelectedTags(prev =>
                                isSel
                                  ? prev.filter(x => x !== tagOpt.id)
                                  : [...prev, tagOpt.id]
                              )
                            }
                            disabled={uploading}
                            className={`${cls} px-4 py-2 rounded-full text-sm font-semibold`}
                          >
                            {tagOpt.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Progress bar */}
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

                {/* Navigation */}
                <div className="flex justify-between">
                  <button
                    onClick={handleBack}
                    disabled={step === 1}
                    className={`px-4 py-2 rounded ${
                      step === 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                    }`}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canProceed() || uploading}
                    className={`px-4 py-2 rounded text-white ${
                      canProceed()
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-indigo-300 cursor-not-allowed'
                    }`}
                  >
                    {step < totalSteps
                      ? 'Next'
                      : uploading
                      ? 'Posting…'
                      : 'Post Event'}
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
