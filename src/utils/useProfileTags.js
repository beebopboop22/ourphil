import { useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { AuthContext } from '../AuthProvider';

export default function useProfileTags(tagType = 'culture') {
  const { user } = useContext(AuthContext);
  const [tags, setTags] = useState([]);

  const fetchTags = async () => {
    if (!user) { setTags([]); return { error: null }; }
    const { data, error } = await supabase
      .from('profile_tags')
      .select('tag_id, culture_tags(id,name,emoji)')
      .eq('profile_id', user.id)
      .eq('tag_type', tagType);
    if (!error) {
      const mapped = (data || []).map(r => r.culture_tags).filter(Boolean);
      setTags(mapped);
    }
    return { error };
  };

  useEffect(() => { fetchTags(); }, [user, tagType]);

  const saveTags = async ids => {
    if (!user) return { error: { message: 'No user' } };
    const { error: delError } = await supabase
      .from('profile_tags')
      .delete()
      .eq('profile_id', user.id)
      .eq('tag_type', tagType);
    const inserts = ids.map(id => ({ profile_id: user.id, tag_id: id, tag_type: tagType }));
    const { error: insError } = await supabase.from('profile_tags').insert(inserts);
    await fetchTags();
    return { error: delError || insError };
  };

  return { tags, saveTags, refresh: fetchTags };
}
