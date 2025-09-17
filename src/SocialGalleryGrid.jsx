// src/SocialGalleryGrid.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'

export default function SocialGalleryGrid({ limit = 60 }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('all_events')
        .select('id, name, image')
        .not('image', 'is', null)
        .limit(100)
      if (error) throw error
      const shuffled = data.sort(() => 0.5 - Math.random())
      setEvents(shuffled.slice(0, limit))
    } catch (e) {
      console.error('Error fetching events:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [limit])

  useEffect(() => {
    if (events.length > 0) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      const interval = setInterval(() => {
        const scrolled = window.innerHeight + window.scrollY
        const height = document.body.offsetHeight
        if (scrolled >= height) {
          clearInterval(interval)
        } else {
          window.scrollBy({ top: 2, behavior: 'smooth' })
        }
      }, 30)
      return () => clearInterval(interval)
    }
  }, [events])

  return (
    <div className="w-screen overflow-x-hidden">
      <Navbar />
      <div className="h-20" />
      {loading ? (
        <p className="text-center">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0">
            {events.map(evt => (
              <div key={evt.id} className="relative">
                <img
                  src={evt.image || 'https://via.placeholder.com/300'}
                  alt={evt.name}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/40" />
                {evt.name && (
                  <div className="absolute bottom-0 w-full bg-black/60 text-white text-3xl font-[Barrio] text-center p-2">
                    {evt.name}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={fetchEvents}
            className="w-full h-12 bg-blue-500 text-white"
          >
            Refresh
          </button>
        </>
      )}
    </div>
  )
}
