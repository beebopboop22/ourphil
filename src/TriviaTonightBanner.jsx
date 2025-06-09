// src/TriviaTonightBanner.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'

const daysOfWeek = [
  'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
]

const dayIcons = {
  Sunday:    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//sunday-trivia.png',
  Monday:    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//MONDAY-TRIVIA.png',
  Tuesday:   'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//TUESDAY-TRIVIA.png',
  Wednesday: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//WEDSNEDAY-TRIVIA.png',
  Thursday:  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//THURSDAY-TRIVAI.png',
  Friday:    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//FRIDAY-TRIVIA.png',
  Saturday:  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//SATURDAY-TRIVIA.png',
}

const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
]

export default function TriviaTonightBanner() {
  const today = daysOfWeek[new Date().getDay()]
  const iconUrl = dayIcons[today]

  const [count, setCount] = useState(0)
  const [sampleBars, setSampleBars] = useState([])
  const [game, setGame] = useState(null)

  useEffect(() => {
    supabase
      .from('trivia')
      .select('id', { count: 'exact', head: true })
      .eq('Day', today)
      .then(({ count }) => setCount(count || 0))

    supabase
      .from('trivia')
      .select('Bar')
      .eq('Day', today)
      .order('Time', { ascending: true })
      .limit(2)
      .then(({ data }) => setSampleBars(data.map(d => d.Bar)))

    ;(async () => {
      let all = []
      for (let slug of teamSlugs) {
        const res = await fetch(
          `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=10&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
        )
        const json = await res.json()
        all.push(...(json.events || []))
      }
      const today0 = new Date(); today0.setHours(0,0,0,0)
      const tonight = all.filter(e => {
        const d = new Date(e.datetime_local); d.setHours(0,0,0,0)
        return d.getTime() === today0.getTime()
      })
      if (tonight.length) {
        const e = tonight[0]
        const home = e.performers.find(p => p.home_team) || e.performers[0]
        const away = e.performers.find(p => !p.home_team) || e.performers[1] || home
        const time = new Date(e.datetime_local)
          .toLocaleTimeString('en-US',{ hour:'numeric', minute:'2-digit' })
        setGame({ home, away, time, venue: e.venue.name, url: e.url })
      }
    })()
  }, [today])

  return (
    <div
      className="
        flex flex-col sm:flex-row
        items-start
        sm:items-center
        space-y-4 sm:space-y-0
        sm:space-x-6
        p-4 bg-white rounded-lg shadow-sm
        mx-auto
        w-full sm:max-w-3xl
      "
    >
      {/* Trivia panel */}
      <Link
        to="/trivia"
        className="flex items-center space-x-4 flex-shrink-0 border-b sm:border-b-0 sm:border-r pb-4 sm:pb-0"
      >
        <img
          src={iconUrl}
          alt={`${today} trivia`}
          className="w-12 sm:w-16 h-auto rounded"
        />
        <div className="flex flex-col text-left pr-4">
          <span className="font-medium text-gray-900 text-sm">
            {count} QUIZZO tonight
          </span>
          <span className="text-xs text-gray-500">
            {sampleBars.join(', ')}, & more!
          </span>
        </div>
      </Link>

      {/* Sports panel */}
      {game && (
        <a
          href={game.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-4 flex-shrink-0"
        >
          <img
            src={game.home.image}
            alt={game.home.name}
            className="w-12 sm:w-16 h-auto object-cover rounded"
          />
          
          <div className="flex flex-col text-left">
            <span className="font-medium text-gray-900 text-sm">
              {game.home.name.replace(/^Philadelphia\s+/, '')} vs{' '}
              {game.away.name.replace(/^Philadelphia\s+/, '')}
            </span>
            <span className="text-xs text-gray-500">
              {game.time} @ {game.venue}
            </span>
          </div>
        </a>
      )}
    </div>
  )
}
