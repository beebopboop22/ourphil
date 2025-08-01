import React, { useContext, useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import Footer from './Footer';
import { Helmet } from 'react-helmet';
import SavedEventCard from './SavedEventCard.jsx';
import useProfile from './utils/useProfile';
import useProfileTags from './utils/useProfileTags';
import { RRule } from 'rrule';
import { Link, useNavigate } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaGlobe } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';

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

  const navigate = useNavigate();

  // Tag subscriptions for email digests
  const [allTags, setAllTags] = useState([]);
  const [subs, setSubs] = useState(new Set());

  // Account settings
  const [email, setEmail] = useState('');
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('upcoming');

  const [username, setUsername] = useState(profile?.username || profile?.slug || '');
  const [imageUrl, setImageUrl] = useState(profile?.image_url || '');
  const [facebookUrl, setFacebookUrl] = useState(profile?.facebook_url || '');
  const [instagramUrl, setInstagramUrl] = useState(profile?.instagram_url || '');
  const [tiktokUrl, setTiktokUrl] = useState(profile?.tiktok_url || '');
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url || '');
  const [cultures, setCultures] = useState(cultureTags);
  const [editingName, setEditingName] = useState(false);
  const [changingPic, setChangingPic] = useState(false);
  const [showCultureModal, setShowCultureModal] = useState(false);
  const [savedEvents, setSavedEvents] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [myEvents, setMyEvents] = useState([]);
  const [loadingMyEvents, setLoadingMyEvents] = useState(false);
  const [followingEvents, setFollowingEvents] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  // Load tags and subscriptions on mount
  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    supabase
      .from('tags')
      .select('id,name,slug')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setAllTags(data || []);
      });
    supabase
      .from('user_subscriptions')
      .select('tag_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!error) setSubs(new Set((data || []).map(r => r.tag_id)));
      });
  }, [activeTab, user]);

  useEffect(() => {
    setUsername(profile?.username || profile?.slug || '');
    setImageUrl(profile?.image_url || '');
    setFacebookUrl(profile?.facebook_url || '');
    setInstagramUrl(profile?.instagram_url || '');
    setTiktokUrl(profile?.tiktok_url || '');
    setWebsiteUrl(profile?.website_url || '');
  }, [profile]);

  useEffect(() => {
    setCultures(cultureTags);
  }, [cultureTags]);

  useEffect(() => {
    if (activeTab !== 'upcoming' || !user) return;
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

  useEffect(() => {
    if (activeTab !== 'my-events' || !user) return;
    setLoadingMyEvents(true);
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const all = [];

      const { data: myPosts, error: postErr } = await supabase
        .from('big_board_posts')
        .select(
          'image_url,big_board_events!big_board_events_post_id_fkey(id,slug,title,start_date,start_time)'
        )
        .eq('user_id', user.id)
        .gte('big_board_events.start_date', today)
        .order('start_date', { foreignTable: 'big_board_events', ascending: true });
      if (postErr) console.error(postErr);
      (myPosts || []).forEach(p => {
        const ev = p.big_board_events?.[0];
        if (!ev) return;
        let img = '';
        if (p.image_url) {
          const { data: { publicUrl } } = supabase.storage
            .from('big-board')
            .getPublicUrl(p.image_url);
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

      const { data: ge, error: geErr } = await supabase
        .from('group_events')
        .select('id,slug,title,start_date,start_time,groups(slug,imag)')
        .eq('user_id', user.id)
        .gte('start_date', today)
        .order('start_date', { ascending: true });
      if (geErr) console.error(geErr);
      (ge || []).forEach(ev => {
        all.push({
          id: ev.id,
          slug: ev.slug,
          title: ev.title,
          start_date: ev.start_date,
          start_time: ev.start_time,
          image: ev.groups?.imag || ev.groups?.[0]?.imag || '',
          group: ev.groups ? { slug: ev.groups.slug } : ev.groups?.[0] ? { slug: ev.groups[0].slug } : null,
          source_table: 'group_events',
        });
      });

      const parseISO = str => {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const todayObj = new Date();
      todayObj.setHours(0, 0, 0, 0);
      const upcoming = all
        .map(ev => ({ ...ev, _d: parseISO(ev.start_date) }))
        .filter(ev => ev._d && ev._d >= todayObj)
        .sort((a, b) => a._d - b._d)
        .map(({ _d, ...rest }) => rest);
      setMyEvents(upcoming);
      setLoadingMyEvents(false);
    })();
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== 'following' || !user) return;
    setLoadingFollowing(true);
    (async () => {
      const { data, error } = await supabase
        .from('user_follow_events')
        .select('*')
        .eq('follower_id', user.id)
        .order('start_date', { ascending: true });
      if (error) {
        console.error(error);
        setFollowingEvents([]);
        setLoadingFollowing(false);
        return;
      }
      const mapped = (data || []).map(ev => {
        let img = ev.image_url || '';
        if (ev.source === 'big_board' && img) {
          const { data: { publicUrl } } = supabase.storage
            .from('big-board')
            .getPublicUrl(img);
          img = publicUrl;
        }
        return {
          id: ev.event_id,
          slug: ev.slug,
          title: ev.title,
          start_date: ev.start_date,
          start_time: ev.start_time,
          image: img,
          source_table: ev.source === 'big_board'
            ? 'big_board_events'
            : 'group_events',
        };
      });
      setFollowingEvents(mapped);
      setLoadingFollowing(false);
    })();
  }, [activeTab, user]);

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

  const saveSocialLinks = async () => {
    const { error } = await updateProfile({
      facebook_url: facebookUrl,
      instagram_url: instagramUrl,
      tiktok_url: tiktokUrl,
      website_url: websiteUrl,
    });
    if (error) setToast(error.message);
    else setToast('Social links saved!');
  };

  const toggleSub = async tagId => {
    if (!user) return;
    if (subs.has(tagId)) {
      await supabase
        .from('user_subscriptions')
        .delete()
        .match({ user_id: user.id, tag_id: tagId });
      setSubs(prev => {
        prev.delete(tagId);
        return new Set(prev);
      });
    } else {
      await supabase
        .from('user_subscriptions')
        .insert({ user_id: user.id, tag_id: tagId });
      setSubs(prev => new Set(prev).add(tagId));
    }
  };

  const updateEmail = async () => {
    setUpdating(true);
    setStatus('');
    const { error } = await supabase.auth.updateUser({ email });
    if (error) setStatus(`❌ ${error.message}`);
    else setStatus('✅ Check your inbox to confirm email change.');
    setUpdating(false);
  };

  const sendPasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.ourphilly.org/update-password',
    });
    if (error) alert('Error: ' + error.message);
    else alert('Password reset link sent.');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account permanently?')) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete_user_account');
    if (error) {
      alert('Could not delete: ' + error.message);
      setDeleting(false);
    } else {
      await supabase.auth.signOut();
      navigate('/');
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
    <div className="min-h-screen bg-neutral-50 pb-12 pt-20">
      <Helmet>
        <title>Your Profile | Our Philly</title>
        <meta name="description" content="Manage your saved events and account settings." />
        <link rel="canonical" href="https://ourphilly.org/profile" />
      </Helmet>
      <Navbar />

      <header className="bg-gradient-to-r from-indigo-700 to-purple-600 text-white">
        <div className="max-w-screen-md mx-auto px-4 py-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            {imageUrl ? (
              <img src={imageUrl} alt="avatar" className="w-32 h-32 rounded-full object-cover" />
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
              className="absolute bottom-0 right-0 text-xs bg-black/60 px-2 py-1 rounded"
              disabled={changingPic}
            >
              {changingPic ? 'Uploading…' : 'Change'}
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left">
            {editingName ? (
              <div className="flex gap-2 items-center justify-center sm:justify-start">
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="border rounded px-2 py-1 text-black"
                />
                <button
                  onClick={saveName}
                  className="bg-indigo-600 text-white px-2 py-1 rounded"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 justify-center sm:justify-start">
                <h2 className="text-3xl font-bold">{username || profile?.slug || 'Username'}</h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-sm underline"
                >
                  Edit username
                </button>
                {profile?.slug && (
                  <Link to={`/u/${profile.slug}`} className="text-sm underline">
                    View public profile
                  </Link>
                )}
              </div>
              <div className="mt-2 flex gap-4 justify-center sm:justify-start text-xl">
                {facebookUrl && (
                  <a href={facebookUrl} target="_blank" rel="noopener">
                    <FaFacebookF />
                  </a>
                )}
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener">
                    <FaInstagram />
                  </a>
                )}
                {tiktokUrl && (
                  <a href={tiktokUrl} target="_blank" rel="noopener">
                    <SiTiktok />
                  </a>
                )}
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" rel="noopener">
                    <FaGlobe />
                  </a>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap justify-center sm:justify-start items-center gap-1">
              {cultures.map(c => (
                <span key={c.id} className="relative group text-2xl">
                  {c.emoji}
                  <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                    {c.name}
                  </span>
                </span>
              ))}
              <button
                onClick={() => setShowCultureModal(true)}
                className="ml-2 text-sm underline"
              >
                edit your cultures!
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-md mx-auto px-4 py-12 space-y-12">
        <div className="flex justify-center gap-6 mb-8">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-1 ${activeTab === 'upcoming' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            Upcoming Plans
          </button>
          <button
            onClick={() => setActiveTab('my-events')}
            className={`pb-1 ${activeTab === 'my-events' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            My Events
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`pb-1 ${activeTab === 'following' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            Following
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-1 ${activeTab === 'settings' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            Settings
          </button>
        </div>

        {activeTab === 'settings' && (
          <div className="space-y-12">
            <header className="text-center">
              <h1 className="text-4xl mt-8 font-[Barrio] text-indigo-900 mb-2">Your Email Digests</h1>
              <p className="text-gray-700">Pick the topics you want delivered in your once-a-week roundup.</p>
            </header>

            <section>
              <div className="flex flex-wrap justify-center gap-4">
                {allTags.map((tag, i) => {
                  const selected = subs.has(tag.id);
                  const colors = ['bg-green-100 text-indigo-800','bg-teal-100 text-teal-800','bg-pink-100 text-pink-800','bg-blue-100 text-blue-800','bg-orange-100 text-orange-800','bg-yellow-100 text-yellow-800','bg-purple-100 text-purple-800','bg-red-100 text-red-800'];
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleSub(tag.id)}
                      className={`${colors[i % colors.length]} px-6 py-3 text-lg font-bold rounded-full transition transform hover:scale-105 ${selected ? 'border-4 border-indigo-700' : 'opacity-60 hover:opacity-80'}`}
                    >
                      #{tag.name}
                    </button>
                  );
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
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Facebook URL</label>
                  <input
                    type="url"
                    value={facebookUrl}
                    onChange={e => setFacebookUrl(e.target.value)}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Instagram URL</label>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={e => setInstagramUrl(e.target.value)}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">TikTok URL</label>
                  <input
                    type="url"
                    value={tiktokUrl}
                    onChange={e => setTiktokUrl(e.target.value)}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <button
                    onClick={saveSocialLinks}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
                  >
                    Save Social Links
                  </button>
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {savedEvents.map(ev => (
                  <SavedEventCard key={`${ev.source_table}-${ev.id}`} event={ev} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'my-events' && (
          <section>
            {loadingMyEvents ? (
              <div className="py-20 text-center text-gray-500">Loading…</div>
            ) : myEvents.length === 0 ? (
              <div className="py-20 text-center text-gray-500">You have not created an event. Create an event.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {myEvents.map(ev => (
                  <SavedEventCard key={`${ev.source_table}-${ev.id}`} event={ev} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'following' && (
          <section>
            {loadingFollowing ? (
              <div className="py-20 text-center text-gray-500">Loading…</div>
            ) : followingEvents.length === 0 ? (
              <div className="py-20 text-center text-gray-500">No upcoming events.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {followingEvents.map(ev => (
                  <SavedEventCard key={`${ev.source_table}-${ev.id}`} event={ev} />
                ))}
              </div>
            )}
          </section>
        )}
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
