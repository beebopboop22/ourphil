// src/LoginPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';


export default function LoginPage() {
  const { user } = useContext(AuthContext);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const [traditions, setTraditions] = useState([]);
  const [groups, setGroups]         = useState([]);

  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) alert(error.message);
    else window.location.href = '/';
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setResetStatus('Enter your email above to receive a reset link.');
      return;
    }
    setResetStatus('');
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.ourphilly.org/update-password',
    });
    if (error) setResetStatus(`❌ ${error.message}`);
    else setResetStatus('✅ Password reset link sent. Check your inbox.');
    setResetting(false);
  };

  // load top 5 traditions
  useEffect(() => {
    (async () => {
      const { data: favs } = await supabase.from('event_favorites').select('event_id');
      const counts = favs.reduce((acc, { event_id }) => {
        acc[event_id] = (acc[event_id]||0) + 1;
        return acc;
      }, {});
      const topIds = Object.entries(counts)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5)
        .map(([id])=>id);
      if (!topIds.length) return setTraditions([]);
      const { data: ev } = await supabase
        .from('events')
        .select('id,"E Name","E Link"')
        .in('id', topIds);
      const byId = Object.fromEntries(ev.map(e=>[e.id,e]));
      setTraditions(topIds.map((id,i)=>({
        id,
        name: byId[id]?.['E Name']||'–',
        link: byId[id]?.['E Link']||'#',
        count: counts[id]||0
      })));
    })();
  }, []);

  // load top 5 groups
  useEffect(() => {
    (async () => {
      const { data: favs } = await supabase.from('favorites').select('group_id');
      const counts = favs.reduce((acc, { group_id }) => {
        acc[group_id] = (acc[group_id]||0) + 1;
        return acc;
      }, {});
      const topIds = Object.entries(counts)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5)
        .map(([id])=>id);
      if (!topIds.length) return setGroups([]);
      const { data: gs } = await supabase
        .from('groups')
        .select('id,Name,slug')
        .in('id', topIds);
      const byId = Object.fromEntries(gs.map(g=>[g.id,g]));
      setGroups(topIds.map((id,i)=>({
        id,
        name: byId[id]?.Name||'–',
        slug: byId[id]?.slug||'',
        count: counts[id]||0
      })));
    })();
  }, []);

  return (
    <div className="relative mt-52 flex flex-col items-center justify-center bg-white overflow-hidden">
      <Helmet>
        <title>Log In – Our Philly</title>
        <meta name="description" content="Log in to Our Philly to heart events, post group updates, and discover more of your city’s best community happenings." />
        <meta property="og:title" content="Log In – Our Philly" />
        <meta property="og:description" content="Access your Our Philly account to manage favorites, post reviews, and claim your community group." />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:image" content="https://your-default-image.png" />
        <link rel="canonical" href="https://ourphilly.org/login" />
        <link rel="icon" href="/favicon.ico" />
      </Helmet>
      <Navbar />

      {/* full-opacity heart */}
      <img
        src={heartUrl}
        alt="Heart"
        className="fixed right-1/2 w-1/2 h-auto opacity-100 transform -translate-x-1/3 pointer-events-none"
      />
    
      {/* login form */}
      <div className="relative z-10 mt-500 w-full max-w-lg py-20 px-6 bg-white">
        <h1 className="text-5xl font-[Barrio] font-black mb-6 text-left">Log In</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetting}
            className="w-full text-sm text-indigo-600 hover:underline"
          >
            {resetting ? 'Sending reset link…' : 'Forgot your password?'}
          </button>
          {resetStatus && (
            <p className="text-sm text-gray-600 text-center mt-2">{resetStatus}</p>
          )}
        </form>
      </div>

     


    </div>
  );
}
