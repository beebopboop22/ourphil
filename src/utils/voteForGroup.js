// src/utils/voteForGroup.js
import { supabase } from '../supabaseClient';

export const voteForGroup = async (groupId) => {
  const { data, error } = await supabase
    .from('groups')
    .update({ Votes: supabase.raw('"Votes" + 1') })
    .eq('id', groupId)
    .select();

  if (error) {
    console.error('Error voting:', error);
    return null;
  }

  return data;
};
