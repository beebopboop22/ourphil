// src/BigBoardEventPage.jsx
import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react';

import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useFollow from './utils/useFollow';
import useEventFavorite from './utils/useEventFavorite';
import { isTagActive } from './utils/tagUtils';
import Seo from './components/Seo.jsx';
import MonthlyEventsMap from './MonthlyEventsMap.jsx';
import { getMapboxToken } from './config/mapboxToken.js';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
} from './utils/seoHelpers.js';
import {
  PHILLY_TIME_ZONE,
  formatWeekdayAbbrev,
  getZonedDate,
  setStartOfDay,
} from './utils/dateUtils';

const CommentsSection = lazy(() => import('./CommentsSection'));

const FALLBACK_BIG_BOARD_TITLE = 'Community Event – Our Philly';
const FALLBACK_BIG_BOARD_DESCRIPTION =
  'Discover community-submitted events happening around Philadelphia with Our Philly.';

const PILL_STYLES = [
  'bg-red-100 text-red-800',
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
];

const RECOMMENDATION_CACHE_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours
const RECOMMENDATION_CACHE_PREFIX = 'big-board-event-recs';

function parseLocalYMD(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if ([y, m, d].some(Number.isNaN)) return null;
  return new Date(y, m - 1, d);
}

function formatTimeLabel(timeStr) {
  if (!timeStr) return '';
  const [hoursStr, minutesStr = '00'] = timeStr.split(':');
  let hours = Number.parseInt(hoursStr, 10);
  if (Number.isNaN(hours)) return '';
  const minutes = minutesStr.padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function formatDateTimeRange(startDate, startTime, endTime) {
  const dateObj = parseLocalYMD(startDate);
  if (!dateObj) return '';
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
  const startLabel = formatTimeLabel(startTime);
  const endLabel = formatTimeLabel(endTime);
  if (startLabel && endLabel) {
    return `${dateLabel} • ${startLabel}–${endLabel}`;
  }
  if (startLabel) {
    return `${dateLabel} • ${startLabel}`;
  }
  return dateLabel;
}

function getShortAddress(address) {
  if (!address) return '';
  return address.split(',')[0]?.trim() || address.trim();
}

function getCacheKey(eventId, type) {
  return `${RECOMMENDATION_CACHE_PREFIX}:${eventId}:${type}`;
}

function readRecommendationCache(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.expires || parsed.expires < Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch (err) {
    console.warn('Failed to read recommendation cache', err);
    return null;
  }
}

function writeRecommendationCache(key, data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        expires: Date.now() + RECOMMENDATION_CACHE_LIFETIME,
        data,
      }),
    );
  } catch (err) {
    console.warn('Failed to store recommendation cache', err);
  }
}

function sortEventsByAreaAndTime(events, areaId) {
  return [...events].sort((a, b) => {
    const aMatches = areaId && a.area_id === areaId ? 1 : 0;
    const bMatches = areaId && b.area_id === areaId ? 1 : 0;
    if (aMatches !== bMatches) return bMatches - aMatches;
    const aDate = `${a.start_date || ''}T${a.start_time || ''}`;
    const bDate = `${b.start_date || ''}T${b.start_time || ''}`;
    if (aDate < bDate) return -1;
    if (aDate > bDate) return 1;
    return (a.title || '').localeCompare(b.title || '');
  });
}

function formatRecommendationTiming(event) {
  const todayInPhilly = getZonedDate(new Date(), PHILLY_TIME_ZONE);
  const todayStart = setStartOfDay(new Date(todayInPhilly.getTime()));
  const startDate = parseLocalYMD(event.start_date);
  if (!startDate) return 'Date TBA';
  const eventStart = setStartOfDay(new Date(startDate.getTime()));
  const diffDays = Math.round((eventStart - todayStart) / (1000 * 60 * 60 * 24));
  const timeLabel = formatTimeLabel(event.start_time);
  if (diffDays === 0) {
    return `Today${timeLabel ? ` · ${timeLabel}` : ''}`;
  }
  if (diffDays === 1) {
    return `Tomorrow${timeLabel ? ` · ${timeLabel}` : ''}`;
  }
  const weekday = formatWeekdayAbbrev(event.start_date, PHILLY_TIME_ZONE);
  return `${weekday}${timeLabel ? ` · ${timeLabel}` : ''}`;
}

