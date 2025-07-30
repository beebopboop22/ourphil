// src/GroupEventDetailPage.jsx
import React, { useEffect, useState, useContext } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { supabase } from './supabaseClient'
import Navbar from './Navbar'
import Footer from './Footer'
import GroupProgressBar from './GroupProgressBar'
import { AuthContext } from './AuthProvider'
import EventFavorite from './EventFavorite.jsx'
import CommentsSection from './CommentsSection'

const pillStyles = [
  'bg-red-100 text-red-800',
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
]

// parse "YYYY-MM-DD" or "MM/DD/YYYY"
function parseYMD(str) {
  if (!str) return null
  if (str.includes('-')) {
    const [y,m,d] = str.split('-').map(Number)
    return new Date(y, m-1, d)
  }
  const [m,d,y] = str.split('/').map(Number)
  return new Date(y, m-1, d)
}

// format "HH:MM" into "h:mm a.m./p.m."
function formatTime(t) {
  if (!t) return ''
  let [h,m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`
}

export default function GroupEventDetailPage() {
  const { slug, eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)

  const [group, setGroup] = useState(null)
  const [evt,   setEvt]   = useState(null)
  const [loading, setLoading] = useState(true)

  const [tagsList, setTagsList]         = useState([])
  const [selectedTags, setSelectedTags] = useState([])

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData]   = useState({})
  const [saving, setSaving]       = useState(false)

  const [subs, setSubs]             = useState([])
  const [loadingSubs, setLoadingSubs] = useState(true)

  // ── LOAD GROUP, EVENT, TAGS, IMAGE ─────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      // 1) group
      const { data: grp } = await supabase
        .from('groups')
        .select('id,Name,slug,Description')
        .eq('slug', slug)
        .single()

      // 2) event
      const { data: ev } = await supabase
        .from('group_events')
        .select('*')
        .eq('id', eventId)
        .single()

      // 3) existing taggings
      const { data: tgs } = await supabase
        .from('taggings')
        .select('tag_id')
        .eq('taggable_type','group_events')
        .eq('taggable_id', ev.id)

      // 4) all tags
      const { data: allTags } = await supabase
        .from('tags')
        .select('id,name')

      // 5) resolve public URL
      let evImgUrl = ''
if (ev.image_url) {
  if (ev.image_url.startsWith('http')) {
    // already a full URL
    evImgUrl = ev.image_url
  } else {
    // storage key → public URL
    evImgUrl = supabase
      .storage
      .from('big-board')
      .getPublicUrl(ev.image_url)
      .data
      .publicUrl
  }
}

      setGroup(grp)
      setEvt({ ...ev, image: evImgUrl })
      setSelectedTags(tgs?.map(x=>x.tag_id) || [])
      setTagsList(allTags || [])
      setLoading(false)
    }
    load()
  }, [slug, eventId])

  // ── LOAD COMMUNITY SUBMISSIONS ──────────────────────────────────────
  useEffect(() => {
    async function loadSubs() {
      setLoadingSubs(true)
      const today = new Date().toISOString().slice(0,10)
      const { data:list } = await supabase
        .from('big_board_events')
        .select('id,post_id,title,start_date,slug')
        .gte('start_date', today)
        .order('start_date',{ ascending:true })
        .limit(32)

      const enriched = await Promise.all(
        (list||[]).map(async item => {
          const { data:p } = await supabase
            .from('big_board_posts')
            .select('image_url')
            .eq('id', item.post_id)
            .single()
          let url = ''
          if (p?.image_url) {
            const { data:{ publicUrl }} = supabase
              .storage.from('big-board')
              .getPublicUrl(p.image_url)
            url = publicUrl
          }
          return { ...item, image: url }
        })
      )

      setSubs(enriched)
      setLoadingSubs(false)
    }
    loadSubs()
  }, [])

  // ── EDIT HANDLERS ─────────────────────────────────────────────────
  const startEditing = () => {
    setFormData({
      title:       evt.title,
      description: evt.description||'',
      address:     evt.address||'',
      start_date:  evt.start_date||'',
      end_date:    evt.end_date||'',
      start_time:  evt.start_time||'',
      end_time:    evt.end_time||''
    })
    setIsEditing(true)
  }
  const handleChange = e => {
    const { name, value } = e.target
    setFormData(fd => ({ ...fd, [name]: value }))
  }
  const toggleTag = id => {
    setSelectedTags(sel =>
      sel.includes(id) ? sel.filter(x=>x!==id) : [...sel, id]
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // 1) update event
      const payload = {
        title:       formData.title,
        description: formData.description,
        address:     formData.address||null,
        start_date:  formData.start_date,
        end_date:    formData.end_date||null,
        start_time:  formData.start_time||null,
        end_time:    formData.end_time||null,
      }
      const { data: updated, error: updErr } = await supabase
        .from('group_events')
        .update(payload)
        .select('*')
        .eq('id', evt.id)
        .single()

      if (updErr) throw updErr

      // 2) reset taggings
      await supabase
        .from('taggings')
        .delete()
        .eq('taggable_type','group_events')
        .eq('taggable_id', evt.id)

      if (selectedTags.length) {
        const ins = selectedTags.map(tag_id => ({
          tag_id, taggable_type:'group_events', taggable_id:evt.id
        }))
        await supabase.from('taggings').insert(ins)
      }

      // 3) re-resolve image public URL
      const imageKey = updated.image_url || evt.image_url
      let publicUrl = ''
      if (imageKey) {
        publicUrl = supabase
          .storage.from('big-board')
          .getPublicUrl(imageKey).data.publicUrl
      }

      // 4) update state & exit edit mode
      setEvt({ ...updated, image: publicUrl })
      setIsEditing(false)
    } catch(err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return
    await supabase
      .from('group_events')
      .delete()
      .eq('id', evt.id)
    navigate(`/groups/${group.slug}`)
  }

  if (loading || !group || !evt) {
    return <div className="py-20 text-center text-gray-500">Loading…</div>
  }

  // ── friendly date/time
  const d0 = parseYMD(evt.start_date) || new Date()
  const diff = Math.round((d0 - new Date().setHours(0,0,0,0)) / (1000*60*60*24))
  const when = diff===0 ? 'Today'
             : diff===1 ? 'Tomorrow'
             : d0.toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })
  const t1 = formatTime(evt.start_time)
  const t2 = formatTime(evt.end_time)

  return (
    <>
      <Helmet>
        <title>{evt.title} – {group.Name}</title>
      </Helmet>
      <Navbar/>
      <GroupProgressBar/>

      {/* static banner */}
      <div
        className="w-full h-[200px] bg-cover bg-center"
        style={{
          backgroundImage:
            `url("https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//Group%20Event%20Banner.png")`
        }}
      />

      {/* overlap detail card */}
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-xl -mt-24 relative z-10">
        <EventFavorite
          event_id={evt.id}
          source_table="group_events"
          className="absolute left-6 top-6 text-3xl"
        />

        {/* created by */}
        <div className="w-full bg-blue-50 px-6 py-3 text-center text-blue-700 font-semibold rounded-t-xl">
          Created by&nbsp;
          <Link to={`/groups/${group.slug}`} className="underline">
            {group.Name}
          </Link>
        </div>

        {/* two‐col layout */}
        <div className="flex flex-col lg:flex-row">
          {/* flyer */}
          <div className="lg:w-1/2 p-6 flex items-center justify-center">
            {evt.image
              ? <img src={evt.image}
                     alt={evt.title}
                     className="w-full h-auto object-cover rounded-lg" />
              : <div className="w-full h-64 bg-gray-100 rounded-lg" />
            }
          </div>

          {/* details / edit */}
          <div className="lg:w-1/2 p-6 space-y-4">
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-6">
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2"
                />

                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />

                {/* tags picker */}
                <div>
                  <label className="block text-sm font-medium">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {tagsList.map((tg,i) => {
                      const sel = selectedTags.includes(tg.id)
                      const cls = sel
                        ? pillStyles[i % pillStyles.length]
                        : 'bg-gray-200 text-gray-700'
                      return (
                        <button
                          key={tg.id}
                          type="button"
                          onClick={()=>toggleTag(tg.id)}
                          className={`${cls} px-3 py-1 rounded-full text-sm`}
                        >
                          {tg.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Address"
                  className="w-full border rounded px-3 py-2"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="w-full border rounded px-3 py-2"
                  />
                  <input
                    name="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    name="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                  />
                  <input
                    name="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={()=>setIsEditing(false)}
                    className="flex-1 bg-gray-300 text-gray-800 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{evt.title}</h1>
                <p className="text-gray-600">
                  {when}{t1 && ` — ${t1}`}{t2 && ` to ${t2}`}
                </p>
                {evt.address && (
                  <p className="text-sm text-blue-600">
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(evt.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {evt.address}
                    </a>
                  </p>
                )}

                {/* tags display */}
                {selectedTags.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-sm font-medium text-gray-700 mb-1">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                      {tagsList
                        .filter(tag => selectedTags.includes(tag.id))
                        .map((tg,i) => (
                          <span
                            key={tg.id}
                            className={`${pillStyles[i % pillStyles.length]} px-3 py-1 rounded-full text-sm`}
                          >
                            {tg.name}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <p className="mt-4 text-gray-700">{evt.description}</p>
                <div className="mt-4">
                  <h2 className="text-lg font-semibold">About this Group</h2>
                  <p className="text-gray-700">{group.Description}</p>
                </div>

                {evt.user_id === user?.id && (
                  <div className="mt-6 flex space-x-4">
                    <button
                      onClick={startEditing}
                      className="bg-indigo-600 text-white px-4 py-2 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      className="bg-red-600 text-white px-4 py-2 rounded"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <CommentsSection
        source_table="group_events"
        event_id={evt.id}
      />

      {/* full-width community subs */}
      <section className="w-full bg-neutral-100 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-semibold text-center mb-6">
            Upcoming Community Submissions
          </h2>
          {loadingSubs ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : subs.length === 0 ? (
            <p className="text-center text-gray-600">No upcoming submissions.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {subs.map(s => {
                const d = parseYMD(s.start_date)
                const label = d
                  ? d.toLocaleDateString('en-US',{ month:'short', day:'numeric' })
                  : ''
                return (
                  <Link
                    key={s.id}
                    to={`/big-board/${s.slug}`}
                    className="bg-white rounded-lg shadow hover:shadow-lg overflow-hidden"
                  >
                    <div className="relative h-32 bg-gray-100">
                      <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white text-xs uppercase text-center py-1 z-10">
                        COMMUNITY SUBMISSION
                      </div>
                      {s.image && (
                        <img
                          src={s.image}
                          alt={s.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4 text-center">
                      <h3 className="font-semibold mb-1 line-clamp-2">
                        {s.title}
                      </h3>
                      <p className="text-sm text-gray-600">{label}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <Footer/>
    </>
  )
}
