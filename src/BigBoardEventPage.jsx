import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import PostFlyerModal from './PostFlyerModal';
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
import { isTagActive } from './utils/tagUtils';
import Seo from './components/Seo.jsx';
import { getMapboxToken } from './config/mapboxToken.js';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import { CalendarCheck, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
} from './utils/seoHelpers.js';

const FALLBACK_BIG_BOARD_TITLE = 'Community Event – Our Philly';
const FALLBACK_BIG_BOARD_DESCRIPTION =
  'Discover community-submitted events happening around Philadelphia with Our Philly.';
export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const geocoderToken = getMapboxToken();
  const sessionToken = useRef(crypto.randomUUID());
  const suggestRef = useRef(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);

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

  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);
  const [moreTagMap, setMoreTagMap] = useState({});

  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);

  const [poster, setPoster] = useState(null);
  const [areaName, setAreaName] = useState(null);
  const [stickyOffset, setStickyOffset] = useState(0);

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
            address, latitude, longitude, area_id,
            created_at, slug
          `)
          .eq('slug', slug)
          .single();
        if (evErr) throw evErr;

        const { data: post } = await supabase
          .from('big_board_posts')
          .select('image_url, user_id')
          .eq('id', ev.post_id)
          .single();
        const { data: { publicUrl } } = supabase
          .storage.from('big-board')
          .getPublicUrl(post.image_url);

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
        if (ev.area_id != null) {
          try {
            const { data: areaRow, error: areaErr } = await supabase
              .from('areas')
              .select('name')
              .eq('id', ev.area_id)
              .single();
            if (areaErr) throw areaErr;
            setAreaName(areaRow?.name || String(ev.area_id));
          } catch (areaError) {
            console.error('Failed to load area', areaError);
            setAreaName(String(ev.area_id));
          }
        } else {
          setAreaName(null);
        }
      } catch (err) {
        console.error(err);
        setError('Could not load event.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

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
        setPoster({
          id: event.owner_id,
          username: prof?.username || 'User',
          image: img,
          slug: prof?.slug || null,
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [event]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    let navObserver = null;
    let tagObserver = null;
    let mutationObserver = null;

    const measure = () => {
      const navEl = document.querySelector('[data-navbar]');
      const tagEl = document.querySelector('[data-nav-tag-menu]');
      const navHeight = navEl?.getBoundingClientRect().height || 0;
      const tagHeight = tagEl?.getBoundingClientRect().height || 0;
      setStickyOffset(navHeight + tagHeight);
    };

    const observeElements = () => {
      if (typeof ResizeObserver === 'undefined') return;
      const navEl = document.querySelector('[data-navbar]');
      const tagEl = document.querySelector('[data-nav-tag-menu]');

      if (navEl && !navObserver) {
        navObserver = new ResizeObserver(measure);
        navObserver.observe(navEl);
      }

      if (tagEl && !tagObserver) {
        tagObserver = new ResizeObserver(measure);
        tagObserver.observe(tagEl);
      }
    };

    const handleResize = () => {
      measure();
      observeElements();
    };

    window.addEventListener('resize', handleResize);
    measure();
    observeElements();

    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        measure();
        observeElements();
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      navObserver?.disconnect();
      tagObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, []);

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

  const openEdit = () => {
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

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };

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
  const formattedDate = startDateObj
    ? startDateObj.toLocaleDateString('en-US',{ month:'long', day:'numeric', year:'numeric' })
    : null;
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
  const dateLabel = startDateObj
    ? startDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date TBA';
  const startTimeLabel = event.start_time ? formatTime(event.start_time) : null;
  const endTimeLabel = event.end_time ? formatTime(event.end_time) : null;
  let timeLabel = 'Time TBA';
  if (startTimeLabel && endTimeLabel) {
    timeLabel = `${startTimeLabel} – ${endTimeLabel}`;
  } else if (startTimeLabel) {
    timeLabel = startTimeLabel;
  } else if (endTimeLabel) {
    timeLabel = `Ends ${endTimeLabel}`;
  }
  const hasLocation = Boolean(event.address);
  const hasCoordinates = Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
  const mapEvents = hasCoordinates
    ? [
        {
          id: event.id,
          title: event.title,
          latitude: event.latitude,
          longitude: event.longitude,
          startDate: event.start_date,
          endDate: event.end_date || event.start_date,
          source_table: 'big_board_events',
          detailPath: `/big-board/${event.slug}`,
        },
      ]
    : [];
  const actionButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';
  const addToPlansLabel = isFavorite ? 'In the Plans' : 'Add to Plans';
  const activeTags = tagsList.filter(t => selectedTags.includes(t.id));
  const areaLabel = event?.area_id != null ? areaName || null : null;
  const eventLink = event?.link ? ensureAbsoluteUrl(event.link) : null;
  const showAboutBlock = Boolean(event.description || eventLink || event.owner_id === user?.id);

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

      <main className="flex-grow bg-white" style={{ paddingTop: stickyOffset }}>
        <section
          className="sticky z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          style={{ top: stickyOffset, marginTop: -stickyOffset }}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:justify-between md:py-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 md:text-3xl lg:text-4xl">{event.title}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 md:text-base">
                  <span className="font-medium text-gray-900">{dateLabel}</span>
                  <span aria-hidden="true" className="hidden text-gray-300 sm:inline">•</span>
                  <span>{timeLabel}</span>
                  {areaLabel && (
                    <>
                      <span aria-hidden="true" className="hidden text-gray-300 sm:inline">•</span>
                      <span className="text-gray-700">{areaLabel}</span>
                    </>
                  )}
                  {hasLocation && (
                    <>
                      <span aria-hidden="true" className="hidden text-gray-300 sm:inline">•</span>
                      <span className="truncate text-gray-600 sm:max-w-xs md:max-w-sm" title={event.address}>
                        {event.address}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {!!activeTags.length && (
                <div className="flex flex-wrap gap-2">
                  {activeTags.map((tag, i) => (
                    <Link
                      key={tag.id}
                      to={`/tags/${tag.name.toLowerCase()}`}
                      className={`${pillStyles[i % pillStyles.length]} rounded-full px-3 py-1.5 text-sm font-semibold`}
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              )}
              {poster?.username && (
                <p className="text-sm text-gray-500">
                  Submitted by{' '}
                  {poster.slug ? (
                    <Link to={`/u/${poster.slug}`} className="font-medium text-gray-600 hover:text-gray-800">
                      @{poster.username}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-600">@{poster.username}</span>
                  )}
                </p>
              )}
            </div>
            <div className="hidden min-w-[240px] flex-col gap-2 md:flex md:items-end">
              <button
                onClick={handleFavorite}
                disabled={favLoading}
                className={`${actionButtonClasses} w-full ${
                  isFavorite
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                    : 'border border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                <CalendarCheck className="h-4 w-4" />
                {addToPlansLabel}
              </button>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-8 md:pb-16 md:pt-12">
          <div className="space-y-10">
            <div>
              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
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
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Link</label>
                      <input
                        name="link"
                        value={formData.link}
                        onChange={handleChange}
                        className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <input
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        ref={suggestRef}
                        className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      />
                      {!!addressSuggestions.length && (
                        <ul className="mt-2 rounded border border-gray-200 bg-white shadow">
                          {addressSuggestions.map(suggestion => (
                            <li
                              key={suggestion.mapbox_id}
                              className="cursor-pointer px-3 py-2 text-sm hover:bg-indigo-50"
                              onMouseDown={() => pickSuggestion(suggestion)}
                            >
                              {suggestion.name} — {suggestion.place_formatted}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
                            } px-4 py-2 text-sm font-semibold rounded-full`}
                          >
                            {tagOpt.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="inline-flex items-center justify-center rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {showAboutBlock && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
                      <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">About this event</h2>
                      {event.description && (
                        <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-gray-700">
                          {event.description}
                        </p>
                      )}
                      {(eventLink || event.owner_id === user?.id) && (
                        <div
                          className={`flex flex-wrap items-center gap-3 ${
                            event.description ? 'mt-5' : 'mt-4'
                          }`}
                        >
                          {eventLink && (
                            <a
                              href={eventLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                            >
                              <ExternalLink className="h-4 w-4" />
                              See original listing
                            </a>
                          )}
                          {event.owner_id === user?.id && (
                            <>
                              <button
                                type="button"
                                onClick={openEdit}
                                className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={handleDelete}
                                className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="overflow-hidden rounded-3xl bg-gray-100">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="h-full w-full max-h-[70vh] object-contain"
              />
            </div>

            {!!mapEvents.length && (
              <div>
                <MonthlyEventsMap events={mapEvents} height={320} />
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl border-t border-gray-200 px-4 pb-12 pt-10">
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
                      <div className="absolute inset-x-0 bottom-0 bg-indigo-600 py-1 text-center text-xs font-semibold uppercase tracking-wide text-white">
                        COMMUNITY SUBMISSION
                      </div>
                      <img
                        src={evItem.imageUrl}
                        alt={evItem.title}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4 text-center">
                      <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-gray-800">{evItem.title}</h3>
                      <span className="text-sm text-gray-600">{prefix}, {md}</span>
                      {!!moreTagMap[evItem.id]?.length && (
                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                          {moreTagMap[evItem.id].map((tag, i) => (
                            <Link
                              key={tag.slug}
                              to={`/tags/${tag.slug}`}
                              className={`${pillStyles[i % pillStyles.length]} rounded-full px-2 py-1 text-xs font-semibold hover:opacity-80 transition`}
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

        <SubmitEventSection
          onNext={file => {
            setInitialFlyer(file);
            setModalStartStep(2);
            setShowFlyerModal(true);
          }}
        />
      </main>

      <Footer />

      <PostFlyerModal
        isOpen={showFlyerModal}
        onClose={() => setShowFlyerModal(false)}
        startStep={modalStartStep}
        initialFile={initialFlyer}
      />

      <div className="md:hidden">
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 shadow-[0_-6px_24px_rgba(15,23,42,0.1)] backdrop-blur"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <button
            onClick={handleFavorite}
            disabled={favLoading}
            className={`${actionButtonClasses} w-full justify-center ${
              isFavorite
                ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                : 'border border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            {addToPlansLabel}
          </button>
        </div>
      </div>
    </div>
  );

}
