import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

let cachedLookup = null;
let cachedSlugLookup = null;
let cachedAreas = null;
let pendingPromise = null;

function normalizeSlug(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed
    .replace(/&/g, ' and ')
    .replace(/['”’“‘"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function extractSlug(area) {
  if (!area) return '';
  const possibleKeys = ['slug', 'slug_text', 'slugName', 'area_slug'];
  for (const key of possibleKeys) {
    const raw = area[key];
    const normalized = normalizeSlug(raw);
    if (normalized) return normalized;
  }
  return normalizeSlug(area.name);
}

async function fetchAreas(select) {
  const { data, error } = await supabase.from('areas').select(select);
  if (error) throw error;
  return data || [];
}

async function loadAreaLookup() {
  if (cachedLookup) {
    return cachedLookup;
  }
  if (!pendingPromise) {
    pendingPromise = (async () => {
      let areas;
      try {
        areas = await fetchAreas('id,name,slug');
      } catch (err) {
        console.warn('Failed to load areas with slug column, retrying without slug', err);
        try {
          areas = await fetchAreas('*');
        } catch (fallbackError) {
          console.error('Failed to load areas', fallbackError);
          throw fallbackError;
        }
      }

      const lookup = {};
      const slugLookup = {};

      areas.forEach(area => {
        if (!area?.id) return;
        const name = area.name || '';
        lookup[area.id] = name;
        const slug = extractSlug(area);
        if (slug) {
          slugLookup[slug] = {
            id: area.id,
            name,
            slug,
          };
        }
      });

      cachedLookup = lookup;
      cachedSlugLookup = slugLookup;
      cachedAreas = areas;
      return lookup;
    })()
      .catch(err => {
        cachedLookup = {};
        cachedSlugLookup = {};
        cachedAreas = [];
        throw err;
      })
      .finally(() => {
        pendingPromise = null;
      });
  }
  return pendingPromise;
}

export function getAreaNameFromCache(areaId) {
  if (!areaId || !cachedLookup) return null;
  return cachedLookup[areaId] || null;
}

export function getAreaBySlugFromCache(areaSlug) {
  if (!areaSlug || !cachedSlugLookup) return null;
  const normalized = normalizeSlug(areaSlug);
  if (!normalized) return null;
  return cachedSlugLookup[normalized] || null;
}

export async function resolveAreaBySlug(areaSlug) {
  if (!areaSlug) return null;
  const normalized = normalizeSlug(areaSlug);
  if (!normalized) return null;
  if (!cachedSlugLookup) {
    await loadAreaLookup().catch(() => {});
  }
  return cachedSlugLookup ? cachedSlugLookup[normalized] || null : null;
}

export function getCachedAreas() {
  if (!cachedAreas) return [];
  return cachedAreas;
}

export default function useAreaLookup() {
  const [lookup, setLookup] = useState(cachedLookup);

  useEffect(() => {
    let isMounted = true;

    if (cachedLookup) {
      setLookup(cachedLookup);
      return () => {
        isMounted = false;
      };
    }

    loadAreaLookup()
      .then(result => {
        if (isMounted) {
          setLookup(result);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLookup({});
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return lookup || {};
}
