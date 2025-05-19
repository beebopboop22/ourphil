// src/GroupsPageHero.jsx
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import { Link } from 'react-router-dom'

export default function GroupsPageHero() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // slugify for links
  const slugify = (text) =>
    text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  // 1) Fetch all groups & build a map[type] → first group with that type
  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('Type, Name, imag, slug')
      if (error) {
        console.error('GroupsPageHero load error:', error)
        setLoading(false)
        return
      }
      const map = {}
      data.forEach(g => {
        const types = (g.Type || '').split(',')
          .map(t => t.trim())
          .filter(Boolean)
        types.forEach(type => {
          if (!map[type]) {
            map[type] = { type, group: g }
          }
        })
      })
      const arr = Object.values(map)
      // optional: sort by type
      arr.sort((a, b) => a.type.localeCompare(b.type))
      setItems(arr)
      setLoading(false)
    })()
  }, [])

  // 2) Auto-advance every 1.75s
  useEffect(() => {
    if (!items.length) return
    const iv = setInterval(() => {
      setCurrentIndex(i => (i + 1) % items.length)
    }, 1750)
    return () => clearInterval(iv)
  }, [items])

  // 3) Scroll on index change
  useEffect(() => {
    const el = containerRef.current
    if (el) {
      const w = el.clientWidth
      el.scrollTo({ left: currentIndex * w, behavior: 'smooth' })
    }
  }, [currentIndex])

  return (
    <>
      <div className="h-[calc(80vh-112px)] overflow-hidden">
        {loading ? (
          <p className="text-center py-20">Loading…</p>
        ) : (
          <div ref={containerRef} className="flex w-full h-full overflow-hidden">
            {items.map(({ type, group }) => (
              <Link
                key={type}
                to={`/groups/type/${slugify(type)}`}
                className="relative w-full flex-shrink-0"
              >
                {/* backdrop image */}
                <img
                  src={group.imag}
                  alt={type}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* dark gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Type label */}
                <h3 className="absolute bottom-24 left-4 right-4 text-center text-white text-5xl font-[Barrio] font-bold z-20 leading-tight">
                  {type}
                </h3>

                {/* Group name */}
                <span className="absolute bottom-16 left-4 right-4 text-center text-white text-lg z-20">
                  {group.Name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* bottom bar + iceberg heart */}
      <div className="relative">
        <div className="bg-[#28313e] text-white py-3 text-center font-[Barrio] text-2xl">
          Dig Into Philly
        </div>
        
      </div>
    </>
  )
}
