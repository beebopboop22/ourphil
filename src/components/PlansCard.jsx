import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthProvider';
import useEventFavorite from '../utils/useEventFavorite';

function normalizeBadge(badge) {
  if (!badge) return null;
  if (typeof badge === 'string') {
    return { label: badge, className: undefined };
  }
  return badge;
}

export default function PlansCard({
  title,
  imageUrl,
  href,
  badge,
  meta,
  secondaryMeta,
  eventId,
  sourceTable,
  externalUrl,
  className = '',
}) {
  const normalizedBadge = normalizeBadge(badge);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({
    event_id: eventId,
    source_table: sourceTable,
  });

  const canFavorite = Boolean(eventId && sourceTable && !externalUrl);
  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href } : {};

  const handleFavoriteClick = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite();
  };

  return (
    <Wrapper
      {...wrapperProps}
      className={`group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-md transition duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
        isFavorite && canFavorite ? 'ring-2 ring-indigo-600' : ''
      } ${className}`.trim()}
    >
      <div className="relative h-40 w-full overflow-hidden bg-gray-100">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-500">
            Photo coming soon
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {isFavorite && canFavorite && (
          <div className="absolute right-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow">
            In the plans!
          </div>
        )}
        {normalizedBadge?.label && (
          <div
            className={`absolute inset-x-0 bottom-0 text-center text-xs font-bold uppercase tracking-wide ${
              normalizedBadge.className || 'bg-indigo-600 text-white'
            }`}
          >
            {normalizedBadge.label}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-4 text-center">
        <div className="flex w-full flex-1 flex-col items-center">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{title}</h3>
          {meta && <p className="mt-2 text-sm text-gray-600">{meta}</p>}
          {secondaryMeta && <p className="mt-1 text-xs text-gray-500">{secondaryMeta}</p>}
        </div>
        <div className="mt-4 w-full">
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
              onClick={e => e.stopPropagation()}
            >
              Get Tickets
            </a>
          ) : canFavorite ? (
            <button
              type="button"
              onClick={handleFavoriteClick}
              disabled={loading}
              className={`inline-flex w-full items-center justify-center rounded-md border border-indigo-600 px-4 py-2 text-sm font-semibold transition ${
                isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          ) : null}
        </div>
      </div>
    </Wrapper>
  );
}
