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
      if (/^https?:/.test(profile.image_url)) {
        img = profile.image_url
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(profile.image_url)
        img = publicUrl
      }
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
      .select(`*, profiles (username, image_url) `)
      .eq('source_table', source_table)
      .order('created_at', { ascending: false })
    if (source_table === 'all_events') query = query.eq('event_int_id', event_id)
    else query = query.eq('event_id', event_id)
    const { data, error } = await query
    if (!error) {
      const rows = data || []
      const profileIds = Array.from(new Set(rows.map(r => r.user_id)))
      const { data: tagRows } = await supabase
        .from('profile_tags')
        .select('profile_id,tag_id')
        .in('profile_id', profileIds)
        .eq('tag_type', 'culture')
      let cultById = {}
      if (tagRows?.length) {
        const ids = Array.from(new Set(tagRows.map(t => t.tag_id)))
        const { data: cultures } = await supabase
          .from('culture_tags')
          .select('id,emoji')
          .in('id', ids)
        cultById = Object.fromEntries((cultures || []).map(c => [c.id, c.emoji]))
      }
      const profileCultures = {}
      tagRows?.forEach(t => {
        const emoji = cultById[t.tag_id]
        if (!emoji) return
        if (!profileCultures[t.profile_id]) profileCultures[t.profile_id] = []
        profileCultures[t.profile_id].push(emoji)
      })
      setComments(rows.map(c => transform({
        ...c,
        profiles: {
          ...c.profiles,
          profile_tags: (profileCultures[c.user_id] || []).map(e => ({ tag_type: 'culture', culture_tags: { emoji: e } }))
        }
      })))
    }
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
