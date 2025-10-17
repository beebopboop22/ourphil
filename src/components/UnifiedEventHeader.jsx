import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';

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

      {coverImage && (
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="mx-auto flex w-full max-w-5xl justify-center px-4 py-6">
            <img
              src={coverImage}
              alt={title || 'Event cover'}
              className="max-h-[480px] w-full rounded-2xl bg-white object-contain shadow-sm"
            />
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

      {hasCoords && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            <iframe
              title={`Map for ${title || 'event'}`}
              src={`https://www.google.com/maps?q=${parsedLat},${parsedLng}&z=14&output=embed`}
              loading="lazy"
              className="h-64 w-full"
              allowFullScreen
            />
            {resolvedMapLabel && (
              <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                <a
                  href={`https://maps.google.com?q=${encodeURIComponent(resolvedMapLabel)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Open in Google Maps
                </a>
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
