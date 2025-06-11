// src/TrendingTags.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'

const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
]

export default function TrendingTags() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tags')
      .select('name, slug')
      .limit(3)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading trending tags:', error)
          setTags([])
        } else {
          setTags(data)
        }
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="text-center py-2 text-gray-500">Loading trending tags…</p>
  }
  if (!tags.length) return null

  return (
    <div className="flex justify-center px-2 py-3 bg-white rounded-lg shadow-sm">
      <span className="text-xl font-bold text-gray-700 mr-3 mt-1">TRENDING TAGS:</span>
      {tags.map((tag, i) => (
        <Link
          key={tag.slug}
          to={`/tags/${tag.slug}`}
          className={`
            ${pillStyles[i % pillStyles.length]}
            text-xl font-semibold
            px-4 py-1 rounded-full
            hover:opacity-80
            transition
          `}
        >
          #{tag.name.toLowerCase()}
        </Link>
      ))}
    </div>
  )
}
