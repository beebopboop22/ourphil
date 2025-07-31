import { useState, useEffect, useContext } from 'react'
import { supabase } from '../supabaseClient'
import { AuthContext } from '../AuthProvider'

export default function useEventComments({ source_table, event_id }) {
  const { user } = useContext(AuthContext);
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)

  const BAD_WORDS = [
    'fuck',
    'shit',
    'bitch',
    'asshole',
    'nigger',
    'nigga',
    'cunt',
    'faggot',
    'bastard',
  ];

  const hasProfanity = text => {
    const lower = text.toLowerCase();
    return BAD_WORDS.some(w => lower.includes(w));
  };

  const transform = c => {
    const profile = c.profiles || {}
    let img = ''
    if (profile.image_url) {
      const { data: { publicUrl } } = supabase
        .from('profile-images')
        .getPublicUrl(profile.image_url)
      img = publicUrl
    }
    const cultures = (profile.profile_tags || [])
      .filter(t => t.tag_type === 'culture')
      .map(t => t.culture_tags?.emoji)
      .filter(Boolean)
    return {
      ...c,
      username: profile.username,
      profileImage: img,
      cultures,
    }
  }

  const fetchComments = async () => {
    if (!source_table || !event_id) {
      setComments([])
      return
    }
    setLoading(true)
    let query = supabase
      .from('event_comments')
      .select(`
        *,
        profiles (
          username,
          image_url,
          profile_tags (
            tag_type,
            culture_tags ( emoji )
          )
        )
      `)
      .eq('source_table', source_table)
      .order('created_at', { ascending: false })
    if (source_table === 'all_events') query = query.eq('event_int_id', event_id)
    else query = query.eq('event_id', event_id)
    const { data, error } = await query
    if (!error) setComments((data || []).map(transform))
    setLoading(false)
  }

  useEffect(() => {
    fetchComments();
  }, [source_table, event_id]);

  const addComment = async content => {
    const text = content.trim();
    if (!user || !text) return;
    if (hasProfanity(text)) {
      return { error: { message: 'Inappropriate language detected' } };
    }
    const payload = {
      user_id: user.id,
      source_table,
      content: text,
      ...(source_table === 'all_events'
        ? { event_int_id: event_id }
        : { event_id }),
    };
    const { error } = await supabase
      .from('event_comments')
      .insert([payload])
    if (!error) await fetchComments()
    return { error }
  };

  const editComment = async (id, content) => {
    const text = content.trim();
    if (!user || !text) return;
    if (hasProfanity(text)) {
      return { error: { message: 'Inappropriate language detected' } };
    }
    const { error } = await supabase
      .from('event_comments')
      .update({ content: text })
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetchComments()
    return { error }
  };

  const deleteComment = async id => {
    if (!user) return;
    const { error } = await supabase
      .from('event_comments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (!error) await fetchComments()
    return { error }
  };

  return {
    comments,
    addComment,
    editComment,
    deleteComment,
    loading,
    refresh: fetchComments,
  };
}
