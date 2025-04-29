// src/EventDetailPage.jsx
import React, { useEffect, useState, useContext } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import { AuthContext } from './AuthProvider'
import {
  getMyEventFavorites,
  addEventFavorite,
  removeEventFavorite,
} from './utils/eventFavorites'

export default function EventDetailPage() {
  const { slug } = useParams()
  const { user } = useContext(AuthContext)

  const [event, setEvent]       = useState(null)
  const [favCount, setFavCount] = useState(0)
  const [myFavId, setMyFavId]   = useState(null)
  const [toggling, setToggling] = useState(false)

  const [reviews, setReviews]       = useState([])
  const [rating, setRating]         = useState(5)
  const [comment, setComment]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  // fetch event by slug
  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setEvent(data)
      })
  }, [slug])

  // fetch fav count & my fav id
  useEffect(() => {
    if (!event) return
    supabase
      .from('event_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .then(({ count }) => setFavCount(count || 0))

    if (user) {
      getMyEventFavorites().then(rows => {
        const mine = rows.find(r => r.event_id === event.id)
        setMyFavId(mine?.id ?? null)
      })
    } else {
      setMyFavId(null)
    }
  }, [event, user])

  // load reviews
  const loadReviews = () => {
    supabase
      .from('reviews')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setReviews(data)
      })
  }
  useEffect(() => {
    if (event) loadReviews()
  }, [event])

  // toggle heart
  const toggleFav = async () => {
    if (!user || !event) return
    setToggling(true)
    if (myFavId) {
      await removeEventFavorite(myFavId)
      setMyFavId(null)
      setFavCount(c => c - 1)
    } else {
      const newRow = await addEventFavorite(event.id)
      setMyFavId(newRow.id)
      setFavCount(c => c + 1)
    }
    setToggling(false)
  }

  // submit new review
  const handleSubmit = async e => {
    e.preventDefault()
    if (!user) return alert('Log in to leave a review.')
    setSubmitting(true)
    const { error } = await supabase
      .from('reviews')
      .insert({ event_id: event.id, user_id: user.id, rating, comment })
    setSubmitting(false)
    if (error) console.error(error)
    else {
      setComment(''); setRating(5); loadReviews()
    }
  }

  const alreadyReviewed = user && reviews.some(r => r.user_id === user.id)

  if (!event) return <div className="text-center py-20 text-gray-500">Loading…</div>

  // format date nicely
  const formattedDate = new Date(event.Dates).toLocaleDateString('en-US',{
    month: 'long', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />

      {/* Hero with image, title, big date, heart */}
      <div className="w-full bg-gray-100 border-b border-gray-300 py-10 px-4 mb-16">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row gap-8 items-center">
          {event['E Image'] && (
            <div className="w-40 h-40 flex-shrink-0">
              <img
                src={event['E Image']}
                alt={event['E Name']}
                className="w-full h-full object-cover rounded-2xl border-4 border-indigo-100"
              />
            </div>
          )}
          <div className="flex-grow text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-4">
              <h1 className="text-4xl font-[Barrio] text-gray-900">{event['E Name']}</h1>
              <button
                onClick={toggleFav}
                disabled={toggling}
                className="flex items-center space-x-1 text-xl"
              >
                <span>{myFavId ? '❤️' : '🤍'}</span>
                <span className="font-[Barrio] text-2xl">{favCount}</span>
              </button>
            </div>
            {/* large date */}
            <p className="text-lg text-gray-700 mt-2">{formattedDate}</p>
            {/* description */}
            <p className="text-gray-600 mt-4">{event['E Description']}</p>
            <a
              href={event['E Link']}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-full mt-4"
            >
              Visit Event Site
            </a>
          </div>
        </div>
      </div>

      {/* Reviews — full-width */}
      <main className="flex-grow mb-40 py-4 px-4">
        <h2 className="text-2xl font-[Barrio] mb-4">Reviews</h2>

        <div className="space-y-6">
          {reviews.map(r => (
            <div key={r.id} className="bg-white shadow-md rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-800">
                  {r.user_id === user?.id ? 'You' : 'Anonymous'}
                </span>
                <span className="text-yellow-500 text-xl font-[Barrio]">
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </span>
              </div>
              <p className="text-gray-700 mb-3">{r.comment}</p>
              <div className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          )}
        </div>

        {user ? (
          alreadyReviewed ? (
            <p className="mt-6 text-center text-gray-600">
              You’ve already reviewed this tradition.
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 bg-white p-6 rounded-xl shadow-md space-y-6"
            >
              <div>
                <label className="block text-sm font-medium mb-2">Your Rating</label>
                <div className="flex space-x-2">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`text-2xl ${
                        n <= rating ? 'text-yellow-500' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  rows={4}
                  placeholder="Share your experience…"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition"
              >
                {submitting ? 'Posting…' : 'Post Review'}
              </button>
            </form>
          )
        ) : (
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="text-indigo-600 hover:underline">
              Log in
            </Link>{' '}
            to leave a review.
          </p>
        )}
      </main>

      <Footer />
    </div>
  )
}
