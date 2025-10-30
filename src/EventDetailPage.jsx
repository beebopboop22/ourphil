// src/EventDetailPage.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import PostFlyerModal from './PostFlyerModal';
import HeroLanding from './HeroLanding';
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
import ReviewPhotoGrid from './ReviewPhotoGrid';
import Seo from './components/Seo.jsx';
import EventLocationMap from './EventLocationMap.jsx';
import { parseEventDateValue } from './utils/dateUtils';
import useAreaLookup, { getAreaNameFromCache } from './utils/useAreaLookup.js';
import {
  DEFAULT_OG_IMAGE,
  SITE_BASE_URL,
  ensureAbsoluteUrl,
  buildEventJsonLd,
} from './utils/seoHelpers.js';
import { CalendarCheck, CalendarPlus, MapPin, Share2 } from 'lucide-react';

const FALLBACK_EVENT_TITLE = 'Philadelphia Event Details – Our Philly';
const FALLBACK_EVENT_DESCRIPTION =
  'Discover upcoming Philadelphia events and traditions with Our Philly.';

function normalizeNationality(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildShortDescription(text, maxLength = 160) {
  if (!text) return '';
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, maxLength - 1).trimEnd();
  return `${sliced}…`;
}

function formatTimeLabel(timeStr) {
  if (!timeStr) return null;
  const value = String(timeStr).trim();
  if (!value) return null;
  const [hoursRaw, minutesRaw = '00'] = value.split(':');
  const hoursNum = Number.parseInt(hoursRaw, 10);
  if (Number.isNaN(hoursNum)) return null;
  const minutesNum = Number.parseInt(minutesRaw, 10);
  if (Number.isNaN(minutesNum)) return null;
  const hours12 = hoursNum % 12 || 12;
  const ampm = hoursNum >= 12 ? 'p.m.' : 'a.m.';
  const minutes = minutesNum.toString().padStart(2, '0');
  return `${hours12}:${minutes} ${ampm}`;
}