function RecommendationFavoriteButton({ event }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event.favoriteId,
    source_table: event.source_table,
  });

  const handleClick = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite();
  };

  if (!event.favoriteId || !event.source_table) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`border border-indigo-600 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        isFavorite
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      {isFavorite ? 'In the Plans' : 'Add to Plans'}
    </button>
  );
}

function RecommendationListItem({ event }) {
  if (!event) return null;
  const areaLabel = event.areaName || null;
  return (
    <Link
      to={event.detailPath}
      className="block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex w-full items-start gap-4">
          <div className="hidden h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:block">
            {event.imageUrl ? (
              <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{event.dateLabel}</span>
              {areaLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[#29313f] normal-case">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {areaLabel}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-lg font-bold text-gray-800 break-words">{event.title}</h3>
            {event.address && (
              <p className="mt-1 text-sm text-gray-500">{event.address}</p>
            )}
            {event.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {event.tags.slice(0, 3).map((tag, index) => (
                  <Link
                    key={tag.slug || `${tag.name}-${index}`}
                    to={`/tags/${tag.slug}`}
                    className={`${PILL_STYLES[index % PILL_STYLES.length]} rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                    onClick={e => e.stopPropagation()}
                  >
                    #{tag.name}
                  </Link>
                ))}
                {event.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{event.tags.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 md:w-40">
          <RecommendationFavoriteButton event={event} />
        </div>
      </div>
    </Link>
  );
}

