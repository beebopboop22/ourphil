// src/SignUpPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from './Navbar'
import { Helmet } from 'react-helmet'

export default function SignUpPage() {
  const navigate = useNavigate()

  // ── Form state ─────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Tag selection state ────────────────────────────────────
  const [tags, setTags] = useState([])
  const [selectedTags, setSelectedTags] = useState(new Set())

  // ── Pill configs for falling effect ───────────────────────
  const [pillConfigs, setPillConfigs] = useState([])

  // ── Color palette ─────────────────────────────────────────
  const colors = [
    '#22C55E', // green
    '#0D9488', // teal
    '#DB2777', // pink
    '#3B82F6', // blue
    '#F97316', // orange
    '#EAB308', // yellow
    '#8B5CF6', // purple
    '#EF4444', // red
  ]

  // Fetch tags on mount
  useEffect(() => {
    supabase
      .from('tags')
      .select('id,name,slug')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Error loading tags:', error)
        else {
          setTags(data || [])
          // generate a falling‐pill for each tag
          const configs = (data || []).map((t, i) => ({
            name: t.name,
            color: colors[i % colors.length],
            left: Math.random() * 100,              // percent across screen
            duration: 12 + Math.random() * 8,        // between 12s–20s
            delay: -Math.random() * 20               // start at random point
          }))
          setPillConfigs(configs)
        }
      })
  }, [])

  const toggleTag = id => {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Sign-up + save subscriptions ───────────────────────────
  const handleSignUp = async e => {
    e.preventDefault()
    if (!consent) {
      return alert('Please agree to our Privacy Policy before continuing.')
    }
    setLoading(true)

    // 1) Sign up
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + '/profile' },
    })
    if (signUpError) {
      setLoading(false)
      return alert(signUpError.message)
    }

    // 2) Store their tag-subscriptions
    const userId = authData.user.id
    if (selectedTags.size > 0) {
      const rows = Array.from(selectedTags).map(tag_id => ({ user_id: userId, tag_id }))
      const { error: subError } = await supabase
        .from('user_subscriptions')
        .insert(rows)
      if (subError) console.error('Error saving subscriptions:', subError)
    }

    setLoading(false)
    alert('✅ Check your inbox for a confirmation link!')
    navigate('/')
  }

  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1%20copy-min.png'

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <Helmet>
        <title>Create Account – Our Philly</title>
        <meta
          name="description"
          content="Sign up for Our Philly to heart your favorite events and get weekly digests."
        />
        <link rel="canonical" href="https://ourphilly.org/signup" />
      </Helmet>

      <Navbar />

      {/* falling pills background */}
      <div className="pill-container fixed inset-0 pointer-events-none">
        {pillConfigs.map((p, i) => (
          <span
            key={i}
            className="pill"
            style={{
              left: `${p.left}%`,
              backgroundColor: p.color,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          >
            #{p.name}
          </span>
        ))}
      </div>

      <div className="relative z-10 max-w-md mx-auto py-20 px-4">
        <img
          src={heartUrl}
          alt=""
          role="presentation"
          loading="lazy"
          className="absolute bottom-0 transform -translate-x-1/2 w-full opacity-20 pointer-events-none z-0"
        />

        <h1 className="mt-12 relative z-10 text-3xl sm:text-4xl md:text-5xl font-[Barrio] font-black mb-2 text-center">
          Sign up for your Digest
        </h1>
        <p className="relative z-10 mb-8 text-center text-gray-700">
          Plan your Philly life: save events, comment, and even host your own.
          Subscribe to hashtags for a custom once-a-week roundup.
        </p>

        <div className="relative z-10 mb-8 bg-indigo-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3 text-center">Why create an account?</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-700 text-left">
            <li>Save events to build your personal Plans list</li>
            <li>Follow hosts & tags for a weekly email digest</li>
            <li>Leave comments and reviews on events</li>
            <li>Post your own events or flyers</li>
          </ul>
          <div className="mt-4 p-4 bg-white rounded shadow">
            <p className="text-sm text-gray-500 mb-2">Sample Plans card</p>
            <div className="border rounded p-3">
              <div className="font-semibold">🎉 Parade on Market</div>
              <div className="text-xs text-gray-600">Jan 1 • 10:00 AM</div>
            </div>
          </div>
        </div>

        <form id="signup-form" onSubmit={handleSignUp} className="relative z-10 space-y-6 bg-white p-6 rounded-lg shadow-lg">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border rounded focus:outline-none"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border rounded focus:outline-none"
            />
          </div>

          {/* Consent */}
          <div className="flex items-center space-x-2">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="consent" className="text-sm text-gray-700">
              I agree to the{' '}
              <Link to="/privacy" target="_blank" className="text-indigo-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded text-white transition ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Signing up…' : 'Create Account'}
          </button>
        </form>

        <p className="relative z-10 mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>

      {/* inline styles for falling pills */}
      <style>{`
        .pill-container { z-index: 0; }
        .pill {
          position: absolute;
          top: -3rem;
          padding: .5rem 1rem;
          border-radius: 9999px;
          color: #fff;
          font-size: 1.25rem;
          white-space: nowrap;
          opacity: .9;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes fall {
          to { transform: translateY(110vh); }
        }
      `}</style>
    </div>
  )
}
