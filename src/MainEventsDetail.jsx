// src/MainEventsDetail.jsx
import React, { useEffect, useState, useContext, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';
import { RRule } from 'rrule';
import PostFlyerModal from './PostFlyerModal';
import SubmitEventSection from './SubmitEventSection';
import useEventFavorite from './utils/useEventFavorite';
const CommentsSection = lazy(() => import('./CommentsSection'));

import Seo from './components/Seo.jsx';
import {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  ensureAbsoluteUrl,
  buildEventJsonLd,
  buildIsoDateTime,
} from './utils/seoHelpers.js';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';
import ReviewPhotoGrid from './ReviewPhotoGrid';
import { Pencil, Trash2, Instagram } from 'lucide-react';
import UnifiedEventHeader from './components/UnifiedEventHeader.jsx';

const FALLBACK_MAIN_EVENT_TITLE = 'Philadelphia Event – Our Philly';
const FALLBACK_MAIN_EVENT_DESCRIPTION =
  'Discover upcoming events and things to do across Philadelphia with Our Philly.';

const TAG_PILL_STYLES = [
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

function formatRelativeDateLabel(dateStr, timeStr) {
  if (!dateStr) return '';
  const dt = parseLocalYMD(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dt - today) / (1000 * 60 * 60 * 24));
  let label = '';
  if (diffDays === 0) label = 'Today';
  else if (diffDays === 1) label = 'Tomorrow';
  else label = dt.toLocaleDateString('en-US', { weekday: 'long' });
  if (timeStr) label += ` · ${formatTime(timeStr)}`;
  return label;
}

function normalizeInstagramHandle(value) {
  if (!value) return '';
  return value
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\?.*$/, '')
    .replace(/\/$/, '')
    .replace(/^@/, '');
}

function AddToPlansButton({ eventId, sourceTable }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: eventId,
    source_table: sourceTable,
  });

  if (!eventId) return null;

  return (
    <button
      type="button"
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          navigate('/login');
          return;
        }
        toggleFavorite();
      }}
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

