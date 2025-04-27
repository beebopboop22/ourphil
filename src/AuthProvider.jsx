// src/AuthProvider.jsx
import React, { createContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export const AuthContext = createContext({
  session: null,
  user: null,
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

    // listen for changes
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

  return (
    <AuthContext.Provider value={{ session, user }}>
      {children}
    </AuthContext.Provider>
  );
}
