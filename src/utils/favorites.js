// src/utils/favorites.js
import { supabase } from '../supabaseClient'

// insert a new heart
export async function addFavorite(groupId) {
  // you must await getUser() to get the user object
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  // return the inserted row (use .select() to get it back)
  const { data, error } = await supabase
    .from('favorites')
    .insert([{ group_id: groupId, user_id: user.id }])
    .select()
  if (error) throw error
  return { data }
}

// remove an existing heart by its favorites.id
export async function removeFavorite(favId) {
  const { data, error } = await supabase
    .from('favorites')
    .delete()
    .eq('id', favId)
    .select()
  if (error) throw error
  return { data }
}

// fetch all favorites for the signed-in user
export async function getMyFavorites() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) return []

  const { data, error } = await supabase
    .from('favorites')
    .select('group_id, id')
    .eq('user_id', user.id)
  if (error) throw error
  return data
}
