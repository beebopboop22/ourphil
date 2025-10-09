const env = (typeof import.meta !== 'undefined' && import.meta && import.meta.env) || {};

const ENV_KEYS = [
  'VITE_MAPBOX_TOKEN',
  'VITE_MAPBOX_ACCESS_TOKEN',
  'PUBLIC_MAPBOX_TOKEN',
  'MAPBOX_TOKEN',
  'MAPBOX_ACCESS_TOKEN',
  'REACT_APP_MAPBOX_ACCESS_TOKEN',
  'NEXT_PUBLIC_MAPBOX_TOKEN',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
];

const GLOBAL_KEYS = [
  'MAPBOX_TOKEN',
  'MAPBOX_ACCESS_TOKEN',
  'VITE_MAPBOX_TOKEN',
  'REACT_APP_MAPBOX_ACCESS_TOKEN',
  'NEXT_PUBLIC_MAPBOX_TOKEN',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
];

const PROCESS_KEYS = [
  'VITE_MAPBOX_TOKEN',
  'VITE_MAPBOX_ACCESS_TOKEN',
  'MAPBOX_TOKEN',
  'MAPBOX_ACCESS_TOKEN',
  'REACT_APP_MAPBOX_ACCESS_TOKEN',
  'NEXT_PUBLIC_MAPBOX_TOKEN',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
];

function pickTokenFromObject(source, keys) {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function getMapboxToken() {
  const envToken = pickTokenFromObject(env, ENV_KEYS);
  if (envToken) return envToken;

  if (typeof process !== 'undefined' && process.env) {
    const processToken = pickTokenFromObject(process.env, PROCESS_KEYS);
    if (processToken) return processToken;
  }

  if (typeof globalThis !== 'undefined') {
    const globalToken = pickTokenFromObject(globalThis, GLOBAL_KEYS);
    if (globalToken) return globalToken;
  }

  return '';
}

export function applyMapboxToken(mapboxgl) {
  const token = getMapboxToken() || (mapboxgl && mapboxgl.accessToken) || '';
  if (token && mapboxgl && mapboxgl.accessToken !== token) {
    mapboxgl.accessToken = token;
  }
  return token;
}

export const MAPBOX_TOKEN = getMapboxToken();

