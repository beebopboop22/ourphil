// src/utils/eventFavorites.js
import { supabase } from '../supabaseClient'

// fetch all { event_id, id } for the current user
export async function getMyEventFavorites() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('event_favorites')
    .select('event_id,id')
    .eq('user_id', user.id)
  if (error) throw error
  return data
}

// insert a new heart on event, and return the new row
export async function addEventFavorite(eventId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('not logged in')

  // by chaining .select() we force Supabase to return the inserted row
  const response = await supabase
    .from('event_favorites')
    .insert([{ event_id: eventId, user_id: user.id }])
    .select('id,event_id,user_id')
    .single()     // we know it's exactly one row
  if (response.error) throw response.error
  return response.data
}

// remove an existing heart by its favorite.id
export async function removeEventFavorite(favId) {
  // also return the deleted row if you like:
  const response = await supabase
    .from('event_favorites')
    .delete()
    .eq('id', favId)
    .select('id,event_id,user_id')
    .single()
  if (response.error) throw response.error
  return response.data
}
