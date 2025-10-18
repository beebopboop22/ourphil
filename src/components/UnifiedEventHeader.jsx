import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ExternalLink } from 'lucide-react';
import EventLocationMap from './EventLocationMap.jsx';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function UnifiedEventHeader({
  title,
  meta,
  tags = [],
  visitSiteUrl,
  imageUrl,
  isFavorite = false,
  onToggleFavorite,
  favoriteLoading = false,
  contextCallouts,
  mapLocation,
  actionRow,
  bottomPadding = true,
}) {
  const handleToggleFavorite = event => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof onToggleFavorite === 'function') {
      onToggleFavorite();
    }
  };

  const addToPlansButton = (
    <button
      type="button"
      onClick={handleToggleFavorite}
      disabled={favoriteLoading || !onToggleFavorite}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm',
        isFavorite
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-600 hover:text-white'
      )}
    >
      <CalendarCheck className="h-4 w-4" />
      {isFavorite ? 'In the Plans' : 'Add to Plans'}
    </button>
  );

  return (
    <section className={classNames('relative bg-white', bottomPadding ? 'pb-24 md:pb-0' : '')}>
      <div className="sticky top-[4.5rem] z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
            {meta && <div className="mt-1 text-sm text-slate-600">{meta}</div>}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map(tag => {
                  const TagComponent = tag.href ? Link : 'span';
                  const tagProps =
                    TagComponent === Link
                      ? { to: tag.href }
                      : tag.href
                        ? { href: tag.href, target: tag.target, rel: tag.rel }
                        : {};
                  return (
                    <TagComponent
                      key={tag.id || tag.name}
                      {...tagProps}
                      className={classNames(tag.className, 'px-3 py-1 text-xs font-semibold rounded-full')}
                    >
                      #{tag.name}
                    </TagComponent>
                  );
                })}
              </div>
            )}
          </div>
          <div className="hidden md:block">{addToPlansButton}</div>
        </div>
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        {imageUrl && (
          <div className="overflow-hidden rounded-3xl bg-slate-100">
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full max-h-[60vh] object-cover"
            />
          </div>
        )}

        {visitSiteUrl && (
          <div className="text-center">
            <a
              href={visitSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-lg font-semibold text-white shadow hover:bg-indigo-700"
            >
              <ExternalLink className="h-5 w-5" />
              Visit Site
            </a>
          </div>
        )}

        {contextCallouts && (
          <div className="space-y-3 text-sm text-slate-700">{contextCallouts}</div>
        )}

        {mapLocation && (
          <EventLocationMap
            latitude={mapLocation.latitude}
            longitude={mapLocation.longitude}
            address={mapLocation.address}
          />
        )}

        {actionRow && <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 text-sm font-medium text-slate-700">{actionRow}</div>}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-6 md:hidden">
        <div className="pointer-events-auto rounded-full bg-white p-2 shadow-lg ring-1 ring-slate-200">
          {addToPlansButton}
        </div>
      </div>
    </section>
  );
}
