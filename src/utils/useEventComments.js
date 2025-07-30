import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { AuthContext } from '../AuthProvider';

export default function useEventComments({ source_table, event_id }) {
  const { user } = useContext(AuthContext);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const fetchComments = async () => {
    if (!source_table || !event_id) {
      setComments([]);
      return;
    }
    setLoading(true);
    let query = supabase
      .from('event_comments')
      .select('*')
      .eq('source_table', source_table)
      .order('created_at', { ascending: false });
    if (source_table === 'all_events') query = query.eq('event_int_id', event_id);
    else query = query.eq('event_id', event_id);
    const { data, error } = await query;
    if (!error) setComments(data || []);
    setLoading(false);
  };

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
    const { data, error } = await supabase
      .from('event_comments')
      .insert([payload])
      .select('*')
      .single();
    if (!error && data) {
      setComments(prev => [data, ...prev]);
    }
    return { data, error };
  };

  const editComment = async (id, content) => {
    const text = content.trim();
    if (!user || !text) return;
    if (hasProfanity(text)) {
      return { error: { message: 'Inappropriate language detected' } };
    }
    const { data, error } = await supabase
      .from('event_comments')
      .update({ content: text })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (!error && data) {
      setComments(prev => prev.map(c => (c.id === id ? data : c)));
    }
    return { data, error };
  };

  const deleteComment = async id => {
    if (!user) return;
    const { error } = await supabase
      .from('event_comments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (!error) {
      setComments(prev => prev.filter(c => c.id !== id));
    }
    return { error };
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
