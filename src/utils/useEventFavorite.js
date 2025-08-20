/* global window, CustomEvent */
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../supabaseClient'
import { AuthContext } from '../AuthProvider'

export default function useEventFavorite({ event_id, source_table }) {
  const { user } = useContext(AuthContext)
  const [favId, setFavId] = useState(null)
  const [loading, setLoading] = useState(false)

  // Check if user has favorited
  const fetchFavorite = () => {
    if (!user || !event_id || !source_table) {
      setFavId(null)
      return
    }
    let column = 'event_id'
    if (source_table === 'all_events') column = 'event_int_id'
    else if (source_table === 'sg_events') column = 'event_uuid'
    supabase
      .from('event_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_table', source_table)
      .eq(column, event_id)
      .limit(1)
      .then(({ data }) => {
        setFavId(data?.[0]?.id || null)
      })
  }

  useEffect(fetchFavorite, [user, event_id, source_table])

  // Listen for favorite toggles elsewhere in the app
  useEffect(() => {
    const handler = e => {
      if (
        e.detail?.event_id === event_id &&
        e.detail?.source_table === source_table &&
        e.detail?.user_id === user?.id
      ) {
        setFavId(e.detail?.favId || null)
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('favorite-changed', handler)
      return () => window.removeEventListener('favorite-changed', handler)
    }
  }, [user, event_id, source_table])

  const toggleFavorite = async () => {
    if (!user || !event_id || !source_table) return
    setLoading(true)
    let column = 'event_id'
    if (source_table === 'all_events') column = 'event_int_id'
    else if (source_table === 'sg_events') column = 'event_uuid'
    let newFavId = null
    if (favId) {
      await supabase
        .from('event_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('source_table', source_table)
        .eq(column, event_id)
      setFavId(null)
    } else {
      const { data } = await supabase
        .from('event_favorites')
        .insert([{ user_id: user.id, source_table, [column]: event_id }])
        .select('id')
        .single()
      if (data) {
        newFavId = data.id
        setFavId(data.id)
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('favorite-changed', {
          detail: { event_id, source_table, favId: newFavId, user_id: user.id }
        })
      )
    }
    setLoading(false)
  }

  return { isFavorite: Boolean(favId), favId, toggleFavorite, loading }
}
