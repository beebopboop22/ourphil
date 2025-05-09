// src/SignUpPage.jsx
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from './Navbar';
import { Helmet } from 'react-helmet';

export default function SignUpPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!consent) {
      return alert('Please agree to our Privacy Policy before continuing.');
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/welcome',
      },
    });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert('✅ Check your inbox for a confirmation link!');
      navigate('/');
    }
  };

  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//OurPhilly-CityHeart-1%20copy-min.png';

  return (
    <div className="relative min-h-screen bg-white">
      <Helmet>
        <title>Create Account – Our Philly</title>
        <meta
          name="description"
          content="Sign up for Our Philly to heart your favorite events and groups, post updates, and explore everything Philly has to offer."
        />
        <meta property="og:title" content="Sign Up – Our Philly" />
        <meta
          property="og:description"
          content="Join Our Philly to discover local events, leave reviews, claim your community group, and more."
        />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:image" content="https://your-default-image.png" />
        <link rel="canonical" href="https://ourphilly.com/signup" />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>

      <Navbar />

      <div className="relative z-10 max-w-md mx-auto py-20 px-4">
        {/* background heart inside the card container */}
        <img
          src={heartUrl}
          alt=""
          className="absolute bottom-0 transform -translate-x-1/2 w-full opacity-20 pointer-events-none z-0"
        />

        <h1 className="mt-12 relative z-10 text-3xl sm:text-4xl md:text-5xl font-[Barrio] font-black mb-6 text-center">
          Sign up HERE
        </h1>

        <form onSubmit={handleSignUp} className="relative z-10 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border rounded focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border rounded focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="consent" className="text-sm text-gray-700">
              I’ve read and agree to the{' '}
              <Link
                to="/privacy"
                target="_blank"
                className="text-indigo-600 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded text-white transition ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
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
    </div>
  );
}
