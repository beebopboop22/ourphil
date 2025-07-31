// src/ProfilePage.jsx
import React, { useContext, useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'
import imageCompression from 'browser-image-compression'
import Navbar from './Navbar'
import Footer from './Footer'
import SavedEventsScroller from './SavedEventsScroller.jsx'
import { RRule } from 'rrule'

export default function ProfilePage() {
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  // ── Tag subscriptions ────────────────────────────────────
  const [allTags, setAllTags] = useState([])
  const [subs, setSubs] = useState(new Set())

  // ── Account settings ─────────────────────────────────────
  const [email, setEmail] = useState('')
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState('')
  const [deleting, setDeleting] = useState(false)

  // ── Favorites / Tabs ─────────────────────────────────────
  const [activeTab, setActiveTab] = useState('upcoming')
  const [savedEvents, setSavedEvents] = useState([])
  const [loadingSaved, setLoadingSaved] = useState(false)

  // ── Profile info ─────────────────────────────────────────
  const [username, setUsername] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [cultures, setCultures] = useState([])
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [changingPic, setChangingPic] = useState(false)
  const [showCultureModal, setShowCultureModal] = useState(false)
  const [toast, setToast] = useState(null)

  // ── Styles for tag pills ─────────────────────────────────
  const pillStyles = [
    'bg-green-100 text-indigo-800',
    'bg-teal-100 text-teal-800',
    'bg-pink-100 text-pink-800',
    'bg-blue-100 text-blue-800',
    'bg-orange-100 text-orange-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-red-100 text-red-800',
  ]

  // ── Load initial data ────────────────────────────────────
  useEffect(() => {
    if (!user) return
    setEmail(user.email)

    // profile info
    ;(async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('username,image_url')
        .eq('id', user.id)
        .single()
      if (prof) {
        setUsername(prof.username || '')
        if (prof.image_url) {
          const { data: { publicUrl } } = supabase.storage
            .from('profile-images')
            .getPublicUrl(prof.image_url)
          setImageUrl(publicUrl)
        } else {
          setImageUrl('')
        }
      }

      const { data: tagRows } = await supabase
        .from('profile_tags')
        .select('tag_id')
        .eq('profile_id', user.id)
        .eq('tag_type', 'culture')
      if (tagRows?.length) {
        const ids = tagRows.map(r => r.tag_id)
        const { data: cultData } = await supabase
          .from('culture_tags')
          .select('id,name,emoji')
          .in('id', ids)
        setCultures(cultData || [])
      } else {
        setCultures([])
      }
    })()

    // all tags
    supabase
      .from('tags')
      .select('id,name,slug')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setAllTags(data || [])
      })

    // user's subscriptions
    supabase
      .from('user_subscriptions')
      .select('tag_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setSubs(new Set((data || []).map(r => r.tag_id)))
      })
  }, [user])

  // ── Toggle one tag subscription ──────────────────────────
  const toggleSub = async (tagId) => {
    if (!user) return
    if (subs.has(tagId)) {
      await supabase
        .from('user_subscriptions')
        .delete()
        .match({ user_id: user.id, tag_id: tagId })
      setSubs(s => { s.delete(tagId); return new Set(s) })
    } else {
      await supabase
        .from('user_subscriptions')
        .insert({ user_id: user.id, tag_id: tagId })
      setSubs(s => new Set(s).add(tagId))
    }
  }

  // ── Toast helper ─────────────────────────────────────────
  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Account actions ─────────────────────────────────────
  const updateEmail = async () => {
    setUpdating(true)
    setStatus('')
    const { error } = await supabase.auth.updateUser({ email })
    if (error) setStatus(`❌ ${error.message}`)
    else setStatus('✅ Check your inbox to confirm email change.')
    setUpdating(false)
  }

  const sendPasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.ourphilly.org/update-password',
    })
    if (error) alert('Error: ' + error.message)
    else alert('Password reset link sent.')
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account permanently?')) return
    setDeleting(true)
    const { error } = await supabase.functions.invoke('delete_user_account')
    if (error) {
      alert('Could not delete: ' + error.message)
      setDeleting(false)
    } else {
      await supabase.auth.signOut()
      navigate('/')
    }
  }

  const saveUsername = async () => {
    if (!user) return
    setSavingName(true)
    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Username updated!')
      setEditingName(false)
    }
    setSavingName(false)
  }

  const fileInputRef = useRef(null)
  const handlePicClick = () => fileInputRef.current?.click()
  const handleFileChange = async e => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setChangingPic(true)
    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 256, useWebWorker: true }
      const compressed = await imageCompression(file, options)
      const clean = compressed.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()
      const key = `${user.id}-${Date.now()}-${clean}`
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ image_url: key })
        .eq('id', user.id)
      if (upErr) throw upErr
      await supabase.storage.from('profile-images').upload(key, compressed, { upsert: true })
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(key)
      setImageUrl(publicUrl)
      showToast('Picture updated!')
    } catch (err) {
      console.error(err)
      showToast(err.message, 'error')
    }
    setChangingPic(false)
  }

  const CultureModal = () => {
    const [search, setSearch] = useState('')
    const [options, setOptions] = useState([])
    const [selected, setSelected] = useState(new Set(cultures.map(c => c.id)))
    const [loadingOpts, setLoadingOpts] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
      if (!showCultureModal) return
      setLoadingOpts(true)
      supabase
        .from('culture_tags')
        .select('*')
        .order('name', { ascending: true })
        .then(({ data, error }) => {
          if (!error) setOptions(data || [])
          setLoadingOpts(false)
        })
    }, [showCultureModal])

    const toggle = id => {
      setSelected(prev => {
        const set = new Set(prev)
        set.has(id) ? set.delete(id) : set.add(id)
        return set
      })
    }

    const handleSave = async () => {
      if (!user) return
      setSaving(true)
      const ids = Array.from(selected)
      const { error: delErr } = await supabase
        .from('profile_tags')
        .delete()
        .eq('profile_id', user.id)
        .eq('tag_type', 'culture')
      if (delErr) {
        showToast(delErr.message, 'error')
        setSaving(false)
        return
      }
      if (ids.length) {
        const rows = ids.map(id => ({ profile_id: user.id, tag_id: id, tag_type: 'culture' }))
        const { error: insErr } = await supabase.from('profile_tags').insert(rows)
        if (insErr) {
          showToast(insErr.message, 'error')
          setSaving(false)
          return
        }
      }
      const newCult = options.filter(o => selected.has(o.id))
      setCultures(newCult)
      showToast('Cultures updated!')
      setShowCultureModal(false)
      setSaving(false)
    }

    if (!showCultureModal) return null
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex flex-col">
        <div className="bg-white flex-1 overflow-y-auto p-4">
          <div className="flex mb-4">
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button onClick={() => setShowCultureModal(false)} className="ml-2">✕</button>
          </div>
          {loadingOpts ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : (
            <div className="space-y-2">
              {options
                .filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
                .map(o => (
                  <label key={o.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                    <span className="text-xl">{o.emoji}</span>
                    <span>{o.name}</span>
                  </label>
                ))}
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  // ── Load saved events when showing Upcoming tab ──────────
  useEffect(() => {
    if (activeTab !== 'upcoming' || !user) return
    setLoadingSaved(true)
    ;(async () => {
      const { data: favs, error } = await supabase
        .from('event_favorites')
        .select('event_id,event_int_id,event_uuid,source_table')
        .eq('user_id', user.id)
      if (error) {
        console.error('favorites fetch error', error)
        setSavedEvents([])
        setLoadingSaved(false)
        return
      }

      const idsByTable = {}
      favs.forEach(r => {
        const tbl = r.source_table
        let id
        if (tbl === 'all_events') id = r.event_int_id
        else if (tbl === 'events') id = r.event_id
        else id = r.event_uuid
        if (!id) return
        idsByTable[tbl] = idsByTable[tbl] || []
        idsByTable[tbl].push(id)
      })

      const all = []

      if (idsByTable.all_events?.length) {
        const { data } = await supabase
          .from('all_events')
          .select('id,name,slug,image,start_date,start_time,venues:venue_id(name,slug)')
          .in('id', idsByTable.all_events)
        data?.forEach(e => {
          all.push({
            ...e,
            title: e.name,
            source_table: 'all_events'
          })
        })
      }

      if (idsByTable.events?.length) {
        const { data } = await supabase
          .from('events')
          .select('id,slug,"E Name","E Image",Dates')
          .in('id', idsByTable.events)
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e['E Name'],
            image: e['E Image'],
            start_date: e.Dates,
            source_table: 'events'
          })
        })
      }

      if (idsByTable.big_board_events?.length) {
        const { data } = await supabase
          .from('big_board_events')
          .select('id,slug,title,start_date,start_time,big_board_posts!big_board_posts_event_id_fkey(image_url)')
          .in('id', idsByTable.big_board_events)
        data?.forEach(ev => {
          let img = ''
          const path = ev.big_board_posts?.[0]?.image_url || ''
          if (path) {
            const { data: { publicUrl } } = supabase.storage
              .from('big-board')
              .getPublicUrl(path)
            img = publicUrl
          }
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: img,
            source_table: 'big_board_events'
          })
        })
      }

      if (idsByTable.group_events?.length) {
        const { data } = await supabase
          .from('group_events')
          .select('id,slug,title,start_date,start_time,groups(Name,slug,imag)')
          .in('id', idsByTable.group_events)
        data?.forEach(ev => {
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: ev.groups?.[0]?.imag || '',
            group: ev.groups?.[0] ? { slug: ev.groups[0].slug } : null,
            source_table: 'group_events'
          })
        })
      }

      if (idsByTable.recurring_events?.length) {
        const { data } = await supabase
          .from('recurring_events')
          .select('id,slug,name,address,start_date,start_time,end_date,rrule,image_url')
          .in('id', idsByTable.recurring_events)
        data?.forEach(ev => {
          try {
            const opts = RRule.parseString(ev.rrule)
            opts.dtstart = new Date(`${ev.start_date}T${ev.start_time}`)
            if (ev.end_date) opts.until = new Date(`${ev.end_date}T23:59:59`)
            const rule = new RRule(opts)
            const today0 = new Date(); today0.setHours(0,0,0,0)
            const next = rule.after(today0, true)
            if (next) {
              all.push({
                id: ev.id,
                slug: ev.slug,
                title: ev.name,
                address: ev.address,
                start_date: next.toISOString().slice(0,10),
                start_time: ev.start_time,
                image: ev.image_url,
                source_table: 'recurring_events'
              })
            }
          } catch (err) {
            console.error('rrule parse', err)
          }
        })
      }

      const today = new Date(); today.setHours(0,0,0,0)
      const parseEventsDate = str => {
        if (!str) return null
        const [first] = str.split(/through|–|-/)
        const [m,d,y] = first.trim().split('/').map(Number)
        return new Date(y, m-1, d)
      }
      const parseISODateLocal = str => {
        if (!str) return null
        const [y,m,d] = str.split('-').map(Number)
        return new Date(y, m-1, d)
      }

      const upcoming = all
        .map(ev => {
          const d = ev.source_table === 'events'
            ? parseEventsDate(ev.start_date)
            : parseISODateLocal(ev.start_date)
          return { ...ev, _date: d }
        })
        .filter(ev => {
          if (!ev._date) return false
          ev._date.setHours(0,0,0,0)
          return ev._date >= today
        })

      upcoming.sort((a,b) => a._date - b._date)

      setSavedEvents(upcoming.map(({ _date, ...rest }) => rest))
      setLoadingSaved(false)
    })()
  }, [activeTab, user])

  // ── If not logged in ────────────────────────────────────
  if (!user) {
    return (
      <>
        <Navbar />
        <div className="py-20 text-center text-gray-600">
          Please{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            log in
          </Link>{' '}
          to manage your subscriptions.
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <Navbar />
      {cultures.length > 0 && (
        <div className="flex justify-center text-3xl mt-4">
          {cultures.map(c => (
            <span key={c.id} className="mx-1">{c.emoji}</span>
          ))}
        </div>
      )}

      <div className="max-w-screen-md mx-auto px-4 py-12 mt-6">
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            {imageUrl ? (
              <img src={imageUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200" />
            )}
            <button
              onClick={handlePicClick}
              disabled={changingPic}
              className="absolute bottom-0 right-0 text-xs bg-white px-2 py-1 rounded shadow"
            >
              {changingPic ? 'Uploading…' : 'Change Picture'}
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          {editingName ? (
            <div className="mt-2 flex items-center space-x-2">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="border rounded px-2 py-1"
              />
              <button
                onClick={saveUsername}
                disabled={savingName}
                className="bg-indigo-600 text-white px-2 py-1 rounded text-sm"
              >
                Save
              </button>
              <button onClick={() => setEditingName(false)} className="text-sm">
                Cancel
              </button>
            </div>
          ) : (
            <h2
              onClick={() => setEditingName(true)}
              className="mt-2 text-2xl font-semibold cursor-pointer"
            >
              {username || 'Set username'}
            </h2>
          )}
          <p className="text-sm text-gray-600">{email}</p>
          <button
            onClick={() => setShowCultureModal(true)}
            className="text-sm text-indigo-600 underline mt-2"
          >
            Select Cultures
          </button>
        </div>

        <div className="flex justify-center gap-6 mb-8">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-1 ${activeTab==='upcoming' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-1 ${activeTab==='settings' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            Settings
          </button>
        </div>

        {activeTab === 'settings' && (
          <div className="space-y-12">
            <header className="text-center">
              <h1 className="text-4xl mt-8 font-[Barrio] text-indigo-900 mb-2">
                Your Email Digests
              </h1>
              <p className="text-gray-700">
                Pick the topics you want delivered in your once-a-week roundup.
              </p>
            </header>

            <section>
              <div className="flex flex-wrap justify-center gap-4">
                {allTags.map((tag, i) => {
                  const selected = subs.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleSub(tag.id)}
                      className={`
                        ${pillStyles[i % pillStyles.length]}
                        px-6 py-3 text-lg font-bold rounded-full
                        transition transform hover:scale-105
                        ${selected ? 'border-4 border-indigo-700' : 'opacity-60 hover:opacity-80'}
                      `}
                    >
                      #{tag.name}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-md p-6 space-y-6">
              <h2 className="text-2xl font-semibold text-gray-800">Account Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={updateEmail}
                    disabled={updating}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
                  >
                    Update Email
                  </button>
                  <button
                    onClick={sendPasswordReset}
                    className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                  >
                    {deleting ? 'Deleting…' : 'Delete My Account'}
                  </button>
                </div>
                {status && <p className="text-sm text-gray-700">{status}</p>}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'upcoming' && (
          <section>
            {loadingSaved ? (
              <div className="py-20 text-center text-gray-500">Loading…</div>
            ) : savedEvents.length === 0 ? (
              <div className="py-20 text-center text-gray-500">No upcoming events saved.</div>
            ) : (
              <SavedEventsScroller events={savedEvents} />
            )}
          </section>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 right-4 text-white px-4 py-2 rounded ${toast.type==='error' ? 'bg-red-600' : 'bg-green-600'}`}
        >
          {toast.msg}
        </div>
      )}
      <CultureModal />
      <Footer />
    </div>
  )
}
