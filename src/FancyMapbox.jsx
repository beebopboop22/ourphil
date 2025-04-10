// src/FancyMapbox.jsx
import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'eyJ1IjoiYm1jYnJpZGUyMzAyIiwiYSI6ImNtOTY5ZDZzMDA5YzIybG9nbWNmeW5neTYifQ';

const FancyMapbox = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1', // 🎨 stylish theme
      center: [-75.1652, 39.9526],
      zoom: 13,
      pitch: 60, // 📐 3D tilt
      bearing: -10, // 🧭 rotation angle
      antialias: true,
    });

    // 🗼 Add 3D buildings
    map.current.on('load', () => {
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

      // ✨ Fly to Rittenhouse Square after 2 sec
      setTimeout(() => {
        map.current.flyTo({
          center: [-75.1702, 39.9489],
          zoom: 16,
          speed: 0.8,
          curve: 1.2,
          essential: true
        });
      }, 2000);
    });

    return () => map.current?.remove();
  }, []);

  return (
    <div
      ref={mapContainer}
      className="w-full mt-10 rounded-xl overflow-hidden border border-gray-300"
      style={{ height: '600px' }}
    />
  );
};

export default FancyMapbox;
