// src/TriviaNights.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiYm1jYnJpZGUyMzAyIiwiYSI6ImNtOTY5ZDZzMDA5YzIybG9nbWNmeW5neTYifQ.opZIDulk6EiQhp0ApwYo8g';

const daysOfWeek = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const TriviaNights = () => {
  const [triviaList, setTriviaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(daysOfWeek[new Date().getDay()]);
  const mapContainer = React.useRef(null);
  const map = React.useRef(null);

  useEffect(() => {
    const fetchTrivia = async () => {
      const { data, error } = await supabase
        .from('trivia')
        .select('*')
        .eq('Day', selectedDay);

      if (error) {
        console.error('Error fetching trivia nights:', error);
      } else {
        setTriviaList(data);
      }
      setLoading(false);
    };

    fetchTrivia();
  }, [selectedDay]);

  useEffect(() => {
    if (!mapContainer.current || !triviaList.length) return;

    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-75.1652, 39.9526],
      zoom: 12.5,
      pitch: 45,
      bearing: -15,
      antialias: true,
    });

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

      triviaList.forEach((item) => {
        const lat = parseFloat(item.latitude);
        const lng = parseFloat(item.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          new mapboxgl.Marker({ color: '#FACC15' })
            .setLngLat([lng, lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(
                `<strong><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.Bar}</a></strong><br/>${item.Time}`
              )
            )
            .addTo(map.current);
        }
      });
    });
  }, [triviaList]);

  return (
    <div className="flex w-full h-screen overflow-hidden">
      <div className="w-1/4 bg-white pt-28 px-6 overflow-y-auto z-10 relative">
        <div className="mb-6">
          <Navbar />
        </div>

        <h1 className="text-2xl font-bold text-black mb-4">
          Trivia Nights on {selectedDay}
        </h1>

        <div className="mb-4">
          <label htmlFor="day-select" className="block mb-1 text-sm font-medium text-gray-700">Select a day</label>
          <select
            id="day-select"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-yellow-500 focus:border-yellow-500"
          >
            {daysOfWeek.map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-gray-500 mt-6">Loading...</p>
        ) : triviaList.length === 0 ? (
          <p className="text-gray-600 mt-6">No trivia nights listed for this day.</p>
        ) : (
          <ul className="space-y-4 mt-6">
            {triviaList.map((item) => (
              <li key={item.id} className="border-b pb-3">
                <a
                  href={item.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-black hover:text-yellow-600"
                >
                  <p className="text-lg font-semibold">{item.Bar}</p>
                  <p className="text-sm">{item.Time} – {item.Neighborhood}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        ref={mapContainer}
        className="w-3/4 h-full"
      />
    </div>
  );
};

export default TriviaNights;






