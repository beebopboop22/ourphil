// src/BigBoardEventPage.jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import PostFlyerModal from './PostFlyerModal';
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
import useAreaLookup from './utils/useAreaLookup.js';
import { isTagActive } from './utils/tagUtils';
import Seo from './components/Seo.jsx';
import { getMapboxToken } from './config/mapboxToken.js';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
} from './utils/seoHelpers.js';

const FALLBACK_BIG_BOARD_TITLE = 'Community Event – Our Philly';
const FALLBACK_BIG_BOARD_DESCRIPTION =
  'Discover community-submitted events happening around Philadelphia with Our Philly.';
import { CalendarCheck, ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react';

export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Main event state
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mapbox Search Box setup
  const geocoderToken = getMapboxToken();
  const sessionToken = useRef(crypto.randomUUID());
  const suggestRef = useRef(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    address: '',
    latitude: null,
    longitude: null,
  });
  const [saving, setSaving] = useState(false);

  const {
    isFavorite,
    toggleFavorite,
    loading: favLoading,
  } = useEventFavorite({ event_id: event?.id, source_table: 'big_board_events' });

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    await toggleFavorite();
  };

  // Tag state
  const pillStyles = [
    'bg-red-100 text-red-800',
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
  ];
  const [tagsList, setTagsList] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // Upcoming community submissions
  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);
  const [moreTagMap, setMoreTagMap] = useState({});

  const areaLookup = useAreaLookup();
  const [navOffset, setNavOffset] = useState(0);

  // Post flyer modal
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);

  // Event poster info
  const [poster, setPoster] = useState(null);
  // Helpers
  function parseLocalYMD(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function formatTime(timeStr) {
    if (!timeStr) return '';
    let [h, m] = timeStr.split(':');
    h = parseInt(h, 10);
    m = (m || '00').padStart(2, '0');
    const ampm = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  // Fetch main event (including lat/lng)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: ev, error: evErr } = await supabase
          .from('big_board_events')
          .select(`
            id, post_id, title, description, link,
            start_date, end_date, start_time, end_time,
            address, latitude, longitude,
            created_at, slug, area_id
          `)
          .eq('slug', slug)
          .single();
        if (evErr) throw evErr;

        // load image & owner
        const { data: post } = await supabase
          .from('big_board_posts')
          .select('image_url, user_id')
          .eq('id', ev.post_id)
          .single();
        const { data: { publicUrl } } = supabase
          .storage.from('big-board')
          .getPublicUrl(post.image_url);

        // load tags list & existing tags
        const { data: tagsData } = await supabase
          .from('tags')
          .select('id,name,rrule,season_start,season_end');
        setTagsList((tagsData || []).filter(isTagActive));
        const { data: taggings = [] } = await supabase
          .from('taggings')
          .select('tag_id')
          .eq('taggable_type','big_board_events')
          .eq('taggable_id', ev.id);
        setSelectedTags(taggings.map(t => t.tag_id));

        setEvent({ ...ev, imageUrl: publicUrl, owner_id: post.user_id });
      } catch (err) {
        console.error(err);
        setError('Could not load event.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Fetch event poster profile
  useEffect(() => {
    if (!event?.owner_id) return;
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username,image_url,slug')
          .eq('id', event.owner_id)
          .single();
        let img = prof?.image_url || '';
        if (img && !img.startsWith('http')) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-images')
            .getPublicUrl(img);
          img = publicUrl;
        }
        const { data: tags } = await supabase
          .from('profile_tags')
          .select('culture_tags(name,emoji)')
          .eq('profile_id', event.owner_id)
          .eq('tag_type', 'culture');
        const cultures = [];
        tags?.forEach(t => {
          if (t.culture_tags?.emoji) {
            cultures.push({ emoji: t.culture_tags.emoji, name: t.culture_tags.name });
          }
        });
        setPoster({
          id: event.owner_id,
          username: prof?.username || 'User',
          image: img,
          slug: prof?.slug || null,
          cultures,
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [event]);

  // Fetch more community submissions
  useEffect(() => {
    if (!event) return;
    setLoadingMore(true);
    (async () => {
      try {
        const todayStr = new Date().toISOString().slice(0,10);
        const { data: list } = await supabase
          .from('big_board_events')
          .select('id, post_id, title, start_date, slug')
          .gte('start_date', todayStr)
          .neq('id', event.id)
          .order('start_date',{ ascending: true })
          .limit(39);
        const enriched = await Promise.all(
          list.map(async itm => {
            const { data: p } = await supabase
              .from('big_board_posts')
              .select('image_url')
              .eq('id', itm.post_id)
              .single();
            const { data: { publicUrl } } = supabase
              .storage.from('big-board')
              .getPublicUrl(p.image_url);
            return { ...itm, imageUrl: publicUrl };
          })
        );
        setMoreEvents(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMore(false);
      }
    })();
  }, [event]);

  // Fetch tags for those submissions
  useEffect(() => {
    if (!moreEvents.length) return;
    const ids = moreEvents.map(e => e.id);
    supabase
      .from('taggings')
      .select('tags(name,slug),taggable_id')
      .eq('taggable_type','big_board_events')
      .in('taggable_id', ids)
      .then(({ data, error }) => {
        if (error) throw error;
        const map = {};
        data.forEach(({ taggable_id, tags }) => {
          map[taggable_id] = map[taggable_id] || [];
          map[taggable_id].push(tags);
        });
        setMoreTagMap(map);
      })
      .catch(console.error);
  }, [moreEvents]);

  // Enter edit mode
  const startEditing = () => {
    setFormData({
      title:       event.title,
      description: event.description || '',
      link:        event.link || '',
      start_date:  event.start_date,
      end_date:    event.end_date   || '',
      start_time:  event.start_time || '',
      end_time:    event.end_time   || '',
      address:     event.address    || '',
      latitude:    event.latitude   || null,
      longitude:   event.longitude  || null,
    });
    setIsEditing(true);
  };

  // Handle form field change
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };

  // Address suggestions effect (Mapbox Search Box /suggest)
  useEffect(() => {
    if (!isEditing) return;
    const addr = formData.address?.trim();
    if (!addr) {
      setAddressSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest` +
        `?q=${encodeURIComponent(addr)}` +
        `&access_token=${geocoderToken}` +
        `&session_token=${sessionToken.current}` +
        `&limit=5` +
        `&proximity=-75.1652,39.9526` +
        `&bbox=-75.2803,39.8670,-74.9558,40.1379`
      )
        .then(r => r.json())
        .then(json => setAddressSuggestions(json.suggestions || []))
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.address, isEditing, geocoderToken]);

  // Pick a suggestion (Mapbox Search Box /retrieve)
  function pickSuggestion(feat) {
    fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${feat.mapbox_id}` +
      `?access_token=${geocoderToken}` +
      `&session_token=${sessionToken.current}`
    )
      .then(r => r.json())
      .then(json => {
        const feature = json.features?.[0];
        if (feature) {
          const name    = feature.properties.name_preferred || feature.properties.name;
          const context = feature.properties.place_formatted;
          const [lng, lat] = feature.geometry.coordinates;
          setFormData(fd => ({
            ...fd,
            address:   `${name}, ${context}`,
            latitude:  lat,
            longitude: lng,
          }));
        }
      })
      .catch(console.error);

    setAddressSuggestions([]);
    suggestRef.current?.blur();
  }

  // Save edits
  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title:       formData.title,
        description: formData.description || null,
        link:        formData.link || null,
        start_date:  formData.start_date,
        end_date:    formData.end_date   || null,
        start_time:  formData.start_time || null,
        end_time:    formData.end_time   || null,
        address:     formData.address    || null,
        latitude:    formData.latitude,
        longitude:   formData.longitude,
      };
      const { data: upd, error } = await supabase
        .from('big_board_events')
        .update(payload)
        .eq('id', event.id)
        .single();
      if (error) throw error;
      setEvent(ev => ({ ...ev, ...upd }));

      // refresh taggings
      await supabase
        .from('taggings')
        .delete()
        .eq('taggable_type','big_board_events')
        .eq('taggable_id', event.id);
      if (selectedTags.length) {
        const taggings = selectedTags.map(tag_id => ({
          taggable_type: 'big_board_events',
          taggable_id:   event.id,
          tag_id,
        }));
        await supabase.from('taggings').insert(taggings);
      }

      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const measure = () => {
      const navEl = document.querySelector('nav');
      if (!navEl) return;
      setNavOffset(navEl.getBoundingClientRect().height);
    };

    measure();

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    let observer;
    const navEl = document.querySelector('nav');
    if (typeof ResizeObserver !== 'undefined' && navEl) {
      observer = new ResizeObserver(measure);
      observer.observe(navEl);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, []);

  // Delete event
  const handleDelete = async () => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await supabase
        .from('big_board_events')
        .delete()
        .eq('id', event.id);
      navigate('/');
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  const canonicalUrl = `${SITE_BASE_URL}/big-board/${slug}`;

  if (loading || error || !event) {
    const message = loading ? 'Loading…' : error || 'Event not found.';
    const messageClass = error ? 'text-red-600' : 'text-gray-500';
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Seo
          title={FALLBACK_BIG_BOARD_TITLE}
          description={FALLBACK_BIG_BOARD_DESCRIPTION}
          canonicalUrl={canonicalUrl}
          ogImage={DEFAULT_OG_IMAGE}
          ogType="event"
        />
        <Navbar />
        <main className="flex-grow flex items-center justify-center mt-32">
          <div className={`text-2xl ${messageClass}`}>{message}</div>
        </main>
        <Footer />
      </div>
    );
  }

  // Date helpers
  const startDateObj = event.start_date ? parseLocalYMD(event.start_date) : null;
  const endDateObj = event.end_date ? parseLocalYMD(event.end_date) : startDateObj;
  const formattedDate = startDateObj
    ? startDateObj.toLocaleDateString('en-US',{ month:'long', day:'numeric', year:'numeric' })
    : '';
  const rawDesc = event.description || '';
  const metaDesc = rawDesc.length > 155 ? `${rawDesc.slice(0, 152)}…` : rawDesc;
  const seoDescription = metaDesc || FALLBACK_BIG_BOARD_DESCRIPTION;

  const absoluteImage = ensureAbsoluteUrl(event.imageUrl);
  const ogImage = absoluteImage || DEFAULT_OG_IMAGE;
  const seoTitle = formattedDate
    ? `${event.title} | Community Event on ${formattedDate} | Our Philly`
    : `${event.title} – Our Philly`;

  const jsonLd = buildEventJsonLd({
    name: event.title,
    canonicalUrl,
    startDate: event.start_date,
    endDate: event.end_date || event.start_date,
    locationName: event.address || 'Philadelphia',
    description: seoDescription,
    image: ogImage,
  });

  const dateFormatter = { weekday: 'long', month: 'long', day: 'numeric' };
  const startDateLabel = startDateObj
    ? startDateObj.toLocaleDateString('en-US', dateFormatter)
    : 'Date TBA';
  const endDateLabel = endDateObj && startDateObj && endDateObj.getTime() !== startDateObj.getTime()
    ? endDateObj.toLocaleDateString('en-US', dateFormatter)
    : null;
  const dateLabel = endDateLabel ? `${startDateLabel} – ${endDateLabel}` : startDateLabel;

  const startTimeLabel = event.start_time ? formatTime(event.start_time) : null;
  const endTimeLabel = event.end_time ? formatTime(event.end_time) : null;
  let timeLabel = 'Time TBA';
  if (startTimeLabel) {
    timeLabel = endTimeLabel ? `${startTimeLabel} – ${endTimeLabel}` : startTimeLabel;
  }
  const dateTimeDisplay = `${dateLabel} · ${timeLabel}`;

  const areaName = event.area_id ? areaLookup[event.area_id] || null : null;
  const neighborhoodName = areaName?.trim() || 'Neighborhood TBA';
  const shortAddress = event.address ? event.address.split(',')[0].trim() : null;
  const headerTags = tagsList.filter(tag => selectedTags.includes(tag.id));

  const stickyStyle = { top: `${navOffset}px` };
  const mainStyle = { paddingTop: `${navOffset}px` };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="event"
        jsonLd={jsonLd}
      />
      <Navbar />

      <main className="flex-grow relative pb-24 sm:pb-0" style={mainStyle}>
        <header
          className="sticky z-40 w-full border-b border-gray-200 bg-white"
          style={stickyStyle}
        >
          <div className="w-full">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-5">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl line-clamp-2">
                  {event.title}
                </h1>
                <div className="mt-2 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  <span className="font-medium text-gray-900">{dateTimeDisplay}</span>
                  <span className="flex min-w-0 items-center gap-1 font-medium text-gray-700">
                    <MapPin className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    <span className="truncate text-gray-900">
                      {neighborhoodName}
                    </span>
                    {shortAddress && (
                      <span className="truncate text-gray-500">· {shortAddress}</span>
                    )}
                  </span>
                </div>
                {!!headerTags.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {headerTags.map((tag, i) => (
                      <Link
                        key={tag.id}
                        to={`/tags/${tag.name.toLowerCase()}`}
                        className={`${pillStyles[i % pillStyles.length]} px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-80`}
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
                {poster?.username && (
                  <p className="mt-3 text-sm text-gray-500">
                    Submitted by{' '}
                    {poster.slug ? (
                      <Link
                        to={`/u/${poster.slug}`}
                        className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
                      >
                        @{poster.username}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-700">@{poster.username}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="hidden sm:flex flex-shrink-0 items-center">
                <button
                  type="button"
                  onClick={handleFavorite}
                  disabled={favLoading}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition-colors ${
                    isFavorite
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  } ${favLoading ? 'opacity-70' : ''}`}
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Description, form / details, and image */}
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: description / edit form / buttons */}
            <div>
              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <input
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      name="description"
                      rows="3"
                      value={formData.description}
                      onChange={handleChange}
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Address with suggestions */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      name="address"
                      type="text"
                      autoComplete="off"
                      ref={suggestRef}
                      value={formData.address}
                      onChange={handleChange}
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      placeholder="Start typing an address…"
                    />
                    {addressSuggestions.length > 0 && (
                      <ul className="absolute z-20 bg-white border w-full mt-1 rounded max-h-48 overflow-auto">
                        {addressSuggestions.map(feat => (
                          <li
                            key={feat.mapbox_id}
                            onClick={() => pickSuggestion(feat)}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            {feat.name} — {feat.full_address || feat.place_formatted}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {/* Times */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Time</label>
                      <input
                        name="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={handleChange}
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Time</label>
                      <input
                        name="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={handleChange}
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Date</label>
                      <input
                        name="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={handleChange}
                        required
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Date</label>
                      <input
                        name="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={handleChange}
                        className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <div className="flex flex-wrap gap-3">
                      {tagsList.map((tagOpt, i) => {
                        const isSel = selectedTags.includes(tagOpt.id);
                        return (
                          <button
                            key={tagOpt.id}
                            type="button"
                            onClick={() =>
                              setSelectedTags(prev =>
                                isSel
                                  ? prev.filter(x => x !== tagOpt.id)
                                  : [...prev, tagOpt.id]
                              )
                            }
                            className={`${
                              isSel
                                ? pillStyles[i % pillStyles.length]
                                : 'bg-gray-200 text-gray-700'
                            } px-4 py-2 rounded-full text-sm font-semibold`}
                          >
                            {tagOpt.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Save / Cancel */}
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-green-600 text-white py-2 rounded disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-gray-300 text-gray-800 py-2 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {event.description && (
                    <div className="mb-6">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Description</h2>
                      <p className="text-gray-700">{event.description}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <button
                      onClick={handleFavorite}
                      disabled={favLoading}
                      className={`w-full flex items-center justify-center gap-2 rounded-md py-3 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                    >
                      <CalendarCheck className="w-5 h-5" />
                      {isFavorite ? 'In the Plans' : 'Add to Plans'}
                    </button>

                    {event.link && (
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 rounded-md py-3 font-semibold border border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Visit Site
                      </a>
                    )}

                    {event.owner_id === user?.id && (
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={startEditing}
                          className="flex-1 flex items-center justify-center gap-2 rounded-md py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={handleDelete}
                          className="flex-1 flex items-center justify-center gap-2 rounded-md py-2 bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}

                  </div>
                  </>
                )}
              </div>

          {/* Right: full image */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl shadow-lg border border-gray-200">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-auto max-h-[60vh] object-cover"
              />
            </div>
            {!user && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-center text-sm text-indigo-800">
                <Link to="/login" className="font-semibold underline">Log in</Link> or{' '}
                <Link to="/signup" className="font-semibold underline">sign up</Link> free to add to your Plans
              </div>
            )}
          </div>
        </div>

          {/* More Upcoming Community Submissions */}
          <div className="max-w-5xl mx-auto mt-12 border-t border-gray-200 pt-8 px-4 pb-12">
            <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
              More Upcoming Community Submissions
            </h2>
            {loadingMore ? (
              <p className="text-center text-gray-500">Loading…</p>
            ) : moreEvents.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming submissions.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {moreEvents.map(evItem => (
                  <MoreCommunitySubmissionCard
                    key={evItem.id}
                    event={evItem}
                    tags={moreTagMap[evItem.id] || []}
                    pillStyles={pillStyles}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <button
              type="button"
              onClick={handleFavorite}
              disabled={favLoading}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-full border border-indigo-600 px-6 py-3 text-sm font-semibold transition ${
                isFavorite
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
              } ${favLoading ? 'opacity-70' : ''}`}
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          </div>

          <SubmitEventSection onNext={file => {
            setInitialFlyer(file);
            setModalStartStep(2);
            setShowFlyerModal(true);
          }} />
      </main>

      <Footer />
      <PostFlyerModal
        isOpen={showFlyerModal}
        onClose={() => setShowFlyerModal(false)}
        startStep={modalStartStep}
        initialFile={initialFlyer}
      />
    </div>
  );
}

function MoreCommunitySubmissionCard({ event, tags, pillStyles }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event.id,
    source_table: 'big_board_events',
  });

  const parseLocalYMD = str => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const dt = parseLocalYMD(event.start_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt - today) / (1000 * 60 * 60 * 24));
  const prefix =
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : dt.toLocaleDateString('en-US', { weekday: 'long' });
  const md = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const handleFavoriteClick = async e => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    await toggleFavorite();
  };

  const safeTags = (tags || []).filter(tag => tag && tag.slug);
  const hasTags = safeTags.length > 0;

  return (
    <div className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition">
      <Link
        to={`/big-board/${event.slug}`}
        className="flex-1 flex flex-col"
      >
        <div className="relative h-40 bg-gray-100">
          <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1">
            COMMUNITY SUBMISSION
          </div>
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="p-4 flex-1 flex flex-col justify-between text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
            {event.title}
          </h3>
          <span className="text-sm text-gray-600">{prefix}, {md}</span>
          {hasTags && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {safeTags.map((tag, i) => (
                <Link
                  key={tag.slug}
                  to={`/tags/${tag.slug}`}
                  className={`${pillStyles[i % pillStyles.length]} text-xs font-semibold px-2 py-1 rounded-full hover:opacity-80 transition`}
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={handleFavoriteClick}
        disabled={loading}
        className={`flex items-center justify-center gap-2 border-t border-indigo-100 px-4 py-3 text-sm font-semibold transition ${
          isFavorite
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-indigo-600 hover:bg-indigo-50'
        } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        {isFavorite ? 'In the Plans' : 'Add to Plans'}
      </button>
    </div>
  );
}
