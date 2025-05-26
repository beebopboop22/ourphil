// src/BigBoardEventPage.jsx
import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'

export default function BigBoardEventPage() {
  const { slug } = useParams()
  const [event, setEvent]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // ── Helper: parse "YYYY-MM-DD" as a local Date at midnight ──────────────
  function parseLocalYMD(str) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  useEffect(() => {
    fetchEvent()
  }, [slug])

  async function fetchEvent() {
    setLoading(true)
    setError(null)

    // 1) fetch event metadata
    const { data: ev, error: evErr } = await supabase
      .from('big_board_events')
      .select('id, post_id, title, start_date, end_date, created_at, slug')
      .eq('slug', slug)
      .single()

    if (evErr) {
      console.error(evErr)
      setError('Could not load event.')
      setLoading(false)
      return
    }

    // 2) fetch flyer post
    const { data: post, error: postErr } = await supabase
      .from('big_board_posts')
      .select('image_url')
      .eq('id', ev.post_id)
      .single()

    if (postErr) {
      console.error(postErr)
      setError('Could not load flyer.')
      setLoading(false)
      return
    }

    // 3) resolve storage URL
    const { data: { publicUrl } } = supabase
      .storage.from('big-board')
      .getPublicUrl(post.image_url)

    setEvent({ ...ev, imageUrl: publicUrl })
    setLoading(false)
  }

  if (loading) return <div className="py-20 text-center">Loading…</div>
  if (error)   return <div className="py-20 text-center text-red-600">{error}</div>
  if (!event)  return <div className="py-20 text-center">Event not found.</div>

  // use parseLocalYMD so dates render in local zone correctly
  const startDate = parseLocalYMD(event.start_date)
  const endDate   = parseLocalYMD(event.end_date)
  const start = startDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
  const end   = endDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow bg-white pt-20 pb-12 px-4">
        <div className="relative max-w-md mx-auto space-y-6">

          {/* oversized heart behind flyer */}
          <img
            src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-2.png"
            aria-hidden
            className="absolute top-1/2 left-1/2 w-96 -translate-x-1/2 -translate-y-1/3 opacity-10 pointer-events-none z-0"
          />

          {/* badge shifted left */}
          <div className="relative flex items-center ml-[-1rem] z-10">
            <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png"
              alt="Community submission"
              className="w-14 h-14"
            />
            <span className="ml-2 bg-yellow-100 text-yellow-800 text-base font-bold uppercase px-3 py-1 rounded-full">
              Stranger Submission
            </span>
          </div>

          {/* flyer container */}
          <div className="relative w-full h-full overflow-hidden rounded-lg shadow-lg z-10">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* title & dates */}
          <h1 className="text-3xl font-[Barrio] font-bold z-10">{event.title}</h1>
          <p className="text-gray-700 z-10">
            {start === end ? start : `${start} — ${end}`}
          </p>
          <p className="text-gray-400 text-sm z-10">
            Posted on {new Date(event.created_at).toLocaleDateString()}
          </p>

          {/* actions */}
          <div className="flex flex-col gap-3 mt-6 z-10">
            <Link
              to="/board"
              className="bg-indigo-600 text-white text-center py-2 rounded hover:bg-indigo-700"
            >
              ← Back to Big Board
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
