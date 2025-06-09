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
    // trivia count + sample bars
    supabase
      .from('trivia')
      .select('id',{ count:'exact', head:true })
      .eq('Day', today)
      .then(({ count }) => setCount(count||0))

    supabase
      .from('trivia')
      .select('Bar')
      .eq('Day', today)
      .order('Time',{ ascending:true })
      .limit(3)
      .then(({ data }) => setSampleBars(data.map(d=>d.Bar)))

    // sports tonight: first matchup
    ;(async() => {
      let all = []
      for (let slug of teamSlugs) {
        const res = await fetch(
          `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=10&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
        )
        const json = await res.json()
        all.push(...(json.events||[]))
      }
      const today0 = new Date(); today0.setHours(0,0,0,0)
      const tonight = all.filter(e => {
        const d = new Date(e.datetime_local); d.setHours(0,0,0,0)
        return d.getTime()===today0.getTime()
      })
      if (tonight.length) {
        const e = tonight[0]
        const home = e.performers.find(p=>p.home_team)||e.performers[0]
        const away = e.performers.find(p=>!p.home_team)||e.performers[1]||home
        const time = new Date(e.datetime_local)
          .toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
        setGame({
          home,
          away,
          time,
          venue: e.venue.name,
          url: e.url,            // Capture the SeatGeek link
        })
      }
    })()
  }, [today])

  return (
    <div className="flex items-start space-x-6 p-4 bg-white rounded-lg shadow-sm mx-auto max-w-2xl">
      {/* Trivia half, links to your trivia page */}
      <Link
        to="/trivia"
        className="flex items-center space-x-4 pr-2 border-r"
      >
        <img
          src={iconUrl}
          alt={`${today} trivia`}
          className="w-30 h-20"
        />
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">
            {count} bars hosting trivia tonight
          </span>
          <span className="text-sm text-gray-500">
            {sampleBars.join(', ')}, …and more!
          </span>
        </div>
      </Link>

      {/* Sports half, links to SeatGeek */}
      {game && (
        <a
          href={game.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-4 pl-3"
        >
          <div className="flex space-x-2">
            <img
              src={game.home.image}
              alt={game.home.name}
              className="w-40 h-20 object-cover rounded"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">
              {game.home.name.replace(/^Philadelphia\s+/, '')} vs{' '}
              {game.away.name.replace(/^Philadelphia\s+/, '')}
            </span>
            <span className="text-sm text-gray-500">
              {game.time} @ {game.venue}
            </span>
          </div>
        </a>
      )}
    </div>
  )
}
