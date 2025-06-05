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
  // ── Local state for aggregated stats ───────────────────────────────
  const [stats, setStats] = useState({
    totalReviews: 0,
    soloCount: 0,
    crowdCounts: {},
    vibeCounts: {},
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    setStatsLoading(true)

    // Fetch all reviews for this trivia_id, then aggregate in JS
    supabase
      .from('trivia_reviews')
      .select('solo_friendly, crowd_level, vibe')
      .eq('trivia_id', item.id)
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          console.error('Error fetching reviews:', error)
          setStatsLoading(false)
          return
        }
        // Aggregate on the fetched rows:
        const totalReviews = data.length
        let soloCount = 0
        const crowdCounts = {}
        const vibeCounts = {}

        data.forEach((r) => {
          if (r.solo_friendly) {
            soloCount += 1
          }
          if (r.crowd_level) {
            crowdCounts[r.crowd_level] = (crowdCounts[r.crowd_level] || 0) + 1
          }
          if (r.vibe) {
            vibeCounts[r.vibe] = (vibeCounts[r.vibe] || 0) + 1
          }
        })

        setStats({ totalReviews, soloCount, crowdCounts, vibeCounts })
        setStatsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [item.id, statsRefreshKey])

  // Derive summary values for display
  let soloPct = 0
  let topCrowd = ''
  let topVibe = ''

  if (!statsLoading && stats.totalReviews > 0) {
    soloPct = Math.round((stats.soloCount / stats.totalReviews) * 100)

    const sortedCrowd = Object.entries(stats.crowdCounts).sort(
      (a, b) => b[1] - a[1]
    )
    if (sortedCrowd.length) {
      topCrowd = sortedCrowd[0][0]
    }

    const sortedVibe = Object.entries(stats.vibeCounts).sort(
      (a, b) => b[1] - a[1]
    )
    if (sortedVibe.length) {
      topVibe = sortedVibe[0][0]
    }
  }

  const isOpen = reviewOpenId === item.id
  const toggleReview = () => {
    setReviewOpenId(isOpen ? null : item.id)
  }

  const placeholderImage =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/113_334387_1738156330113.webp'

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-transform hover:scale-[1.02]">
      {/* Placeholder Image */}
      <a
        href={item.link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={placeholderImage}
          alt={item.Bar}
          className="w-full h-40 object-cover"
        />
      </a>

      <div className="p-4">
        {/* Link to bar’s page (or external) */}
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

        {/* Review Stats (once loaded) or “No reviews yet” */}
        {!statsLoading && stats.totalReviews > 0 ? (
          <div className="mt-2 text-sm text-gray-600">
            <span>✶ {stats.totalReviews} reviews</span>
            <span className="mx-2">|</span>
            <span>Solo-friendly: {soloPct}%</span>
            <span className="mx-2">|</span>
            <span>
              Crowd:{' '}
              {topCrowd.charAt(0).toUpperCase() + topCrowd.slice(1)}
            </span>
            <span className="mx-2">|</span>
            <span>
              Vibe:{' '}
              {topVibe
                .charAt(0)
                .toUpperCase() + topVibe.slice(1).replace('-', ' ')}
            </span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-500">No reviews yet.</div>
        )}

        {/* Button toggles the inline review form */}
        <button
          type="button"
          onClick={toggleReview}
          className="mt-2 text-indigo-600 text-sm underline focus:outline-none"
        >
          {isOpen ? 'Cancel Review' : 'Leave a review'}
        </button>

        {/* Inline Review Form, if open */}
        {isOpen && (
          <div className="mt-4 border-t pt-4">
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
    </div>
  )
}
