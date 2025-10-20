// src/BigBoardEventPage.jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
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
import {
  CalendarCheck,
  CalendarPlus,
  ExternalLink,
  MapPin,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';

export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Main event state
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Siblings for prev/next
  const [siblings, setSiblings] = useState([]);

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

  const [area, setArea] = useState(null);
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

  // Share fallback & handler
  function copyLinkFallback(url) {
    navigator.clipboard.writeText(url).catch(console.error);
  }
  function handleShare() {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      navigator.share({ title, url }).catch(console.error);
    } else {
      copyLinkFallback(url);
    }
  }

  const gcalLink = event ? (() => {
    const start = event.start_date?.replace(/-/g, '') || '';
    const end = (event.end_date || event.start_date || '').replace(/-/g, '');
    const url = window.location.href;
    return (
      'https://www.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(event.title)}` +
      `&dates=${start}/${end}` +
      `&details=${encodeURIComponent('Details: ' + url)}`
    );
  })() : '#';

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
            area_id,
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

        setEvent({
          ...ev,
          latitude: ev.latitude != null ? Number(ev.latitude) : null,
          longitude: ev.longitude != null ? Number(ev.longitude) : null,
          imageUrl: publicUrl,
          owner_id: post.user_id,
        });
      } catch (err) {
        console.error(err);
        setError('Could not load event.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Fetch siblings same-day
  useEffect(() => {
    if (!event) return;
    (async () => {
      const { data } = await supabase
        .from('big_board_events')
        .select('slug,title,start_time')
        .eq('start_date', event.start_date)
        .order('start_time',{ ascending: true });
      setSiblings(data || []);
    })();
  }, [event]);

  // Fetch event poster profile
  useEffect(() => {
    if (!event?.owner_id) {
      setPoster(null);
      return;
    }

    let active = true;

    (async () => {
      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('username,slug')
          .eq('id', event.owner_id)
          .single();
        if (error) throw error;
        if (active) {
          setPoster({
            id: event.owner_id,
            username: prof?.username || 'User',
            slug: prof?.slug || null,
          });
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setPoster({
            id: event.owner_id,
            username: 'User',
            slug: null,
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [event?.owner_id]);

  useEffect(() => {
    if (!event?.area_id) {
      setArea(null);
      return;
    }

    let active = true;

    supabase
      .from('areas')
      .select('name,short_name,slug')
      .eq('id', event.area_id)
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setArea(data || null);
      })
      .catch(err => {
        console.error(err);
        if (active) setArea(null);
      });

    return () => {
      active = false;
    };
  }, [event?.area_id]);

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
  const endDateObj = event.end_date ? parseLocalYMD(event.end_date) : null;

  let dateRangeLabel = '';
  if (startDateObj) {
    if (endDateObj && endDateObj.getTime() !== startDateObj.getTime()) {
      const sameMonth =
        startDateObj.getFullYear() === endDateObj.getFullYear() &&
        startDateObj.getMonth() === endDateObj.getMonth();
      if (sameMonth) {
        dateRangeLabel = `${startDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${endDateObj.toLocaleDateString('en-US', { day: 'numeric' })}, ${startDateObj.getFullYear()}`;
      } else if (startDateObj.getFullYear() === endDateObj.getFullYear()) {
        dateRangeLabel = `${startDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${endDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${startDateObj.getFullYear()}`;
      } else {
        dateRangeLabel = `${startDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} – ${endDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      }
    } else {
      dateRangeLabel = startDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }

  const timeRangeLabel = event.start_time
    ? event.end_time
      ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
      : formatTime(event.start_time)
    : '';

  const rawDesc = event.description || '';
  const metaDesc = rawDesc.length > 155 ? `${rawDesc.slice(0, 152)}…` : rawDesc;
  const seoDescription = metaDesc || FALLBACK_BIG_BOARD_DESCRIPTION;

  const absoluteImage = ensureAbsoluteUrl(event.imageUrl);
  const ogImage = absoluteImage || DEFAULT_OG_IMAGE;
  const formattedDate = startDateObj
    ? startDateObj.toLocaleDateString('en-US',{ month:'long', day:'numeric', year:'numeric' })
    : '';
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

  const headerTags = tagsList.filter(t => selectedTags.includes(t.id));
  const shortAddress = event.address ? event.address.split(',')[0].trim() : '';
  const areaLabel = area?.short_name || area?.name || '';
  const posterHandle = poster?.username ? poster.username.replace(/^@/, '') : '';
  const fullAddressLink = event.address
    ? `https://maps.google.com?q=${encodeURIComponent(event.address)}`
    : '';
  const hasDescription = rawDesc.trim().length > 0;
  const hasLocation = Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
  const mapEvents = hasLocation && startDateObj
    ? [{
        id: event.id,
        title: event.title,
        latitude: event.latitude,
        longitude: event.longitude,
        startDate: startDateObj,
        endDate: endDateObj || startDateObj,
        detailPath: `/big-board/${event.slug}`,
        source_table: 'big_board_events',
      }]
    : [];
  const favoriteStateClasses = isFavorite
    ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
    : 'border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-50';

  // Prev/Next logic
  const currentIndex = siblings.findIndex(e => e.slug === slug);
  const prev = siblings.length
    ? siblings[(currentIndex - 1 + siblings.length) % siblings.length]
    : null;
  const next = siblings.length
    ? siblings[(currentIndex + 1) % siblings.length]
    : null;

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

      <main className="flex-grow bg-white pt-28 pb-16">
        <header className="sticky top-[72px] z-30 px-4 sm:top-[80px]">
          <div className="relative">
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-screen -translate-x-1/2 border-b border-gray-100 bg-white/95 backdrop-blur" />
            <div className="relative mx-auto flex max-w-5xl flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{event.title}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                  {dateRangeLabel && (
                    <span className="font-semibold text-gray-900">{dateRangeLabel}</span>
                  )}
                  {timeRangeLabel && <span>{timeRangeLabel}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                  {areaLabel && (
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                      <MapPin className="h-4 w-4" />
                      {areaLabel}
                    </span>
                  )}
                  {shortAddress && fullAddressLink && (
                    <a
                      href={fullAddressLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-gray-600 transition hover:text-indigo-600 hover:underline"
                    >
                      {shortAddress}
                    </a>
                  )}
                </div>
                {!!headerTags.length && (
                  <div className="flex flex-wrap gap-2">
                    {headerTags.map((tag, i) => (
                      <Link
                        key={tag.id}
                        to={`/tags/${tag.name.toLowerCase()}`}
                        className={`${pillStyles[i % pillStyles.length]} rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide`}
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
                {posterHandle && (
                  <div className="text-sm text-gray-500">
                    Submitted by{' '}
                    {poster?.slug ? (
                      <Link
                        to={`/u/${poster.slug}`}
                        className="font-semibold text-gray-700 transition hover:text-indigo-600"
                      >
                        @{posterHandle}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-700">@{posterHandle}</span>
                    )}
                  </div>
                )}
              </div>
              {!isEditing && (
                <div className="hidden shrink-0 lg:flex">
                  <button
                    type="button"
                    onClick={handleFavorite}
                    disabled={favLoading}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${favoriteStateClasses}`}
                  >
                    <CalendarCheck className="h-5 w-5" />
                    {isFavorite ? 'In the Plans' : 'Add to Plans'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-10 px-4">
          {(prev || next) && (
            <div className="flex items-center justify-between text-sm font-medium text-indigo-600">
              {prev ? (
                <button
                  type="button"
                  onClick={() => navigate(`/big-board/${prev.slug}`)}
                  className="inline-flex items-center gap-2 hover:text-indigo-800"
                >
                  <span aria-hidden="true">←</span>
                  <span className="inline-block max-w-[12rem] truncate align-middle">{prev.title}</span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button
                  type="button"
                  onClick={() => navigate(`/big-board/${next.slug}`)}
                  className="inline-flex items-center gap-2 text-right hover:text-indigo-800"
                >
                  <span className="inline-block max-w-[12rem] truncate text-right align-middle">{next.title}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <span />
              )}
            </div>
          )}

          {!isEditing && (
            <div className="lg:hidden">
              <button
                type="button"
                onClick={handleFavorite}
                disabled={favLoading}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${favoriteStateClasses}`}
              >
                <CalendarCheck className="h-5 w-5" />
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">About this event</h2>
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                {/* Title */}
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
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    rows="3"
                    value={formData.description}
                    onChange={handleChange}
                    className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {/* Address with suggestions */}
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
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
                {/* Times */}
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
                {/* Dates */}
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
                {/* Tags */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tags</label>
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
                {/* Save / Cancel */}
                <div className="flex flex-wrap gap-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded bg-green-600 py-2 text-white disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 rounded bg-gray-200 py-2 text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {hasDescription ? (
                  <p className="whitespace-pre-line text-base leading-7 text-gray-700">{event.description}</p>
                ) : (
                  <p className="text-base text-gray-500">No description has been added yet.</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
                  {event.link && (
                    <a
                      href={event.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 transition hover:text-indigo-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      See original listing
                    </a>
                  )}
                  {event.owner_id === user?.id && (
                    <>
                      <button
                        type="button"
                        onClick={startEditing}
                        className="inline-flex items-center gap-1 text-indigo-600 transition hover:text-indigo-800"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1 text-rose-600 transition hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          <div className="overflow-hidden rounded-3xl bg-gray-100 shadow-sm">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-auto w-full object-cover"
            />
          </div>

          <section className="flex flex-wrap items-center gap-6 text-sm font-medium text-indigo-600">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 text-indigo-600 transition hover:text-indigo-800 hover:underline"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <a
              href={gcalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 transition hover:text-indigo-800 hover:underline"
            >
              <CalendarPlus className="h-4 w-4" />
              Google Calendar
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-indigo-600 transition hover:text-indigo-800 hover:underline"
            >
              <span aria-hidden="true">←</span>
              Back to Events
            </Link>
          </section>

          {event.address && (
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-700">Address: </span>
              {fullAddressLink ? (
                <a
                  href={fullAddressLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {event.address}
                </a>
              ) : (
                event.address
              )}
            </div>
          )}

          {mapEvents.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Where it's happening</h2>
              <MonthlyEventsMap events={mapEvents} height={360} />
            </section>
          )}
        </div>

        <div className="mx-auto mt-16 w-full max-w-5xl px-4">
          <div className="border-t border-gray-200 pt-8 pb-12">
            <h2 className="mb-6 text-center text-2xl font-semibold text-gray-800">
              More Upcoming Community Submissions
            </h2>
            {loadingMore ? (
              <p className="text-center text-gray-500">Loading…</p>
            ) : moreEvents.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming submissions.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                      className="flex flex-col overflow-hidden rounded-xl bg-white shadow transition hover:shadow-lg"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-center text-xs font-semibold uppercase tracking-wide text-white">
                          COMMUNITY SUBMISSION
                        </div>
                        <img
                          src={evItem.imageUrl}
                          alt={evItem.title}
                          className="h-full w-full object-cover object-center"
                        />
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4 text-center">
                        <h3 className="mb-2 text-lg font-semibold text-gray-800">
                          {evItem.title}
                        </h3>
                        <span className="text-sm text-gray-600">{prefix}, {md}</span>
                        {!!moreTagMap[evItem.id]?.length && (
                          <div className="mt-2 flex flex-wrap justify-center gap-1">
                            {moreTagMap[evItem.id].map((tag, i) => (
                              <Link
                                key={tag.slug}
                                to={`/tags/${tag.slug}`}
                                className={`${pillStyles[i % pillStyles.length]} rounded-full px-2 py-1 text-xs font-semibold transition hover:opacity-80`}
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
        </div>

        <SubmitEventSection onNext={file => {
          setInitialFlyer(file);
          setModalStartStep(2);
          setShowFlyerModal(true);
        }} />
      </main>
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

