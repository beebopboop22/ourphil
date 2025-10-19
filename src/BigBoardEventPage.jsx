// src/BigBoardEventPage.jsx
import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import PostFlyerModal from './PostFlyerModal';
import FloatingAddButton from './FloatingAddButton';
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
import { isTagActive } from './utils/tagUtils';
import Seo from './components/Seo.jsx';
import { getMapboxToken } from './config/mapboxToken.js';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
} from './utils/seoHelpers.js';

const FALLBACK_BIG_BOARD_TITLE = 'Community Event – Our Philly';
const FALLBACK_BIG_BOARD_DESCRIPTION =
  'Discover community-submitted events happening around Philadelphia with Our Philly.';
import { CalendarCheck, Pencil, Trash2 } from 'lucide-react';

export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Main event state
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [areaName, setAreaName] = useState(null);

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
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function formatTimeRange(start, end) {
    if (!start) return '';
    const startText = formatTime(start);
    if (end) {
      return `${startText}–${formatTime(end)}`;
    }
    return startText;
  }

  // Fetch main event (including lat/lng)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setAreaName(null);
      try {
        const { data: ev, error: evErr } = await supabase
          .from('big_board_events')
          .select(`
            id, post_id, title, description, link,
            start_date, end_date, start_time, end_time,
            address, latitude, longitude, area_id,
            created_at, slug
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

        if (ev.area_id) {
          const { data: areaData } = await supabase
            .from('areas')
            .select('name')
            .eq('id', ev.area_id)
            .maybeSingle();
          setAreaName(areaData?.name || null);
        }

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

  const startDateObj = event.start_date ? parseLocalYMD(event.start_date) : null;
  const formattedDateLabel = startDateObj
    ? startDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const formattedDate = startDateObj
    ? startDateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  const timeRangeText = formatTimeRange(event.start_time, event.end_time);
  const shortAddress = event.address
    ? event.address.split(',').slice(0, 2).join(', ').trim()
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

  const activeTags = useMemo(
    () =>
      tagsList.filter(tag => selectedTags.includes(tag.id)),
    [tagsList, selectedTags],
  );

  const mapEvents = useMemo(() => {
    if (!event?.latitude || !event?.longitude) return [];
    return [
      {
        id: event.id,
        latitude: event.latitude,
        longitude: event.longitude,
        title: event.title,
        startDate: event.start_date,
        endDate: event.end_date || event.start_date,
        detailPath: `/big-board/${event.slug}`,
        source_table: 'big_board_events',
      },
    ];
  }, [event]);

  const metaItems = [formattedDateLabel, timeRangeText, areaName, shortAddress].filter(Boolean);

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

      <main className="flex-grow bg-white">
        <div className="pt-28 pb-16">
          <div
            className="sticky z-30 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
            style={{ top: '5.75rem' }}
          >
            <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-xl font-semibold text-gray-900 sm:text-2xl">
                    {event.title}
                  </h1>
                  {!!metaItems.length && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                      {metaItems.map((item, idx) => (
                        <span key={`${item}-${idx}`} className="flex items-center gap-2">
                          {idx > 0 && (
                            <span aria-hidden="true" className="text-gray-300">
                              •
                            </span>
                          )}
                          <span>{item}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleFavorite}
                  disabled={favLoading}
                  className={`hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors md:inline-flex ${
                    isFavorite
                      ? 'bg-indigo-600 text-white'
                      : 'border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  <CalendarCheck className="h-4 w-4" />
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeTags.map((tag, i) => (
                  <Link
                    key={tag.id}
                    to={`/tags/${tag.name.toLowerCase()}`}
                    className={`${pillStyles[i % pillStyles.length]} rounded-full px-3 py-1 text-xs font-semibold`}
                  >
                    #{tag.name}
                  </Link>
                ))}
                {poster?.username && (
                  <span className="text-sm text-gray-600">
                    Submitted by{' '}
                    {poster.slug ? (
                      <Link
                        to={`/u/${poster.slug}`}
                        className="font-semibold text-gray-800 transition hover:text-indigo-600"
                      >
                        @{poster.username}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-800">@{poster.username}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 w-full max-w-3xl px-4">
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    rows="4"
                    value={formData.description}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    name="address"
                    type="text"
                    autoComplete="off"
                    ref={suggestRef}
                    value={formData.address}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Start typing an address…"
                  />
                  {addressSuggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow">
                      {addressSuggestions.map(feat => (
                        <li
                          key={feat.mapbox_id}
                          onClick={() => pickSuggestion(feat)}
                          className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
                        >
                          {feat.name} — {feat.full_address || feat.place_formatted}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                    <input
                      name="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={handleChange}
                      className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                    <input
                      name="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={handleChange}
                      className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      name="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={handleChange}
                      required
                      className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                    <input
                      name="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
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
                          } rounded-full px-4 py-2 text-sm font-semibold`}
                        >
                          {tagOpt.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded bg-green-600 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 rounded bg-gray-200 py-2 font-semibold text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {event.description && (
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">About this event</h2>
                    <p className="whitespace-pre-line text-base leading-relaxed text-gray-700">
                      {event.description}
                    </p>
                  </section>
                )}
              </>
            )}

            {!isEditing && (event.link || event.owner_id === user?.id) && (
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium">
                {event.link && (
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 transition hover:text-indigo-800"
                  >
                    See original listing
                  </a>
                )}
                {event.owner_id === user?.id && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <button
                      onClick={startEditing}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-sm font-medium hover:border-indigo-400 hover:text-indigo-600"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-sm font-medium text-red-600 hover:border-red-400 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mx-auto mt-8 w-full max-w-4xl px-4">
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="h-full w-full max-h-[520px] object-contain"
              />
            </div>
          </div>

          {mapEvents.length > 0 && (
            <div className="mx-auto mt-8 w-full max-w-4xl px-4">
              <MonthlyEventsMap events={mapEvents} height={320} />
            </div>
          )}

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
                {moreEvents.map(evItem => {
                  const dt = parseLocalYMD(evItem.start_date);
                  const diff = Math.round((dt - new Date(new Date().setHours(0,0,0,0))) / (1000*60*60*24));
                  const prefix =
                    diff === 0 ? 'Today' :
                    diff === 1 ? 'Tomorrow' :
                    dt.toLocaleDateString('en-US',{ weekday:'long' });
                  const md = dt.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
                  return (
                    <Link
                      key={evItem.id}
                      to={`/big-board/${evItem.slug}`}
                      className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1">
                          COMMUNITY SUBMISSION
                        </div>
                        <img
                          src={evItem.imageUrl}
                          alt={evItem.title}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                          {evItem.title}
                        </h3>
                        <span className="text-sm text-gray-600">{prefix}, {md}</span>
                        {!!moreTagMap[evItem.id]?.length && (
                          <div className="mt-2 flex flex-wrap justify-center space-x-1">
                            {moreTagMap[evItem.id].map((tag, i) => (
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
                  );
                })}
              </div>
            )}
          </div>

          <SubmitEventSection onNext={file => {
            setInitialFlyer(file);
            setModalStartStep(2);
            setShowFlyerModal(true);
          }} />
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            onClick={handleFavorite}
            disabled={favLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-semibold transition-colors ${
              isFavorite
                ? 'bg-indigo-600 text-white'
                : 'border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'
            }`}
          >
            <CalendarCheck className="h-5 w-5" />
            {isFavorite ? 'In the Plans' : 'Add to Plans'}
          </button>
        </div>
      </div>

      <Footer />
      <FloatingAddButton
        onClick={() => {
          setModalStartStep(1);
          setInitialFlyer(null);
          setShowFlyerModal(true);
        }}
      />
      <PostFlyerModal
        isOpen={showFlyerModal}
        onClose={() => setShowFlyerModal(false)}
        startStep={modalStartStep}
        initialFile={initialFlyer}
      />
    </div>
  );
}
