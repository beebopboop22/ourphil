// src/Unsubscribe.jsx
import React, { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { Helmet } from 'react-helmet'

export default function Unsubscribe() {
  const [status, setStatus] = useState('loading')
  const { search } = useLocation()

  useEffect(() => {
    const token = new URLSearchParams(search).get('token')
    if (!token) {
      setStatus('error')
      return
    }

    // call our Edge Function which runs with service‑role key
    fetch(
      `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/unsubscribe?token=${token}`,
      { method: 'POST' }
    )
      .then(res => {
        if (res.ok) setStatus('success')
        else setStatus('error')
      })
      .catch(() => {
        setStatus('error')
      })
  }, [search])

  return (
    <>
      <Helmet>
        <title>Unsubscribe – Our Philly</title>
        <meta name="description" content="You’ve been unsubscribed from our newsletter." />
      </Helmet>

      <Navbar />

      <div className="max-w-md mx-auto py-20">
        {status === 'loading' && (
          <div className="text-center">
            <h1 className="text-4xl font-[Barrio] mb-4">Processing…</h1>
            <p>Please wait while we remove you from our newsletter.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600">
            <h1 className="text-4xl font-[Barrio] mb-4">Oops!</h1>
            <p>Unable to unsubscribe—invalid or expired link.</p>
            <Link to="/" className="text-indigo-600 hover:underline mt-4 inline-block">
              Return Home
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <h1 className="text-4xl font-[Barrio] mb-4 text-green-700">Unsubscribed</h1>
            <p>You’ve been removed from our daily digest.</p>
            <Link to="/" className="text-indigo-600 hover:underline mt-4 inline-block">
              Back to Our Philly
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </>
  )
}
