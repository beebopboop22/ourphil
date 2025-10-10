// src/GroupEventModal.jsx
import React, { useState, useEffect, useRef, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import imageCompression from 'browser-image-compression'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'
import { isTagActive } from './utils/tagUtils'
import { getMapboxToken } from './config/mapboxToken.js'

const pillStyles = [
  'bg-red-100 text-red-800',
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
]

export default function GroupEventModal({
  isOpen,
  onClose,
  groupId,
  userId,
  onSuccess
}) {
  const { user } = useContext(AuthContext)
  const geocoderToken = getMapboxToken()
  const sessionToken = useRef(crypto.randomUUID())
  const skipNextFetch = useRef(false)

  const totalSteps = 6
  const [step, setStep] = useState(1)

  // form state
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [tagsList, setTagsList] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // load tags on open
  useEffect(() => {
    if (!isOpen) return
    supabase
      .from('tags')
      .select('id,name,rrule,season_start,season_end')
      .then(({ data }) => {
        if (data) setTagsList(data.filter(isTagActive))
      })
  }, [isOpen])

  // prevent background scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }, [isOpen])

  // mapbox suggestions
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
    if (!address.trim()) {
      setSuggestions([])
      return
    }
    const tid = setTimeout(() => {
      fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest` +
          `?q=${encodeURIComponent(address)}` +
          `&access_token=${geocoderToken}` +
          `&session_token=${sessionToken.current}` +
          `&limit=5` +
          `&proximity=-75.1652,39.9526` +
          `&bbox=-75.2803,39.8670,-74.9558,40.1379`
      )
        .then(r => r.json())
        .then(j => setSuggestions(j.suggestions || []))
        .catch(console.error)
    }, 300)
    return () => clearTimeout(tid)
  }, [address])

  function pickSuggestion(feat) {
    skipNextFetch.current = true
    fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${feat.mapbox_id}` +
        `?access_token=${geocoderToken}` +
        `&session_token=${sessionToken.current}`
    )
      .then(r => r.json())
      .then(j => {
        const f = j.features?.[0]
        if (!f) return
        const name = f.properties.name_preferred || f.properties.name
        const context = f.properties.place_formatted
        setAddress(`${name}, ${context}`)
        const [lng_, lat_] = f.geometry.coordinates
        setLat(lat_)
        setLng(lng_)
      })
      .catch(console.error)
    setSuggestions([])
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function canProceed() {
    switch (step) {
      case 1:
        return !!selectedFile
      case 2:
        return !!title.trim()
      case 3:
        return true // description optional
      case 4:
        return true // location optional
      case 5:
        return !!startDate
      case 6:
        return true // tags optional
      default:
        return false
    }
  }

  async function handleSubmit() {
    if (!user) {
      alert('Please log in first')
      return
    }
    setSubmitting(true)
    try {
      // compress image
      const opts = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true }
      const comp = await imageCompression(selectedFile, opts)
      const clean = comp.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()
      const key = `${user.id}-${Date.now()}-${clean}`

      // upload to big-board bucket
      await supabase.storage.from('big-board').upload(key, comp)

      // get public URL
      const { data: { publicUrl } } = supabase
        .storage.from('big-board')
        .getPublicUrl(key)

      // insert event
      const payload = {
        group_id:   groupId,
        user_id:    userId,
        title,
        description: description || null,
        address:     address || null,
        latitude:    lat,
        longitude:   lng,
        start_date:  startDate.toISOString().slice(0,10),
        end_date:    (endDate||startDate).toISOString().slice(0,10),
        start_time:  startTime||null,
        end_time:    endTime||null,
        image_url:   publicUrl
      }

      const { data: ev, error } = await supabase
        .from('group_events')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error

      // taggings
      if (selectedTags.length) {
        const tgs = selectedTags.map(id => ({
          tag_id:        id,
          taggable_type: 'group_events',
          taggable_id:   ev.id,
        }))
        await supabase.from('taggings').insert(tgs)
      }

      onSuccess()
      onClose()
    } catch (e) {
      console.error(e)
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (step < totalSteps) setStep(step + 1)
    else handleSubmit()
  }
  function back() {
    if (step > 1) setStep(step - 1)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
          >
            <button
              onClick={() => { onClose(); setStep(1) }}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-center mb-4">Add Group Event</h2>

            {/* Step 1: Image */}
            {step === 1 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium">
                  Upload Image <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full"
                  disabled={submitting}
                />
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="mt-2 w-full h-48 object-cover rounded-md"
                  />
                )}
              </div>
            )}

            {/* Step 2: Title */}
            {step === 2 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border p-2 rounded"
                  disabled={submitting}
                />
              </div>
            )}

            {/* Step 3: Description */}
            {step === 3 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border p-2 rounded"
                  disabled={submitting}
                />
              </div>
            )}

            {/* Step 4: Location */}
            {step === 4 && (
              <div className="space-y-4 relative">
                <label className="block text-sm font-medium">Location</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full border p-2 rounded"
                  placeholder="Search address"
                  disabled={submitting}
                />
                {suggestions.length > 0 && (
                  <ul className="absolute z-20 bg-white border w-full mt-1 rounded max-h-40 overflow-auto">
                    {suggestions.map(f => (
                      <li
                        key={f.mapbox_id}
                        onClick={() => pickSuggestion(f)}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        {f.name} — {f.full_address || f.place_formatted}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Step 5: Date & Time */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={startDate}
                    onChange={setStartDate}
                    className="w-full border p-2 rounded"
                    disabled={submitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Start Time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full border p-2 rounded"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">End Date</label>
                    <DatePicker
                      selected={endDate}
                      onChange={setEndDate}
                      className="w-full border p-2 rounded"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">End Time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full border p-2 rounded"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Tags */}
            {step === 6 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tagsList.map((tg, i) => {
                    const isSel = selectedTags.includes(tg.id)
                    const cls = isSel
                      ? pillStyles[i % pillStyles.length]
                      : 'bg-gray-200 text-gray-700'
                    return (
                      <button
                        key={tg.id}
                        type="button"
                        onClick={() => {
                          if (isSel)
                            setSelectedTags(s => s.filter(x => x !== tg.id))
                          else
                            setSelectedTags(s => [...s, tg.id])
                        }}
                        className={`${cls} px-3 py-1 rounded-full text-sm`}
                        disabled={submitting}
                      >
                        {tg.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={back}
                disabled={step === 1 || submitting}
                className="px-4 py-2 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={next}
                disabled={!canProceed() || submitting}
                className={`px-6 py-2 rounded text-white ${
                  canProceed()
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-indigo-300'
                }`}
              >
                {step < totalSteps
                  ? 'Next'
                  : submitting
                  ? 'Posting…'
                  : 'Post Event'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
