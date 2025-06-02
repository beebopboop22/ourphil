import React, { useState, useEffect, useContext, useMemo } from 'react'
import imageCompression from 'browser-image-compression'
import { motion, AnimatePresence } from 'framer-motion'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'
import Navbar from './Navbar'
import Footer from './Footer'
import CityHolidayAlert from './CityHolidayAlert'

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

  // Bulletin board assets
  const boardBg = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/bulletin-board-2.jpeg'
  const paperBg = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/loose-leaf-paper.jpg'
  const pinUrl  = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/push-pin-green.png'

  useEffect(() => {
    fetchPosts()
  }, [])

  // ── Fetch posts + events ─────────────────────────────────────────────────
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

  // ── Utility: resolve public URL for stored images ─────────────────────────
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

  // ── File & event upload handlers ─────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

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
        .insert({ user_id:user.id, image_url:key, Area:selectedAreas.join(',')||'' })
      await fetchPosts()
      resetModal()
    } catch (err) {
      console.error(err)
      alert(err.message)
      setUploading(false)
    }
  }

  async function uploadWithEvent() {
    setUploading(true)
    try {
      const options = { maxSizeMB:0.5, maxWidthOrHeight:1024, useWebWorker:true }
      const compressed = await imageCompression(selectedFile, options)
      const cleanName = compressed.name.replace(/[^a-z0-9.\-_]/gi,'_').toLowerCase()
      const key = `${user.id}-${Date.now()}-${cleanName}`
      await supabase.storage.from('big-board').upload(key, compressed)
      const { data: postData } = await supabase
        .from('big_board_posts')
        .insert({ user_id:user.id, image_url:key, Area:selectedAreas.join(',')||'' })
        .select('id')
      const postId = postData[0].id
      const slug = `${slugify(title)}-${Date.now()}`
      const { data: evData } = await supabase
        .from('big_board_events')
        .insert({ post_id:postId, title, start_date:startDate.toISOString().split('T')[0], end_date:endDate.toISOString().split('T')[0], slug })
        .select('id')
      await supabase.from('big_board_posts').update({ event_id:evData[0].id }).eq('id',postId)
      setEventSlug(slug)
      await fetchPosts()
      setModalStep(4)
    } catch (err) {
      console.error(err)
      alert(err.message)
      setUploading(false)
    }
  }

   // ── Filtered view based on selectedArea ───────────────────────────────────
  const displayedPosts = useMemo(() => {
    if (selectedView === 'All') return posts
    return posts.filter(p =>
      p.Area?.split(',').map(a => a.trim()).includes(selectedView)
    )
  }, [posts, selectedView])

  // ── Sort posts by their event start_date ─────────────────────────────────
  const sortedDisplayedPosts = useMemo(() => {
    return [...displayedPosts].sort((a, b) => {
      const aDate = a.big_board_events?.[0]?.start_date || ''
      const bDate = b.big_board_events?.[0]?.start_date || ''
      return new Date(aDate) - new Date(bDate)
    })
  }, [displayedPosts])

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main
  className="flex-grow text-white pt-20 mt-20 pb-20 relative"
  style={{
    backgroundImage: `url('${boardBg}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
>
  <div className="max-w-6xl mx-auto px-4 mb-8">
    {/* Pinned title */}
    <div className="relative mb-8 flex flex-col items-center">
      <div
        className="w-full max-w-md py-6 px-8"
        style={{
          backgroundImage: `url('${paperBg}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <h1 className="font-[Barrio] text-6xl text-center text-[#28313e]">
          THE BIG BOARD
        </h1>
        <h3 className="mt-2 text-lg text-[#28313e] text-center">
          Community-submitted fliers & events
        </h3>
      </div>
      <img
        src={pinUrl}
        alt="Pinned"
        className="absolute -top-4 left-1/2 w-16 h-12 transform -translate-x-1/2 rotate-6 z-20 pointer-events-none"
      />
      {user ? (
        <button
          onClick={() => setShowModal(true)}
          className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded shadow hover:bg-indigo-700 transition"
        >
          Add a post
        </button>
      ) : (
        <p className="mt-4 text-gray-200">Log in to post</p>
      )}
    </div>
  </div>

  {loadingPosts ? (
    <p className="text-center text-white">Loading…</p>
  ) : (
    <div className="flex overflow-x-auto space-x-4 px-4 pb-4">
      {sortedDisplayedPosts.map((post, i) => {
        const url = resolveImageUrl(post.image_url)
        const ev  = post.big_board_events?.[0]
        const link = ev?.slug
          ? `https://ourphilly.org/big-board/${ev.slug}`
          : null

        // format “Jun 10”
        const dateLabel = ev?.start_date
          ? new Date(ev.start_date).toLocaleDateString('en-US', {
              month: 'short',
              day:   'numeric',
            })
          : ''

        return (
          <motion.a
            key={post.id}
            href={link || '#'}
            className="relative flex-shrink-0 w-64 h-80 shadow-lg rounded-lg cursor-pointer block overflow-hidden"
            whileHover={{ scale: 1.03 }}
            onClick={(e) => {
              // if no event, just open lightbox
              if (!link) {
                e.preventDefault()
                setLightboxIndex(i)
              }
            }}
          >
            {/* Pin graphic */}
            <img
              src={pinUrl}
              alt=""
              className="absolute -top-4 left-1/2 w-16 h-12 transform -translate-x-1/2 rotate-6 z-20 pointer-events-none"
            />

            {/* Background image */}
            <img
              src={url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Footer overlay */}
            {ev && (
              <div className="absolute bottom-0 left-0 w-full bg-white bg-opacity-80 p-2 text-center">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {ev.title}
                </p>
                <p className="text-xs text-gray-600">{dateLabel}</p>
              </div>
            )}
          </motion.a>
        )
      })}
    </div>
  )}
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
