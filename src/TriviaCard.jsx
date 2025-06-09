// src/TriviaCard.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TriviaReviewForm from './TriviaReviewForm'

export default function TriviaCard({
  item,
  reviewOpenId,
  setReviewOpenId,
  statsRefreshKey,
  onReviewSuccess,
}) {
  const [stats, setStats] = useState({
    totalReviews: 0,
    soloCount: 0,
    crowdCounts: {},
    vibeCounts: {},
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setStatsLoading(true)
    supabase
      .from('trivia_reviews')
      .select('solo_friendly, crowd_level, vibe')
      .eq('trivia_id', item.id)
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error(error)
          setStatsLoading(false)
          return
        }
        const total = data.length
        let solo = 0, crowd = {}, vibe = {}
        data.forEach(r => {
          if (r.solo_friendly) solo++
          if (r.crowd_level) crowd[r.crowd_level] = (crowd[r.crowd_level]||0)+1
          if (r.vibe) vibe[r.vibe] = (vibe[r.vibe]||0)+1
        })
        setStats({ totalReviews: total, soloCount: solo, crowdCounts: crowd, vibeCounts: vibe })
        setStatsLoading(false)
      })
    return () => { mounted = false }
  }, [item.id, statsRefreshKey])

  const isOpen = reviewOpenId === item.id
  const toggleReview = () => setReviewOpenId(isOpen ? null : item.id)

  // hard-coded day images
  const dayImageMap = {
    Sunday:    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//sunday-trivia.png',
    Monday:    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//MONDAY-TRIVIA.png',
    Tuesday:   'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//TUESDAY-TRIVIA.png',
    Wednesday: 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//WEDSNEDAY-TRIVIA.png',
    Thursday:  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//THURSDAY-TRIVAI.png',
  }
  const imgSrc = dayImageMap[item.Day] || ''

  let soloPct = 0, topCrowd = '', topVibe = ''
  if (!statsLoading && stats.totalReviews > 0) {
    soloPct = Math.round(100 * stats.soloCount / stats.totalReviews)
    const sortedCrowd = Object.entries(stats.crowdCounts).sort((a,b)=>b[1]-a[1])
    if (sortedCrowd[0]) topCrowd = sortedCrowd[0][0]
    const sortedVibe = Object.entries(stats.vibeCounts).sort((a,b)=>b[1]-a[1])
    if (sortedVibe[0]) topVibe = sortedVibe[0][0]
  }

  return (
    <div className="flex flex-col bg-white border-b last:border-none hover:bg-gray-50 transition">
      <div className="flex items-center p-4 space-x-4">
        {/* Day image */}
        <img
          src={imgSrc}
          alt={`${item.Day} trivia`}
          className="w-16 h-16 object-cover rounded"
        />

        {/* Main info */}
        <div className="flex-1 flex flex-col space-y-1">
          <div className="text-lg font-semibold text-gray-900">
            {item.Bar}
          </div>
          <div className="text-sm text-gray-600">
            {item.Time}
            {item.Neighborhood && ` • ${item.Neighborhood}`}
          </div>
        </div>

        {/* Actions & stats */}
        <div className="flex flex-col items-end space-y-1">
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline"
            >
              Website
            </a>
          )}
          {!statsLoading && stats.totalReviews > 0 ? (
            <div className="text-xs text-gray-600">
              {stats.totalReviews} reviews
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              No reviews yet
            </div>
          )}
          <button
            onClick={toggleReview}
            className="text-xs text-indigo-600 underline focus:outline-none"
          >
            {isOpen ? 'Cancel' : 'Review'}
          </button>
        </div>
      </div>

      {/* Inline Review Form */}
      {isOpen && (
        <div className="px-4 pb-4 border-t">
          <TriviaReviewForm
            triviaId={item.id}
            onSuccess={() => {
              setReviewOpenId(null)
              onReviewSuccess()
            }}
          />
        </div>
      )}
    </div>
  )
}
