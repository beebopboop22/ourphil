import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { applyMapboxToken } from '../config/mapboxToken.js';

const token = applyMapboxToken(mapboxgl);
const hasToken = typeof token === 'string' && token.trim().length > 0;

export default function EventMapPreview({ latitude, longitude, label }) {
  const containerRef = useRef(null);
  const latNumber = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lngNumber = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  const hasValidCoords = Number.isFinite(latNumber) && Number.isFinite(lngNumber);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    if (!hasValidCoords) return undefined;
    if (!mapboxgl || !mapboxgl.accessToken) return undefined;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [lngNumber, latNumber],
      zoom: 14,
      attributionControl: false,
      cooperativeGestures: true,
    });

    const marker = new mapboxgl.Marker({ color: '#2563eb' }).setLngLat([lngNumber, latNumber]);
    if (label) {
      const popup = new mapboxgl.Popup({ offset: 16 }).setText(label);
      marker.setPopup(popup);
    }
    marker.addTo(map);

    return () => {
      marker.remove();
      map.remove();
    };
  }, [hasValidCoords, latNumber, lngNumber, label]);

  if (!hasToken || !hasValidCoords) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="h-64 w-full"
      role="img"
      aria-label={label ? `Map showing ${label}` : 'Map view'}
    />
  );
}
