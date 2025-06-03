// src/TriviaReviewForm.jsx
import React, { useState, useContext } from 'react'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'

export default function TriviaReviewForm({ triviaId, onSuccess }) {
  const { user } = useContext(AuthContext)

  const [difficulty, setDifficulty] = useState('medium')
  const [soloFriendly, setSoloFriendly] = useState(false)
  const [crowdLevel, setCrowdLevel] = useState('moderate')
  const [vibe, setVibe] = useState('casual')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) {
      alert('You must be logged in to leave a review.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('trivia_reviews').insert({
      trivia_id: triviaId,
      user_id: user.id,
      difficulty,
      solo_friendly: soloFriendly,
      crowd_level: crowdLevel,
      vibe,
      comment: comment.trim() || null,
    })
    setSubmitting(false)
    if (error) {
      console.error('Error submitting review:', error)
      alert('Failed to submit review.')
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Difficulty */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Difficulty
        </label>
        <div className="flex gap-2">
          {['easy', 'medium', 'hard'].map((level) => (
            <label key={level} className="inline-flex items-center">
              <input
                type="radio"
                name="difficulty"
                value={level}
                checked={difficulty === level}
                onChange={() => setDifficulty(level)}
                className="form-radio"
                disabled={submitting}
              />
              <span className="ml-2 capitalize">{level}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Solo-friendly */}
      <div>
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={soloFriendly}
            onChange={(e) => setSoloFriendly(e.target.checked)}
            className="form-checkbox"
            disabled={submitting}
          />
          <span className="ml-2 text-sm">Good for solo players</span>
        </label>
      </div>

      {/* Crowd Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Crowd Level
        </label>
        <select
          value={crowdLevel}
          onChange={(e) => setCrowdLevel(e.target.value)}
          className="w-full border rounded px-3 py-2"
          disabled={submitting}
        >
          <option value="sparse">Sparse</option>
          <option value="moderate">Moderate</option>
          <option value="packed">Packed</option>
        </select>
      </div>

      {/* Vibe */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Vibe
        </label>
        <select
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          className="w-full border rounded px-3 py-2"
          disabled={submitting}
        >
          <option value="casual">Casual</option>
          <option value="competitive">Competitive</option>
          <option value="lively">Lively</option>
          <option value="laid-back">Laid-back</option>
        </select>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          How was it? <span className="text-xs text-gray-500">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="Share your thoughts…"
          disabled={submitting}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
