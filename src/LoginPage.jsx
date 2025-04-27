// src/LoginPage.jsx
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';


export default function LoginPage() {
  const [email, setEmail] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert(error.message);
    } else {
      alert('✅ Check your email for the magic link!');
    }
  };

  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU';

  return (

    <div className="relative min-h-screen flex items-center justify-center bg-white overflow-hidden">
          <Navbar />   

      {/* Giant heart background */}
      <img
          src={heartUrl}
          alt="Heart"
          className="absolute left-1/2 w-full h-auto opacity-100"
        />

      {/* Foreground form */}
      <div className="relative z-10 w-full max-w-md py-20 px-6">
      <h1 className="text-5xl font-[Barrio] font-black mb-6 mt-10 text-left">Log in</h1>
      <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:outline-none"
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
          >
            Send Magic Link
          </button>
        </form>
      </div>
    </div>
  );
}
