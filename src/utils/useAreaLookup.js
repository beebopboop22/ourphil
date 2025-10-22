import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

let cachedLookup = null;
let cachedSlugLookup = null;
let cachedAreas = null;
let pendingPromise = null;

async function loadAreaLookup() {
  if (cachedLookup) {
    return cachedLookup;
  }
  if (!pendingPromise) {
    pendingPromise = supabase
      .from('areas')
      .select('id,name,slug')
      .then(({ data, error }) => {
        if (error) throw error;
        const lookup = {};
        const slugLookup = {};
        (data || []).forEach(area => {
          if (!area?.id) return;
          lookup[area.id] = area.name || '';
          const slug = typeof area.slug === 'string' ? area.slug.trim().toLowerCase() : '';
          if (slug) {
            slugLookup[slug] = {
              id: area.id,
              name: area.name || '',
              slug,
            };
          }
        });
        cachedLookup = lookup;
        cachedSlugLookup = slugLookup;
        cachedAreas = data || [];
        return lookup;
      })
      .catch(err => {
        console.error('Failed to load areas', err);
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
  const normalized = areaSlug.trim().toLowerCase();
  if (!normalized) return null;
  return cachedSlugLookup[normalized] || null;
}

export async function resolveAreaBySlug(areaSlug) {
  if (!areaSlug) return null;
  const normalized = areaSlug.trim().toLowerCase();
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
