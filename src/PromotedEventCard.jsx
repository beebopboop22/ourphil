import React, { useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthProvider';
import useEventFavorite from './utils/useEventFavorite';
import {
  trackPromotedEventImpression,
  trackPromotedEventClick,
} from './utils/analytics';
import { ensureAbsoluteUrl, DEFAULT_OG_IMAGE } from './utils/seoHelpers';

function formatDateLine(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.toLocaleDateString('en-US', { day: 'numeric' });
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
    };
  }
  return { Component: 'span', props: { 'aria-disabled': true } };
}

export default function PromotedEventCard({ event, pageName = 'list', className = '' }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: event?.id,
    source_table: 'events',
  });

  useEffect(() => {
    if (!event?.id) return;
    trackPromotedEventImpression({ page: pageName, position: 'card', eventId: event.id });
  }, [event?.id, pageName]);

  if (!event) return null;

  const learnMore = resolveLearnMore(event);
  const learnMoreDisabled = learnMore.Component === 'span';
  const dateSummary = buildDateTimeSummary(event);
  const locationSummary = resolveLocation(event);
  const imageUrl = ensureAbsoluteUrl(event.imageUrl) || event.imageUrl || DEFAULT_OG_IMAGE;

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
    <article
      className={`relative overflow-hidden rounded-3xl border border-indigo-100 bg-indigo-50 shadow-lg transition ${className}`.trim()}
    >
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 space-y-4 p-6 md:p-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Featured Tradition</p>
            <h3 className="text-3xl font-[Barrio] text-indigo-900">{event.headline || event.title}</h3>
          </div>
          <div className="space-y-3">
            {event.title && (
              <learnMore.Component
                {...learnMore.props}
                onClick={handleLearnMoreClick}
                className={`inline-block text-xl font-semibold text-indigo-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  learnMoreDisabled ? 'pointer-events-none opacity-70' : ''
                }`}
              >
                {event.title}
              </learnMore.Component>
            )}
            {dateSummary && <p className="text-base font-medium text-indigo-900">{dateSummary}</p>}
            {locationSummary && <p className="text-sm text-indigo-800/90">{locationSummary}</p>}
            {(event.summary || event.fullSummary) && (
              <p className="text-sm text-indigo-900/80 md:text-base">{event.summary || event.fullSummary}</p>
            )}
            {event.nationality && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-900">
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
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Learn More
              </learnMore.Component>
            )}
            <button
              type="button"
              onClick={handleAddToPlans}
              disabled={loading}
              className={`inline-flex items-center justify-center rounded-full border-2 border-indigo-600 px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                isFavorite ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'
              } ${loading ? 'opacity-70' : ''}`}
            >
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          </div>
        </div>
        <div className="relative h-64 w-full md:h-auto md:w-80">
          <img
            src={imageUrl}
            alt={event.headline || event.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </article>
  );
}

