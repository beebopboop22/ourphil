// src/MoreEventsBanner.jsx
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function MoreEventsBanner({ maxItems = 10 }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0,10)
      const { data, error } = await supabase
        .from('all_events')
        .select('name, start_date')
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(maxItems)

      if (!error) {
        setItems(
          data.map(ev => {
            const d = new Date(ev.start_date)
            const m = d.toLocaleDateString('en-US',{ month:'short', day:'numeric' })
            return `${m}: ${ev.name}`
          })
        )
      }
    })();
  }, [maxItems])

  // duplicate the list so it scrolls seamlessly
  const marqueeItems = [...items, ...items]

  return (
    <Link
      to="/"
      className="block w-full bg-white"
    >
      <div className="flex items-center w-full h-12">
        {/* static label */}
        <div className="flex-none px-4 font-bold whitespace-nowrap text-base md:text-2xl">
          MORE EVENTS  →
        </div>

        {/* marquee */}
        <div className="overflow-hidden flex-1">
          <div
            className="inline-flex whitespace-nowrap"
            style={{
              animation: 'marquee 20s linear infinite'
            }}
          >
            {marqueeItems.map((text, i) => (
              <span key={i} className=" text-lg">
                {text}
                <span className="mx-2">&bull;</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* keyframes injected here */}
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}
      </style>
    </Link>
  )
}
