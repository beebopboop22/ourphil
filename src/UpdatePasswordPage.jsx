// /src/UpdatePasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // Wait for Supabase to verify token from hash
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('access_token')) {
      setStatus('❌ Invalid or expired link.');
      return;
    }

    // Supabase will handle auth session from URL
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  const handleSubmit = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus(`❌ ${error.message}`);
    } else {
      setStatus('✅ Password updated. Redirecting...');
      setTimeout(() => navigate('/profile'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Reset Your Password</h1>
        {!ready ? (
          <p className="text-gray-600">Validating link…</p>
        ) : (
          <>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border p-2 mb-4 rounded"
            />
            <button
              onClick={handleSubmit}
              className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
            >
              Update Password
            </button>
          </>
        )}
        {status && <p className="mt-4 text-sm text-gray-700">{status}</p>}
      </div>
    </div>
  );
}
