// src/AuthProvider.jsx
import React, { createContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export const AuthContext = createContext({
  session: null,
  user: null,
  isAdmin: false,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser]       = useState(null);

  useEffect(() => {
    // on mount, get initial session & user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // only bill@solar-states.com is treated as admin
  const isAdmin = user?.email === 'bill@solar-states.com';

  return (
    <AuthContext.Provider value={{ session, user, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
