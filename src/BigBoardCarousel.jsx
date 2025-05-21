// src/BigBoardCarousel.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import { Link } from 'react-router-dom'

export default function BigBoardCarousel() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('big_board_posts')
        .select(`
          id,
          image_url,
          event_id,
          big_board_events!big_board_posts_event_id_fkey(
            title,
            start_date,
            slug
          )
        `)
        .order('created_at', { ascending: false })
        .limit(12)

      if (error) {
        console.error('Error loading big board posts:', error)
      } else {
        setPosts(data.map(post => {
          const { data: { publicUrl } } = supabase
            .storage
            .from('big-board')
            .getPublicUrl(post.image_url)
          return {
            ...post,
            imageUrl: publicUrl,
            evt: post.big_board_events?.[0] ?? null
          }
        }))
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!posts.length) return
    const iv = setInterval(() => {
      setCurrentIndex(i => (i + 1) % posts.length)
    }, 2000)
    return () => clearInterval(iv)
  }, [posts])

  useEffect(() => {
    const el = containerRef.current
    if (el) {
      const w = el.clientWidth
      el.scrollTo({ left: currentIndex * w, behavior: 'smooth' })
    }
  }, [currentIndex])

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
      year:  'numeric',
    })

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <div className="h-[calc(100vh-112px)] overflow-hidden pt-20">
        {loading ? (
          <p className="text-center py-20">Loading…</p>
        ) : (
          <div ref={containerRef} className="flex w-full h-full overflow-hidden">
            {posts.map(post => (
              <Link
                key={post.id}
                to={post.evt ? `/big-board/${post.evt.slug}` : '/board'}
                className="relative w-full flex-shrink-0 flex items-center justify-center bg-[#bf3d35]"
              >
                {/* Poster */}
                <img
                  src={post.imageUrl}
                  alt={post.evt?.title || 'Big Board Post'}
                  className="max-h-full max-w-full object-contain z-10"
                />

                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

                {/* Event pill */}
                {post.evt && (
                  <>
                    <div className="absolute top-4 left-4 text-2xl z-20">📅</div>
                    <span className="absolute bottom-6 right-6 bg-white/90 text-indigo-700 text-sm font-medium px-3 py-1 rounded z-20">
                      View Event
                    </span>
                  </>
                )}

                {/* Title & Date centered */}
                {post.evt && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 text-white p-4 z-20 space-y-1">
                    <h3 className="text-xl font-bold text-center">{post.evt.title}</h3>
                    <p className="text-sm">{formatDate(post.evt.start_date)}</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <div className="bg-[#28313e] text-white py-4 text-center font-[Barrio] text-2xl">
          THE BIG BOARD
        </div>
        <img
          src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//OurPhilly-CityHeart-2.png"
          alt="heart"
          className="absolute bottom-0 right-3/4 w-1/3 translate-y-[55%] pointer-events-none"
        />
      </div>
    </div>
  )
}
