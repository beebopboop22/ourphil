import React, { useEffect, useState, useContext } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import { AuthContext } from './AuthProvider'

/**
 * BigBoardEventPage
 * -----------------
 * Detailed view of a single Big Board event with edit/delete for owners.
 */
export default function BigBoardEventPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)

  const [event, setEvent]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData]   = useState({ title: '', start_date: '', end_date: '' })
  const [saving, setSaving]       = useState(false)

  // Parse "YYYY-MM-DD" as local Date at midnight
  function parseLocalYMD(str) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  useEffect(() => {
    fetchEvent()
  }, [slug])

  async function fetchEvent() {
    setLoading(true)
    setError(null)

    // 1) fetch event metadata
    const { data: ev, error: evErr } = await supabase
      .from('big_board_events')
      .select('id, post_id, title, start_date, end_date, created_at, slug')
      .eq('slug', slug)
      .single()

    if (evErr) {
      console.error(evErr)
      setError('Could not load event.')
      setLoading(false)
      return
    }

    // 2) fetch flyer post (to get image and owner)
    const { data: post, error: postErr } = await supabase
      .from('big_board_posts')
      .select('image_url, user_id')
      .eq('id', ev.post_id)
      .single()

    if (postErr) {
      console.error(postErr)
      setError('Could not load flyer.')
      setLoading(false)
      return
    }

    // 3) resolve storage URL
    const { data: { publicUrl } } = await supabase
      .storage.from('big-board')
      .getPublicUrl(post.image_url)

    setEvent({ ...ev, imageUrl: publicUrl, owner_id: post.user_id })
    setLoading(false)
  }

  // Start editing
  function startEditing() {
    setFormData({
      title: event.title,
      start_date: event.start_date || '',
      end_date: event.end_date || ''
    })
    setIsEditing(true)
  }

  // Handle form input changes
  function handleChange(e) {
    const { name, value } = e.target
    setFormData(fd => ({ ...fd, [name]: value }))
  }

  // Save edits
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('big_board_events')
      .update(formData)
      .eq('id', event.id)
      .select()
      .single()
    setSaving(false)
    if (error) {
      alert('Error saving event: ' + error.message)
    } else {
      setEvent({ ...event, ...data })
      setIsEditing(false)
    }
  }

  // Delete event
  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event?')) return
    const { error } = await supabase
      .from('big_board_events')
      .delete()
      .eq('id', event.id)
    if (error) {
      alert('Error deleting event: ' + error.message)
    } else {
      navigate('/board')
    }
  }

  if (loading) return <div className="py-20 text-center">Loading…</div>
  if (error)   return <div className="py-20 text-center text-red-600">{error}</div>
  if (!event)  return <div className="py-20 text-center">Event not found.</div>

  // Format display dates
  const startDate = parseLocalYMD(event.start_date)
  const endDate   = event.end_date ? parseLocalYMD(event.end_date) : null
  const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const end   = endDate
    ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow bg-white pt-20 pb-12 px-4">
        <div className="relative max-w-md mx-auto space-y-6">

          {/* Heart background */}
          <img
            src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-2.png"
            aria-hidden
            className="absolute top-1/2 left-1/2 w-96 -translate-x-1/2 -translate-y-1/3 opacity-10 pointer-events-none z-0"
          />

          {/* Badge */}
          <div className="relative flex items-center ml-[-1rem] z-10">
            <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png"
              alt="Community submission"
              className="w-14 h-14"
            />
            <span className="ml-2 bg-yellow-100 text-yellow-800 text-base font-bold uppercase px-3 py-1 rounded-full">
              STRANGER SUBMISSION
            </span>
          </div>

          {/* Edit/Delete buttons for owner */}
          {event.owner_id === user?.id && !isEditing && (
            <div className="flex justify-end space-x-2 z-10">
              <button onClick={startEditing} className="bg-indigo-600 text-white px-4 py-1 rounded hover:bg-indigo-700">
                Edit
              </button>
              <button onClick={handleDelete} className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700">
                Delete
              </button>
            </div>
          )}

          {/* Edit Form */}
          {isEditing ? (
            <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-lg space-y-4 z-10">
              <div>
                <label className="block text-sm font-bold mb-1">Title</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">End Date (optional)</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date || ''}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded border">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            /* Display Mode */
            <>              
              {/* Flyer Image */}
              <div className="relative w-full h-full overflow-hidden rounded-lg shadow-lg z-10">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
              </div>

              {/* Title & Dates */}
              <h1 className="text-3xl font-[Barrio] font-bold z-10">{event.title}</h1>
              <p className="text-gray-700 z-10">
                {end ? `${start} — ${end}` : start}
              </p>
              <p className="text-gray-400 text-sm z-10">
                Posted on {new Date(event.created_at).toLocaleDateString()}
              </p>

              {/* Navigation */}
              <div className="flex flex-col gap-3 mt-6 z-10">
                <Link
                  to="/board"
                  className="bg-indigo-600 text-white text-center py-2 rounded hover:bg-indigo-700"
                >
                  ← Back to Big Board
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
