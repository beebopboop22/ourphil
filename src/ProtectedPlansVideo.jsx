import React, { useContext, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import UpcomingPlansVideo from './UpcomingPlansVideo.jsx';
import { AuthContext } from './AuthProvider.jsx';
import { supabase } from './supabaseClient.js';

export default function ProtectedPlansVideo() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);
  const [userSlug, setUserSlug] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSlug() {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('slug')
        .eq('id', user.id)
        .single();
      if (!error) {
        setUserSlug(data?.slug);
      }
      setLoading(false);
    }
    fetchSlug();
  }, [user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return null;
  }

  if (userSlug !== slug) {
    return <div>Not authorized</div>;
  }

  return <UpcomingPlansVideo />;
}