export default function EventDetailPage() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // ─── State ───────────────────────────────────────────────────────────
  const [event, setEvent] = useState(null);
  const {
    isFavorite,
    toggleFavorite,
    loading: toggling,
  } = useEventFavorite({ event_id: event?.id, source_table: 'events' })

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');

  const [modalImage, setModalImage] = useState(null);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);

  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);
  const [tagMap, setTagMap] = useState({});
  const [eventTags, setEventTags] = useState([]);
  const [matchingGroups, setMatchingGroups] = useState([]);
  const [navOffset, setNavOffset] = useState(0);
  const areaLookup = useAreaLookup();
  const reviewPhotoUrls = useMemo(
    () => reviews.flatMap(r => r.photo_urls || []),
    [reviews],
  );
  const eventNationality = useMemo(() => {
    if (!event) return '';
    const candidates = [event?.Nationality, event?.nationality];
    for (const candidate of candidates) {
      const normalized = normalizeNationality(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return '';
  }, [event]);
  const isFeaturedTradition = useMemo(() => {
    if (!event) return false;
    const raw = event?.Promoted ?? event?.promoted ?? null;
    if (typeof raw === 'string') {
      return raw.trim().toLowerCase() === 'yes';
    }
    if (typeof raw === 'boolean') {
      return raw;
    }
    return false;
  }, [event]);
  const communityCalloutLabel = useMemo(() => {
    if (matchingGroups.length > 0) {
      const label = matchingGroups
        .map(group => normalizeNationality(group?.Nationality))
        .find(Boolean);
      if (label) {
        return label;
      }
    }
    return eventNationality;
  }, [matchingGroups, eventNationality]);

  const pillStyles = [
    'bg-red-100 text-red-800',
    'bg-orange-100 text-orange-800',
    'bg-amber-100 text-amber-800',
    'bg-yellow-100 text-yellow-800',
    'bg-lime-100 text-lime-800',
    'bg-green-100 text-green-800',
    'bg-emerald-100 text-emerald-800',
    'bg-teal-100 text-teal-800',
    'bg-cyan-100 text-cyan-800',
    'bg-sky-100 text-sky-800',
    'bg-blue-100 text-blue-800',
    'bg-indigo-100 text-indigo-800',
    'bg-violet-100 text-violet-800',
    'bg-purple-100 text-purple-800',
    'bg-fuchsia-100 text-fuchsia-800',
    'bg-pink-100 text-pink-800',
    'bg-rose-100 text-rose-800',
    'bg-gray-100 text-gray-800',
    'bg-slate-100 text-slate-800',
    'bg-zinc-100 text-zinc-800',
    'bg-neutral-100 text-neutral-800',
    'bg-stone-100 text-stone-800',
    'bg-lime-200 text-lime-900',
    'bg-orange-200 text-orange-900',
  ];

  // ─── Helpers ─────────────────────────────────────────────────────────
  function getFriendlyDate(value) {
    const date = value instanceof Date ? value : parseEventDateValue(value);
    if (!date) return '';
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((normalized.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    let prefix;
    if (diff === 0) prefix = 'Today';
    else if (diff === 1) prefix = 'Tomorrow';
    else if (diff > 1 && diff < 7)
      prefix = `This ${normalized.toLocaleDateString('en-US', { weekday: 'long' })}`;
    else if (diff >= 7 && diff < 14)
      prefix = `Next ${normalized.toLocaleDateString('en-US', { weekday: 'long' })}`;
    else prefix = normalized.toLocaleDateString('en-US', { weekday: 'long' });
    const md = normalized.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return `${prefix}, ${md}`;
  }

  function copyLinkFallback(url) {
    navigator.clipboard.writeText(url).catch(console.error);
  }

  function handleShare() {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) navigator.share({ title, url }).catch(console.error);
    else copyLinkFallback(url);
  }

  // ─── Load event, favorites & community subs ───────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) console.error(error);
      else setEvent(data);
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!event) return;
    supabase
      .from('taggings')
      .select('tags(name,slug)')
      .eq('taggable_type', 'events')
      .eq('taggable_id', event.id)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setEventTags([]);
        } else {
          setEventTags((data || []).map(r => r.tags));
        }
      });
  }, [event]);

  useEffect(() => {
    if (!isFeaturedTradition) {
      setMatchingGroups([]);
      return;
    }
    if (!eventNationality) {
      setMatchingGroups([]);
      return;
    }
    let isActive = true;
    supabase
      .from('groups')
      .select('id, Name, slug, imag, Nationality')
      .eq('Nationality', eventNationality)
      .order('Name', { ascending: true })
      .limit(6)
      .then(({ data, error }) => {
        if (!isActive) return;
        if (error) {
          console.error('Failed to load related groups', error);
          setMatchingGroups([]);
          return;
        }
        const filtered = Array.isArray(data) ? data.filter(Boolean) : [];
        setMatchingGroups(filtered);
      });
    return () => {
      isActive = false;
    };
  }, [eventNationality, isFeaturedTradition]);

  useEffect(() => {
    if (!event) return;

    // upcoming community submissions
    (async () => {
      const today = new Date().toISOString().slice(0,10);
      const { data: list, error } = await supabase
        .from('big_board_events')
        .select('id,post_id,title,start_date,slug')
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(24);
      if (error) {
        console.error(error);
        setMoreEvents([]);
        setLoadingMore(false);
        return;
      }
      const enriched = await Promise.all(
        list.map(async ev => {
          const { data: post } = await supabase
            .from('big_board_posts')
            .select('image_url')
            .eq('id', ev.post_id)
            .single();
          let url = '';
          if (post?.image_url) {
            const { data:{ publicUrl } } = supabase
              .storage.from('big-board')
              .getPublicUrl(post.image_url);
            url = publicUrl;
          }
          return { ...ev, imageUrl: url };
        })
      );
      setMoreEvents(enriched);
      setLoadingMore(false);
    })();
  }, [event, user]);

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

  // ─── Load tags for community cards ────────────────────────────────────
  useEffect(() => {
    if (!moreEvents.length) return;
    const ids = moreEvents.map(ev => String(ev.id));
    supabase
      .from('taggings')
      .select('tags(name,slug),taggable_id')
      .eq('taggable_type','big_board_events')
      .in('taggable_id', ids)
      .then(({ data, error }) => {
        if (error) return console.error(error);
        const map = {};
        data.forEach(({ taggable_id, tags }) => {
          map[taggable_id] = map[taggable_id] || [];
          map[taggable_id].push(tags);
        });
        setTagMap(map);
      });
  }, [moreEvents]);

  // ─── Favorite toggle ─────────────────────────────────────────────────
  const toggleFav = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!event) return;
    await toggleFavorite();
  };

  // ─── Reviews ─────────────────────────────────────────────────────────
  const loadReviews = async () => {
    setLoadingReviews(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at',{ ascending: false });
    if (error) {
      console.error(error);
      setReviews([]);
    } else {
      setReviews(data.map(r => {
        let urls = Array.isArray(r.photo_urls) ? r.photo_urls : [];
        if (!Array.isArray(r.photo_urls) && r.photo_urls) {
          try {
            const p = JSON.parse(r.photo_urls);
            if (Array.isArray(p)) urls = p;
          } catch {}
        }
        return { ...r, photo_urls: urls };
      }));
    }
    setLoadingReviews(false);
  };
  useEffect(() => { if (event) loadReviews(); }, [event]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!user) return alert('Log in to leave a review.');
    setSubmitting(true);
    const photoUrls = [];
    for (let file of photoFiles) {
      const name = file.name.replace(/[^a-z0-9.\-_]/gi,'_').toLowerCase();
      const path = `${event.id}-${Date.now()}-${name}`;
      const { error: upErr } = await supabase.storage
        .from('event-photos').upload(path, file);
      if (upErr) { alert('Upload failed.'); setSubmitting(false); return; }
      const { data:{ publicUrl } } =
        supabase.storage.from('event-photos').getPublicUrl(path);
      photoUrls.push(publicUrl);
    }
    const { error } = await supabase.from('reviews').insert({
      event_id: event.id,
      user_id: user.id,
      rating, comment, photo_urls: photoUrls
    });
    setSubmitting(false);
    if (!error) {
      setComment(''); setRating(5); setPhotoFiles([]);
      loadReviews();
    }
  };

  const startEdit = r => {
    setEditingId(r.id);
    setDraftRating(r.rating);
    setDraftComment(r.comment);
  };
  const saveEdit = async () => {
    const { error } = await supabase
      .from('reviews')
      .update({ rating: draftRating, comment: draftComment })
      .eq('id', editingId);
    if (!error) { setEditingId(null); loadReviews(); }
    else alert('Update failed: ' + error.message);
  };
  const deleteReview = async id => {
    if (!window.confirm('Delete this review?')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (!error) loadReviews(); else alert('Delete failed.');
  };
  const alreadyReviewed = user && reviews.some(r => r.user_id === user.id);

  const canonicalUrl = `${SITE_BASE_URL}/events/${slug}`;
  const eventNameRaw = event?.['E Name'];
  const eventName = typeof eventNameRaw === 'string' ? eventNameRaw.trim() : '';
  const shortDescription = buildShortDescription(event?.['E Description']);
  const startRaw =
    event?.['E Start Date'] ||
    event?.Dates ||
    event?.['Start Date'] ||
    event?.startDate ||
    event?.start_date ||
    null;
  const endRaw =
    event?.['E End Date'] ||
    event?.['End Date'] ||
    event?.endDate ||
    event?.end_date ||
    null;
  const startTimeRaw =
    event?.start_time ||
    event?.time ||
    event?.['Start Time'] ||
    event?.['E Start Time'] ||
    null;
  const endTimeRaw =
    event?.end_time ||
    event?.['End Time'] ||
    event?.['E End Time'] ||
    null;
  const startDate = parseEventDateValue(startRaw);
  const endDateCandidate = parseEventDateValue(endRaw);
  const effectiveEndDate = endDateCandidate || startDate || null;
  const isoStartDate = startDate ? startDate.toISOString() : null;
  const isoEndDate = effectiveEndDate ? effectiveEndDate.toISOString() : null;
  const singleDay =
    startDate && effectiveEndDate
      ? effectiveEndDate.getTime() === startDate.getTime()
      : true;
  let displayDate = '';
  if (startDate) {
    if (singleDay) {
      displayDate = getFriendlyDate(startDate);
    } else {
      const startLabel = startDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      });
      const endLabel = effectiveEndDate
        ? effectiveEndDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
          })
        : '';
      displayDate = endLabel ? `${startLabel} — ${endLabel}` : startLabel;
    }
  }

  const locationNameRaw = event?.['E Address'];
  const locationName =
    typeof locationNameRaw === 'string' && locationNameRaw.trim()
      ? locationNameRaw.trim()
      : 'Philadelphia';
  const eventLocationLabel = useMemo(() => {
    if (!event) return '';
    const candidates = [
      event?.location_name,
      event?.venue_name,
      event?.venue,
      event?.address,
      event?.location,
      typeof locationNameRaw === 'string' ? locationNameRaw : null,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed) return trimmed;
      }
    }
    return '';
  }, [event, locationNameRaw]);

  const eventLatitude = useMemo(() => {
    if (!event) return null;
    const candidates = [
      event?.latitude,
      event?.lat,
      event?.Latitude,
      event?.LATITUDE,
      event?.['Latitude'],
      event?.['latitude'],
      event?.['E Latitude'],
      event?.['E Lat'],
    ];
    for (const candidate of candidates) {
      if (candidate == null) continue;
      const value = typeof candidate === 'number' ? candidate : Number(candidate);
      if (Number.isFinite(value)) {
        return value;
      }
    }
    return null;
  }, [event]);

  const eventLongitude = useMemo(() => {
    if (!event) return null;
    const candidates = [
      event?.longitude,
      event?.lng,
      event?.Longitude,
      event?.LONGITUDE,
      event?.['Longitude'],
      event?.['longitude'],
      event?.['E Longitude'],
      event?.['E Lng'],
    ];
    for (const candidate of candidates) {
      if (candidate == null) continue;
      const value = typeof candidate === 'number' ? candidate : Number(candidate);
      if (Number.isFinite(value)) {
        return value;
      }
    }
    return null;
  }, [event]);
  const absoluteImage = ensureAbsoluteUrl(event?.['E Image']);
  const ogImage = absoluteImage || DEFAULT_OG_IMAGE;
  const startTimeLabel = formatTimeLabel(startTimeRaw);
  const endTimeLabel = formatTimeLabel(endTimeRaw);
  const timeDisplay = startTimeLabel && endTimeLabel ? `${startTimeLabel} – ${endTimeLabel}` : 'Time TBA';
  const dateFormatter = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };
  const startDateLabel = startDate
    ? startDate.toLocaleDateString('en-US', dateFormatter)
    : 'Date TBA';
  const endDateLabel =
    effectiveEndDate &&
    startDate &&
    effectiveEndDate.getTime() !== startDate.getTime()
      ? effectiveEndDate.toLocaleDateString('en-US', dateFormatter)
      : null;
  const dateLabel = endDateLabel ? `${startDateLabel} – ${endDateLabel}` : startDateLabel;
  const dateTimeDisplay = `${dateLabel} · ${timeDisplay}`;

  const areaIdCandidates = [
    event?.area_id,
    event?.['Area ID'],
    event?.areaId,
    event?.AreaId,
    event?.AreaID,
    event?.['area_id'],
  ];
  const areaId = areaIdCandidates.find(
    value => value !== null && value !== undefined && String(value).trim() !== '',
  );
  const cachedAreaName = areaId != null ? getAreaNameFromCache(areaId) : null;
  const lookupAreaName =
    areaId != null && areaLookup && typeof areaLookup === 'object'
      ? areaLookup[areaId] || areaLookup[String(areaId)] || null
      : null;
  const fallbackNeighborhoodCandidates = [event?.Neighborhood, event?.neighborhood, event?.['Neighborhood']];
  const fallbackNeighborhood = fallbackNeighborhoodCandidates.find(
    value => typeof value === 'string' && value.trim(),
  );
  const neighborhoodName =
    (typeof lookupAreaName === 'string' && lookupAreaName.trim()) ||
    (typeof cachedAreaName === 'string' && cachedAreaName.trim()) ||
    (typeof fallbackNeighborhood === 'string' && fallbackNeighborhood.trim()) ||
    'Neighborhood TBA';

  const rawAddressCandidates = [
    event?.['Short Address'],
    event?.['E Address'],
    event?.address,
    event?.Address,
    event?.location,
  ];
  const rawAddress = rawAddressCandidates.find(
    value => typeof value === 'string' && value.trim(),
  );
  const shortAddress = rawAddress ? rawAddress.split(',')[0].trim() : '';

  const submittedByUsernameCandidates = [
    event?.submitted_by_username,
    event?.submitter_username,
    event?.submitted_by,
    event?.SubmittedBy,
    event?.submittedBy,
    event?.['Submitted By Username'],
    event?.['Submitted By'],
    event?.submitted_by_name,
  ];
  const submittedByUsernameRaw = submittedByUsernameCandidates.find(
    value => typeof value === 'string' && value.trim(),
  );
  const submittedByUsername = submittedByUsernameRaw
    ? submittedByUsernameRaw.replace(/^@+/, '').trim()
    : '';
  const submittedBySlugCandidates = [
    event?.submitted_by_slug,
    event?.submitter_slug,
    event?.['Submitted By Slug'],
    event?.submittedBySlug,
    event?.submitted_by_profile_slug,
  ];
  const submittedBySlug = submittedBySlugCandidates.find(
    value => typeof value === 'string' && value.trim(),
  );
  const stickyStyle = { top: `${navOffset}px` };
  const mainStyle = { paddingTop: `${navOffset}px` };

  const seoTitle = eventName
    ? `${eventName}${displayDate ? ` – ${displayDate}` : ''} – Our Philly`
    : FALLBACK_EVENT_TITLE;
  const seoDescription = shortDescription || FALLBACK_EVENT_DESCRIPTION;

  const eventJsonLd =
    eventName && isoStartDate
      ? buildEventJsonLd({
          name: eventName,
          canonicalUrl,
          startDate: isoStartDate,
          endDate: isoEndDate,
          locationName,
          description: shortDescription,
          image: absoluteImage || DEFAULT_OG_IMAGE,
        })
      : null;

  if (!event) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Seo
          title={seoTitle}
          description={seoDescription}
          canonicalUrl={canonicalUrl}
          ogImage={ogImage}
          ogType="event"
        />
        <Navbar />
        <main className="flex-grow pt-36 pb-16">
          <div className="py-20 text-center text-gray-500">Loading…</div>
        </main>
        <Footer />
      </div>
    );
  }

  const gcalLink = (() => {
    const toCalendarDate = date =>
      date ? date.toISOString().slice(0, 10).replace(/-/g, '') : '';
    const start = toCalendarDate(startDate);
    const end = toCalendarDate(effectiveEndDate);
    if (!start) return '';
    const url =
      typeof window !== 'undefined' && window.location
        ? window.location.href
        : canonicalUrl;
    const text = eventName || 'Our Philly Event';
    return (
      'https://www.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(text)}` +
      `&dates=${start}/${end || start}` +
      `&details=${encodeURIComponent('Details: ' + url)}`
    );
  })();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        ogType="event"
        jsonLd={eventJsonLd}
      />

      <Navbar />

      <main className="flex-grow relative pb-24 sm:pb-0" style={mainStyle}>
        <header className="sticky z-40" style={stickyStyle}>
          <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-5">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                  {eventName || 'Philadelphia Event'}
                </h1>
                <div className="mt-2 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  <span className="font-medium text-gray-900">{dateTimeDisplay}</span>
                  <span className="flex min-w-0 items-center gap-1 font-medium text-gray-700">
                    <MapPin className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    <span className="truncate text-gray-900">{neighborhoodName}</span>
                    {shortAddress && (
                      <span className="truncate text-gray-500">· {shortAddress}</span>
                    )}
                  </span>
                </div>
                {!!eventTags.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eventTags.map((tag, i) => (
                      <Link
                        key={tag.slug}
                        to={`/tags/${tag.slug}`}
                        className={`${pillStyles[i % pillStyles.length]} px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-80`}
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
                {submittedByUsername && (
                  <p className="mt-3 text-sm text-gray-500">
                    Submitted by{' '}
                    {submittedBySlug ? (
                      <Link
                        to={`/u/${submittedBySlug}`}
                        className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
                      >
                        @{submittedByUsername}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-700">@{submittedByUsername}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="hidden sm:flex flex-shrink-0 items-center">
                <button
                  type="button"
                  onClick={toggleFav}
                  disabled={toggling}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
                    isFavorite
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  } ${toggling ? 'opacity-70' : ''}`}
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {!user && (
          <div className="mt-6 w-full bg-indigo-600 py-4 text-center text-xl text-white sm:text-2xl">
            <Link to="/login" className="font-semibold underline">Log in</Link> or{' '}
            <Link to="/signup" className="font-semibold underline">sign up</Link> free to add to your Plans
          </div>
        )}
        {reviewPhotoUrls.length > 0 && (
          <div className="mt-6">
            <ReviewPhotoGrid photos={reviewPhotoUrls} />
          </div>
        )}

        {/* Traditions FAQ notice */}
        <div className="max-w-4xl mx-auto mt-8 px-4">
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-center rounded-md p-4">
            <a
              href="/traditions-faq"
              onClick={() =>
                window.gtag &&
                window.gtag('event', 'cta_click', {
                  event_category: 'traditions_faq',
                  event_label: 'events_page_notice',
                })
              }
              className="font-medium underline"
            >
              Do you manage this Philly tradition? Read our FAQ for traditions hosts
            </a>
          </div>
        </div>

        {/* What to Expect */}
        {event['E Description'] && (
          <>
            <div className="max-w-4xl mx-auto mt-8 px-4">
              <div className="flex items-start gap-4">
                <img
                  src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png"
                  alt="Our Philly concierge"
                  className="w-12 h-12 mt-1"
                />
                <div>
                  <h2 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-2">What to Expect</h2>
                  <p className="text-gray-700 text-lg">{event['E Description']}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 w-3/4 mx-auto mt-6" />
          </>
        )}

        {/* Description & Image */}
        <div className="max-w-4xl mx-auto mt-8 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {event.longDescription && (
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">About this Philly Tradition</h2>
                <p className="text-gray-700">{event.longDescription}</p>
              </div>
            )}
            <div className="mb-6 space-y-4">
              <button
                onClick={toggleFav}
                disabled={toggling}
                className={`w-full flex items-center justify-center gap-2 rounded-md py-3 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
              >
                <CalendarCheck className="w-5 h-5" />
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
              <div className="flex items-center justify-center gap-6 pt-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 text-indigo-600 hover:underline"
                >
                  <Share2 className="w-5 h-5" />
                  Share
                </button>
                {gcalLink && (
                  <a
                    href={gcalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 hover:underline"
                  >
                    <CalendarPlus className="w-5 h-5" />
                    Google Calendar
                  </a>
                )}
              </div>
            </div>
          </div>
          <div>
            {event['E Image'] && (
              <img
                src={event['E Image']}
                alt={event['E Name']}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
              />
            )}
          </div>
        </div>

        {isFeaturedTradition && matchingGroups.length > 0 && (
          <div className="max-w-4xl mx-auto mt-10 px-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Communities</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {communityCalloutLabel ? `Also tagged ${communityCalloutLabel}` : 'Also tagged'}
              </h2>
              <p className="text-sm text-slate-600">Connect with local groups sharing this tradition.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {matchingGroups.map(group => (
                  <Link
                    key={group.id}
                    to={group.slug ? `/groups/${group.slug}` : '/groups'}
                    className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                      {group.imag ? (
                        <img
                          src={group.imag}
                          alt={group.Name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">
                          {group.Name?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900 group-hover:text-indigo-600">
                        {group.Name || 'Community Group'}
                      </p>
                      <p className="text-sm text-slate-500">{group.Nationality || eventNationality}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {eventLatitude != null && eventLongitude != null && (
          <EventLocationMap
            latitude={eventLatitude}
            longitude={eventLongitude}
            eventName={eventName}
            locationLabel={eventLocationLabel || locationName}
          />
        )}

        {/* Reviews */}
        <section className="max-w-4xl mx-auto py-10 px-4">
          <h2 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-8">Photos, Photos, Photos</h2>
          {loadingReviews ? (
            <p>Loading reviews…</p>
          ) : reviews.length === 0 ? (
            <p className="text-gray-500">No reviews yet.</p>
          ) : (
            reviews.map(r => (
              <div key={r.id} className="mb-6 bg-white rounded-xl shadow p-6">
                {editingId === r.id ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">Edit Rating</label>
                      <div className="flex space-x-2">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            onClick={() => setDraftRating(n)}
                            className={`text-2xl ${n <= draftRating ? 'text-yellow-500' : 'text-gray-300'}`}
                          >★</button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      className="w-full border rounded p-2 mb-3"
                      value={draftComment}
                      onChange={e => setDraftComment(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-gray-300 rounded">
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-yellow-500 text-xl">
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </span>
                      <time className="text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="text-gray-700 mb-3">{r.comment}</p>
                    {r.photo_urls.length > 0 && (
                      <div className="flex space-x-2 mb-3">
                        {r.photo_urls.map(url => (
                          <div
                            key={url}
                            className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer"
                            onClick={() => setModalImage(url)}
                          >
                            <img src={url} alt="Review" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {user?.id === r.user_id && (
                      <div className="space-x-2">
                        <button
                          onClick={() => startEdit(r)}
                          className="px-2 py-1 bg-yellow-500 text-white text-sm rounded"
                        >Edit</button>
                        <button
                          onClick={() => deleteReview(r.id)}
                          className="px-2 py-1 bg-red-600 text-white text-sm rounded"
                        >Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}

          {/* Post Review Form */}
          {user ? (
            alreadyReviewed ? (
              <p className="mt-6 text-center text-gray-600">You’ve already reviewed this event.</p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 bg-white p-6 rounded-xl shadow space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Rating</label>
                  <div className="flex space-x-2">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className={`text-2xl ${n <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
                      >★</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Your Review</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    required
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-300"
                    rows={4}
                    placeholder="Share your experience…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Upload Photos (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      const valid = files.filter(f => f.type.startsWith('image/'));
                      if (valid.length !== files.length) alert('Non-image files ignored');
                      setPhotoFiles(valid);
                    }}
                    className="text-sm text-gray-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition"
                >
                  {submitting ? 'Posting…' : 'Post Review'}
                </button>
              </form>
            )
          ) : (
            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="text-indigo-600 hover:underline">Log in</Link> to leave a review.
            </p>
          )}

          {/* Image Lightbox */}
          {modalImage && (
            <div
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
              onClick={() => setModalImage(null)}
            >
              <img
                src={modalImage}
                alt="Enlarged"
                className="max-w-full max-h-[90vh] rounded-lg border-4 border-white shadow-lg"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </section>

        <hr className="my-8 border-gray-200" />

        <HeroLanding />

        <hr className="my-8 border-gray-200" />

        {/* More Upcoming Community Submissions */}
        <div className="border-t border-gray-200 mt-8 pt-6 px-4 pb-10 max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl text-center font-[Barrio] text-gray-800 mb-8">
            More Upcoming Community Submissions
          </h2>
          {loadingMore ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : moreEvents.length === 0 ? (
            <p className="text-center text-gray-600">No upcoming submissions.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {moreEvents.map(eventItem => (
                <CommunitySubmissionCard
                  key={eventItem.id}
                  event={eventItem}
                  tags={tagMap[eventItem.id] || []}
                  pillStyles={pillStyles}
                  dateLabel={getFriendlyDate(eventItem.start_date)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <button
            type="button"
            onClick={toggleFav}
            disabled={toggling}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-full border border-indigo-600 px-6 py-3 text-sm font-semibold transition ${
              isFavorite
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
            } ${toggling ? 'opacity-70' : ''}`}
          >
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            {isFavorite ? 'In the Plans' : 'Add to Plans'}
          </button>
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
    </div>
  );
}

function CommunitySubmissionCard({ event, tags, pillStyles, dateLabel }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event.id,
    source_table: 'big_board_events',
  });

  const handleFavoriteClick = async e => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    await toggleFavorite();
  };

  const safeTags = Array.isArray(tags)
    ? tags.filter(tag => tag && tag.slug)
    : [];

  return (
    <div className="flex flex-col bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition">
      <Link to={`/big-board/${event.slug}`} className="flex-1 flex flex-col">
        <div className="relative h-40 bg-gray-100">
          <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1">
            COMMUNITY SUBMISSION
          </div>
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-400">
              No Image
            </div>
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col justify-between text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
            {event.title}
          </h3>
          <span className="text-sm text-gray-600">{dateLabel}</span>
          {safeTags.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {safeTags.map((tag, index) => (
                <Link
                  key={tag.slug}
                  to={`/tags/${tag.slug}`}
                  className={`${pillStyles[index % pillStyles.length]} text-xs font-semibold px-3 py-1 rounded-full hover:opacity-80 transition`}
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
