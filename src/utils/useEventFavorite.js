import { useState, useEffect, useContext } from 'react'
import { supabase } from '../supabaseClient'
import { AuthContext } from '../AuthProvider'

export default function useEventFavorite({ event_id, source_table }) {
  const { user } = useContext(AuthContext)
  const [favId, setFavId] = useState(null)
  const [loading, setLoading] = useState(false)

  // Check if user has favorited
  useEffect(() => {
    if (!user || !event_id || !source_table) {
      setFavId(null)
      return
    }
    const uuidTables = ['big_board_events', 'recurring_events', 'group_events']
    const column = uuidTables.includes(source_table) ? 'event_uuid' : 'event_id'
    supabase
      .from('event_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_table', source_table)
      .eq(column, event_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) setFavId(data ? data.id : null)
      })
  }, [user, event_id, source_table])

  const toggleFavorite = async () => {
    if (!user || !event_id || !source_table) return
    setLoading(true)
    const uuidTables = ['big_board_events', 'recurring_events', 'group_events']
    const column = uuidTables.includes(source_table) ? 'event_uuid' : 'event_id'
    if (favId) {
      await supabase.from('event_favorites').delete().eq('id', favId)
      setFavId(null)
    } else {
      const { data } = await supabase
        .from('event_favorites')
        .insert([{ user_id: user.id, source_table, [column]: event_id }])
        .select('id')
        .single()
      if (data) setFavId(data.id)
    }
    setLoading(false)
  }

  return { isFavorite: Boolean(favId), favId, toggleFavorite, loading }
}