function VenueEventRow({ event, venueSlug, tags = [] }) {
  const label = formatRelativeDateLabel(event.start_date, event.start_time);
  return (
    <Link
      to={`/${venueSlug}/${event.slug}`}
      className="block rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between p-4 md:p-6">
        <div className="flex items-start gap-4 w-full">
          <div className="hidden sm:block flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
            {event.image ? (
              <img src={event.image} alt={event.name} className="w-full h-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-400">
                No Image
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              {label && <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">{label}</span>}
            </div>
            <h3 className="mt-2 text-lg font-bold text-gray-800 break-words">{event.name}</h3>
            {event.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{event.description}</p>
            )}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.slice(0, 3).map((tag, index) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    className={`${TAG_PILL_STYLES[index % TAG_PILL_STYLES.length]} px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-80`}
                    onClick={e => e.stopPropagation()}
                  >
                    #{tag.name}
                  </Link>
                ))}
                {tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{tags.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:w-40">
          <AddToPlansButton eventId={event.id} sourceTable="all_events" />
        </div>
      </div>
    </Link>
  );
}

function RecurringEventRow({ event, occurrenceDate, tags = [] }) {
  const timeLabel = event.start_time ? formatTime(event.start_time) : '';
  const dayLabel = occurrenceDate
    ? new Date(occurrenceDate).toLocaleDateString('en-US', { weekday: 'long' })
    : '';
  return (
    <Link
      to={`/series/${event.slug}/${occurrenceDate}`}
      className="block rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between p-4 md:p-6">
        <div className="flex items-start gap-4 w-full">
          <div className="hidden sm:block flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
            {event.image_url ? (
              <img src={event.image_url} alt={event.name} className="w-full h-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-400">
                No Image
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              {dayLabel && (
                <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">Every {dayLabel}</span>
              )}
              {timeLabel && (
                <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">Starts at {timeLabel}</span>
              )}
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Recurring Series</span>
            </div>
            <h3 className="mt-2 text-lg font-bold text-gray-800 break-words">{event.name}</h3>
            {event.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{event.description}</p>
            )}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.slice(0, 3).map((tag, index) => (
                  <Link
                    key={tag.slug}
                    to={`/tags/${tag.slug}`}
                    className={`${TAG_PILL_STYLES[index % TAG_PILL_STYLES.length]} px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-80`}
                    onClick={e => e.stopPropagation()}
                  >
                    #{tag.name}
                  </Link>
                ))}
                {tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{tags.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:w-40">
          <AddToPlansButton eventId={event.id} sourceTable="recurring_events" />
        </div>
      </div>
    </Link>
  );
}

// parse "YYYY-MM-DD" into local Date
function parseLocalYMD(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// format "HH:MM[:SS]" into "h:mm a.m./p.m."
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const min = (minStr || '00').padStart(2, '0');
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

export default function MainEventsDetail() {
  const { slug, venue } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useContext(AuthContext);

  // State
  const [event, setEvent] = useState(null);
  const [venueData, setVenueData] = useState(null);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [relatedEventTags, setRelatedEventTags] = useState({});
  const [communityEvents, setCommunityEvents] = useState([]);
  const [sameDayEvents, setSameDayEvents] = useState([]);
  const [sameDayEventTags, setSameDayEventTags] = useState({});
  const [eventTags, setEventTags] = useState([]);
  const [reviewPhotos, setReviewPhotos] = useState([]);

  // post flyer modal state
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [modalStartStep, setModalStartStep] = useState(1);
  const [initialFlyer, setInitialFlyer] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin / edit state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    link: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);

  const {
    isFavorite,
    toggleFavorite,
    loading: toggling,
  } = useEventFavorite({ event_id: event?.id, source_table: 'all_events' });

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    await toggleFavorite();
  };

  const fetchTagsForEvents = async (ids, type, setter) => {
    if (!ids?.length) {
      setter({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('taggings')
        .select('taggable_id, tags(name, slug)')
        .eq('taggable_type', type)
        .in('taggable_id', ids);
      if (error) throw error;
      const map = {};
      (data || []).forEach(row => {
        if (!row?.tags) return;
        if (!map[row.taggable_id]) map[row.taggable_id] = [];
        map[row.taggable_id].push(row.tags);
      });
      setter(map);
    } catch (err) {
      console.error(err);
      setter({});
    }
  };

  useEffect(() => {
    if (!event) return;
    supabase
      .from('reviews')
      .select('photo_urls')
      .eq('event_id', event.id)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setReviewPhotos([]);
        } else {
          const urls = (data || []).flatMap(r => {
            let arr = Array.isArray(r.photo_urls) ? r.photo_urls : [];
            if (!Array.isArray(r.photo_urls) && r.photo_urls) {
              try {
                const p = JSON.parse(r.photo_urls);
                if (Array.isArray(p)) arr = p;
              } catch {}
            }
            return arr;
          });
          setReviewPhotos(urls.slice(0, 20));
        }
      });
  }, [event]);

  // Fetch everything
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // main event
        const { data: evs, error: evErr } = await supabase
          .from('all_events')
          .select(`
            id, venue_id, name, description, link, image,
            start_date, end_date, start_time, end_time,
            address, created_at, slug
          `)
          .eq('slug', slug)
          .limit(1);
        if (evErr) throw evErr;
        if (!evs?.length) { setLoading(false); return; }
        const ev = evs[0];
        setEvent(ev);

        if (ev.venue_id) {
          const { data: vens } = await supabase
            .from('venues')
            .select('id,name,slug,address,description,website,instagram')
            .eq('id', ev.venue_id)
            .limit(1);
          setVenueData(vens?.[0] || null);

          const todayStr = new Date().toISOString().slice(0,10);
          const { data: rel } = await supabase
            .from('all_events')
            .select(`id,name,slug,start_date,start_time,description,image`)
            .eq('venue_id', ev.venue_id)
            .gte('start_date', todayStr)
            .neq('slug', slug)
            .order('start_date',{ ascending: true })
            .limit(12);
          setRelatedEvents(rel || []);
          await fetchTagsForEvents((rel || []).map(item => item.id), 'all_events', setRelatedEventTags);
        } else {
          setVenueData(null);
          setRelatedEvents([]);
          setRelatedEventTags({});
        }

        // community subs
        const todayStr = new Date().toISOString().slice(0,10);
        const { data: list } = await supabase
          .from('big_board_events')
          .select('id,post_id,title,start_date,slug')
          .gte('start_date', todayStr)
          .neq('slug', slug)
          .order('start_date',{ ascending: true })
          .limit(24);
        if (list) {
          const enriched = await Promise.all(
            list.map(async evb => {
              const { data: p } = await supabase
                .from('big_board_posts')
                .select('image_url')
                .eq('id', evb.post_id)
                .single();
              let url = '';
              if (p?.image_url) {
                const { data:{ publicUrl }} = supabase
                  .storage.from('big-board')
                  .getPublicUrl(p.image_url);
                url = publicUrl;
              }
              return { ...evb, imageUrl: url };
            })
          );
          setCommunityEvents(enriched);
        }
      } catch (err) {
        console.error(err);
        setRelatedEvents([]);
        setRelatedEventTags({});
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Load tags for this event
  useEffect(() => {
    if (!event) return;
    supabase
      .from('taggings')
      .select('tags(name,slug)')
      .eq('taggable_type', 'all_events')
      .eq('taggable_id', event.id)
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setEventTags((data || []).map(r => r.tags));
      });

  }, [event]);

  // Load recurring events on the same day
  useEffect(() => {
    if (!event?.start_date) return;
    const start = parseLocalYMD(event.start_date);
    const dayStart = new Date(start); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(start); dayEnd.setHours(23,59,59,999);
    (async () => {
      try {
        const { data: list } = await supabase
          .from('recurring_events')
          .select('id,name,slug,image_url,start_date,start_time,end_date,rrule,description')
          .eq('is_active', true);
        const matches = [];
        (list || []).forEach(ev => {
          const opts = RRule.parseString(ev.rrule);
          opts.dtstart = new Date(`${ev.start_date}T${ev.start_time}`);
          if (ev.end_date) opts.until = new Date(`${ev.end_date}T23:59:59`);
          const rule = new RRule(opts);
          if (rule.between(dayStart, dayEnd, true).length) {
            matches.push(ev);
          }
        });
        setSameDayEvents(matches);
        await fetchTagsForEvents(matches.map(item => item.id), 'recurring_events', setSameDayEventTags);
      } catch (e) {
        console.error(e);
        setSameDayEvents([]);
        setSameDayEventTags({});
      }
    })();
  }, [event]);

  // Populate form on edit
  useEffect(() => {
    if (isEditing && event) {
      setFormData({
        name:        event.name        || '',
        description: event.description || '',
        link:        event.link        || '',
        start_date:  event.start_date  || '',
        end_date:    event.end_date    || '',
        start_time:  event.start_time  || '',
        end_time:    event.end_time    || '',
        address:     event.address     || '',
      });
    }
  }, [isEditing, event]);

  // Handle form field change
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };

  // Save edits
  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:        formData.name,
        description: formData.description || null,
        link:        formData.link || null,
        start_date:  formData.start_date,
        end_date:    formData.end_date   || null,
        start_time:  formData.start_time || null,
        end_time:    formData.end_time   || null,
        address:     formData.address    || null,
      };
      const { data: updated, error } = await supabase
        .from('all_events')
        .update(payload)
        .eq('id', event.id)
        .single();
      if (error) throw error;
      setEvent(ev => ({ ...ev, ...updated }));
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
      await supabase.from('all_events').delete().eq('id', event.id);
      navigate('/');
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  const fallbackCanonicalPath =
    getDetailPathForItem({
      slug,
      venue_slug: venue,
    }) || (venue ? `/${venue}/${slug}` : `/events/${slug}`);
  const fallbackCanonicalUrl = `${SITE_BASE_URL}${fallbackCanonicalPath}`;

  if (loading || !event) {
    const message = loading ? 'Loading…' : 'Event not found.';
    const messageClass = loading ? 'text-gray-500' : 'text-red-600';
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Seo
          title={FALLBACK_MAIN_EVENT_TITLE}
          description={FALLBACK_MAIN_EVENT_DESCRIPTION}
          canonicalUrl={fallbackCanonicalUrl}
          ogImage={DEFAULT_OG_IMAGE}
          ogType="event"
        />
        <Navbar/>
        <div className="flex-grow flex items-center justify-center mt-32">
          <div className={`text-2xl ${messageClass}`}>{message}</div>
        </div>
        <Footer/>
      </div>
    );
  }

  // Friendly date/time
  const sd = parseLocalYMD(event.start_date);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const daysDiff = Math.round((sd - today0)/(1000*60*60*24));
  const whenText =
    daysDiff === 0 ? 'Today' :
    daysDiff === 1 ? 'Tomorrow' :
    sd.toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' });
  const timeText = event.start_time ? formatTime(event.start_time) : '';
  const endTimeText = event.end_time ? formatTime(event.end_time) : '';
  const weekdayName = sd.toLocaleDateString('en-US',{ weekday:'long' });
  const venueSlugForCanonical = venueData?.slug || venue;
  const canonicalPath =
    getDetailPathForItem({
      ...event,
      venue_slug: venueSlugForCanonical,
      venues: event.venues || (venueData ? { name: venueData.name, slug: venueData.slug } : null),
    }) || (venueSlugForCanonical ? `/${venueSlugForCanonical}/${event.slug}` : `/events/${event.slug}`);
  const canonicalUrl = `${SITE_BASE_URL}${canonicalPath}`;

  const eventImage = ensureAbsoluteUrl(event.image) || DEFAULT_OG_IMAGE;
  const rawDescription = event.description || '';
  const seoDescription = rawDescription
    ? rawDescription.slice(0, 155)
    : FALLBACK_MAIN_EVENT_DESCRIPTION;

  const startIso = buildIsoDateTime(event.start_date, event.start_time);
  const endIso = buildIsoDateTime(event.end_date || event.start_date, event.end_time);
  const jsonLd = buildEventJsonLd({
    name: event.name,
    canonicalUrl,
    startDate: startIso || event.start_date,
    endDate: endIso,
    locationName: venueData?.name || event.address || 'Philadelphia',
    description: seoDescription,
    image: eventImage,
  });

  const venueDescription = venueData?.description?.trim();
  const headerDescription = (() => {
    const text = event.description?.trim();
    if (!text && !venueDescription) return null;
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">What to Expect</p>
        {text && (
          <p className="text-base text-gray-700 whitespace-pre-line">{text}</p>
        )}
        {venueDescription && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              About this Philly Description
            </p>
            <p className="text-base text-gray-700 whitespace-pre-line">{venueDescription}</p>
          </div>
        )}
      </div>
    );
  })();
  const visitLink = event.link?.trim() || '';

  const headerDateText = sd
    ? timeText
      ? `${sd.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${timeText}`
      : `${sd.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} (Time TBA)`
    : '';
  const locationMeta = (() => {
    if (venueData?.name) return venueData.name;
    if (event.address) return event.address.split(',')[0].trim();
    if (venueData?.address) return venueData.address.split(',')[0].trim();
    return 'Philadelphia';
  })();
  const headerTags = eventTags.map(tag => ({ name: tag.name, slug: tag.slug }));
  const venueSlugLink = venueData?.slug || venue || event?.venues?.slug || null;
  const venueDisplayName = venueData?.name || event.address || venueData?.address || '';
  const headerContext = venueDisplayName
    ? (
        <span className="flex flex-wrap items-center gap-3">
          <span>
            At:{' '}
            {venueSlugLink ? (
              <Link to={`/${venueSlugLink}`} className="font-semibold text-indigo-700">
                {venueDisplayName}
              </Link>
            ) : (
              <span className="font-semibold">{venueDisplayName}</span>
            )}
          </span>
          {instagramUrl && instagramHandle && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline"
            >
              <Instagram className="h-4 w-4" />
              @{instagramHandle}
            </a>
          )}
        </span>
      )
    : null;

  // Which address to_SEARCH for Google Maps:
  const resolvedAddress = event.address?.trim() || venueData?.address?.trim();
  // Link text is always venue name if available:
  const instagramUrlRaw = venueData?.instagram?.trim();
  const instagramUrl = instagramUrlRaw
    ? (instagramUrlRaw.startsWith('http')
      ? instagramUrlRaw
      : `https://instagram.com/${instagramUrlRaw.replace(/^@/, '')}`)
    : null;
  const instagramHandle = normalizeInstagramHandle(instagramUrlRaw || instagramUrl || '');

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title={`${event.name} | Our Philly Concierge`}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogImage={eventImage}
        ogType="event"
        jsonLd={jsonLd}
      />

      <Navbar/>

      <main className="flex-grow mt-32 pb-24 md:pb-0">
        <UnifiedEventHeader
          title={event.name}
          dateText={headerDateText}
          locationText={locationMeta}
          tags={headerTags}
          getTagClassName={index => TAG_PILL_STYLES[index % TAG_PILL_STYLES.length]}
          onToggleFavorite={handleFavorite}
          isFavorite={isFavorite}
          favoriteLoading={toggling}
          coverImage={event.image}
          contextCallout={headerContext}
          description={headerDescription}
          visitLink={visitLink}
          mapCoordinates={null}
          mapLabel={resolvedAddress}
        />

        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 pt-4">
          <Link to="/" className="text-sm font-medium text-indigo-600 hover:underline">
            ← Back to Events
          </Link>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>

          {!user && (
            <div className="w-full bg-indigo-600 text-white text-center py-4 text-xl sm:text-2xl">
              <Link to="/login" className="underline font-semibold">Log in</Link> or <Link to="/signup" className="underline font-semibold">sign up</Link> free to add to your Plans
            </div>
          )}

          {reviewPhotos.length > 0 && (
            <ReviewPhotoGrid photos={reviewPhotos} />
          )}

          {/* Content */}
          <div className="max-w-4xl mx-auto mt-12 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left */}
            <div>
              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      name="name"
                      value={formData.name}
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
                  {/* Link */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Link</label>
                    <input
                      name="link"
                      type="url"
                      value={formData.link}
                      onChange={handleChange}
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={handleChange}
                      className="mt-1 w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
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
              ) : null}
            </div>

            {/* Right: image */}
            <div>
              {event.image ? (
                <img
                  src={event.image}
                  alt={event.name}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-full h-[240px] bg-gray-200 rounded-lg" />
              )}
          </div>
          </div>

          <Suspense fallback={<div className="max-w-4xl mx-auto mt-12 px-4 text-gray-500">Loading comments…</div>}>
            <CommentsSection
              source_table="all_events"
              event_id={event.id}
            />
          </Suspense>

          {relatedEvents.length > 0 && venueData && (
            <section className="max-w-4xl mx-auto mt-12 px-4">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                More at {venueData.name}
              </h2>
              {venueDescription && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-indigo-900">
                    What We're Seeing at {venueData.name}
                  </h3>
                  <p className="mt-2 text-base text-gray-700 leading-relaxed whitespace-pre-line">
                    {venueDescription}
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {relatedEvents.slice(0, 8).map(re => (
                  <VenueEventRow
                    key={re.id}
                    event={re}
                    venueSlug={venueData.slug}
                    tags={relatedEventTags[re.id] || []}
                  />
                ))}
              </div>
            </section>
          )}
          {sameDayEvents.length > 0 && (
            <section className="max-w-4xl mx-auto mt-12 px-4">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Every {weekdayName} in Philly
              </h2>
              <div className="space-y-4">
                {sameDayEvents.map(ev => (
                  <RecurringEventRow
                    key={ev.id}
                    event={ev}
                    occurrenceDate={event.start_date}
                    tags={sameDayEventTags[ev.id] || []}
                  />
                ))}
              </div>
            </section>
          )}
          {/* Community Submissions */}
          <section className="border-t border-gray-200 mt-12 pt-8 px-4 pb-12 max-w-4xl mx-auto">
            <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
              Upcoming Community Submissions
            </h2>
            {communityEvents.length === 0 ? (
              <p className="text-center text-gray-600">No upcoming submissions.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {communityEvents.map(evb => {
                  const dt = parseLocalYMD(evb.start_date);
                  const diff = Math.round(
                    (dt - new Date(new Date().setHours(0,0,0,0))) /
                    (1000*60*60*24)
                  );
                  const prefix =
                    diff === 0 ? 'Today' :
                    diff === 1 ? 'Tomorrow' :
                    dt.toLocaleDateString('en-US',{ weekday:'long' });
                  const md = dt.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
                  return (
                    <Link
                      key={evb.id}
                      to={`/big-board/${evb.slug}`}
                      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] overflow-hidden flex flex-col"
                    >
                      <div className="relative h-40 bg-gray-100">
                        <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white uppercase text-xs text-center py-1 z-20">
                          COMMUNITY SUBMISSION
                        </div>
                        {evb.imageUrl ? (
                          <img
                            src={evb.imageUrl}
                            alt={evb.title}
                            className="w-full h-full object-cover object-center"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-center text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                          {evb.title}
                        </h3>
                        <span className="text-sm text-gray-600">
                          {prefix}, {md}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <SubmitEventSection onNext={file => { setInitialFlyer(file); setModalStartStep(2); setShowFlyerModal(true); }} />
      </main>

      <Footer/>
      <PostFlyerModal isOpen={showFlyerModal} onClose={() => setShowFlyerModal(false)} startStep={modalStartStep} initialFile={initialFlyer} />
    </div>
  );
}
