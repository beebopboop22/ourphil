// src/BigBoardPage.jsx
import React, { useState, useEffect, useContext, useMemo } from 'react'
import imageCompression from 'browser-image-compression'
import { motion, AnimatePresence } from 'framer-motion'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'
import Navbar from './Navbar'
import Footer from './Footer'

export default function BigBoardPage() {
  const { user } = useContext(AuthContext)

  // ── State ────────────────────────────────────────────────────────────────
  const [posts, setPosts]               = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [modalStep, setModalStep]       = useState(1)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl]     = useState('')
  const [selectedAreas, setSelectedAreas] = useState([])
  const [title, setTitle]               = useState('')
  const [startDate, setStartDate]       = useState(null)
  const [endDate, setEndDate]           = useState(null)
  const [eventSlug, setEventSlug]       = useState('')
  const [uploading, setUploading]       = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [selectedView, setSelectedView]   = useState('All')

  const areasList = [
    'South','North','West','Center City',
    'Northeast','Northwest','River Wards'
  ]

  // ── Fetch posts ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    setLoadingPosts(true)
    const { data, error } = await supabase
      .from('big_board_posts')
      .select(`
        id,
        image_url,
        user_id,
        created_at,
        Area,
        event_id,
        big_board_events!big_board_events_post_id_fkey(
          id, title, start_date, end_date, slug
        )
      `)
      .order('created_at', { ascending: false })

    if (error) console.error('fetchPosts error:', error)
    else setPosts(data)

    setLoadingPosts(false)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function resolveImageUrl(val) {
    let key = val
    if (val.startsWith('http')) {
      const m = val.match(/\/public\/big-board\/(.+)$/)
      if (m) key = m[1]
      else return val
    }
    return supabase
      .storage
      .from('big-board')
      .getPublicUrl(key)
      .data.publicUrl
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'')
  }

  function resetModal() {
    setShowModal(false)
    setModalStep(1)
    setSelectedFile(null)
    setPreviewUrl('')
    setSelectedAreas([])
    setTitle('')
    setStartDate(null)
    setEndDate(null)
    setEventSlug('')
    setUploading(false)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  // ── Step 2: post only ───────────────────────────────────────────────────────
  async function uploadPostOnly() {
    setUploading(true)
    try {
      const options = { maxSizeMB:0.5, maxWidthOrHeight:1024, useWebWorker:true }
      const compressed = await imageCompression(selectedFile, options)
      const cleanName = compressed.name.replace(/[^a-z0-9.\-_]/gi,'_').toLowerCase()
      const key = `${user.id}-${Date.now()}-${cleanName}`
      await supabase.storage.from('big-board').upload(key, compressed)

      await supabase
        .from('big_board_posts')
        .insert({
          user_id:   user.id,
          image_url: key,
          Area:      selectedAreas.join(',') || ''
        })

      await fetchPosts()
      resetModal()
    } catch (err) {
      console.error(err)
      alert(err.message)
      setUploading(false)
    }
  }

  // ── Step 3: post + event ────────────────────────────────────────────────────
  async function uploadWithEvent() {
    setUploading(true)
    try {
      // 1) compress & upload image
      const options = { maxSizeMB:0.5, maxWidthOrHeight:1024, useWebWorker:true }
      const compressed = await imageCompression(selectedFile, options)
      const cleanName = compressed.name.replace(/[^a-z0-9.\-_]/gi,'_').toLowerCase()
      const key = `${user.id}-${Date.now()}-${cleanName}`
      await supabase.storage.from('big-board').upload(key, compressed)

      // 2) insert post & grab its id
      let { data: postData } = await supabase
        .from('big_board_posts')
        .insert({
          user_id:   user.id,
          image_url: key,
          Area:      selectedAreas.join(',') || ''
        })
        .select('id')
      const postId = postData[0].id

      // 3) insert event
      const slug = `${slugify(title)}-${Date.now()}`
      let { data: evData } = await supabase
        .from('big_board_events')
        .insert({
          post_id:    postId,
          title,
          start_date: startDate.toISOString().split('T')[0],
          end_date:   endDate.toISOString().split('T')[0],
          slug
        })
        .select('id')
      const evId = evData[0].id

      // 4) link post → event
      await supabase
        .from('big_board_posts')
        .update({ event_id: evId })
        .eq('id', postId)

      setEventSlug(slug)
      await fetchPosts()
      setModalStep(4)
    } catch (err) {
      console.error(err)
      alert(err.message)
      setUploading(false)
    }
  }

  // ── Filtered posts ─────────────────────────────────────────────────────────
  const displayedPosts = useMemo(() => {
    if (selectedView === 'All') return posts
    return posts.filter(p => {
      const arr = p.Area?.split(',').map(a=>a.trim()) || []
      return arr.includes(selectedView)
    })
  }, [posts, selectedView])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow bg-[#bf3d35] text-white pt-20 mt-20 pb-20">
        <div className="max-w-6xl mx-auto px-4">
        <div className="max-w-6xl mx-auto px-4 mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center">
  {/* heading block */}
  <div className="text-center sm:text-left">
    <h1 className="font-[Barrio] text-6xl">THE BIG BOARD</h1>
    <h3 className="mt-2 text-lg">
      Community-submitted fliers & events
    </h3>
  </div>

  {/* button aligned right */}
  {user && (
    <button
      onClick={() => setShowModal(true)}
      className="mt-4 sm:mt-0 bg-indigo-600 text-white px-6 py-3 rounded shadow hover:bg-indigo-700"
    >
      Add a post
    </button>
  )}
  {!user && (
    <p className="mt-4 sm:mt-0 text-gray-200">Log in to post</p>
  )}
</div>

          {/* grid */}
          {loadingPosts ? (
            <p className="text-center">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {displayedPosts.map((post,i)=>{
                const url = resolveImageUrl(post.image_url)
                const ev  = post.big_board_events?.[0]
                return (
                  <motion.div
                    key={post.id}
                    className="relative overflow-hidden shadow-lg rounded-lg cursor-pointer w-full h-72 sm:aspect-square"
                    whileHover={{ scale:1.03 }}
                    onClick={()=>setLightboxIndex(i)}
                  >
                    {/* calendar + View Event */}
                    {ev?.slug && (
                      <>
                        <div className="absolute top-2 left-2 text-2xl z-20">
                          📅
                        </div>
                        <a
                          href={`https://ourphilly.org/big-board/${ev.slug}`}
                          className="absolute bottom-2 left-2 bg-white bg-opacity-80 text-indigo-600 text-sm px-2 py-1 rounded z-20"
                        >
                          View Event
                        </a>
                      </>
                    )}

                    {/* flyer image */}
                    <img
                      src={url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* delete button */}
                    {post.user_id===user?.id && (
                      <button
                        onClick={e=>{
                          e.stopPropagation()
                          if(!confirm('Delete this post?')) return
                          supabase
                            .from('big_board_posts').delete().eq('id',post.id)
                            .then(()=>supabase.storage.from('big-board').remove([post.image_url]))
                            .then(fetchPosts)
                            .catch(console.error)
                        }}
                        className="absolute top-1 right-1 bg-white/80 p-1 rounded-full hover:bg-red-100 z-20"
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

      {/* ── Multi-step Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          >
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-md relative"
              initial={{scale:0.8}} animate={{scale:1}} exit={{scale:0.8}}
            >
              {/* close */}
              <button
                onClick={resetModal}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>

              {/* Step 1 */}
              {modalStep===1 && (
                <>
                  <h2 className="text-xl font-bold mb-4">Add a post</h2>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="mb-4 w-full"
                  />
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="mb-4 w-full h-40 object-cover rounded"
                    />
                  )}
                  <button
                    onClick={()=>setModalStep(2)}
                    disabled={!selectedFile}
                    className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </>
              )}

              {/* Step 2 */}
              {modalStep===2 && (
                <>
                  <h2 className="text-xl font-bold mb-4">Create an event?</h2>
                  {previewUrl && (
                    <img src={previewUrl} className="mb-4 w-full h-40 object-cover rounded" />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={uploadPostOnly}
                      disabled={uploading}
                      className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      No, post now
                    </button>
                    <button
                      onClick={()=>setModalStep(3)}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                    >
                      Yes, create event
                    </button>
                  </div>
                </>
              )}

              {/* Step 3 */}
              {modalStep===3 && (
                <>
                  <h2 className="text-xl font-bold mb-4">Event details</h2>
                  {previewUrl && (
                    <img src={previewUrl} className="mb-4 w-full h-40 object-cover rounded" />
                  )}
                  <input
                    type="text"
                    placeholder="Event Title"
                    value={title}
                    onChange={e=>setTitle(e.target.value)}
                    className="w-full border p-2 rounded mb-4"
                  />
                  <div className="flex gap-2 mb-4">
                    <DatePicker
                      selected={startDate}
                      onChange={setStartDate}
                      placeholderText="Start Date"
                      className="w-1/2 border p-2 rounded"
                    />
                    <DatePicker
                      selected={endDate}
                      onChange={setEndDate}
                      placeholderText="End Date"
                      className="w-1/2 border p-2 rounded"
                    />
                  </div>
                  <button
                    onClick={uploadWithEvent}
                    disabled={uploading||!title||!startDate||!endDate}
                    className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
                  >
                    Finish
                  </button>
                </>
              )}

              {/* Step 4 */}
              {modalStep===4 && (
                <>
                  <h2 className="text-xl font-bold mb-4">Your event is live!</h2>
                  <input
                    readOnly
                    value={`https://ourphilly.org/big-board/${eventSlug}`}
                    className="w-full border p-2 rounded mb-4"
                    onClick={e=>e.target.select()}
                  />
                  <button
                    onClick={resetModal}
                    className="w-full bg-indigo-600 text-white py-2 rounded"
                  >
                    Close
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lightbox ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxIndex != null && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setLightboxIndex(null)}
          >
            <button
              onClick={e=>{
                e.stopPropagation()
                setLightboxIndex((lightboxIndex + posts.length - 1) % posts.length)
              }}
              className="absolute left-4 text-white text-3xl"
            >‹</button>
            <motion.img
              src={resolveImageUrl(posts[lightboxIndex].image_url)}
              alt=""
              className="max-w-full max-h-full rounded-lg"
              initial={{scale:0.8}} animate={{scale:1}} exit={{scale:0.8}}
              onClick={e=>e.stopPropagation()}
            />
            <button
              onClick={e=>{
                e.stopPropagation()
                setLightboxIndex((lightboxIndex + 1) % posts.length)
              }}
              className="absolute right-4 text-white text-3xl"
            >›</button>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  )
}
