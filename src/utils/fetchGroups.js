// src/utils/fetchGroups.js
import { supabase } from '../supabaseClient';

export const fetchGroups = async () => {
  const { data, error, status } = await supabase.from('groups').select('*');
  if (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
  console.log('Fetched groups (status ' + status + '):', data);
  return data;
};
