import React, { useContext, useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import Footer from './Footer';
import SavedEventsScroller from './SavedEventsScroller.jsx';
import useProfile from './utils/useProfile';
import useProfileTags from './utils/useProfileTags';
import { RRule } from 'rrule';
import { Link } from 'react-router-dom';

function CultureModal({ initial = [], onSave, onClose }) {
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set(initial));

  useEffect(() => {
    supabase
      .from('culture_tags')
      .select('id,name,emoji')
      .order('name', { ascending: true })
      .then(({ data }) => setTags(data || []));
  }, []);

  const toggle = id => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleSave = () => {
    onSave(Array.from(selected));
  };

  const filtered = tags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-4 max-h-[80vh] overflow-y-auto w-80 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Select Cultures</h2>
          <button onClick={onClose} className="text-xl">×</button>
        </div>
        <input
          className="w-full border p-1"
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="space-y-1">
          {filtered.map(t => (
            <label key={t.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span>{t.emoji} {t.name}</span>
            </label>
          ))}
        </div>
        <button
          onClick={handleSave}
          className="mt-2 bg-indigo-600 text-white px-4 py-1 rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  const { profile, updateProfile } = useProfile();
  const { tags: cultureTags, saveTags } = useProfileTags('culture');

  const [username, setUsername] = useState(profile?.username || '');
  const [imageUrl, setImageUrl] = useState(profile?.image_url || '');
  const [cultures, setCultures] = useState(cultureTags);
  const [editingName, setEditingName] = useState(false);
  const [changingPic, setChangingPic] = useState(false);
  const [showCultureModal, setShowCultureModal] = useState(false);
  const [savedEvents, setSavedEvents] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    setUsername(profile?.username || '');
    setImageUrl(profile?.image_url || '');
  }, [profile]);

  useEffect(() => {
    setCultures(cultureTags);
  }, [cultureTags]);

  useEffect(() => {
    if (!user) return;
    setLoadingSaved(true);
    (async () => {
      const { data: favs, error } = await supabase
        .from('event_favorites')
        .select('event_id,event_int_id,event_uuid,source_table')
        .eq('user_id', user.id);
      if (error) {
        setSavedEvents([]);
        setLoadingSaved(false);
        return;
      }
      const idsByTable = {};
      favs.forEach(r => {
        const tbl = r.source_table;
        let id;
        if (tbl === 'all_events') id = r.event_int_id;
        else if (tbl === 'events') id = r.event_id;
        else id = r.event_uuid;
        if (!id) return;
        idsByTable[tbl] = idsByTable[tbl] || [];
        idsByTable[tbl].push(id);
      });
      const all = [];
      if (idsByTable.all_events?.length) {
        const { data } = await supabase
          .from('all_events')
          .select('id,name,slug,image,start_date,start_time,venues:venue_id(name,slug)')
          .in('id', idsByTable.all_events);
        data?.forEach(e => {
          all.push({ ...e, title: e.name, source_table: 'all_events' });
        });
      }
      if (idsByTable.events?.length) {
        const { data } = await supabase
          .from('events')
          .select('id,slug,"E Name","E Image",Dates')
          .in('id', idsByTable.events);
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e['E Name'],
            image: e['E Image'],
            start_date: e.Dates,
            source_table: 'events',
          });
        });
      }
      if (idsByTable.big_board_events?.length) {
        const { data } = await supabase
          .from('big_board_events')
          .select('id,slug,title,start_date,start_time,big_board_posts!big_board_posts_event_id_fkey(image_url)')
          .in('id', idsByTable.big_board_events);
        data?.forEach(ev => {
          let img = '';
          const path = ev.big_board_posts?.[0]?.image_url || '';
          if (path) {
            const { data: { publicUrl } } = supabase.storage
              .from('big-board')
              .getPublicUrl(path);
            img = publicUrl;
          }
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: img,
            source_table: 'big_board_events',
          });
        });
      }
      if (idsByTable.group_events?.length) {
        const { data } = await supabase
          .from('group_events')
          .select('id,slug,title,start_date,start_time,groups(Name,slug,imag)')
          .in('id', idsByTable.group_events);
        data?.forEach(ev => {
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: ev.groups?.[0]?.imag || '',
            group: ev.groups?.[0] ? { slug: ev.groups[0].slug } : null,
            source_table: 'group_events',
          });
        });
      }
      if (idsByTable.recurring_events?.length) {
        const { data } = await supabase
          .from('recurring_events')
          .select('id,slug,name,address,start_date,start_time,end_date,rrule,image_url')
          .in('id', idsByTable.recurring_events);
        data?.forEach(ev => {
          try {
            const opts = RRule.parseString(ev.rrule);
            opts.dtstart = new Date(`${ev.start_date}T${ev.start_time}`);
            if (ev.end_date) opts.until = new Date(`${ev.end_date}T23:59:59`);
            const rule = new RRule(opts);
            const today0 = new Date();
            today0.setHours(0, 0, 0, 0);
            const next = rule.after(today0, true);
            if (next) {
              all.push({
                id: ev.id,
                slug: ev.slug,
                title: ev.name,
                address: ev.address,
                start_date: next.toISOString().slice(0, 10),
                start_time: ev.start_time,
                image: ev.image_url,
                source_table: 'recurring_events',
              });
            }
          } catch (err) {
            console.error('rrule parse', err);
          }
        });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parseEventsDate = str => {
        if (!str) return null;
        const [first] = str.split(/through|–|-/);
        const [m, d, y] = first.trim().split('/').map(Number);
        return new Date(y, m - 1, d);
      };
      const parseISODateLocal = str => {
        if (!str) return null;
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const upcoming = all
        .map(ev => {
          const d = ev.source_table === 'events'
            ? parseEventsDate(ev.start_date)
            : parseISODateLocal(ev.start_date);
          return { ...ev, _date: d };
        })
        .filter(ev => {
          if (!ev._date) return false;
          ev._date.setHours(0, 0, 0, 0);
          return ev._date >= today;
        });
      upcoming.sort((a, b) => a._date - b._date);
      setSavedEvents(upcoming.map(({ _date, ...rest }) => rest));
      setLoadingSaved(false);
    })();
  }, [user]);

  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setChangingPic(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 512 });
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase
        .storage
        .from('profile-images')
        .upload(path, compressed, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase
        .storage
        .from('profile-images')
        .getPublicUrl(path);
      await updateProfile({ image_url: publicUrl });
      setImageUrl(publicUrl);
      setToast('Image updated');
    } catch (err) {
      console.error(err);
      setToast('Upload failed');
    }
    setChangingPic(false);
  };

  const saveName = async () => {
    await updateProfile({ username });
    setEditingName(false);
    setToast('Username saved');
  };

  const handleSaveCultures = async ids => {
    const { error } = await saveTags(ids);
    if (!error) {
      setShowCultureModal(false);
      setToast('Cultures saved');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="py-20 text-center text-gray-600">
          Please{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            log in
          </Link>{' '}
          to view your profile.
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <Navbar />
      <div className="max-w-screen-md mx-auto px-4 py-12 mt-12 space-y-8">
        <div className="flex flex-col items-center space-y-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="avatar"
              className="w-32 h-32 rounded-full object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-300" />
          )}
          <input
            type="file"
            ref={fileRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="text-sm text-indigo-600"
            disabled={changingPic}
          >
            {changingPic ? 'Uploading…' : 'Change Picture'}
          </button>
          {editingName ? (
            <div className="flex gap-2 items-center">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="border rounded px-2 py-1"
              />
              <button
                onClick={saveName}
                className="bg-indigo-600 text-white px-2 py-1 rounded"
              >
                Save
              </button>
            </div>
          ) : (
            <h2
              className="text-2xl font-semibold cursor-pointer"
              onClick={() => setEditingName(true)}
            >
              {username || 'Set username'}
            </h2>
          )}
          <div>
            {cultures.map(c => (
              <span key={c.id} className="text-2xl mr-1">
                {c.emoji}
              </span>
            ))}
          </div>
          <button
            onClick={() => setShowCultureModal(true)}
            className="text-sm text-indigo-600"
          >
            Select Cultures
          </button>
        </div>

        <section>
          {loadingSaved ? (
            <div className="py-20 text-center text-gray-500">Loading…</div>
          ) : savedEvents.length === 0 ? (
            <div className="py-20 text-center text-gray-500">No upcoming events saved.</div>
          ) : (
            <SavedEventsScroller events={savedEvents} />
          )}
        </section>
      </div>
      <Footer />
      {showCultureModal && (
        <CultureModal
          initial={cultures.map(c => c.id)}
          onSave={handleSaveCultures}
          onClose={() => setShowCultureModal(false)}
        />
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded">
          {toast}
        </div>
      )}
    </div>
  );
}
