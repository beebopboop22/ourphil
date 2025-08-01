import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { AuthContext } from '../AuthProvider';

export default function useFollow(profileId) {
  const { user } = useContext(AuthContext);
  const [followId, setFollowId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !profileId) { setFollowId(null); return; }
    supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('followed_id', profileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) setFollowId(data ? data.id : null);
      });
  }, [user, profileId]);

  const toggleFollow = async () => {
    if (!user || !profileId) return;
    setLoading(true);
    if (followId) {
      await supabase.from('user_follows').delete().eq('id', followId);
      setFollowId(null);
    } else {
      const { data } = await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, followed_id: profileId })
        .select('id')
        .single();
      if (data) setFollowId(data.id);
    }
    setLoading(false);
  };

  return { isFollowing: Boolean(followId), toggleFollow, loading };
}
