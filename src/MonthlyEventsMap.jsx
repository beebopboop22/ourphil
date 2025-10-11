import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

  useEffect(() => {
    if (validEvents.length) {
      setViewState(view => ({ ...view, ...calculateCenter(validEvents) }));
    }
  }, [validEvents]);

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
      <Map
        {...viewState}
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
              <p className="text-xs text-gray-600">
                {formatEventDateRange(
                  selectedEvent.startDate,
                  selectedEvent.endDate,
                  PHILLY_TIME_ZONE,
                )}
              </p>
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
