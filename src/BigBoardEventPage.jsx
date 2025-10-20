// src/BigBoardEventPage.jsx
import React, { useEffect, useState, useContext, useRef, lazy, Suspense, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import useFollow from './utils/useFollow';
import PostFlyerModal from './PostFlyerModal';
import FloatingAddButton from './FloatingAddButton';
import TriviaTonightBanner from './TriviaTonightBanner';
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
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
const CommentsSection = lazy(() => import('./CommentsSection'));
import {
  CalendarCheck,
  CalendarPlus,
  ExternalLink,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';

const STATIC_AREA_LOOKUP = Object.freeze({});
const FALLBACK_NEIGHBORHOOD = 'Neighborhood TBA';
const DEFAULT_STICKY_BUFFER = 10;

function formatHeaderDateLabel(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 'Date TBA';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 'Date TBA';
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return 'Date TBA';
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatHeaderTimePart(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const [hourStr, minuteStr = '00'] = timeStr.split(':');
  const hour = Number.parseInt(hourStr, 10);
  if (!Number.isFinite(hour)) return '';
  const normalizedMinute = minuteStr.padStart(2, '0').slice(0, 2);
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = ((hour + 11) % 12) + 1;
  return `${normalizedHour}:${normalizedMinute} ${period}`;
}

function formatHeaderWhenLabel(startDate, startTime, endTime) {
  const dateLabel = formatHeaderDateLabel(startDate);
  const startLabel = formatHeaderTimePart(startTime);
  const endLabel = formatHeaderTimePart(endTime);
  const parts = [];
  if (dateLabel) parts.push(dateLabel);
  if (startLabel && endLabel) {
    parts.push(`${startLabel}–${endLabel}`);
  } else if (startLabel) {
    parts.push(startLabel);
  } else {
    parts.push('Time TBA');
  }
  return parts.join(' • ');
}

function extractAreaLookupFromWindow() {
  if (typeof window === 'undefined') return {};
  const merged = {};
  const candidates = [
    window.__AREA_LOOKUP__,
    window.__AREAS_LOOKUP__,
    window.__AREAS_CACHE__,
    window.__OURPHILLY_AREA_LOOKUP__,
  ];
  candidates.forEach(candidate => {
    if (!candidate || typeof candidate !== 'object') return;
    Object.entries(candidate).forEach(([key, value]) => {
      if (!key) return;
      if (value) merged[key] = value;
    });
  });
  try {
    const stored = window.localStorage?.getItem('areaLookupCache');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, value]) => {
          if (!key) return;
          if (value) merged[key] = value;
        });
      }
    }
  } catch (err) {
    // ignore storage access errors
  }
  return merged;
}

