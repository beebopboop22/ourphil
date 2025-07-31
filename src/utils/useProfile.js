import { useState, useEffect, useContext } from 'react'
import { supabase } from '../supabaseClient'
import { AuthContext } from '../AuthProvider'

export default function useProfile() {
  const { user } = useContext(AuthContext)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchProfile = async () => {
    if (!user) { setProfile(null); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id }, { onConflict: 'id' })
      .select('*')
      .single()
    if (!error) setProfile(data)
    setLoading(false)
  }

  useEffect(() => { fetchProfile() }, [user?.id])

  const updateProfile = async updates => {
    if (!user) return { error: { message: 'Not logged in' } }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single()
    if (!error) setProfile(data)
    return { data, error }
  }

  return { profile, updateProfile, refresh: fetchProfile, loading }
}
