// src/BigBoardPage.jsx
import React, { useState, useEffect, useContext, useMemo } from 'react'
import imageCompression from 'browser-image-compression'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'
import Navbar from './Navbar'
import Footer from './Footer'

export default function BigBoardPage() {
  const { user } = useContext(AuthContext)
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [selectedAreas, setSelectedAreas] = useState([])
  const [selectedView, setSelectedView] = useState('All')

  const areasList = [
    'South',
    'North',
    'West',
    'Center City',
    'Northeast',
    'Northwest',
    'River Wards'
  ]

  useEffect(() => { fetchPosts() }, [])

  async function fetchPosts() {
    setLoadingPosts(true)
    const { data, error } = await supabase
      .from('big_board_posts')
      .select('id, image_url, user_id, created_at, Area')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchPosts error:', error)
    else setPosts(data)
    setLoadingPosts(false)
  }

  const canPost = !!user

  function resolveImageUrl(val) {
    let key = val
    if (val.startsWith('http')) {
      const m = val.match(/\/public\/big-board\/(.+)$/)
      if (m) key = m[1]
      else return val.replace(/([^:]\/)\/+/g, '$1')
    }
    const { data } = supabase.storage.from('big-board').getPublicUrl(key)
    return data.publicUrl
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleUpload() {
    if (!selectedFile || !user) return
    setUploading(true)
    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true }
      const compressed = await imageCompression(selectedFile, options)
      const cleanName = compressed.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()
      const key = `${user.id}-${Date.now()}-${cleanName}`
      const { error: upErr } = await supabase.storage.from('big-board').upload(key, compressed)
      if (upErr) throw upErr

      const areaCsv = selectedAreas.join(',') || ''
      const { error: insErr } = await supabase
        .from('big_board_posts')
        .insert({ user_id: user.id, image_url: key, Area: areaCsv })
      if (insErr) throw insErr

      await fetchPosts()
      setShowUploadModal(false)
      setSelectedFile(null)
      setPreviewUrl('')
      setSelectedAreas([])
    } catch (err) {
      console.error('Upload error:', err)
      alert(err.message)
    }
    setUploading(false)
  }

  async function handleDelete(post) {
    if (!user || post.user_id !== user.id) return
    if (!window.confirm('Delete this post?')) return
    await supabase.from('big_board_posts').delete().eq('id', post.id)
    await supabase.storage.from('big-board').remove([post.image_url])
    setPosts(ps => ps.filter(p => p.id !== post.id))
    setLightboxIndex(null)
  }

  const displayedPosts = useMemo(() => {
    if (selectedView === 'All') return posts
    return posts.filter(p => {
      const arr = p.Area?.split(',').map(a => a.trim()) || []
      return arr.includes(selectedView)
    })
  }, [posts, selectedView])

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow bg-gray-50 pt-20 mt-20 pb-20">
        <div className="w-full px-0 sm:px-4">
          <h1 className="font-[Barrio] text-6xl text-center">THE BIG BOARD</h1>
          <h3 className="text-center text-gray-700 mb-8">Like one big café bulletin board</h3>

          {/* filters + new post button */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {['All', ...areasList].map(area => (
              <button
                key={area}
                onClick={() => setSelectedView(area)}
                className={`px-4 py-2 rounded ${
                  selectedView === area
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 shadow'
                }`}
              >
                {area}
              </button>
            ))}
          </div>

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

          {/* grid: 1 col on mobile, auto‐fill on desktop */}
          {loadingPosts ? (
            <p className="text-center">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {displayedPosts.map((post, i) => {
                const url = resolveImageUrl(post.image_url)
                return (
                  <motion.div
                    key={post.id}
                    className="relative overflow-hidden shadow-lg rounded-lg cursor-pointer w-full h-72 sm:h-auto sm:aspect-square"
                    whileHover={{ scale: 1.03 }}
                    onClick={() => setLightboxIndex(i)}
                  >
                    <img
                      src={url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {post.user_id === user?.id && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleDelete(post)
                        }}
                        className="absolute top-1 right-1 bg-white/80 p-1 rounded-full hover:bg-red-100"
                      >
                        🗑️
                      </button>
                    )}
                  </motion.div>
                )
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-md"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              {/* modal title */}
              <h2 className="font-[Barrio] text-2xl text-center mb-4">
                New Board Post
              </h2>

              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mb-4 w-full"
              />

              {/* area multiselect */}
              <div className="mb-4">
                <label className="block mb-1 font-medium">
                  Area(s) <span className="text-sm text-gray-500">(optional; defaults to All)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {areasList.map(area => (
                    <label key={area} className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        value={area}
                        checked={selectedAreas.includes(area)}
                        onChange={e => {
                          const val = e.target.value
                          setSelectedAreas(curr =>
                            curr.includes(val)
                              ? curr.filter(a => a !== val)
                              : [...curr, val]
                          )
                        }}
                        className="rounded border-gray-300"
                      />
                      <span>{area}</span>
                    </label>
                  ))}
                </div>
              </div>

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

      {/* lightbox with prev/next */}
      <AnimatePresence>
        {lightboxIndex != null && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={e => {
                e.stopPropagation()
                setLightboxIndex((lightboxIndex + displayedPosts.length - 1) % displayedPosts.length)
              }}
              className="absolute left-4 text-white text-3xl"
            >
              ‹
            </button>
            <motion.img
              src={resolveImageUrl(displayedPosts[lightboxIndex].image_url)}
              alt=""
              className="max-w-full max-h-full rounded-lg"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={e => {
                e.stopPropagation()
                setLightboxIndex((lightboxIndex + 1) % displayedPosts.length)
              }}
              className="absolute right-4 text-white text-3xl"
            >
              ›
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  )
}