function BigBoardEventStickyHeader({
  title,
  whenLabel,
  areaName,
  addressLine,
  tags,
  pillStyles,
  submittedBy,
  submittedBySlug,
  onAddToPlans,
  isFavorite,
  favLoading,
}) {
  const [stickyTop, setStickyTop] = useState(128 + DEFAULT_STICKY_BUFFER);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const measure = () => {
      const nav = document.querySelector('nav');
      if (!nav) {
        setStickyTop(128 + DEFAULT_STICKY_BUFFER);
        return;
      }
      const rect = nav.getBoundingClientRect();
      const buffer = DEFAULT_STICKY_BUFFER;
      setStickyTop(Math.ceil(rect.height) + buffer);
    };
    measure();
    const nav = document.querySelector('nav');
    let observer;
    if (window.ResizeObserver && nav) {
      observer = new ResizeObserver(measure);
      observer.observe(nav);
    }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (observer) observer.disconnect();
    };
  }, []);

  const backgroundStyle = {
    marginLeft: 'calc(-50vw + 50%)',
    marginRight: 'calc(-50vw + 50%)',
  };

  return (
    <div className="sticky z-40" style={{ top: `${stickyTop}px` }}>
      <div
        className="border-b border-gray-200 bg-white/95 backdrop-blur"
        style={backgroundStyle}
      >
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <p className="truncate text-base font-semibold text-gray-900 md:text-lg" title={title}>
                {title}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
                {whenLabel && <span>{whenLabel}</span>}
                <span className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                  <span aria-hidden="true" role="img">📍</span>
                  <span className="font-semibold text-indigo-700">
                    {areaName || FALLBACK_NEIGHBORHOOD}
                  </span>
                  {addressLine && (
                    <span className="text-gray-500">— {addressLine}</span>
                  )}
                </span>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {tags.map((tag, index) => (
                    <Link
                      key={tag.id}
                      to={`/tags/${tag.name.toLowerCase()}`}
                      className={`${pillStyles[index % pillStyles.length]} rounded-full px-3 py-1 text-xs font-semibold md:text-sm`}
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              )}
              {submittedBy && (
                <div className="text-xs text-gray-600 md:text-sm">
                  Submitted by{' '}
                  {submittedBySlug ? (
                    <Link to={`/u/${submittedBySlug}`} className="font-semibold text-indigo-700">
                      @{submittedBy}
                    </Link>
                  ) : (
                    <span className="font-semibold text-indigo-700">@{submittedBy}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAddToPlans}
              disabled={favLoading}
              className={`hidden rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition md:inline-flex md:items-center md:gap-2 ${
                isFavorite
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-white text-indigo-600 hover:bg-indigo-50'
              } ${favLoading ? 'opacity-60' : ''}`}
            >
              <CalendarPlus className="h-4 w-4" />
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const areaLookup = useMemo(() => {
    const combined = { ...STATIC_AREA_LOOKUP };
    const extracted = extractAreaLookupFromWindow();
    Object.entries(extracted).forEach(([key, value]) => {
      if (!key || value == null || value === '') return;
      if (combined[key] == null) {
        combined[key] = value;
      }
    });
    return combined;
  }, []);

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

  // Event poster info
  const [poster, setPoster] = useState(null);
  const {
    isFollowing: isPosterFollowing,
    toggleFollow: togglePosterFollow,
    loading: followLoading,
  } = useFollow(event?.owner_id);

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

        setEvent({ ...ev, imageUrl: publicUrl, owner_id: post.user_id });
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

  // Compute whenText
  const startDateObj = parseLocalYMD(event.start_date);
  const daysDiff = Math.round((startDateObj - new Date(new Date().setHours(0,0,0,0))) / (1000*60*60*24));
  const whenText =
    daysDiff === 0 ? 'Today' :
    daysDiff === 1 ? 'Tomorrow' :
    startDateObj.toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' });

  const formattedDate = startDateObj.toLocaleDateString('en-US',{ month:'long', day:'numeric', year:'numeric' });
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

  // Prev/Next logic
  const currentIndex = siblings.findIndex(e => e.slug === slug);
  const prev = siblings.length
    ? siblings[(currentIndex - 1 + siblings.length) % siblings.length]
    : null;
  const next = siblings.length
    ? siblings[(currentIndex + 1) % siblings.length]
    : null;

  const headerWhenLabel = formatHeaderWhenLabel(
    event.start_date,
    event.start_time,
    event.end_time
  );

  const headerAreaName = (() => {
    if (event.area_id == null) return null;
    const idVariants = [event.area_id, String(event.area_id)];
    for (const key of idVariants) {
      if (key in areaLookup && areaLookup[key]) {
        return areaLookup[key];
      }
    }
    return null;
  })();

  const headerAddressLine = (() => {
    const addr = event.address;
    if (!addr || typeof addr !== 'string') return '';
    const [first] = addr.split(',');
    const trimmed = first?.trim();
    if (trimmed) return trimmed;
    return addr.trim();
  })();

  const headerTags = tagsList.filter(tag => selectedTags.includes(tag.id));

  const submittedByUsername = (() => {
    const username = poster?.username || '';
    if (!username) return '';
    return username.replace(/^@+/, '');
  })();

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

      <main className="flex-grow relative mt-32">
          <BigBoardEventStickyHeader
            title={event.title}
            whenLabel={headerWhenLabel}
            areaName={headerAreaName}
            addressLine={headerAddressLine}
            tags={headerTags}
            pillStyles={pillStyles}
            submittedBy={submittedByUsername}
            submittedBySlug={poster?.slug || null}
            onAddToPlans={handleFavorite}
            isFavorite={isFavorite}
            favLoading={favLoading}
          />
          {/* Hero banner */}
          <div
            className="w-full h-[40vh] bg-cover bg-center"
            style={{ backgroundImage: `url(${event.imageUrl})` }}
          />

          {!user && (
            <div className="w-full bg-indigo-600 text-white text-center py-4 text-xl sm:text-2xl">
              <Link to="/login" className="underline font-semibold">Log in</Link> or <Link to="/signup" className="underline font-semibold">sign up</Link> free to add to your Plans
            </div>
          )}

          {/* Overlapping centered card */}
          <div className={`relative max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8 transform z-10 ${user ? '-mt-24' : ''}`}>
            {prev && (
              <button
                onClick={() => navigate(`/big-board/${prev.slug}`)}
                className="absolute top-1/2 left-[-1.5rem] -translate-y-1/2 bg-gray-100 p-2 rounded-full shadow hover:bg-gray-200"
              >←</button>
            )}
            {next && (
              <button
                onClick={() => navigate(`/big-board/${next.slug}`)}
                className="absolute top-1/2 right-[-1.5rem] -translate-y-1/2 bg-gray-100 p-2 rounded-full shadow hover:bg-gray-200"
              >→</button>
            )}
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">{event.title}</h1>
              <p className="text-lg font-medium">
                {whenText}
                {event.start_time && ` — ${formatTime(event.start_time)}`}
                {event.address && (
                  <> • <a
                    href={`https://maps.google.com?q=${encodeURIComponent(event.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {event.address}
                  </a></>
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {tagsList
                  .filter(t => selectedTags.includes(t.id))
                  .map((tag, i) => (
                    <Link
                      key={tag.id}
                      to={`/tags/${tag.name.toLowerCase()}`}
                      className={`${pillStyles[i % pillStyles.length]} px-4 py-2 rounded-full text-lg font-semibold`}
                    >
                      #{tag.name}
                    </Link>
                  ))}
              </div>
            </div>
          </div>

          {poster && (
            <div className="max-w-4xl mx-auto mt-6 px-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg py-3 flex flex-wrap sm:flex-nowrap items-center justify-center gap-3 text-center">
                <span className="text-2xl sm:text-3xl font-[Barrio] whitespace-nowrap">Posted by</span>
                <Link to={`/u/${poster.slug}`} className="flex items-center gap-2">
                  {poster.image ? (
                    <img src={poster.image} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300" />
                  )}
                  <span className="text-2xl sm:text-3xl font-[Barrio] break-words">{poster.username}</span>
                </Link>
                {poster.cultures?.map(c => (
                  <span key={c.emoji} title={c.name} className="text-2xl sm:text-3xl">
                    {c.emoji}
                  </span>
                ))}
                {user && user.id !== poster.id && (
                  <button
                    onClick={togglePosterFollow}
                    disabled={followLoading}
                    className="border border-indigo-700 rounded px-2 py-0.5 text-sm hover:bg-indigo-700 hover:text-white transition"
                  >
                    {isPosterFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Description, form / details, and image */}
          <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
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

                    <div className="flex items-center justify-center gap-6 pt-2">
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 text-indigo-600 hover:underline"
                      >
                        <Share2 className="w-5 h-5" />
                        Share
                      </button>
                      <a
                        href={gcalLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-indigo-600 hover:underline"
                      >
                        <CalendarPlus className="w-5 h-5" />
                        Google Calendar
                      </a>
                    </div>

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

                    <Link
                      to="/"
                      className="block text-center text-indigo-600 hover:underline font-medium"
                    >
                      ← Back to Events
                    </Link>
                  </div>
                  </>
                )}
              </div>

            {/* Right: full image */}
            <div>
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-auto rounded-lg shadow-lg max-h-[60vh]"
              />
            </div>
          </div>

          <Suspense fallback={<div>Loading comments…</div>}>
            <CommentsSection
              source_table="big_board_events"
              event_id={event.id}
            />
          </Suspense>

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
