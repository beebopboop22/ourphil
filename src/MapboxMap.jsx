import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Pull the token from your Vite env vars:
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapboxMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11', // ✨ Sleek dark theme
      center: [-75.1652, 39.9526],
      zoom: 12.5,
      pitch: 45,
      bearing: -15,
      antialias: true,
    });

    map.current.on('load', () => {
      // 🏙️ Add 3D buildings
      map.current.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6
        }
      });

      // 🎯 Center City marker
      new mapboxgl.Marker({ color: '#FACC15' }) // tailwind yellow-400
        .setLngLat([-75.1652, 39.9526])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Center City</strong><br/>Philadelphia, PA'))
        .addTo(map.current);

      // ✈️ Smooth fly-in effect
      map.current.flyTo({
        center: [-75.1652, 39.9526],
        zoom: 13.5,
        speed: 0.8,
        curve: 1.4,
        easing: (t) => t,
      });
    });
  }, []);

  return (
    <div
      ref={mapContainer}
      className="w-full mt-10 h-[600px] rounded-xl overflow-hidden shadow-2xl border border-gray-700"
    />
  );
};

export default MapboxMap;