function RecommendationCard({ event }) {
  if (!event) return null;
  const areaLabel = event.areaName || null;
  return (
    <Link
      to={event.detailPath}
      className="w-64 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl">
        {event.imageUrl ? (
          <div className="relative h-36 w-full overflow-hidden bg-gray-100">
            <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
            {areaLabel && (
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#28313e] px-3 py-1 text-xs font-semibold text-white shadow">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span className="truncate">{areaLabel}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center bg-gray-100 text-sm font-semibold text-gray-500">
            Photo coming soon
          </div>
        )}
        <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-4 text-center">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{event.title}</h3>
          {event.address && <p className="mt-1 text-sm text-gray-600">{event.address}</p>}
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{event.dateLabel}</p>
          {event.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {event.tags.slice(0, 3).map((tag, index) => (
                <Link
                  key={tag.slug || `${tag.name}-${index}`}
                  to={`/tags/${tag.slug}`}
                  className={`${PILL_STYLES[index % PILL_STYLES.length]} inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                  onClick={e => e.stopPropagation()}
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 w-full">
            <RecommendationFavoriteButton event={event} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function RecommendationSection({ title, events }) {
  if (!events?.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold text-[#28313e]">{title}</h2>
      <div className="mt-6 hidden space-y-4 md:block">
        {events.map(event => (
          <RecommendationListItem key={event.id} event={event} />
        ))}
      </div>
      <div className="-mx-4 mt-6 overflow-x-auto pb-2 md:hidden">
        <div className="flex gap-4 px-4">
          {events.map(event => (
            <RecommendationCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function BigBoardEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tagsList, setTagsList] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [eventTags, setEventTags] = useState([]);

  const [poster, setPoster] = useState(null);
  const { isFollowing: isPosterFollowing, toggleFollow: togglePosterFollow, loading: followLoading } = useFollow(event?.owner_id);

  const [areaLookup, setAreaLookup] = useState({});

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

  const geocoderToken = getMapboxToken();
  const sessionToken = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`);
  const suggestRef = useRef(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);

  const { isFavorite, toggleFavorite, loading: favLoading } = useEventFavorite({
    event_id: event?.id,
    source_table: 'big_board_events',
  });

  const [likeEvents, setLikeEvents] = useState([]);
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [loadingLike, setLoadingLike] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);

  const [navOffset, setNavOffset] = useState(128);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: ev, error: evErr } = await supabase
          .from('big_board_events')
          .select(`
            id,
            post_id,
            title,
            description,
            link,
            start_date,
            end_date,
            start_time,
            end_time,
            address,
            latitude,
            longitude,
            created_at,
            slug,
            area_id
          `)
          .eq('slug', slug)
          .single();
        if (evErr) throw evErr;

        const { data: post, error: postErr } = await supabase
          .from('big_board_posts')
          .select('image_url, user_id')
          .eq('id', ev.post_id)
          .single();
        if (postErr) throw postErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from('big-board').getPublicUrl(post.image_url);

        const { data: tagsData, error: tagsErr } = await supabase
          .from('tags')
          .select('id,name,rrule,season_start,season_end');
        if (tagsErr) throw tagsErr;

        const { data: taggingsData, error: taggingsErr } = await supabase
          .from('taggings')
          .select('tag_id, tags(name, slug)')
          .eq('taggable_type', 'big_board_events')
          .eq('taggable_id', ev.id);
        if (taggingsErr) throw taggingsErr;

        if (cancelled) return;
        setTagsList((tagsData || []).filter(isTagActive));
        setSelectedTags((taggingsData || []).map(t => t.tag_id));
        setEventTags((taggingsData || []).map(t => t.tags).filter(Boolean));
        setEvent({ ...ev, imageUrl: publicUrl, owner_id: post.user_id });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Could not load event.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('areas')
      .select('id,name,display_name,short_name')
      .then(({ data, error: areasError }) => {
        if (cancelled) return;
        if (areasError) {
          console.error('Failed to load areas', areasError);
          setAreaLookup({});
          return;
        }
        const lookup = {};
        (data || []).forEach(area => {
          lookup[area.id] = area.display_name || area.short_name || area.name || '';
        });
        setAreaLookup(lookup);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!event?.owner_id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username,image_url,slug')
          .eq('id', event.owner_id)
          .single();
        let img = prof?.image_url || '';
        if (img && !img.startsWith('http')) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('profile-images').getPublicUrl(img);
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
        if (!cancelled) {
          setPoster({
            id: event.owner_id,
            username: prof?.username || 'User',
            image: img,
            slug: prof?.slug || null,
            cultures,
          });
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event]);

  useEffect(() => {
    if (!isEditing || !geocoderToken) return;
    const addr = formData.address?.trim();
    if (!addr) {
      setAddressSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(addr)}&access_token=${geocoderToken}&session_token=${sessionToken.current}&limit=5&proximity=-75.1652,39.9526&bbox=-75.2803,39.8670,-74.9558,40.1379`,
      )
        .then(r => r.json())
        .then(json => setAddressSuggestions(json.suggestions || []))
        .catch(console.error);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [formData.address, isEditing, geocoderToken]);

  const handleFavorite = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite();
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const pickSuggestion = feature => {
    fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${feature.mapbox_id}?access_token=${geocoderToken}&session_token=${sessionToken.current}`,
    )
      .then(r => r.json())
      .then(json => {
        const suggestion = json.features?.[0];
        if (suggestion) {
          const name = suggestion.properties.name_preferred || suggestion.properties.name;
          const context = suggestion.properties.place_formatted;
          const [lng, lat] = suggestion.geometry.coordinates;
          setFormData(prev => ({
            ...prev,
            address: `${name}, ${context}`,
            latitude: lat,
            longitude: lng,
          }));
        }
      })
      .catch(console.error);

    setAddressSuggestions([]);
    suggestRef.current?.blur();
  };

  const startEditing = () => {
    if (!event) return;
    setFormData({
      title: event.title,
      description: event.description || '',
      link: event.link || '',
      start_date: event.start_date,
      end_date: event.end_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      address: event.address || '',
      latitude: event.latitude || null,
      longitude: event.longitude || null,
    });
    setIsEditing(true);
  };

  const handleSave = async e => {
    e.preventDefault();
    if (!event) return;
    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        link: formData.link || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        address: formData.address || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };
      const { data: updated, error: updateErr } = await supabase
        .from('big_board_events')
        .update(payload)
        .eq('id', event.id)
        .single();
      if (updateErr) throw updateErr;
      await supabase
        .from('taggings')
        .delete()
        .eq('taggable_type', 'big_board_events')
        .eq('taggable_id', event.id);
      if (selectedTags.length) {
        const inserts = selectedTags.map(tag_id => ({
          taggable_type: 'big_board_events',
          taggable_id: event.id,
          tag_id,
        }));
        await supabase.from('taggings').insert(inserts);
      }
      setEvent(prev => ({ ...prev, ...updated }));
      const { data: refreshedTaggings } = await supabase
        .from('taggings')
        .select('tag_id, tags(name, slug)')
        .eq('taggable_type', 'big_board_events')
        .eq('taggable_id', event.id);
      setEventTags((refreshedTaggings || []).map(t => t.tags).filter(Boolean));
      setSelectedTags((refreshedTaggings || []).map(t => t.tag_id));
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!window.confirm('Delete this event?')) return;
    try {
      await supabase.from('big_board_events').delete().eq('id', event.id);
      navigate('/');
    } catch (err) {
      alert(`Error deleting: ${err.message}`);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const measure = () => {
      const nav = document.querySelector('nav.fixed');
      const tagRail = document.querySelector('[data-tag-rail]');
      let total = 0;
      if (nav) {
        total += nav.getBoundingClientRect().height;
      }
      if (tagRail) {
        total += tagRail.getBoundingClientRect().height;
      }
      setNavOffset(total + 12);
    };
    measure();
    const observers = [];
    const navEl = document.querySelector('nav.fixed');
    const tagEl = document.querySelector('[data-tag-rail]');
    if (typeof ResizeObserver !== 'undefined') {
      if (navEl) {
        const navObserver = new ResizeObserver(measure);
        navObserver.observe(navEl);
        observers.push(navObserver);
      }
      if (tagEl) {
        const tagObserver = new ResizeObserver(measure);
        tagObserver.observe(tagEl);
        observers.push(tagObserver);
      }
    }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      observers.forEach(observer => observer.disconnect());
    };
  }, []);

  const areaName = event?.area_id ? areaLookup[event.area_id] || null : null;
  const dateTimeLabel = event ? formatDateTimeRange(event.start_date, event.start_time, event.end_time) : '';
  const shortAddress = getShortAddress(event?.address);

  const canonicalUrl = `${SITE_BASE_URL}/big-board/${slug}`;

  const seoDescription = useMemo(() => {
    const raw = event?.description || '';
    if (!raw) return FALLBACK_BIG_BOARD_DESCRIPTION;
    return raw.length > 155 ? `${raw.slice(0, 152)}…` : raw;
  }, [event?.description]);

  const seoTitle = useMemo(() => {
    if (!event) return FALLBACK_BIG_BOARD_TITLE;
    const startDate = parseLocalYMD(event.start_date);
    if (!startDate) return `${event.title} – Our Philly`;
    const formattedDate = startDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `${event.title} | Community Event on ${formattedDate} | Our Philly`;
  }, [event]);

  const ogImage = useMemo(() => {
    if (!event?.imageUrl) return DEFAULT_OG_IMAGE;
    return ensureAbsoluteUrl(event.imageUrl) || DEFAULT_OG_IMAGE;
  }, [event?.imageUrl]);

  const jsonLd = useMemo(() => {
    if (!event) return null;
    return buildEventJsonLd({
      name: event.title,
      canonicalUrl,
      startDate: event.start_date,
      endDate: event.end_date || event.start_date,
      locationName: event.address || 'Philadelphia',
      description: seoDescription,
      image: ogImage,
    });
  }, [event, canonicalUrl, seoDescription, ogImage]);

  const mapEvents = useMemo(() => {
    if (!event || !Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) return [];
    return [
      {
        id: event.id,
        title: event.title,
        latitude: event.latitude,
        longitude: event.longitude,
        startDate: event.start_date,
        endDate: event.end_date,
        detailPath: `/big-board/${event.slug}`,
      },
    ];
  }, [event]);

  useEffect(() => {
    if (!event) return;

    const mapRowToEvent = row => {
      const storageKey = row.big_board_posts?.[0]?.image_url;
      let imageUrl = '';
      if (storageKey) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('big-board').getPublicUrl(storageKey);
        imageUrl = publicUrl;
      }
      const base = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        address: row.address || '',
        area_id: row.area_id,
        areaName: row.area_id ? areaLookup[row.area_id] || null : null,
        imageUrl,
        favoriteId: row.id,
        source_table: 'big_board_events',
        detailPath: `/big-board/${row.slug}`,
      };
      return base;
    };

    const attachTags = async eventsToEnhance => {
      if (!eventsToEnhance.length) return eventsToEnhance;
      const ids = eventsToEnhance.map(ev => ev.id);
      const { data: tagRows, error: tagsErr } = await supabase
        .from('taggings')
        .select('taggable_id, tags(name, slug)')
        .eq('taggable_type', 'big_board_events')
        .in('taggable_id', ids);
      if (tagsErr) {
        console.error('Failed to load tags for recommendations', tagsErr);
        return eventsToEnhance;
      }
      const tagMap = {};
      (tagRows || []).forEach(row => {
        if (!row?.tags) return;
        if (!tagMap[row.taggable_id]) tagMap[row.taggable_id] = [];
        tagMap[row.taggable_id].push(row.tags);
      });
      return eventsToEnhance.map(evt => ({
        ...evt,
        tags: tagMap[evt.id] || [],
        dateLabel: formatRecommendationTiming(evt),
      }));
    };

    const hydrateFromCache = (cacheKey, setter) => {
      const cached = readRecommendationCache(cacheKey);
      if (cached) {
        setter(
          cached.map(ev => ({
            ...ev,
            areaName: ev.area_id ? areaLookup[ev.area_id] || ev.areaName || null : ev.areaName || null,
            dateLabel: formatRecommendationTiming(ev),
          })),
        );
        return true;
      }
      return false;
    };

    const fetchLikeEvents = async () => {
      if (!selectedTags.length) {
        setLikeEvents([]);
        return;
      }
      const cacheKey = getCacheKey(event.id, 'like');
      if (hydrateFromCache(cacheKey, setLikeEvents)) {
        return;
      }
      setLoadingLike(true);
      try {
        const { data: tagRows, error: tagErr } = await supabase
          .from('taggings')
          .select('taggable_id')
          .eq('taggable_type', 'big_board_events')
          .in('tag_id', selectedTags);
        if (tagErr) throw tagErr;
        const candidateIds = Array.from(
          new Set((tagRows || []).map(row => row.taggable_id).filter(id => id !== event.id)),
        );
        if (!candidateIds.length) {
          setLikeEvents([]);
          writeRecommendationCache(cacheKey, []);
          return;
        }
        const { data: eventRows, error: eventsErr } = await supabase
          .from('big_board_events')
          .select(`
            id,
            slug,
            title,
            start_date,
            end_date,
            start_time,
            end_time,
            address,
            area_id,
            big_board_posts!big_board_posts_event_id_fkey (image_url)
          `)
          .in('id', candidateIds);
        if (eventsErr) throw eventsErr;
        const normalized = sortEventsByAreaAndTime(
          (eventRows || []).map(mapRowToEvent),
          event.area_id,
        ).slice(0, 6);
        const withTags = await attachTags(normalized);
        setLikeEvents(withTags);
        writeRecommendationCache(cacheKey, withTags);
      } catch (err) {
        console.error('Failed to load related events', err);
        setLikeEvents([]);
      } finally {
        setLoadingLike(false);
      }
    };

    const fetchNearbyEvents = async () => {
      const cacheKey = getCacheKey(event.id, 'nearby');
      if (hydrateFromCache(cacheKey, setNearbyEvents)) {
        return;
      }
      setLoadingNearby(true);
      try {
        const { data: eventRows, error: nearbyErr } = await supabase
          .from('big_board_events')
          .select(`
            id,
            slug,
            title,
            start_date,
            end_date,
            start_time,
            end_time,
            address,
            area_id,
            big_board_posts!big_board_posts_event_id_fkey (image_url)
          `)
          .eq('start_date', event.start_date)
          .neq('id', event.id);
        if (nearbyErr) throw nearbyErr;
        const normalized = sortEventsByAreaAndTime(
          (eventRows || []).map(mapRowToEvent),
          event.area_id,
        ).slice(0, 6);
        const withTags = await attachTags(normalized);
        setNearbyEvents(withTags);
        writeRecommendationCache(cacheKey, withTags);
      } catch (err) {
        console.error('Failed to load nearby events', err);
        setNearbyEvents([]);
      } finally {
        setLoadingNearby(false);
      }
    };

    fetchLikeEvents();
    fetchNearbyEvents();
  }, [event, selectedTags, areaLookup]);

  if (loading || error || !event) {
    const message = loading ? 'Loading…' : error || 'Event not found.';
    const messageClass = error ? 'text-red-600' : 'text-gray-500';
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Seo
          title={FALLBACK_BIG_BOARD_TITLE}
          description={FALLBACK_BIG_BOARD_DESCRIPTION}
          canonicalUrl={`${SITE_BASE_URL}/big-board/${slug}`}
          ogImage={DEFAULT_OG_IMAGE}
          ogType="event"
        />
        <Navbar />
        <main className="flex flex-1 items-center justify-center" style={{ paddingTop: navOffset }}>
          <div className={`text-2xl ${messageClass}`}>{message}</div>
        </main>
        <Footer />
      </div>
    );
  }

  const headerTags = eventTags.filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="event"
        jsonLd={jsonLd}
      />
      <Navbar />
      <main className="flex-1 bg-white" style={{ paddingTop: navOffset + 16 }}>
        <div className="relative">
          <div
            className="sticky z-40 border-b border-white/50 bg-white/75 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60"
            style={{ top: navOffset }}
          >
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {dateTimeLabel && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{dateTimeLabel}</span>
                  )}
                  {areaName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-sm font-semibold text-[#29313f] normal-case">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {areaName}
                    </span>
                  )}
                  {shortAddress && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 normal-case">
                      {shortAddress}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <h1 className="truncate text-xl font-bold text-[#28313e] md:flex-1">{event.title}</h1>
                  <div className="text-sm text-gray-600 md:text-right">
                    {poster?.username ? (
                      <Link to={poster.slug ? `/u/${poster.slug}` : '#'} className="font-semibold text-indigo-600 hover:text-indigo-700">
                        Submitted by @{poster.username}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-500">Submitted by community</span>
                    )}
                  </div>
                </div>
                {headerTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {headerTags.map((tag, index) => (
                      <Link
                        key={tag.slug || `${tag.name}-${index}`}
                        to={`/tags/${tag.slug}`}
                        className={`${PILL_STYLES[index % PILL_STYLES.length]} rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="hidden md:flex md:items-center md:gap-3">
                <button
                  type="button"
                  onClick={handleFavorite}
                  disabled={favLoading}
                  className={`inline-flex items-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
                    isFavorite
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  <CalendarCheck className="h-4 w-4" />
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-16">
            {poster && (
              <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-center gap-3 text-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {poster.image ? (
                      <img src={poster.image} alt="avatar" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gray-300" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Submitted by</p>
                      <Link to={poster.slug ? `/u/${poster.slug}` : '#'} className="text-lg font-semibold text-[#28313e] hover:text-indigo-700">
                        @{poster.username}
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {poster.cultures?.map(culture => (
                      <span key={culture.emoji} title={culture.name} className="text-2xl">
                        {culture.emoji}
                      </span>
                    ))}
                    {user && user.id !== poster.id && (
                      <button
                        type="button"
                        onClick={togglePosterFollow}
                        disabled={followLoading}
                        className="rounded-full border border-indigo-700 px-4 py-1 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-700 hover:text-white"
                      >
                        {isPosterFollowing ? 'Unfollow' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSave} className="mt-10 space-y-6">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">External Link</label>
                  <input
                    name="link"
                    type="url"
                    value={formData.link}
                    onChange={handleChange}
                    placeholder="https://"
                    className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
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
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <input
                    name="address"
                    type="text"
                    autoComplete="off"
                    ref={suggestRef}
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Start typing an address…"
                    className="mt-1 w-full rounded border px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                  {addressSuggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow">
                      {addressSuggestions.map(feat => (
                        <li
                          key={feat.mapbox_id}
                          className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
                          onClick={() => pickSuggestion(feat)}
                        >
                          {feat.name} — {feat.full_address || feat.place_formatted}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tags</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {tagsList.map((tag, index) => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setSelectedTags(prev =>
                              isSelected
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id],
                            )
                          }
                          className={`${
                            isSelected
                              ? PILL_STYLES[index % PILL_STYLES.length]
                              : 'bg-gray-200 text-gray-700'
                          } rounded-full px-4 py-2 text-sm font-semibold`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                    className="flex-1 rounded bg-gray-300 py-2 text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {event.description && (
                  <section className="mt-10">
                    <h2 className="text-2xl font-semibold text-[#28313e]">About this event</h2>
                    <p className="mt-3 text-base leading-7 text-gray-700 whitespace-pre-line">{event.description}</p>
                  </section>
                )}

                {(event.link || event.owner_id === user?.id) && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-6">
                    {event.link && (
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        See original listing
                      </a>
                    )}
                    {event.owner_id === user?.id && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={startEditing}
                          className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-8">
                  <div className="overflow-hidden rounded-3xl border border-gray-200 shadow-sm">
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt={event.title} className="h-full w-full max-h-[60vh] object-contain bg-gray-50" />
                    ) : (
                      <div className="flex h-64 items-center justify-center bg-gray-100 text-gray-500">
                        Image coming soon
                      </div>
                    )}
                  </div>
                </div>

                {mapEvents.length > 0 && (
                  <div className="mt-10">
                    <MonthlyEventsMap events={mapEvents} height={360} />
                  </div>
                )}

                <div className="mt-10 space-y-8">
                  {loadingLike ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
                      Loading similar events…
                    </div>
                  ) : (
                    <RecommendationSection title="More events like this" events={likeEvents} />
                  )}

                  {loadingNearby ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
                      Finding events nearby…
                    </div>
                  ) : (
                    <RecommendationSection title="More happening nearby this day" events={nearbyEvents} />
                  )}
                </div>
              </>
            )}

            <Suspense fallback={<div className="mt-12 text-sm text-gray-500">Loading comments…</div>}>
              <div className="mt-12">
                <CommentsSection source_table="big_board_events" event_id={event.id} />
              </div>
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[calc(env(safe-area-inset-bottom,0)+12px)] pt-3 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Save this event</p>
            <p className="text-sm font-semibold text-[#28313e]">Add to your plans</p>
          </div>
          <button
            type="button"
            onClick={handleFavorite}
            disabled={favLoading}
            className={`inline-flex items-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
              isFavorite
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            {isFavorite ? 'In the Plans' : 'Add to Plans'}
          </button>
        </div>
      </div>
    </div>
  );
}
