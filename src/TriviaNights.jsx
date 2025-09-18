// src/TriviaNights.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { Helmet } from 'react-helmet-async'
import Navbar from './Navbar'
import Footer from './Footer'
import TriviaCard from './TriviaCard'

const daysOfWeek = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export default function TriviaNights() {
  const [triviaList, setTriviaList] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedDay, setSelectedDay] = useState(daysOfWeek[new Date().getDay()])
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('All')

  const [reviewOpenId, setReviewOpenId] = useState(null)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

  // Fetch whenever selectedDay changes
  useEffect(() => {
    setLoading(true)
    supabase
      .from('trivia')
      .select('id, Bar, Time, Neighborhood, link, Day')
      .eq('Day', selectedDay)
      .order('Time', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          setTriviaList([])
        } else {
          setTriviaList(data)
          setSelectedNeighborhood('All')
        }
      })
      .finally(() => setLoading(false))
  }, [selectedDay])

  // Unique neighborhoods
  const neighborhoods = useMemo(() => {
    const uniq = Array.from(
      new Set(triviaList.map(t => t.Neighborhood || '').filter(Boolean))
    )
    return ['All', ...uniq.sort()]
  }, [triviaList])

  // Filter by neighborhood
  const filtered = useMemo(() => {
    if (selectedNeighborhood === 'All') return triviaList
    return triviaList.filter(t => t.Neighborhood === selectedNeighborhood)
  }, [triviaList, selectedNeighborhood])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Helmet>
        <title>
          Quizzo in Philadelphia – Quizzo on {selectedDay} – Quizzo & Trivia
        </title>
        <meta
          name="description"
          content={`Browse trivia nights in Philadelphia for ${selectedDay}.`}
        />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />

      <div className="max-w-screen-xl mx-auto px-4 py-8 relative">
        {/* Massive heart in background */}
        <img
          src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//OurPhilly-CityHeart-1.png"
          alt=""
          role="presentation"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-contain opacity-5 pointer-events-none select-none"
        />

        <h1 className="text-4xl font-[Barrio] text-center mb-6 mt-20">
          Quizzo in Philly
        </h1>
        <p className="text-center text-sm text-gray-600 mb-8">
          Check their website to confirm.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Day selector */}
            <div>
              <h2 className="text-xl font-semibold mb-2">Day</h2>
              <select
                value={selectedDay}
                onChange={e => setSelectedDay(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {daysOfWeek.map(day => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            {/* Neighborhood selector */}
            <div>
              <h2 className="text-xl font-semibold mb-2">Neighborhood</h2>
              <ul className="space-y-2">
                {neighborhoods.map(n => (
                  <li key={n}>
                    <button
                      onClick={() => setSelectedNeighborhood(n)}
                      className={`w-full text-left px-4 py-2 rounded transition ${
                        selectedNeighborhood === n
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {n}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main list */}
          <section className="md:col-span-3 space-y-4">
            {loading ? (
              <p className="text-center text-gray-500 py-8">
                Loading trivia nights…
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No trivia tonight
                {selectedNeighborhood !== 'All' && ` in ${selectedNeighborhood}`}.
              </p>
            ) : (
              filtered.map(item => (
                <TriviaCard
                  key={item.id}
                  item={item}
                  reviewOpenId={reviewOpenId}
                  setReviewOpenId={setReviewOpenId}
                  statsRefreshKey={statsRefreshKey}
                  onReviewSuccess={() => setStatsRefreshKey(k => k + 1)}
                />
              ))
            )}
          </section>
        </div>
      </div>

      <Footer />
    </div>
  )
}
