import React, { useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { AuthContext } from '../AuthProvider.jsx';
import useEventFavorite from '../utils/useEventFavorite.js';
import {
  PHILLY_TIME_ZONE,
  formatEventDateRange,
  formatWeekdayAbbrev,
  setStartOfDay,
} from '../utils/dateUtils.js';

const PILL_STYLES = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hoursStr, minutesStr = '00'] = timeStr.split(':');
  let hours = parseInt(hoursStr, 10);
  if (Number.isNaN(hours)) return '';
  const minutes = minutesStr.padStart(2, '0');
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatEventTiming(event, now) {
  if (!event?.startDate) return '';
  const eventDay = setStartOfDay(new Date(event.startDate));
  const diffDays = Math.round((eventDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = event.start_time ? ` · ${formatTime(event.start_time)}` : '';
  if (diffDays === 0) return `Today${timeLabel}`;
  if (diffDays === 1) return `Tomorrow${timeLabel}`;
  const weekday = formatWeekdayAbbrev(event.startDate, PHILLY_TIME_ZONE);
  return `${weekday}${timeLabel}`;
}

function FavoriteState({ eventId, sourceTable, children }) {
  const state = useEventFavorite({ event_id: eventId, source_table: sourceTable });
  return children(state);
}

export default function EventListRow({
  event,
  now,
  tags = [],
  variant = 'default',
  className = '',
  distanceMeters = null,
}) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const safeNow = useMemo(() => now || setStartOfDay(new Date()), [now]);
  const label = formatEventTiming(event, safeNow);
  const badges = Array.isArray(event?.badges) ? event.badges : [];
  const areaLabel = useMemo(() => {
    const candidates = [event?.areaName, event?.area?.name, event?.area_name];
    return candidates.map(value => (typeof value === 'string' ? value.trim() : '')).find(Boolean) || null;
  }, [event?.area?.name, event?.areaName, event?.area_name]);

  const Wrapper = event?.detailPath ? Link : 'div';
  const wrapperProps = event?.detailPath ? { to: event.detailPath } : {};
  const isFeatured = variant === 'featured';
  const containerClass = isFeatured
    ? 'block rounded-2xl border-2 border-amber-400 bg-white shadow-md hover:shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500'
    : 'block rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
  const baseClass = isFeatured
    ? 'rounded-2xl border-2 border-amber-400 bg-white shadow-md'
    : 'rounded-2xl border border-gray-200 bg-white shadow-sm';
  const resolvedClass = `${event?.detailPath ? containerClass : baseClass} ${className}`.trim();

  const chipDistance = useMemo(() => {
    const value = Number.isFinite(distanceMeters)
      ? distanceMeters
      : Number.isFinite(event?.distance_meters)
      ? event.distance_meters
      : Number.isFinite(event?.distanceMeters)
      ? event.distanceMeters
      : null;
    if (!Number.isFinite(value)) return null;
    const miles = value / 1609.344;
    if (!Number.isFinite(miles)) return null;
    return `${miles < 0.2 ? '<0.2' : miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  }, [distanceMeters, event?.distanceMeters, event?.distance_meters]);

  const eventTags = Array.isArray(tags) ? tags : [];
  const displayedTags = eventTags.slice(0, 4);
  const extraTagCount = eventTags.length > 4 ? eventTags.length - 4 : 0;

  const dateRangeText = useMemo(() => {
    if (!event?.startDate) return '';
    return formatEventDateRange(event.startDate, event.endDate || event.startDate, PHILLY_TIME_ZONE);
  }, [event?.startDate, event?.endDate]);

  const addressLabel = useMemo(() => {
    if (event?.address) return event.address;
    if (event?.venueName) return event.venueName;
    if (event?.venue?.name) return event.venue.name;
    return null;
  }, [event?.address, event?.venue?.name, event?.venueName]);

  return (
    <Wrapper className={resolvedClass} {...wrapperProps}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        <div className="w-full flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:w-48">
          {event?.imageUrl ? (
            <img src={event.imageUrl} alt={event?.title || 'Event'} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wide">
            {label && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{label}</span>}
            {chipDistance && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 normal-case">
                {chipDistance}
              </span>
            )}
            {areaLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 normal-case">
                <MapPin className="h-3 w-3 text-slate-500" aria-hidden="true" />
                {areaLabel}
              </span>
            )}
            {badges.map(badge => (
              <span
                key={badge}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 normal-case"
              >
                {badge}
              </span>
            ))}
            {event?.source_table && event?.favoriteId && (
              <FavoriteState eventId={event.favoriteId} sourceTable={event.source_table}>
                {({ isFavorite }) =>
                  isFavorite ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-white normal-case">
                      In the Plans
                    </span>
                  ) : null
                }
              </FavoriteState>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-[#28313e] break-words">{event?.title}</h3>
            {dateRangeText && <p className="mt-1 text-sm text-gray-500">{dateRangeText}</p>}
            {event?.description && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-3">{event.description}</p>
            )}
            {addressLabel && (
              <p className="mt-1 text-sm text-gray-500">{addressLabel}</p>
            )}
          </div>
          {displayedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {displayedTags.map((tag, index) => (
                <Link
                  key={tag.slug || tag.name || index}
                  to={`/tags/${tag.slug || tag.name}`}
                  onClick={event.detailPath ? e => e.stopPropagation() : undefined}
                  className={`${PILL_STYLES[index % PILL_STYLES.length]} inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
                >
                  #{tag.name || tag.slug || tag}
                </Link>
              ))}
              {extraTagCount > 0 && <span className="text-xs text-gray-500">+{extraTagCount} more</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-stretch justify-center gap-2 sm:w-40">
          {event?.source_table && event?.favoriteId ? (
            <FavoriteState eventId={event.favoriteId} sourceTable={event.source_table}>
              {({ isFavorite, toggleFavorite, loading }) => (
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
                  className={`rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition-colors ${
                    isFavorite
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {isFavorite ? 'In the Plans' : 'Add to Plans'}
                </button>
              )}
            </FavoriteState>
          ) : event?.externalUrl ? (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-indigo-600 bg-white px-4 py-2 text-center text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-600 hover:text-white"
            >
              Get Tickets
            </a>
          ) : null}
          {event?.detailPath && (
            <Link
              to={event.detailPath}
              className="rounded-full border border-transparent bg-[#bf3d35] px-4 py-2 text-center text-sm font-semibold text-white shadow transition hover:bg-[#a32c2c]"
            >
              View event →
            </Link>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
