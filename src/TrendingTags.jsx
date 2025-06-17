// src/TrendingTags.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'

const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
]

export default function TrendingTags() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tags')
      .select('name, slug')
      .limit(10)
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
    <div className="container mx-auto px-2 py-3 bg-white rounded-lg shadow-sm">
      <div className="flex items-center">
        {/* fixed label */}
        <span className="text-sm sm:text-xl font-bold text-gray-700 mr-4 flex-shrink-0">
          TRENDING TAGS:
        </span>

        {/* scrollable pills */}
        <div className="flex-1 flex overflow-x-auto whitespace-nowrap">
          {tags.map((tag, i) => (
            <Link
              key={tag.slug}
              to={`/tags/${tag.slug}`}
              className={`${pillStyles[i % pillStyles.length]} text-sm sm:text-xl font-semibold px-3 sm:px-4 py-1 mr-3 rounded-full flex-shrink-0 hover:opacity-80 transition`}
            >
              #{tag.name.toLowerCase()}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
