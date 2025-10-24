import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import Footer from './Footer';
import { Helmet } from 'react-helmet';
import SavedEventCard from './SavedEventCard.jsx';
import useProfile from './utils/useProfile';
import useAreaLookup from './utils/useAreaLookup';
import useProfileTags from './utils/useProfileTags';
import { RRule } from 'rrule';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaGlobe } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import CultureModal from './CultureModal.jsx';
import OnboardingFlow from './OnboardingFlow.jsx';

const METERS_PER_MILE = 1609.34;
const RADIUS_PRESETS = [
  { label: '0.5 mi', miles: 0.5 },
  { label: '1 mi', miles: 1 },
  { label: '1.5 mi', miles: 1.5 },
];

function milesToMeters(miles) {
  const numeric = typeof miles === 'number' ? miles : parseFloat(miles);
  if (!numeric || Number.isNaN(numeric)) return 0;
  return Math.round(numeric * METERS_PER_MILE);
}

function metersToMilesInput(meters) {
  if (!meters) return '1';
  const miles = meters / METERS_PER_MILE;
  const rounded = Math.round(miles * 10) / 10;
  if (Number.isNaN(rounded) || rounded <= 0) return '1';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function metersToMilesLabel(meters) {
  if (!meters) return '0 mi';
  const miles = meters / METERS_PER_MILE;
  const rounded = Math.round(miles * 10) / 10;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${formatted} mi`;
}

function parseDayKey(dayKey) {
  if (!dayKey) return null;
  const [y, m, d] = dayKey.split('-').map(Number);
  if ([y, m, d].some(n => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d);
}

function formatDayLabel(dayKey) {
  const date = parseDayKey(dayKey);
  if (!date) return 'Unknown day';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((compareDate - today) / (1000 * 60 * 60 * 24));
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  let prefix;
  if (diffDays === 0) prefix = 'Today';
  else if (diffDays === 1) prefix = 'Tomorrow';
  else prefix = weekday;
  return `${prefix} · ${datePart}`;
}

function formatTimelineTime(startTime) {
  if (!startTime) return 'No time listed';
  const [hourPart, minutePart = '0'] = startTime.split(':');
  const hour = Number.parseInt(hourPart, 10);
  const minute = Number.parseInt(minutePart, 10) || 0;
  if (Number.isNaN(hour)) return 'No time listed';
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function timeToMinutes(startTime) {
  if (!startTime) return Number.POSITIVE_INFINITY;
  const [hourPart, minutePart = '0'] = startTime.split(':');
  const hour = Number.parseInt(hourPart, 10);
  const minute = Number.parseInt(minutePart, 10) || 0;
  if (Number.isNaN(hour)) return Number.POSITIVE_INFINITY;
  return hour * 60 + minute;
}

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  const { profile, updateProfile } = useProfile();
  const { tags: cultureTags, saveTags } = useProfileTags('culture');
  const areaLookup = useAreaLookup();

  const [searchParams] = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);

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
  const [cultures, setCultures] = useState(cultureTags);
  const [editingName, setEditingName] = useState(false);
  const [changingPic, setChangingPic] = useState(false);
  const [showCultureModal, setShowCultureModal] = useState(false);
  const [savedEvents, setSavedEvents] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [myEvents, setMyEvents] = useState([]);
  const [loadingMyEvents, setLoadingMyEvents] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [facebookUrl, setFacebookUrl] = useState(profile?.facebook_url || '');
  const [instagramUrl, setInstagramUrl] = useState(profile?.instagram_url || '');
  const [tiktokUrl, setTiktokUrl] = useState(profile?.tiktok_url || '');
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url || '');
  const [preferredAreaId, setPreferredAreaId] = useState(profile?.preferred_area_id ?? null);
  const [preferredRadiusM, setPreferredRadiusM] = useState(profile?.preferred_radius_m ?? 1609);
  const [areaInputValue, setAreaInputValue] = useState('');
  const [showNeighborhoodPrompt, setShowNeighborhoodPrompt] = useState(!profile?.preferred_area_id);
  const [savingNeighborhood, setSavingNeighborhood] = useState(false);
  const [neighborhoodError, setNeighborhoodError] = useState('');
  const [radiusMilesInput, setRadiusMilesInput] = useState(
    metersToMilesInput(profile?.preferred_radius_m ?? 1609)
  );
  const profileAreaId = profile?.preferred_area_id ?? null;
  const fileRef = useRef(null);

  const handleOnboardingComplete = async () => {
    await updateProfile({ onboarding_complete: true });
    setShowOnboarding(false);
  };

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

  // Show onboarding flow if profile isn't complete or forced via query param
  useEffect(() => {
    if (!profile) return;
    const force = searchParams.get('onboard') === '1';
    if (force || profile.onboarding_complete === false) {
      setShowOnboarding(true);
    }
  }, [profile, searchParams]);

  useEffect(() => {
    setUsername(profile?.username || profile?.slug || '');
    setImageUrl(profile?.image_url || '');
    setFacebookUrl(profile?.facebook_url || '');
    setInstagramUrl(profile?.instagram_url || '');
    setTiktokUrl(profile?.tiktok_url || '');
    setWebsiteUrl(profile?.website_url || '');
    setPreferredAreaId(profile?.preferred_area_id ?? null);
    const radiusValue = profile?.preferred_radius_m ?? 1609;
    setPreferredRadiusM(radiusValue);
    setRadiusMilesInput(metersToMilesInput(radiusValue));
    setShowNeighborhoodPrompt(!profile?.preferred_area_id);
  }, [profile]);

  useEffect(() => {
    setCultures(cultureTags);
  }, [cultureTags]);

  useEffect(() => {
    if (profileAreaId && areaLookup && (areaLookup[profileAreaId] || areaLookup[String(profileAreaId)])) {
      const name = areaLookup[profileAreaId] || areaLookup[String(profileAreaId)];
      setAreaInputValue(name || '');
    } else if (!profileAreaId) {
      setAreaInputValue('');
    }
  }, [areaLookup, profileAreaId]);

  useEffect(() => {
    setRadiusMilesInput(metersToMilesInput(preferredRadiusM));
  }, [preferredRadiusM]);

  const areaOptions = useMemo(() => {
    return Object.entries(areaLookup || {})
      .map(([rawId, name]) => {
        const parsed = Number(rawId);
        const id = Number.isNaN(parsed) ? rawId : parsed;
        return { id, name: name || '' };
      })
      .filter(option => option.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [areaLookup]);

  const fallbackRadius = milesToMeters(radiusMilesInput || 1);
  const normalizedRadius =
    preferredRadiusM && preferredRadiusM > 0
      ? preferredRadiusM
      : fallbackRadius > 0
        ? fallbackRadius
        : milesToMeters(1);
  const selectedAreaName =
    preferredAreaId !== null && preferredAreaId !== '' && preferredAreaId !== undefined
      ? areaLookup?.[preferredAreaId] || areaLookup?.[String(preferredAreaId)] || ''
      : '';
  const radiusDisplay = metersToMilesLabel(normalizedRadius);

  const handleAreaInputChange = e => {
    const value = e.target.value;
    setAreaInputValue(value);
    if (!value.trim()) {
      setPreferredAreaId(null);
      return;
    }
    const match = areaOptions.find(
      option => option.name.toLowerCase() === value.trim().toLowerCase()
    );
    if (match) {
      setPreferredAreaId(match.id);
    }
  };

  const handleRadiusPreset = miles => {
    const meters = milesToMeters(miles);
    if (!meters || meters <= 0) return;
    setPreferredRadiusM(meters);
  };

  const handleRadiusInputChange = e => {
    const value = e.target.value;
    setRadiusMilesInput(value);
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const meters = milesToMeters(parsed);
      if (meters > 0) setPreferredRadiusM(meters);
    }
  };

  const handleSaveNeighborhood = async () => {
    setSavingNeighborhood(true);
    setNeighborhoodError('');
    let areaIdValue = null;
    if (preferredAreaId !== null && preferredAreaId !== '' && preferredAreaId !== undefined) {
      const numeric = Number(preferredAreaId);
      areaIdValue = Number.isNaN(numeric) ? preferredAreaId : numeric;
    }
    let radiusToSave = normalizedRadius;
    if (!radiusToSave || radiusToSave <= 0) {
      radiusToSave = milesToMeters(1);
      setPreferredRadiusM(radiusToSave);
    }
    const { error } = await updateProfile({
      preferred_area_id: areaIdValue,
      preferred_radius_m: radiusToSave,
    });
    if (error) {
      setNeighborhoodError(error.message);
      setToast(error.message);
    } else {
      setToast('Home neighborhood saved!');
      setShowNeighborhoodPrompt(!areaIdValue);
    }
    setSavingNeighborhood(false);
  };

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
          .select('id,slug,"E Name","E Image",Dates,"End Date"')
          .in('id', idsByTable.events);
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e['E Name'],
            image: e['E Image'],
            start_date: e.Dates,
            end_date: e['End Date'],
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
      const parseEventsDateRange = (startStr, explicitEnd) => {
        if (!startStr) return { start: null, end: null };
        const [startPart, rangeEnd] = startStr.split(/through|–|-/);
        const [m1, d1, y1] = startPart.trim().split('/').map(Number);
        const start = new Date(y1, m1 - 1, d1);
        let end = start;
        if (explicitEnd) {
          const [m2, d2, y2] = explicitEnd.split('/').map(Number);
          end = new Date(y2, m2 - 1, d2);
        } else if (rangeEnd) {
          const parts = rangeEnd.trim().split('/').map(Number);
          if (parts.length === 3) end = new Date(parts[2], parts[0] - 1, parts[1]);
          else end = new Date(y1, parts[0] - 1, parts[1]);
        }
        return { start, end };
      };
      const parseISODateLocal = str => {
        if (!str) return null;
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const upcoming = all
        .map(ev => {
          if (ev.source_table === 'events') {
            const { start, end } = parseEventsDateRange(ev.start_date, ev.end_date);
            const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
            const validEnd = end && !Number.isNaN(end.getTime()) ? end : validStart;
            const dayKey = validStart
              ? `${validStart.getFullYear()}-${String(validStart.getMonth() + 1).padStart(2, '0')}-${String(
                  validStart.getDate()
                ).padStart(2, '0')}`
              : null;
            return { ...ev, _date: validStart, _end: validEnd, dayKey };
          }
          const parsed = parseISODateLocal(ev.start_date);
          const validDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
          const dayKey = validDate
            ? `${validDate.getFullYear()}-${String(validDate.getMonth() + 1).padStart(2, '0')}-${String(
                validDate.getDate()
              ).padStart(2, '0')}`
            : null;
          return { ...ev, _date: validDate, _end: validDate, dayKey };
        })
        .filter(ev => {
          if (!ev._date || !ev._end) return false;
          ev._date.setHours(0, 0, 0, 0);
          ev._end.setHours(0, 0, 0, 0);
          return ev._end >= today;
        });
      upcoming.sort((a, b) => a._date - b._date);
      setSavedEvents(upcoming.map(({ _date, _end, ...rest }) => rest));
      setLoadingSaved(false);
    })();
  }, [user]);

  const dayOptions = useMemo(() => {
    const byDay = new Map();
    savedEvents.forEach(ev => {
      if (!ev.dayKey) return;
      if (!byDay.has(ev.dayKey)) byDay.set(ev.dayKey, []);
      byDay.get(ev.dayKey).push(ev);
    });
    return Array.from(byDay.entries())
      .map(([key, events]) => {
        const date = parseDayKey(key);
        return {
          key,
          date,
          label: formatDayLabel(key),
          count: events.length,
        };
      })
      .filter(option => option.date)
      .sort((a, b) => a.date - b.date);
  }, [savedEvents]);

  useEffect(() => {
    if (!dayOptions.length) {
      if (selectedDayKey !== null) {
        setSelectedDayKey(null);
      }
      return;
    }
    const hasSelected = dayOptions.some(option => option.key === selectedDayKey);
    if (!hasSelected) {
      setSelectedDayKey(dayOptions[0].key);
    }
  }, [dayOptions, selectedDayKey]);

  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDayKey) return [];
    const events = savedEvents.filter(ev => ev.dayKey === selectedDayKey);
    return events
      .slice()
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  }, [savedEvents, selectedDayKey]);

  const selectedDayLabel = useMemo(() => {
    const current = dayOptions.find(option => option.key === selectedDayKey);
    return current?.label || '';
  }, [dayOptions, selectedDayKey]);

  useEffect(() => {
    if (activeTab !== 'my-posts' || !user) return;
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
      {showOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      <header className="bg-gradient-to-r from-indigo-700 to-purple-600 text-white mt-16">
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
            <div className="mt-2 flex justify-center sm:justify-start gap-4 text-2xl">
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener" className="hover:text-indigo-700">
                  <FaFacebookF />
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener" className="hover:text-indigo-700">
                  <FaInstagram />
                </a>
              )}
              {tiktokUrl && (
                <a href={tiktokUrl} target="_blank" rel="noopener" className="hover:text-indigo-700">
                  <SiTiktok />
                </a>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener" className="hover:text-indigo-700">
                  <FaGlobe />
                </a>
              )}
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
            onClick={() => setActiveTab('my-posts')}
            className={`pb-1 ${activeTab === 'my-posts' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            My Posts
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

            {showNeighborhoodPrompt && (
              <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 px-4 py-3 rounded-lg text-sm">
                <p>
                  Set your home neighborhood to quickly find events near you.
                  <a href="#home-neighborhood-control" className="ml-2 underline text-indigo-700">
                    Set it now
                  </a>
                </p>
              </div>
            )}

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
                <div id="home-neighborhood-control" className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-sm text-gray-600">
                      {selectedAreaName ? (
                        <>
                          Home neighborhood:{' '}
                          <span className="font-medium text-gray-800">{selectedAreaName}</span>
                          {' · '}Radius: {radiusDisplay}
                        </>
                      ) : (
                        <>
                          Home neighborhood:{' '}
                          <span className="font-medium text-gray-800">Not set yet</span>
                          {' · '}Radius: {radiusDisplay}
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1" htmlFor="neighborhood-search">
                      Find your neighborhood
                    </label>
                    <input
                      id="neighborhood-search"
                      type="text"
                      value={areaInputValue}
                      onChange={handleAreaInputChange}
                      list="profile-area-options"
                      placeholder="Search neighborhoods"
                      className="w-full border rounded p-2"
                      autoComplete="off"
                    />
                    <datalist id="profile-area-options">
                      {areaOptions.map(option => (
                        <option key={option.id} value={option.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <span className="block text-sm text-gray-600 mb-1">Preferred radius</span>
                    <div className="flex flex-wrap gap-2">
                      {RADIUS_PRESETS.map(preset => {
                        const meters = milesToMeters(preset.miles);
                        const isActive = Math.abs(normalizedRadius - meters) <= 50;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => handleRadiusPreset(preset.miles)}
                            className={`px-3 py-1 rounded-full border transition ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <label className="text-sm text-gray-600" htmlFor="custom-radius">
                        Custom radius (miles)
                      </label>
                      <input
                        id="custom-radius"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={radiusMilesInput}
                        onChange={handleRadiusInputChange}
                        className="w-24 border rounded p-2"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveNeighborhood}
                      disabled={savingNeighborhood}
                      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition disabled:opacity-60"
                    >
                      {savingNeighborhood ? 'Saving…' : 'Save neighborhood'}
                    </button>
                    {neighborhoodError && (
                      <p className="text-sm text-red-600">{neighborhoodError}</p>
                    )}
                  </div>
                </div>
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
                  <button
                    onClick={saveSocialLinks}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
                  >
                    Save Social Links
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
            ) : dayOptions.length === 0 ? (
              <div className="py-20 text-center text-gray-500">No upcoming events saved.</div>
            ) : (
              <>
                <div className="-mx-4 flex gap-3 overflow-x-auto pb-4 sm:mx-0 sm:px-0">
                  {dayOptions.map(option => {
                    const isActive = selectedDayKey === option.key;
                    return (
                      <button
                        type="button"
                        key={option.key}
                        onClick={() => setSelectedDayKey(option.key)}
                        className={`flex-shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        <div>{option.label}</div>
                        <div className={`text-xs font-normal ${isActive ? 'text-indigo-200' : 'text-gray-500'}`}>
                          {option.count} {option.count === 1 ? 'plan' : 'plans'}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 space-y-6">
                  {selectedDayLabel && (
                    <h3 className="text-xl font-semibold text-gray-800">{selectedDayLabel}</h3>
                  )}
                  {eventsForSelectedDay.length === 0 ? (
                    <div className="py-20 text-center text-gray-500">No events scheduled for this day.</div>
                  ) : (
                    <div className="space-y-8">
                      {eventsForSelectedDay.map((ev, index) => {
                        const isLast = index === eventsForSelectedDay.length - 1;
                        return (
                          <div key={`${ev.source_table}-${ev.id}`} className="flex items-start gap-6">
                            <div className="w-20 pt-2 text-right text-sm font-semibold text-gray-600">
                              {formatTimelineTime(ev.start_time)}
                            </div>
                            <div className="flex-1">
                              <div
                                className={`relative border-l-2 border-indigo-100 pl-8 ${
                                  isLast ? 'pb-0' : 'pb-10'
                                }`}
                              >
                                <span className="absolute left-0 top-2 inline-flex h-4 w-4 -translate-x-1/2 transform items-center justify-center">
                                  <span className="h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow" />
                                </span>
                                <SavedEventCard
                                  event={ev}
                                  size="compact"
                                  onRemove={() =>
                                    setSavedEvents(prev =>
                                      prev.filter(e => !(e.id === ev.id && e.source_table === ev.source_table))
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'my-posts' && (
          <section>
            {loadingMyEvents ? (
              <div className="py-20 text-center text-gray-500">Loading…</div>
            ) : myEvents.length === 0 ? (
              <div className="py-20 text-center text-gray-500">You haven’t created a post yet.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {myEvents.map(ev => (
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
