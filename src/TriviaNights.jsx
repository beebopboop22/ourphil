// src/TriviaNights.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'

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
    const uniq = Array.from(new Set(triviaList.map((t) => t.Neighborhood || '').filter(Boolean)))
    return ['All', ...uniq.sort()]
  }, [triviaList])

  const filteredList = useMemo(() => {
    if (selectedNeighborhood === 'All') return triviaList
    return triviaList.filter((t) => t.Neighborhood === selectedNeighborhood)
  }, [triviaList, selectedNeighborhood])

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-4xl mx-auto py-8 px-4 pt-24">
        {/* Title */}
        <h1 className="text-2xl font-bold text-indigo-600 text-center mb-4">
           Trivia Nights on {selectedDay}
        </h1>

        {/* Day Pills */}
        <div className="flex overflow-x-auto space-x-2 justify-center mb-4">
          {daysOfWeek.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                selectedDay === day
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Neighborhood Filter */}
        {neighborhoods.length > 1 && (
          <div className="flex justify-center mb-4">
            <select
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              className="text-sm font-medium text-indigo-600 border border-indigo-600 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
          <p className="text-gray-500 text-center py-8">Loading trivia nights…</p>
        ) : filteredList.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
            No trivia nights listed for {selectedDay}
            {selectedNeighborhood !== 'All' && ` in ${selectedNeighborhood}`}.
          </p>
        ) : (
          /* Trivia Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-transform hover:scale-[1.02]"
              >
                <a
                  href={item.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <h2 className="text-lg font-semibold text-indigo-800 mb-1">
                    {item.Bar}
                  </h2>
                  <p className="text-gray-700 mb-1">⏰ {item.Time}</p>
                  <p className="text-gray-700">📍 {item.Neighborhood}</p>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
