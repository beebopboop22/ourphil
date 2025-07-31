import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { AuthContext } from '../AuthProvider';

export default function useProfile() {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);

  const refresh = async () => {
    if (!user) {
      setProfile(null);
      return { data: null, error: null };
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (!error) setProfile(data);
    return { data, error };
  };

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .upsert({ id: user.id })
        .select('*')
        .single();
      setProfile(data);
    })();
  }, [user]);

  const updateProfile = async updates => {
    if (!user) return { error: { message: 'No user' } };
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (!error) setProfile(data);
    return { data, error };
  };

  return { profile, updateProfile, refresh };
}
