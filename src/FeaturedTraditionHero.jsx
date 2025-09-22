import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import {
  getDetailPathForItem,
  getCanonicalUrlForItem,
} from './utils/eventDetailPaths';
import {
  DEFAULT_OG_IMAGE,
  SITE_BASE_URL,
  ensureAbsoluteUrl,
  buildEventJsonLd,
  buildIsoDateTime,
} from './utils/seoHelpers';
import {
  PHILLY_TIME_ZONE,
  parseEventDateValue,
  getZonedDate,
} from './utils/dateUtils';

const HERO_MIN_HEIGHT = 'min-h-[420px] sm:min-h-[480px]';
const FALLBACK_IMAGE = DEFAULT_OG_IMAGE;
const SECTION_BG = 'bg-slate-950';

function getNowParts(timeZone = PHILLY_TIME_ZONE) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const map = {};
    parts.forEach(({ type, value }) => {
      map[type] = value;
    });
    return map;
  } catch (error) {
    console.error('Error computing Philadelphia time', error);
    const fallback = new Date();
    return {
      year: String(fallback.getFullYear()),
      month: String(fallback.getMonth() + 1).padStart(2, '0'),
      day: String(fallback.getDate()).padStart(2, '0'),
      hour: String(fallback.getHours()).padStart(2, '0'),
      minute: String(fallback.getMinutes()).padStart(2, '0'),
      second: String(fallback.getSeconds()).padStart(2, '0'),
    };
  }
}

function combineDateAndTime(date, timeStr) {
  if (!date) return null;
  if (!timeStr || typeof timeStr !== 'string') return new Date(date);
  const [h, m = '0', s = '0'] = timeStr.split(':');
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  const combined = new Date(date);
  if (!Number.isNaN(hours)) {
    combined.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, Number.isNaN(seconds) ? 0 : seconds, 0);
  }
  return combined;
}

function formatHeroDateTime(date, hasTime, timeZone = PHILLY_TIME_ZONE) {
  if (!date) return '';
  const opts = hasTime
    ? {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }
    : {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      };
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).format(date);
  } catch {
    return date.toLocaleString('en-US', opts);
  }
}

function buildShortDescription(text, maxLength = 220) {
  if (!text) return '';
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, maxLength - 1).trimEnd();
  return `${sliced}\u2026`;
}

