import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ExternalLink } from 'lucide-react';
import { MAPBOX_TOKEN } from '../config/mapboxToken.js';
import EventMapPreview from './EventMapPreview.jsx';

function buildMetaLine({ dateText, locationText }) {
  const parts = [];
  const trimmedDate = typeof dateText === 'string' ? dateText.trim() : '';
  const trimmedLocation = typeof locationText === 'string' ? locationText.trim() : '';

  parts.push(trimmedDate || 'Date & time TBA');
  parts.push(trimmedLocation || 'Location TBA');

  return parts.join(' \u00b7 ');
}

export default function UnifiedEventHeader({
  title,
  dateText,
  locationText,
  tags = [],
  getTagClassName,
  onTagClick,
  onToggleFavorite,
  isFavorite,
  favoriteLoading,
  coverImage,
  description,
  descriptionTitle,
  descriptionSubtitle,
  visitLink,
  visitLabel = 'Visit Site',
  afterImageContent,
  contextCallout,
  mapCoordinates,
  mapLabel,
}) {
  const metaLine = buildMetaLine({ dateText, locationText });
  const hasFavorite = typeof onToggleFavorite === 'function';
  const tagClassName = index => {
    if (typeof getTagClassName === 'function') {
      return getTagClassName(index);
    }
    return 'bg-indigo-100 text-indigo-700';
  };

  const lat = mapCoordinates?.latitude;
  const lng = mapCoordinates?.longitude;
  const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const resolvedMapLabel = mapCoordinates?.address || mapLabel || locationText;

  const normalizedToken = typeof MAPBOX_TOKEN === 'string' ? MAPBOX_TOKEN.trim() : '';
  const mapExternalHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${parsedLat},${parsedLng}`)}`
    : resolvedMapLabel
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedMapLabel)}`
      : null;
  const shouldRenderMap = hasCoords && normalizedToken.length > 0;
  const showMapSection = shouldRenderMap || mapExternalHref;

  const descriptionNode = (() => {
    if (!description) return null;
    if (React.isValidElement(description)) return description;
    if (typeof description === 'string') {
      return (
        <p className="text-base text-gray-700 whitespace-pre-line">
          {description}
        </p>
      );
    }
    return null;
  })();

  const showImageSection = Boolean(coverImage || descriptionNode || visitLink);

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="sticky top-[72px] z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:top-[88px]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl" title={title}>
              {title || 'Event'}
            </h1>
            <p className="mt-2 text-sm text-gray-600 sm:text-base">{metaLine}</p>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag, index) => {
                  const key = tag.slug || tag.name || index;
                  const href = tag.href || (tag.slug ? `/tags/${tag.slug}` : '#');
                  const className = `${tagClassName(index)} px-3 py-1 text-xs font-semibold rounded-full transition hover:opacity-80`;
                  return (
                    <Link
                      key={key}
                      to={href}
                      className={className}
                      onClick={event => {
                        if (typeof onTagClick === 'function') {
                          onTagClick(event, tag);
                        }
                      }}
                    >
                      #{tag.name || tag.label || 'Tag'}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          {hasFavorite && (
            <div className="hidden flex-none md:flex">
              <button
                type="button"
                onClick={event => {
                  event.preventDefault();
                  onToggleFavorite();
                }}
                disabled={favoriteLoading}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isFavorite
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                <CalendarCheck className="h-4 w-4" />
                {isFavorite ? 'In the Plans' : 'Add to Plans'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showImageSection && (
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
            {(descriptionTitle || descriptionSubtitle || descriptionNode) && (
              <div className="space-y-3 text-left">
                {descriptionTitle && (
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    {descriptionTitle}
                  </p>
                )}
                {descriptionSubtitle && (
                  <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                    {descriptionSubtitle}
                  </h2>
                )}
                {descriptionNode}
              </div>
            )}
            {coverImage && (
              <div className="flex justify-center">
                <img
                  src={coverImage}
                  alt={title || 'Event cover'}
                  className="max-h-[480px] w-full rounded-2xl bg-white object-contain shadow-sm"
                />
              </div>
            )}
            {visitLink && (
              <div className="flex justify-center">
                <a
                  href={visitLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-indigo-600 bg-indigo-600 px-8 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:w-auto"
                >
                  <ExternalLink className="h-5 w-5" />
                  {visitLabel}
                </a>
              </div>
            )}
            {afterImageContent && (
              <div className="space-y-4 text-left">{afterImageContent}</div>
            )}
          </div>
        </div>
      )}

      {contextCallout && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            {contextCallout}
          </div>
        </div>
      )}

      {showMapSection && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            {shouldRenderMap && (
              <EventMapPreview
                latitude={parsedLat}
                longitude={parsedLng}
                label={resolvedMapLabel}
              />
            )}
            {(resolvedMapLabel || mapExternalHref) && (
              <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                {mapExternalHref ? (
                  <a
                    href={mapExternalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    View full map{resolvedMapLabel ? ` · ${resolvedMapLabel}` : ''}
                  </a>
                ) : (
                  <span>{resolvedMapLabel}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {hasFavorite && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={favoriteLoading}
              className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-base font-semibold transition-colors ${
                isFavorite
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              <CalendarCheck className="h-5 w-5" />
              {isFavorite ? 'In the Plans' : 'Add to Plans'}
            </button>
          </div>
          <div className="h-20 md:hidden" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
