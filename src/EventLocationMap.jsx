import React, { useMemo } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapboxToken } from './config/mapboxToken.js';

const mascotUrl =
  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1%20copy-min.png';

function toNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function EventLocationMap({ latitude, longitude, eventName, locationLabel }) {
  const mapboxToken = getMapboxToken();

  const coordinates = useMemo(() => {
    const lat = toNumber(latitude);
    const lng = toNumber(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  if (!mapboxToken || !coordinates) {
    return null;
  }

  return (
    <section className="max-w-4xl mx-auto mt-16 px-4">
      <div className="relative w-full h-[360px] sm:h-[420px] rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
        <Map
          initialViewState={{
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            zoom: 15.5,
            pitch: 50,
            bearing: -20,
          }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={mapboxToken}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          <NavigationControl position="top-right" visualizePitch />
          <Marker latitude={coordinates.latitude} longitude={coordinates.longitude} anchor="bottom">
            <div className="flex flex-col items-center -mb-2">
              <div className="w-10 h-10 rounded-full bg-yellow-400 border-4 border-white shadow-lg flex items-center justify-center">
                <img src={mascotUrl} alt="" className="w-6 h-6" />
              </div>
              <div className="w-2 h-2 bg-yellow-500 rotate-45 -mt-1 border border-white" />
            </div>
          </Marker>
        </Map>
        {(eventName || locationLabel) && (
          <div className="absolute bottom-4 left-4 bg-white/85 text-slate-900 px-4 py-3 rounded-xl max-w-[80%] backdrop-blur border border-white/60 shadow-lg">
            <p className="text-sm font-semibold leading-snug">{eventName || 'Event location'}</p>
            {locationLabel && (
              <p className="text-xs text-slate-600 mt-1 leading-snug">{locationLabel}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
