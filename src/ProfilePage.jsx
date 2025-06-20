// src/ProfilePage.jsx
import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'
import Navbar from './Navbar'
import Footer from './Footer'

export default function ProfilePage() {
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  // ── Tag subscriptions ────────────────────────────────────
  const [allTags, setAllTags] = useState([])
  const [subs, setSubs] = useState(new Set())

  // ── Account settings ─────────────────────────────────────
  const [email, setEmail] = useState('')
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState('')
  const [deleting, setDeleting] = useState(false)

  // ── Styles for tag pills ─────────────────────────────────
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

  // ── Load initial data ────────────────────────────────────
  useEffect(() => {
    if (!user) return
    setEmail(user.email)

    // all tags
    supabase
      .from('tags')
      .select('id,name,slug')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setAllTags(data || [])
      })

    // user's subscriptions
    supabase
      .from('user_subscriptions')
      .select('tag_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setSubs(new Set((data || []).map(r => r.tag_id)))
      })
  }, [user])

  // ── Toggle one tag subscription ──────────────────────────
  const toggleSub = async (tagId) => {
    if (!user) return
    if (subs.has(tagId)) {
      await supabase
        .from('user_subscriptions')
        .delete()
        .match({ user_id: user.id, tag_id: tagId })
      setSubs(s => { s.delete(tagId); return new Set(s) })
    } else {
      await supabase
        .from('user_subscriptions')
        .insert({ user_id: user.id, tag_id: tagId })
      setSubs(s => new Set(s).add(tagId))
    }
  }

  // ── Account actions ─────────────────────────────────────
  const updateEmail = async () => {
    setUpdating(true)
    setStatus('')
    const { error } = await supabase.auth.updateUser({ email })
    if (error) setStatus(`❌ ${error.message}`)
    else setStatus('✅ Check your inbox to confirm email change.')
    setUpdating(false)
  }

  const sendPasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.ourphilly.org/update-password',
    })
    if (error) alert('Error: ' + error.message)
    else alert('Password reset link sent.')
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account permanently?')) return
    setDeleting(true)
    const { error } = await supabase.functions.invoke('delete_user_account')
    if (error) {
      alert('Could not delete: ' + error.message)
      setDeleting(false)
    } else {
      await supabase.auth.signOut()
      navigate('/')
    }
  }

  // ── If not logged in ────────────────────────────────────
  if (!user) {
    return (
      <>
        <Navbar />
        <div className="py-20 text-center text-gray-600">
          Please{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            log in
          </Link>{' '}
          to manage your subscriptions.
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <Navbar />

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="max-w-screen-md mx-auto px-4 py-12 space-y-12">

        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl mt-24 font-[Barrio] text-indigo-900 mb-2">
            Your Email Digests
          </h1>
          <p className="text-gray-700">
            Pick the topics you want delivered in your once-a-week roundup.
          </p>
        </header>

        {/* Tag selector */}
        <section>
          <div className="flex flex-wrap justify-center gap-4">
            {allTags.map((tag, i) => {
              const selected = subs.has(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleSub(tag.id)}
                  className={`
                    ${pillStyles[i % pillStyles.length]}
                    px-6 py-3 text-lg font-bold rounded-full
                    transition transform hover:scale-105
                    ${selected
                      ? 'border-4 border-indigo-700'
                      : 'opacity-60 hover:opacity-80'
                    }
                  `}
                >
                  #{tag.name}
                </button>
              )
            })}
          </div>
        </section>

        {/* Account settings */}
        <section className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Account Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={updateEmail}
                disabled={updating}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
              >
                Update Email
              </button>
              <button
                onClick={sendPasswordReset}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition"
              >
                Reset Password
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
              >
                {deleting ? 'Deleting…' : 'Delete My Account'}
              </button>
            </div>
            {status && (
              <p className="text-sm text-gray-700">{status}</p>
            )}
          </div>
        </section>

      </div>

      <Footer />
    </div>
  )
}
