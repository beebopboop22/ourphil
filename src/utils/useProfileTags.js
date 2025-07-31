import { useState, useEffect, useContext } from 'react'
import { supabase } from '../supabaseClient'
import { AuthContext } from '../AuthProvider'

export default function useProfileTags(tagType = 'culture') {
  const { user } = useContext(AuthContext)
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchTags = async () => {
    if (!user) { setTags([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('profile_tags')
      .select('tag_id, culture_tags(id,name,emoji)')
      .eq('profile_id', user.id)
      .eq('tag_type', tagType)
    setTags((data || []).map(r => r.culture_tags))
    setLoading(false)
  }

  useEffect(() => { fetchTags() }, [user?.id])

  const saveTags = async ids => {
    if (!user) return { error: { message: 'Not logged in' } }
    setLoading(true)
    const { error: delErr } = await supabase
      .from('profile_tags')
      .delete()
      .eq('profile_id', user.id)
      .eq('tag_type', tagType)
    if (delErr) { setLoading(false); return { error: delErr } }
    if (ids.length) {
      const rows = ids.map(id => ({ profile_id: user.id, tag_id: id, tag_type: tagType }))
      const { error: insErr } = await supabase.from('profile_tags').insert(rows)
      if (insErr) { setLoading(false); return { error: insErr } }
    }
    await fetchTags()
    setLoading(false)
    return { error: null }
  }

  return { tags, saveTags, refresh: fetchTags, loading }
}
