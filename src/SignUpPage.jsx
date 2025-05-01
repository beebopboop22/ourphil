// src/SignUpPage.jsx
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';


export default function SignUpPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    // signUp will send a confirmation email by default
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/welcome'  // optional
      }
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
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU';


  return (
    <div className="max-w-md mx-auto py-20">
                  <Navbar />   


         {/* Giant heart background */}
         <img
          src={heartUrl}
          alt="Heart"
          className="fixed bottom-0 w-1/2 h-1/2 object-contain -z-10"
        />
        <h1 className="text-5xl font-[Barrio] font-black mt-10 text-center">Enter the City</h1>
        <p className="text-xl font-[Barrio] font-black mb-6 text-center">Sign up here, all welcome</p>

<form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:outline-none"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:outline-none"
            placeholder="••••••••"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
        >
          {loading ? 'Signing up…' : 'Create Account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/login" className="text-indigo-600 hover:underline">
          Log in
        </a>
      </p>
    </div>
    
  );
}
