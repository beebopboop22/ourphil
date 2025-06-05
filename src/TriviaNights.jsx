// src/TriviaNights.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
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
  const [selectedDay, setSelectedDay] = useState(
    daysOfWeek[new Date().getDay()]
  )
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('All')
  const [reviewOpenId, setReviewOpenId] = useState(null)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

  useEffect(() => {
    const fetchTrivia = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('trivia')
        .select('id, Bar, Time, Neighborhood, link')
        .eq('Day', selectedDay)
        .order('Time', { ascending: true })

      if (error) {
        console.error('Error fetching trivia nights:', error)
        setTriviaList([])
      } else {
        setTriviaList(data)
        setSelectedNeighborhood('All')
      }
      setLoading(false)
    }
    fetchTrivia()
  }, [selectedDay])

  const neighborhoods = useMemo(() => {
    const uniq = Array.from(
      new Set(
        triviaList.map((t) => t.Neighborhood || '').filter(Boolean)
      )
    )
    return ['All', ...uniq.sort()]
  }, [triviaList])

  const filteredList = useMemo(() => {
    if (selectedNeighborhood === 'All') return triviaList
    return triviaList.filter((t) => t.Neighborhood === selectedNeighborhood)
  }, [triviaList, selectedNeighborhood])

  return (
    <div className="min-h-screen bg-gray-900 text-green-300 font-mono">
      <Navbar />

      {/* Cockpit Dashboard Header */}
      <div className="relative max-w-4xl mx-auto py-8 px-4 pt-24">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-900 to-black opacity-80 pointer-events-none z-0" />
        <h1 className="relative z-10 text-3xl font-bold text-center mb-6 tracking-widest">
          🚀 TRIVIA CONTROL PANEL 🚀
        </h1>

        {/* Day Selector as Control Switches */}
        <div className="relative z-10 flex overflow-x-auto space-x-2 justify-center mb-6">
          {daysOfWeek.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                selectedDay === day
                  ? 'bg-green-300 text-black border-green-300'
                  : 'bg-gray-800 text-green-300 border-green-300 hover:bg-green-300 hover:text-black'
              }`}
            >
              {day.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>

        {/* Neighborhood Dropdown as System Monitor */}
        {neighborhoods.length > 1 && (
          <div className="relative z-10 flex justify-center mb-6">
            <select
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              className="text-xs font-medium text-green-300 bg-gray-800 border border-green-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {neighborhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading / No Results */}
        {loading ? (
          <p className="relative z-10 text-green-500 text-center py-8">
            Initializing sensors...
          </p>
        ) : filteredList.length === 0 ? (
          <p className="relative z-10 text-red-500 text-center py-8">
            No trivia stations online for {selectedDay}
            {selectedNeighborhood !== 'All' && ` in ${selectedNeighborhood}`}.
          </p>
        ) : (
          /* Trivia Grid as Cockpit Panels */
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="max-w-xs mx-auto transform hover:scale-105 transition-transform"
              >
                <TriviaCard
                  item={item}
                  reviewOpenId={reviewOpenId}
                  setReviewOpenId={setReviewOpenId}
                  statsRefreshKey={statsRefreshKey}
                  onReviewSuccess={() =>
                    setStatsRefreshKey((k) => k + 1)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
