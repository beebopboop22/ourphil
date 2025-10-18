import React, { useMemo, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from 'lucide-react';
import { getMapboxToken } from '../config/mapboxToken.js';

function isFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num);
}

export default function EventLocationMap({ latitude, longitude, address }) {
  const hasCoordinates = isFiniteNumber(latitude) && isFiniteNumber(longitude);
  const [viewState, setViewState] = useState(() => ({
    latitude: hasCoordinates ? Number(latitude) : 39.9526,
    longitude: hasCoordinates ? Number(longitude) : -75.1652,
    zoom: hasCoordinates ? 13 : 11.5,
  }));

  const mapboxToken = useMemo(() => getMapboxToken(), []);

  if (!hasCoordinates) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '280px' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={mapboxToken}
      >
        <Marker longitude={Number(longitude)} latitude={Number(latitude)} anchor="bottom">
          <div className="rounded-full bg-indigo-600 p-1.5 shadow-lg">
            <MapPin className="h-5 w-5 text-white" />
          </div>
        </Marker>
      </Map>
      {address && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          {address}
        </div>
      )}
    </div>
  );
}
