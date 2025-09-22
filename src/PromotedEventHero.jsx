import React, { useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import {
  trackPromotedEventImpression,
  trackPromotedEventClick,
  trackPromotedRelatedGroupClick,
} from './utils/analytics';
import {
  ensureAbsoluteUrl,
  DEFAULT_OG_IMAGE,
  buildEventJsonLd,
} from './utils/seoHelpers';

function formatDateLine(startDate) {
  if (!startDate || Number.isNaN(startDate.getTime())) return '';
  const weekday = startDate.toLocaleDateString('en-US', { weekday: 'short' });
  const month = startDate.toLocaleDateString('en-US', { month: 'short' });
  const day = startDate.toLocaleDateString('en-US', { day: 'numeric' });
  return `${weekday}, ${month} ${day}`;
}

function stripMeridiem(value) {
  if (!value) return '';
  return value.replace(/\s?(AM|PM)$/i, '');
}

function formatSingleTime(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(':00', '')
    .replace(' a.m.', ' AM')
    .replace(' p.m.', ' PM');
}

function formatTimeRange(start, end) {
  const startLabel = start ? formatSingleTime(start) : '';
  const endLabel = end ? formatSingleTime(end) : '';
  if (!startLabel && !endLabel) return '';
  if (startLabel && !endLabel) return startLabel;
  if (!startLabel && endLabel) return endLabel;
  const startMeridiem = /AM|PM$/i.exec(startLabel)?.[0] || '';
  const endMeridiem = /AM|PM$/i.exec(endLabel)?.[0] || '';
  if (startMeridiem && endMeridiem && startMeridiem === endMeridiem) {
    return `${stripMeridiem(startLabel)}–${endLabel}`;
  }
  return `${startLabel} – ${endLabel}`;
}

function buildDateTimeSummary(event) {
  const dateLine = formatDateLine(event.startDateTime || event.startDate);
  const timeLine = formatTimeRange(event.startDateTime, event.endDateTime);
  if (dateLine && timeLine) return `${dateLine} • ${timeLine}`;
  return dateLine || timeLine || '';
}

function resolveLocation(event) {
  if (event.venueName && event.venueAddress) {
    return `${event.venueName}, ${event.venueAddress}`;
  }
  return event.venueName || event.venueAddress || '';
}

function resolveLearnMore(event) {
  if (event.detailPath) {
    return {
      Component: Link,
      props: { to: event.detailPath },
      isExternal: false,
    };
  }
  if (event.externalUrl) {
    return {
      Component: 'a',
      props: {
        href: event.externalUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      isExternal: true,
    };
  }
  return { Component: 'span', props: { 'aria-disabled': true }, isExternal: false };
}

export default function PromotedEventHero({ event, pageName = 'home', className = '', enableSeo = true }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event?.id,
    source_table: 'events',
  });

  useEffect(() => {
    if (!event?.id) return;
    trackPromotedEventImpression({ page: pageName, position: 'hero', eventId: event.id });
  }, [event?.id, pageName]);

  if (!event) return null;

  const learnMore = resolveLearnMore(event);
  const learnMoreDisabled = learnMore.Component === 'span';
  const metaDescription = event.fullSummary || event.summary || '';
  const heroImage = ensureAbsoluteUrl(event.imageUrl) || event.imageUrl || DEFAULT_OG_IMAGE;
  const canonicalUrl = event.canonicalUrl || ensureAbsoluteUrl(event.learnMoreUrl || event.detailPath || event.externalUrl);
  const dateSummary = buildDateTimeSummary(event);
  const locationSummary = resolveLocation(event);
  const jsonLd = enableSeo
    ? buildEventJsonLd({
        name: event.title,
        canonicalUrl: canonicalUrl || undefined,
        startDate: event.startDateTime || event.startDate,
        endDate: event.endDateTime || event.endDate || event.startDate,
        locationName: locationSummary,
        description: metaDescription,
        image: heroImage,
      })
    : null;

  const handleAddToPlans = e => {
    e.preventDefault();
    if (!event?.id) return;
    if (!user) {
      navigate('/login');
      return;
    }
    trackPromotedEventClick({ cta: 'add_to_plans', eventId: event.id });
    toggleFavorite();
  };

  const handleLearnMoreClick = () => {
    if (!event?.id || learnMoreDisabled) return;
    trackPromotedEventClick({ cta: 'learn_more', eventId: event.id });
  };

  return (
    <section
      className={`relative isolate overflow-hidden bg-slate-950 text-white ${className}`.trim()}
      style={{ marginInline: 'calc(50% - 50vw)', width: '100vw' }}
    >
      {enableSeo && (
        <Helmet>
          {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
          <meta property="og:title" content={event.title} />
          {metaDescription && <meta property="og:description" content={metaDescription} />}
          <meta property="og:image" content={heroImage || DEFAULT_OG_IMAGE} />
          {metaDescription && <meta name="description" content={metaDescription} />}
          {jsonLd && (
            <script type="application/ld+json" key="promoted-event-jsonld">
              {JSON.stringify(jsonLd)}
            </script>
          )}
        </Helmet>
      )}
      <div className="relative flex w-full flex-col justify-end">
        <div className="absolute inset-0">
          <img
            src={heroImage || DEFAULT_OG_IMAGE}
            alt={event.headline || event.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-screen-xl flex-col gap-10 px-4 py-20 sm:px-6 md:flex-row md:items-end md:gap-12 md:py-24">
          <div className="flex-1 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">Featured Tradition</p>
              <h2 className="text-4xl font-[Barrio] text-white sm:text-5xl">{event.headline || event.title}</h2>
            </div>
            <div className="space-y-3 text-white/90">
              {event.title && (
                <learnMore.Component
                  {...learnMore.props}
                  onClick={handleLearnMoreClick}
                  className={`block text-2xl font-semibold text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    learnMoreDisabled ? 'pointer-events-none opacity-80' : ''
                  }`}
                >
                  {event.title}
                </learnMore.Component>
              )}
              {dateSummary && <p className="text-lg font-medium">{dateSummary}</p>}
              {locationSummary && <p className="text-base text-white/80">{locationSummary}</p>}
              {(event.summary || event.fullSummary) && (
                <p className="max-w-2xl text-base text-white/80 md:text-lg">{event.summary || event.fullSummary}</p>
              )}
              {event.nationality && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white/90">
                  {event.nationalityEmoji && <span aria-hidden="true">{event.nationalityEmoji}</span>}
                  <span>{event.nationality}</span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {!learnMoreDisabled && (
                <learnMore.Component
                  {...learnMore.props}
                  onClick={handleLearnMoreClick}
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Learn More
                </learnMore.Component>
              )}
              <button
                type="button"
                onClick={handleAddToPlans}
                disabled={loading}
                className={`inline-flex items-center justify-center rounded-full border-2 border-white px-6 py-3 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isFavorite ? 'bg-white/20 text-white' : 'text-white hover:bg-white/10'
                } ${loading ? 'opacity-70' : ''}`}
              >
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
            </div>
          </div>
          <div className="w-full max-w-md self-stretch overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-lg md:max-w-sm">
            <div className="space-y-3 text-sm text-white/80">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Event Snapshot</p>
              {dateSummary && <p className="text-base">{dateSummary}</p>}
              {locationSummary && <p>{locationSummary}</p>}
              {(event.summary || event.fullSummary) && <p>{event.summary || event.fullSummary}</p>}
            </div>
          </div>
        </div>
        {event.relatedGroups && event.relatedGroups.length > 0 && event.nationality && (
          <div className="relative z-10 border-t border-white/20 bg-black/40">
            <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-4 px-4 py-6 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
                  Explore {event.nationality} community groups →
                </p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {event.relatedGroups.map(group => {
                  if (!group?.slug) return null;
                  const href = `/groups/${group.slug}`;
                  const image = ensureAbsoluteUrl(group.imageUrl) || group.imageUrl || DEFAULT_OG_IMAGE;
                  const handleClick = () =>
                    trackPromotedRelatedGroupClick({ groupId: group.id, eventId: event.id });
                  return (
                    <Link
                      key={group.id || group.slug}
                      to={href}
                      className="group flex min-w-[160px] flex-col items-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-4 py-4 text-center transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      onClick={handleClick}
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-full border border-white/30 bg-white/20">
                        <img src={image} alt={group.name || 'Community group'} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <p className="text-sm font-semibold text-white group-hover:text-white">
                        {group.name || 'View group'}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

