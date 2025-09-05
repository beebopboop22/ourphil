// src/PostFlyerModal.jsx
import React, { useState, useContext, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import imageCompression from 'browser-image-compression';
import { useForm, Controller } from 'react-hook-form';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { isTagActive } from './utils/tagUtils';

export default function PostFlyerModal({ isOpen, onClose, initialFile = null }) {
  const { user } = useContext(AuthContext);
  const geocoderToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const skipNextFetch = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
      link: '',
      startDate: null,
      endDate: null,
      startTime: '',
      endTime: '',
    },
  });

  // ── Form state ─────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
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
      if (initialFile) {
        processFile(initialFile);
      }
    } else {
      document.body.style.overflow = '';
      resetForm();
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  async function loadTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('id,name,rrule,season_start,season_end');
    if (!error && data) setTagsList(data.filter(isTagActive));
  }

  function processFile(file) {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setValue('selectedFile', file, { shouldValidate: true });
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handlePaste(e) {
    const file = e.clipboardData.files?.[0];
    if (file) processFile(file);
  }

  async function handleCapturePhoto() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      canvas.toBlob(blob => {
        if (blob) processFile(new File([blob], 'capture.jpg', { type: blob.type }));
      }, 'image/jpeg');
    } catch (err) {
      console.error('Camera capture failed', err);
    }
  }

  function resetForm() {
    reset();
    setSelectedFile(null);
    setPreviewUrl('');
    setAddress('');
    setSuggestions([]);
    if (suggestRef.current) suggestRef.current.blur();
    setLat(null);
    setLng(null);
    setSelectedTags([]);
    setUploading(false);
    setConfirmationUrl('');
    skipNextFetch.current = false;
  }

  // ── Debounced Mapbox “suggest” ───────────────
  useEffect(() => {
    // if we just picked a suggestion, skip this fetch cycle
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    if (!address.trim() || !geocoderToken) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
      );
      url.search = new URLSearchParams({
        access_token: geocoderToken,
        autocomplete: 'true',
        limit: '5',
        proximity: '-75.1652,39.9526',
        bbox: '-75.2803,39.8670,-74.9558,40.1379',
      }).toString();

      fetch(url, { signal: controller.signal })
        .then(r => (r.ok ? r.json() : Promise.reject(r)))
        .then(json => setSuggestions(json.features || []))
        .catch(err => {
          if (err.name !== 'AbortError') console.error(err);
        });
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [address, geocoderToken]);

  // ── On select suggestion → retrieve full feature ───
  function pickSuggestion(feat) {
    // prevent the next suggest() call
    skipNextFetch.current = true;

    setAddress(feat.place_name);
    const [lng_, lat_] = feat.geometry.coordinates;
    setLat(lat_);
    setLng(lng_);

    setSuggestions([]);
    if (suggestRef.current) suggestRef.current.blur();
  }

  async function onSubmit(data) {
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
      const base = data.title.toLowerCase()
        .replace(/[^a-z0-9]+/g,'-')
        .replace(/(^-|-$)/g,'');
      const slug = `${base}-${Date.now()}`;

      // 4) Event insert
      const payload = {
        post_id:    postId,
        title:      data.title,
        description: data.description || null,
        link:        data.link || null,
        start_date:  data.startDate.toISOString().split('T')[0],
        end_date:    (data.endDate || data.startDate).toISOString().split('T')[0],
        start_time:  data.startTime || null,
        end_time:    data.endTime   || null,
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
              <form
                onSubmit={handleSubmit(onSubmit)}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onPaste={handlePaste}
              >
                <input type="hidden" {...register('selectedFile', { required: true })} />

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
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="mt-2 text-sm text-indigo-600"
                  >Capture Photo</button>
                  {errors.selectedFile && (
                    <p className="text-red-500 text-xs mt-1">Flyer is required</p>
                  )}
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="mt-4 w-full h-48 object-cover rounded"
                    />
                  )}
                </div>

                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Title <span className="text-xs font-normal">(required)</span>
                    </label>
                    <input
                      type="text"
                      {...register('title', { required: true })}
                      disabled={uploading}
                      className="w-full border p-2 rounded mt-1"
                    />
                    {errors.title && (
                      <p className="text-red-500 text-xs mt-1">Title is required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Why should we go? <span className="text-xs font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      {...register('description')}
                      disabled={uploading}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>
                </div>

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
                          key={feat.id}
                          onClick={() => pickSuggestion(feat)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        >
                          {feat.place_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Link <span className="text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      {...register('link')}
                      disabled={uploading}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Start Date <span className="text-xs font-normal">(required)</span>
                      </label>
                      <Controller
                        name="startDate"
                        control={control}
                        rules={{ required: true }}
                        render={({ field }) => (
                          <DatePicker
                            selected={field.value}
                            onChange={field.onChange}
                            disabled={uploading}
                            className="w-full border p-2 rounded mt-1"
                          />
                        )}
                      />
                      {errors.startDate && (
                        <p className="text-red-500 text-xs mt-1">Start date is required</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        End Date <span className="text-xs font-normal">(optional)</span>
                      </label>
                      <Controller
                        name="endDate"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            selected={field.value}
                            onChange={field.onChange}
                            disabled={uploading}
                            className="w-full border p-2 rounded mt-1"
                          />
                        )}
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
                        {...register('startTime')}
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
                        {...register('endTime')}
                        disabled={uploading}
                        className="w-full border p-2 rounded mt-1"
                      />
                    </div>
                  </div>
                </div>

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

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={uploading}
                    className={`px-4 py-2 rounded text-white ${
                      uploading
                        ? 'bg-indigo-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {uploading ? 'Posting…' : 'Post Event'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
