// src/utils/useTriviaReviewStats.js
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Custom hook to fetch aggregated trivia‐review statistics for a given trivia_id.
 * Returns:
 *   stats: {
 *     totalReviews: number,
 *     soloCount:     number,
 *     crowdCounts:   { [crowd_level: string]: number },
 *     vibeCounts:    { [vibe: string]: number }
 *   }
 *   loading: boolean
 */
export function useTriviaReviewStats(triviaId, refreshKey = 0) {
  const [stats, setStats] = useState({
    totalReviews: 0,
    soloCount: 0,
    crowdCounts: {},
    vibeCounts: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!triviaId) return

    setLoading(true)
    // We will run four parallel queries:
    // 1) total count of reviews
    // 2) count where solo_friendly = true
    // 3) GROUP BY crowd_level
    // 4) GROUP BY vibe
    Promise.all([
      // 1) Total reviews
      supabase
        .from('trivia_reviews')
        .select('count', { count: 'exact', head: true })
        .eq('trivia_id', triviaId),

      // 2) Solo‐friendly count
      supabase
        .from('trivia_reviews')
        .select('count', { count: 'exact', head: true })
        .eq('trivia_id', triviaId)
        .eq('solo_friendly', true),

      // 3) Crowd level distribution
      supabase
        .from('trivia_reviews')
        .select('crowd_level, count:crowd_level', { count: 'exact' })
        .eq('trivia_id', triviaId)
        .group('crowd_level'),

      // 4) Vibe distribution
      supabase
        .from('trivia_reviews')
        .select('vibe, count:vibe', { count: 'exact' })
        .eq('trivia_id', triviaId)
        .group('vibe'),
    ])
      .then(
        ([
          totalRes,
          soloRes,
          crowdRes,
          vibeRes,
        ]) => {
          // totalRes:
          //   totalRes.count  = total rows matching trivia_id
          // soloRes:
          //   soloRes.count   = number of rows with solo_friendly = true
          // crowdRes.data   = e.g. [ { crowd_level: 'low', count: 10 }, ... ]
          // vibeRes.data    = e.g. [ { vibe: 'chill', count: 7 }, ... ]

          const totalReviews = totalRes.count ?? 0
          const soloCount = soloRes.count ?? 0

          // Build crowdCounts map
          const crowdCounts = {}
          (crowdRes.data || []).forEach((row) => {
            const lvl = row.crowd_level || 'unknown'
            // Under the hood, Supabase returns count in `row.count` (as a string),
            // so parseInt is necessary.
            crowdCounts[lvl] = parseInt(row.count, 10)
          })

          // Build vibeCounts map
          const vibeCounts = {}
          (vibeRes.data || []).forEach((row) => {
            const v = row.vibe || 'unknown'
            vibeCounts[v] = parseInt(row.count, 10)
          })

          setStats({
            totalReviews,
            soloCount,
            crowdCounts,
            vibeCounts,
          })
        }
      )
      .catch((err) => {
        console.error('Error fetching review stats:', err)
        // In case of error, reset to zeros
        setStats({
          totalReviews: 0,
          soloCount: 0,
          crowdCounts: {},
          vibeCounts: {},
        })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [triviaId, refreshKey])

  return { stats, loading }
}
