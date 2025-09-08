// src/SocialGalleryGrid.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function SocialGalleryGrid({ limit = 4 }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('all_events')
        .select('id, name, image')
        .not('image', 'is', null)
        .limit(50)
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

  return (
    <div className="max-w-2xl mx-auto p-4">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {events.map(evt => (
              <div key={evt.id} className="flex flex-col">
                <img
                  src={evt.image || 'https://via.placeholder.com/300'}
                  alt={evt.name}
                  className="w-full h-48 object-cover rounded"
                />
                {evt.name && (
                  <p className="text-center mt-1 text-sm">{evt.name}</p>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={fetchEvents}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </>
      )}
    </div>
  )
}
