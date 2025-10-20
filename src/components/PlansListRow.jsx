import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { AuthContext } from '../AuthProvider.jsx';
import useEventFavorite from '../utils/useEventFavorite.js';

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

export default function PlansListRow({
  event,
  tags = [],
  className = '',
}) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const canFavorite = Boolean(event?.favoriteId && event?.source_table);
  const favoriteState = useEventFavorite({
    event_id: event?.favoriteId,
    source_table: event?.source_table,
  });

  const onFavoriteClick = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!canFavorite) return;
    if (!user) {
      navigate('/login');
      return;
    }
    favoriteState.toggleFavorite();
  };

  const Wrapper = event?.detailPath ? Link : 'div';
  const wrapperProps = event?.detailPath ? { to: event.detailPath } : {};

  const areaLabel = (event?.neighborhood || event?.areaName || '').trim();
  const badges = Array.isArray(event?.badges) ? event.badges : [];

  return (
    <Wrapper
      {...wrapperProps}
      className={`block rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-6">
        <div className="flex w-full items-start gap-4">
          <div className="hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:block">
            {event?.imageUrl ? (
              <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-600">
              {event?.metaLabel && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">
                  {event.metaLabel}
                </span>
              )}
              {areaLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cfc3] px-2 py-0.5 text-[#29313f]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {areaLabel}
                </span>
              )}
              {badges.map(badge => (
                <span
                  key={badge}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"
                >
                  {badge}
                </span>
              ))}
            </div>
            <h3 className="mt-2 text-lg font-bold text-gray-800">
              {event?.title || 'Untitled Event'}
            </h3>
            {event?.description && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{event.description}</p>
            )}
            {event?.venueName && (
              <p className="mt-1 text-sm text-gray-500">at {event.venueName}</p>
            )}
            {event?.address && !event?.venueName && (
              <p className="mt-1 text-sm text-gray-500">{event.address}</p>
            )}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={tag.slug || `${tag.name}-${index}`}
                    className={`${pillStyles[index % pillStyles.length]} rounded-full px-3 py-1 text-xs font-semibold`}
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 md:w-44">
          {canFavorite ? (
            <button
              type="button"
              onClick={onFavoriteClick}
              disabled={favoriteState.loading}
              className={`rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
                favoriteState.isFavorite
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              {favoriteState.isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          ) : event?.externalUrl ? (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-indigo-600 px-4 py-2 text-center text-sm font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
            >
              Get Tickets
            </a>
          ) : null}
          {event?.timeLabel && (
            <span className="text-center text-xs font-medium uppercase tracking-wide text-gray-500">
              {event.timeLabel}
            </span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