function getVenueLabel(event) {
  if (!event) return '';
  const candidates = [
    event['Venue Name'],
    event.venue_name,
    event.venue,
    event['E Address'],
    event.address,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
}

function getEventImage(event) {
  if (!event) return null;
  const candidates = [event['E Image'], event.image_url, event.image, event.cover_image];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function normalizeNationality(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export default function FeaturedTraditionHero() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groupMatches, setGroupMatches] = useState([]);

  const favoriteState = useEventFavorite({ event_id: event?.id, source_table: 'events' });

  useEffect(() => {
    let isActive = true;
    async function loadEvent() {
      setLoading(true);
      try {
        const parts = getNowParts();
        const datePart = `${parts.year}-${parts.month}-${parts.day}`;
        const timePart = `${parts.hour}:${parts.minute}`;
        let query = supabase
          .from('events')
          .select(`
            id,
            slug,
            "E Name",
            "E Description",
            "E Image",
            Dates,
            "End Date",
            address,
            start_date,
            start_time,
            end_date,
            end_time,
            Nationality
          `)
          .eq('Promoted', 'Yes')
          .order('start_date', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: true })
          .limit(1);

        if (datePart) {
          query = query.or(
            `start_date.gt.${datePart},and(start_date.eq.${datePart},start_time.is.null),and(start_date.eq.${datePart},start_time.gte.${timePart})`
          );
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!isActive) return;
        setEvent(data?.[0] || null);
      } catch (err) {
        console.error('Failed to load featured tradition', err);
        if (isActive) setEvent(null);
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadEvent();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!event) {
      setGroupMatches([]);
      return;
    }
    const nationality = normalizeNationality(event.Nationality || event.nationality);
    if (!nationality) {
      setGroupMatches([]);
      return;
    }

    let isActive = true;
    supabase
      .from('groups')
      .select('id, Name, slug, imag, Nationality')
      .eq('Nationality', nationality)
      .order('Name', { ascending: true })
      .limit(6)
      .then(({ data, error }) => {
        if (!isActive) return;
        if (error) {
          console.error('Failed to load related groups', error);
          setGroupMatches([]);
          return;
        }
        const filtered = Array.isArray(data) ? data.filter(Boolean) : [];
        setGroupMatches(filtered);
      });

    return () => {
      isActive = false;
    };
  }, [event]);

  const detailPath = useMemo(() => (event ? getDetailPathForItem(event) : null), [event]);
  const canonicalUrl = useMemo(
    () => (event ? getCanonicalUrlForItem(event, SITE_BASE_URL) : null),
    [event]
  );

  const title = useMemo(() => {
    if (!event) return '';
    const candidates = [event['E Name'], event.name, event.title];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  }, [event]);

  const description = useMemo(() => {
    if (!event) return '';
    const candidates = [event['E Description'], event.description, event.summary, event.notes];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return buildShortDescription(candidate);
      }
    }
    return '';
  }, [event]);

  const imageUrl = useMemo(() => {
    const raw = getEventImage(event);
    return raw || FALLBACK_IMAGE;
  }, [event]);

  const absoluteImage = useMemo(() => ensureAbsoluteUrl(imageUrl) || FALLBACK_IMAGE, [imageUrl]);

  const startDateRaw = event?.start_date || event?.['E Start Date'] || event?.Dates || event?.['Start Date'] || null;
  const startTimeRaw = event?.start_time || event?.['Start Time'] || null;
  const endDateRaw = event?.end_date || event?.['E End Date'] || event?.['End Date'] || null;
  const endTimeRaw = event?.end_time || event?.['End Time'] || null;

  const startDate = useMemo(() => parseEventDateValue(startDateRaw, PHILLY_TIME_ZONE), [startDateRaw]);
  const endDate = useMemo(() => parseEventDateValue(endDateRaw, PHILLY_TIME_ZONE), [endDateRaw]);
  const startDateTime = useMemo(() => combineDateAndTime(startDate, startTimeRaw), [startDate, startTimeRaw]);
  const endDateTime = useMemo(() => combineDateAndTime(endDate, endTimeRaw), [endDate, endTimeRaw]);

  const formattedDate = useMemo(() => {
    if (startDateTime) return formatHeroDateTime(startDateTime, Boolean(startTimeRaw));
    if (startDate) return formatHeroDateTime(startDate, false);
    return '';
  }, [startDateTime, startDate, startTimeRaw]);

  const venueLabel = useMemo(() => getVenueLabel(event), [event]);

  const ogTitle = title ? `${title} – Our Philly` : 'Our Philly';
  const ogDescription = description || 'Discover Philadelphia traditions with Our Philly.';

  const jsonLd = useMemo(() => {
    if (!event || !title || !canonicalUrl) return null;
    return buildEventJsonLd({
      name: title,
      canonicalUrl,
      startDate: buildIsoDateTime(startDateRaw || startDateTime, startTimeRaw) || startDateTime || startDateRaw,
      endDate: buildIsoDateTime(endDateRaw || endDateTime, endTimeRaw) || endDateTime || endDateRaw,
      locationName: venueLabel,
      description,
      image: absoluteImage,
    });
  }, [
    event,
    title,
    canonicalUrl,
    startDateRaw,
    startDateTime,
    startTimeRaw,
    endDateRaw,
    endDateTime,
    endTimeRaw,
    venueLabel,
    description,
    absoluteImage,
  ]);

  useEffect(() => {
    if (!event) return;
    if (!startDateTime) return;
    const now = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    if (startDateTime.getTime() < now.getTime()) {
      setEvent(null);
    }
  }, [event, startDateTime]);

  if (loading) {
    return (
      <section className="w-full">
        <div className={`relative w-full ${SECTION_BG} text-white`}>
          <div className={`w-full ${HERO_MIN_HEIGHT} bg-slate-900/80 animate-pulse`} />
        </div>
      </section>
    );
  }

  if (!event || !title || !detailPath) {
    return null;
  }

  const handleFavoriteClick = async () => {
    if (!event?.id) return;
    if (!user) {
      navigate('/login');
      return;
    }
    await favoriteState.toggleFavorite();
  };

  const isFavorite = favoriteState.isFavorite;
  const favoriteLoading = favoriteState.loading;

  return (
    <section className="w-full">
      <div className={`relative isolate w-full overflow-hidden ${SECTION_BG} text-white`}>
        <img
          src={imageUrl}
          alt={title}
          loading="eager"
          fetchPriority="high"
          className={`absolute inset-0 h-full w-full object-cover ${HERO_MIN_HEIGHT}`}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/30" aria-hidden="true" />
        <div className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8 lg:py-16 ${HERO_MIN_HEIGHT}`}>
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">Featured Tradition</p>
            <h1 className="mt-3 text-4xl font-[Barrio] font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Mi Gentes!
            </h1>
          </div>
          <div className="max-w-3xl space-y-4">
            <Link
              to={detailPath}
              className="inline-flex items-center gap-2 text-3xl font-bold text-white transition hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 sm:text-4xl"
            >
              {title}
            </Link>
            {formattedDate && (
              <p className="text-lg font-semibold text-white/90">{formattedDate}</p>
            )}
            {venueLabel && (
              <p className="text-base text-white/80">@ {venueLabel}</p>
            )}
            {description && (
              <p
                className="text-base leading-relaxed text-white/90 sm:text-lg"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={detailPath}
                className="inline-flex items-center justify-center rounded-full bg-amber-300 px-5 py-2 text-base font-semibold text-slate-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
              >
                Learn More
              </Link>
              <button
                type="button"
                onClick={handleFavoriteClick}
                disabled={favoriteLoading || !event?.id}
                className={`inline-flex items-center justify-center rounded-full border-2 px-5 py-2 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 ${
                  isFavorite
                    ? 'border-amber-300 bg-amber-200 text-slate-900 hover:bg-amber-100'
                    : 'border-white text-white hover:bg-white hover:text-slate-950'
                } ${favoriteLoading ? 'opacity-75' : ''}`}
              >
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {groupMatches.length > 0 && (
        <div className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Communities</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {`Celebrating ${normalizeNationality(event.Nationality || event.nationality)}`}
              </h2>
              <p className="text-sm text-slate-600">
                Connect with local groups sharing this tradition.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupMatches.map(group => (
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
                    <p className="text-sm text-slate-500">{group.Nationality}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <Helmet>
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={absoluteImage} />
        <meta property="og:url" content={canonicalUrl || SITE_BASE_URL} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={absoluteImage} />
        {jsonLd && (
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        )}
      </Helmet>
    </section>
  );
}
