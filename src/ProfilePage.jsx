// src/ProfilePage.jsx
import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { AuthContext } from './AuthProvider'
import Navbar from './Navbar'
import Footer from './Footer'
import SavedEventCard from './SavedEventCard.jsx'
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

      <div className="max-w-screen-md mx-auto px-4 py-12 mt-12">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {savedEvents.map(ev => (
                  <SavedEventCard key={`${ev.source_table}-${ev.id}`} event={ev} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Footer />
    </div>
  )
}
