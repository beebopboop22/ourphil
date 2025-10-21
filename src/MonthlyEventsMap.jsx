import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapboxToken } from './config/mapboxToken.js';
import { formatEventDateRange, PHILLY_TIME_ZONE } from './utils/dateUtils';

const DEFAULT_VIEW_STATE = {
  latitude: 39.9526,
  longitude: -75.1652,
  zoom: 11,
};

const MARKER_SIZE = 18;

function calculateCenter(events) {
  if (!events.length) {
    return DEFAULT_VIEW_STATE;
  }
  const sum = events.reduce(
    (acc, evt) => {
      acc.lat += evt.latitude;
      acc.lng += evt.longitude;
      return acc;
    },
    { lat: 0, lng: 0 },
  );
  return {
    latitude: sum.lat / events.length,
    longitude: sum.lng / events.length,
    zoom: 12,
  };
}

export default function MonthlyEventsMap({ events = [], height = 360 }) {
  const mapboxToken = getMapboxToken();

  const validEvents = useMemo(
    () =>
      (events || []).filter(
        evt => Number.isFinite(evt.latitude) && Number.isFinite(evt.longitude),
      ),
    [events],
  );

  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const mapRef = useRef(null);

  useEffect(() => {
    if (validEvents.length) {
      setViewState(view => ({ ...view, ...calculateCenter(validEvents) }));
    }
  }, [validEvents]);

  const handleLocateMe = useCallback(() => {
    if (isLocating) return;
    if (!navigator?.geolocation) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }
    setIsLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setViewState(current => ({
          ...current,
          latitude,
          longitude,
          zoom: Math.max(current.zoom ?? DEFAULT_VIEW_STATE.zoom, 13),
        }));
        const map = mapRef.current?.getMap?.() || mapRef.current;
        if (map?.flyTo) {
          map.flyTo({
            center: [longitude, latitude],
            zoom: Math.max(map.getZoom?.() ?? DEFAULT_VIEW_STATE.zoom, 13),
            essential: true,
          });
        }
        setIsLocating(false);
        setGeoError('');
      },
      err => {
        setGeoError(err.message || 'Unable to determine your location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [isLocating]);

  if (!mapboxToken) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Map view unavailable — missing Mapbox access token.
      </div>
    );
  }

  if (!validEvents.length) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm" style={{ height }}>
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex max-w-[60%] flex-col items-end gap-1 text-xs">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-indigo-500/60 bg-white px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating ? 'Locating…' : 'Near me'}
        </button>
        {geoError && (
          <span className="pointer-events-auto rounded-full bg-white/90 px-2 py-1 font-medium text-rose-500 shadow">
            {geoError}
          </span>
        )}
      </div>
      <Map
        {...viewState}
        ref={mapRef}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={mapboxToken}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {validEvents.map(evt => (
          <Marker
            key={`${evt.source_table || 'event'}-${evt.id}`}
            longitude={evt.longitude}
            latitude={evt.latitude}
            anchor="bottom"
            onClick={event => {
              event.originalEvent.stopPropagation();
              setSelectedEvent(evt);
            }}
          >
            <span
              className="flex items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white shadow"
              style={{ width: MARKER_SIZE, height: MARKER_SIZE }}
              aria-label={evt.title}
            >
              ●
            </span>
          </Marker>
        ))}

        {selectedEvent && (
          <Popup
            latitude={selectedEvent.latitude}
            longitude={selectedEvent.longitude}
            anchor="top"
            closeOnClick={false}
            onClose={() => setSelectedEvent(null)}
            className="max-w-xs"
          >
            <div className="space-y-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Upcoming Event</p>
              <h4 className="text-base font-semibold text-[#28313e] leading-snug">
                {selectedEvent.title}
              </h4>
              <div className="space-y-1">
                <p className="text-xs text-gray-600">
                  {formatEventDateRange(
                    selectedEvent.startDate,
                    selectedEvent.endDate,
                    PHILLY_TIME_ZONE,
                  )}
                </p>
                {selectedEvent.timeLabel && (
                  <p className="text-xs font-medium text-gray-700">
                    {selectedEvent.timeLabel}
                  </p>
                )}
                {selectedEvent.areaName && (
                  <p className="flex items-center gap-1 text-xs font-medium text-gray-700">
                    <MapPin className="h-3 w-3 text-gray-500" aria-hidden="true" />
                    {selectedEvent.areaName}
                  </p>
                )}
                {Array.isArray(selectedEvent.mapTags) && selectedEvent.mapTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedEvent.mapTags.slice(0, 4).map(tag => (
                      <Link
                        key={tag.slug}
                        to={`/tags/${tag.slug}`}
                        className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {selectedEvent.detailPath && (
                <Link
                  to={selectedEvent.detailPath}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  View details
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
