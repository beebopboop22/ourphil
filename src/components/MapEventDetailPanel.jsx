import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { AuthContext } from '../AuthProvider.jsx';
import useEventFavorite from '../utils/useEventFavorite.js';
import { formatEventDateRange, PHILLY_TIME_ZONE } from '../utils/dateUtils.js';

const pillStyles = [
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
  const [hoursStr = '0', minutesStr = '00'] = timeStr.split(':');
  let hours = Number(hoursStr);
  if (!Number.isFinite(hours)) return '';
  const minutes = minutesStr.slice(0, 2);
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function MapEventDetailPanel({ event, onClose, variant = 'desktop' }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const favoriteState = useEventFavorite({
    event_id: event?.favoriteId ?? null,
    source_table: event?.source_table ?? null,
  });

  if (!event) {
    if (variant === 'mobile') {
      return null;
    }
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-[#f4c9bc]/70 bg-white/90 p-6 text-center text-sm text-[#4a5568]">
        <p className="font-semibold text-[#29313f]">Select an event on the map to preview it here.</p>
        <p className="mt-2 text-xs text-[#6b7280]">Tap any marker to see highlights and add it to your plans.</p>
      </div>
    );
  }

  const tags = Array.isArray(event.mapTags) ? event.mapTags : [];
  const badges = Array.isArray(event.badges) ? event.badges : [];
  const areaLabel =
    [event.areaName, event.area?.name, event.area_name]
      .map(candidate => (typeof candidate === 'string' ? candidate.trim() : ''))
      .find(Boolean) || null;
  const venueName = typeof event.venueName === 'string' && event.venueName.trim() ? event.venueName.trim() : null;
  const locationLabel = venueName || event.address || areaLabel;
  const detailPath = event.detailPath || null;
  const externalUrl = event.externalUrl || null;
  const dateLabel = formatEventDateRange(event.startDate, event.endDate, PHILLY_TIME_ZONE);
  const timeLabel = event.timeLabel
    ? event.timeLabel
    : event.start_time && event.end_time
    ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
    : event.start_time
    ? formatTime(event.start_time)
    : null;

  let actionButton = null;
  if (event.source_table && event.favoriteId) {
    actionButton = (
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          if (!user) {
            navigate('/login');
            return;
          }
          favoriteState.toggleFavorite();
        }}
        disabled={favoriteState.loading}
        className={`inline-flex items-center justify-center rounded-full border border-indigo-600 px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
          favoriteState.isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
        }`}
      >
        {favoriteState.isFavorite ? 'In the Plans' : 'Add to Plans'}
      </button>
    );
  } else if (externalUrl) {
    actionButton = (
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-full border border-indigo-600 bg-white px-5 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-600 hover:text-white"
      >
        Get Tickets
      </a>
    );
  }

  const panelPadding = variant === 'desktop' ? 'p-6' : 'p-5';
  const panelSizing = variant === 'desktop' ? 'h-full' : 'max-h-[70vh] sm:max-h-[75vh]';

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden rounded-2xl border border-[#f4c9bc]/70 bg-white shadow-lg shadow-[#bf3d35]/10 ${panelPadding} ${panelSizing}`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg font-semibold text-[#9a6f62] shadow-sm ring-1 ring-inset ring-white/60 transition hover:bg-white hover:text-[#bf3d35]"
        aria-label="Close event preview"
      >
        ×
      </button>
      {event.imageUrl && (
        <div className="mb-4 overflow-hidden rounded-xl bg-[#f7e5de]">
          <img src={event.imageUrl} alt={event.title} className="h-40 w-full object-cover sm:h-48" loading="lazy" />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-700">
            {badges.map(badge => (
              <span
                key={badge}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  badge === 'Tradition'
                    ? 'bg-yellow-100 text-yellow-800'
                    : badge === 'Submission'
                    ? 'bg-purple-100 text-purple-800'
                    : badge === 'Sports'
                    ? 'bg-green-100 text-green-800'
                    : badge === 'Recurring'
                    ? 'bg-blue-100 text-blue-800'
                    : badge === 'Group Event'
                    ? 'bg-emerald-100 text-emerald-800'
                    : badge === 'Featured'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {badge}
              </span>
            ))}
            {areaLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[#29313f]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {areaLabel}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-black leading-tight text-[#29313f]">{event.title}</h3>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9a6f62]">{dateLabel}</p>
          {timeLabel && <p className="text-sm font-medium text-[#29313f]">{timeLabel}</p>}
          {locationLabel && (
            <p className="flex items-center gap-2 text-sm text-[#4a5568]">
              <MapPin className="h-4 w-4 text-[#bf3d35]" aria-hidden="true" />
              {locationLabel}
            </p>
          )}
          {event.description && (
            <p className="text-sm leading-relaxed text-[#4a5568]">{event.description}</p>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <Link
                key={tag.slug}
                to={`/tags/${tag.slug}`}
                className={`${pillStyles[index % pillStyles.length]} inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80`}
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-[#f4c9bc]/70 pt-4">
        {actionButton}
        {detailPath && (
          <Link
            to={detailPath}
            className="inline-flex items-center justify-center rounded-full border border-transparent bg-[#bf3d35] px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-[#a32c2c]"
          >
            View event →
          </Link>
        )}
      </div>
    </div>
  );
}

export default MapEventDetailPanel;
