// src/utils/seasonalFavorites.js
import { supabase } from '../supabaseClient'

// fetch all { seasonal_event_id, id } for the current user
export async function getMySeasonalFavorites() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('seasonal_event_favorites')
    .select('seasonal_event_id,id')
    .eq('user_id', user.id)

  if (error) throw error
  return data
}

// insert a new heart on seasonal event, and return the new row
export async function addSeasonalFavorite(eventId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('not logged in')

  // chaining .select() and .single() to return the inserted row immediately
  const response = await supabase
    .from('seasonal_event_favorites')
    .insert([{ seasonal_event_id: eventId, user_id: user.id }])
    .select('id,seasonal_event_id,user_id')
    .single()

  if (response.error) throw response.error
  return response.data
}

// remove an existing heart by its favorite.id, return the deleted row
export async function removeSeasonalFavorite(favId) {
  const response = await supabase
    .from('seasonal_event_favorites')
    .delete()
    .eq('id', favId)
    .select('id,seasonal_event_id,user_id')
    .single()

  if (response.error) throw response.error
  return response.data
}
