// src/BigBoardEventPage.jsx
import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  lazy,
  Suspense,
  useMemo,
} from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Map, Marker } from 'react-map-gl';
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
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
} from './utils/seoHelpers.js';
import { primeAreaLookup, resolveAreaName } from './utils/areaLookup.js';

const FALLBACK_BIG_BOARD_TITLE = 'Community Event – Our Philly';
const FALLBACK_BIG_BOARD_DESCRIPTION =
  'Discover community-submitted events happening around Philadelphia with Our Philly.';
const CommentsSection = lazy(() => import('./CommentsSection'));
import {
  CalendarCheck,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

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

  // Post flyer modal
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);

  // Event poster info
  const [poster, setPoster] = useState(null);
  const [navStackHeight, setNavStackHeight] = useState(0);
  const [shouldRenderMap, setShouldRenderMap] = useState(false);
  const [mapErrored, setMapErrored] = useState(false);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const observed = [];

    const updateOffset = () => {
      const navEl = document.querySelector('[data-nav-root]');
      const tagEl = document.querySelector('[data-tag-rail]');
      const navHeight = navEl?.getBoundingClientRect().height || 0;
      const tagHeight = tagEl?.getBoundingClientRect().height || 0;
      setNavStackHeight(navHeight + tagHeight);
    };

    const attachObservers = () => {
      if (typeof ResizeObserver === 'undefined') return;
      const navEl = document.querySelector('[data-nav-root]');
      const tagEl = document.querySelector('[data-tag-rail]');

      const ensureObserved = element => {
        if (!element) return;
        if (observed.some(entry => entry.element === element)) return;
        const observer = new ResizeObserver(updateOffset);
        observer.observe(element);
        observed.push({ element, observer });
      };

      ensureObserved(navEl);
      ensureObserved(tagEl);
    };

    updateOffset();
    attachObservers();
    window.addEventListener('resize', updateOffset);

    const refreshTimers = [
      window.setTimeout(() => {
        updateOffset();
        attachObservers();
      }, 200),
      window.setTimeout(() => {
        updateOffset();
        attachObservers();
      }, 800),
    ];

    return () => {
      window.removeEventListener('resize', updateOffset);
      refreshTimers.forEach(timer => window.clearTimeout(timer));
      observed.forEach(({ observer }) => observer.disconnect());
    };
  }, []);

  const hasValidCoordinates = useMemo(
    () => Number.isFinite(event?.latitude) && Number.isFinite(event?.longitude),
    [event?.latitude, event?.longitude],
  );

  useEffect(() => {
    setMapErrored(false);
    setShouldRenderMap(false);
  }, [event?.id]);

  useEffect(() => {
    if (!hasValidCoordinates) {
      setShouldRenderMap(false);
      return;
    }
    const element = mapContainerRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldRenderMap(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldRenderMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [hasValidCoordinates]);

  // Helpers
  function parseLocalYMD(str) {
    if (!str || typeof str !== 'string') return null;
    const [yStr, mStr, dStr] = str.split('-');
    const year = Number.parseInt(yStr, 10);
    const month = Number.parseInt(mStr, 10);
    const day = Number.parseInt(dStr, 10);
    if (![year, month, day].every(num => Number.isInteger(num))) {
      return null;
    }
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseTimeOnDate(dateStr, timeStr) {
    if (!dateStr || !timeStr || typeof timeStr !== 'string') return null;
    const [hourStr, minuteStr = '00'] = timeStr.split(':');
    const hour = Number.parseInt(hourStr, 10);
    const minute = Number.parseInt(minuteStr, 10);
    if (!Number.isInteger(hour)) return null;
    const baseDate = parseLocalYMD(dateStr);
    if (!baseDate) return null;
    const result = new Date(baseDate);
    result.setHours(hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  // Fetch main event (including lat/lng)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const baseSelect = `
            id, post_id, title, description, link,
            start_date, end_date, start_time, end_time,
            address, latitude, longitude, area_id,
            created_at, slug
          `;

        const withJoinSelect = `${baseSelect},
            areas:areas(name, short_name)
          `;

        let { data: ev, error: evErr, status } = await supabase
          .from('big_board_events')
          .select(withJoinSelect)
          .eq('slug', slug)
          .maybeSingle();

        if (evErr && status === 400) {
          ({ data: ev, error: evErr } = await supabase
            .from('big_board_events')
            .select(baseSelect)
            .eq('slug', slug)
            .maybeSingle());
        }

        if (evErr) throw evErr;
        if (!ev) {
          setError('Could not load event.');
          return;
        }

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

        const areaNameFromJoin = ev.areas?.short_name || ev.areas?.name || null;
        if (ev.area_id != null && areaNameFromJoin) {
          primeAreaLookup({ [ev.area_id]: areaNameFromJoin });
        }

        const derivedAreaName = areaNameFromJoin || resolveAreaName(ev.area_id) || null;
        const { areas, ...eventWithoutAreas } = ev;
        setEvent({
          ...eventWithoutAreas,
          imageUrl: publicUrl,
          owner_id: post.user_id,
          areaName: derivedAreaName,
        });
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
    let cancelled = false;
    (async () => {
      try {
        const { data: prof, error: profError } = await supabase
          .from('profiles')
          .select('username,slug')
          .eq('id', event.owner_id)
          .single();
        if (profError) throw profError;
        if (!cancelled) {
          setPoster({
            id: event.owner_id,
            username: prof?.username || 'User',
            slug: prof?.slug || null,
          });
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setPoster({
            id: event.owner_id,
            username: 'User',
            slug: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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

  // Compute when details
  const startDateObj = parseLocalYMD(event.start_date);
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const daysDiff =
    startDateObj != null
      ? Math.round((startDateObj - todayStart) / (1000 * 60 * 60 * 24))
      : null;
  const relativeLabel =
    startDateObj == null
      ? 'Date TBA'
      : daysDiff === 0
      ? 'Today'
      : daysDiff === 1
      ? 'Tomorrow'
      : startDateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

  const formattedDate = startDateObj
    ? startDateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const { dateText, timeText } = useMemo(() => {
    const dateLabel = startDateObj ? DATE_LABEL_FORMATTER.format(startDateObj) : 'Date TBA';
    const startTimeDate = parseTimeOnDate(event.start_date, event.start_time);
    const endTimeDate = parseTimeOnDate(event.start_date, event.end_time);

    if (!startTimeDate) {
      return { dateText: dateLabel, timeText: 'Time TBA' };
    }

    const startParts = TIME_FORMATTER.formatToParts(startTimeDate);
    const endParts = endTimeDate ? TIME_FORMATTER.formatToParts(endTimeDate) : null;
    const startPeriod = startParts.find(part => part.type === 'dayPeriod')?.value || '';
    const endPeriod = endParts?.find(part => part.type === 'dayPeriod')?.value || '';

    const buildTimeString = (parts, omitPeriod) =>
      parts
        .filter(part => !(omitPeriod && part.type === 'dayPeriod'))
        .map(part => part.value)
        .join('')
        .replace(/\u202f/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (endParts) {
      const startString = buildTimeString(startParts, startPeriod && endPeriod && startPeriod === endPeriod);
      const endString = buildTimeString(endParts, false);
      return { dateText: dateLabel, timeText: `${startString}–${endString}` };
    }

    return { dateText: dateLabel, timeText: buildTimeString(startParts, false) };
  }, [event.start_date, event.start_time, event.end_time, startDateObj]);
  const shortAddress = useMemo(() => {
    if (!event.address || typeof event.address !== 'string') return '';
    const parts = event.address
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
    if (!parts.length) return '';
    return parts.slice(0, 2).join(', ');
  }, [event.address]);
  const neighborhoodName = resolveAreaName(event.area_id) || event.areaName || null;
  const neighborhoodLabel = neighborhoodName || 'Neighborhood TBA';
  const neighborhoodAriaLabel = `Neighborhood: ${neighborhoodLabel}`;
  const whenDisplay = `${dateText} • ${timeText}`;
  const stickyTop = navStackHeight + 10;
  const stickyOffset = Math.max(stickyTop, 0);
  const contentPaddingTop = navStackHeight + 24;
  const mapboxToken = geocoderToken;
  const showMap = hasValidCoordinates && mapboxToken && !mapErrored;
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

      <main className="flex-grow bg-white" style={{ paddingTop: contentPaddingTop }}>
        <div
          className="sticky z-40"
          style={{ top: stickyOffset, paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
        >
          <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 md:flex-row md:items-center md:gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2">
                  <h1 className="truncate text-lg font-semibold text-gray-900 sm:text-xl md:text-2xl">
                    {event.title || 'Untitled Event'}
                  </h1>
                  {relativeLabel && relativeLabel !== 'Date TBA' && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                      {relativeLabel}
                    </span>
                  )}
                  <div className="text-sm font-medium text-gray-700 sm:text-base">{whenDisplay}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 sm:text-base">
                    <span className="inline-flex items-center gap-1" aria-label={neighborhoodAriaLabel}>
                      <span aria-hidden="true">📍</span>
                      <span className="font-semibold text-indigo-700">{neighborhoodLabel}</span>
                    </span>
                    {shortAddress && <span className="text-gray-500">• {shortAddress}</span>}
                  </div>
                  {!!selectedTags.length && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {tagsList
                        .filter(tag => selectedTags.includes(tag.id))
                        .map((tag, i) => (
                          <Link
                            key={tag.id}
                            to={`/tags/${tag.name.toLowerCase()}`}
                            className={`${pillStyles[i % pillStyles.length]} rounded-full px-4 py-2 text-lg font-semibold`}
                          >
                            #{tag.name}
                          </Link>
                        ))}
                    </div>
                  )}
                  {poster?.username && (
                    <div className="text-sm text-gray-500">
                      Submitted by{' '}
                      {poster.slug ? (
                        <Link
                          to={`/u/${poster.slug}`}
                          className="font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          @{poster.username}
                        </Link>
                      ) : (
                        <span className="font-medium">@{poster.username}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="hidden shrink-0 md:flex">
                <button
                  type="button"
                  onClick={handleFavorite}
                  disabled={favLoading}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isFavorite
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  <CalendarCheck className="h-4 w-4" />
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mt-4 md:hidden">
            <button
              type="button"
              onClick={handleFavorite}
              disabled={favLoading}
              className={`flex w-full items-center justify-center gap-2 rounded-md py-3 font-semibold transition ${
                isFavorite
                  ? 'bg-indigo-600 text-white'
                  : 'border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              <CalendarCheck className="h-5 w-5" />
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          </div>

          {isEditing ? (
            <section className="mt-8 space-y-6">
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
                    rows="3"
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
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border bg-white">
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
                <div className="flex space-x-4">
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
                    className="flex-1 rounded bg-gray-300 py-2 text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <>
              {event.description && (
                <section className="mt-8 space-y-4" aria-labelledby="about-event-heading">
                  <h2 id="about-event-heading" className="text-2xl font-semibold text-gray-900">
                    About this event
                  </h2>
                  <p className="whitespace-pre-line text-base leading-relaxed text-gray-700">
                    {event.description}
                  </p>
                  {(event.link || event.owner_id === user?.id) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
                      {event.link && (
                        <a
                          href={event.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                        >
                          See original listing
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {event.owner_id === user?.id && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-600">
                          <button
                            type="button"
                            onClick={startEditing}
                            className="inline-flex items-center gap-1 text-sm font-semibold hover:text-indigo-700"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            className="inline-flex items-center gap-1 text-sm font-semibold hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {!event.description && (event.link || event.owner_id === user?.id) && (
                <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
                  {event.link && (
                    <a
                      href={event.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                    >
                      See original listing
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {event.owner_id === user?.id && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-600">
                      <button
                        type="button"
                        onClick={startEditing}
                        className="inline-flex items-center gap-1 text-sm font-semibold hover:text-indigo-700"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1 text-sm font-semibold hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {showMap && (
            <div
              ref={mapContainerRef}
              className="mt-8 overflow-hidden rounded-2xl border border-gray-200 shadow-sm"
              style={{ minHeight: 320 }}
            >
              {shouldRenderMap ? (
                <Map
                  reuseMaps
                  mapboxAccessToken={mapboxToken}
                  initialViewState={{
                    longitude: Number(event.longitude),
                    latitude: Number(event.latitude),
                    zoom: 13,
                  }}
                  mapStyle="mapbox://styles/mapbox/light-v11"
                  style={{ width: '100%', height: '100%' }}
                  scrollZoom={false}
                  doubleClickZoom={false}
                  dragRotate={false}
                  onError={evt => {
                    if (!mapErrored) {
                      console.error('Mapbox map failed to load', evt?.error || evt);
                      setMapErrored(true);
                    }
                  }}
                >
                  <Marker
                    longitude={Number(event.longitude)}
                    latitude={Number(event.latitude)}
                    anchor="bottom"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg">
                      ●
                    </span>
                  </Marker>
                </Map>
              ) : (
                <div className="h-80 w-full bg-gray-100" />
              )}
            </div>
          )}

          {event.imageUrl && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
              <img
                src={event.imageUrl}
                alt={event.title}
                loading="lazy"
                className="mx-auto block h-auto w-full max-h-[520px] object-contain"
              />
            </div>
          )}

          <Suspense fallback={<div className="mt-12 text-center text-sm text-gray-500">Loading comments…</div>}>
            <div className="mt-12">
              <CommentsSection source_table="big_board_events" event_id={event.id} />
            </div>
          </Suspense>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mt-12 border-t border-gray-200 pt-8">
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
                  const diff = dt
                    ? Math.round((dt - new Date(new Date().setHours(0, 0, 0, 0))) / (1000 * 60 * 60 * 24))
                    : null;
                  const prefix =
                    diff === 0
                      ? 'Today'
                      : diff === 1
                      ? 'Tomorrow'
                      : dt
                      ? dt.toLocaleDateString('en-US', { weekday: 'long' })
                      : 'Date TBA';
                  const md = dt
                    ? dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                    : '';
                  return (
                    <Link
                      key={evItem.id}
                      to={`/big-board/${evItem.slug}`}
                      className="flex flex-col overflow-hidden rounded-xl bg-white shadow transition hover:shadow-lg"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-xs font-semibold uppercase tracking-wide text-white">
                          COMMUNITY SUBMISSION
                        </div>
                        <img
                          src={evItem.imageUrl}
                          alt={evItem.title}
                          loading="lazy"
                          className="h-full w-full object-cover object-center"
                        />
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4 text-center">
                        <h3 className="mb-2 text-lg font-semibold text-gray-800 line-clamp-2">
                          {evItem.title}
                        </h3>
                        <span className="text-sm text-gray-600">
                          {prefix}
                          {md ? `, ${md}` : ''}
                        </span>
                        {!!moreTagMap[evItem.id]?.length && (
                          <div className="mt-2 flex flex-wrap justify-center gap-1">
                            {moreTagMap[evItem.id].map((tag, i) => (
                              <Link
                                key={`${evItem.id}-${tag.slug}`}
                                to={`/tags/${tag.slug}`}
                                className={`${pillStyles[i % pillStyles.length]} rounded-full px-2 py-1 text-xs font-semibold hover:opacity-80`}
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

        <SubmitEventSection
          onNext={file => {
            setInitialFlyer(file);
            setModalStartStep(2);
            setShowFlyerModal(true);
          }}
        />
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
