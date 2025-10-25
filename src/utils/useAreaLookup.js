import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

let cachedLookup = null;
let cachedSlugLookup = null;
let pendingPromise = null;

function cleanName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeAreaSlugInternal(slug, fallbackName) {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (trimmed === '*') return '*';
  if (trimmed) {
    const normalized = slugify(trimmed);
    if (normalized) return normalized;
  }
  const fallback = cleanName(fallbackName || '');
  if (fallback) {
    const normalizedFallback = slugify(fallback);
    if (normalizedFallback) return normalizedFallback;
  }
  return '*';
}

function buildLookups(rows) {
  const byId = {};
  const bySlug = {};

  (rows || []).forEach(area => {
    if (!area?.id) return;
    const name = cleanName(area.name);
    byId[area.id] = name;

    const normalizedSlug = normalizeAreaSlugInternal(area.slug, name);
    if (normalizedSlug && !bySlug[normalizedSlug]) {
      bySlug[normalizedSlug] = {
        id: area.id,
        name,
        slug: normalizedSlug,
      };
    }

    if (normalizedSlug !== '*' && area?.slug === '*') {
      bySlug['*'] = {
        id: area.id,
        name,
        slug: '*',
      };
    }
  });

  return { byId, bySlug };
}

async function loadAreaLookup() {
  if (cachedLookup && cachedSlugLookup) {
    return { byId: cachedLookup, bySlug: cachedSlugLookup };
  }
  if (!pendingPromise) {
    pendingPromise = supabase
      .from('areas')
      .select('id,name,slug')
      .then(({ data, error }) => {
        if (error) throw error;
        const { byId, bySlug } = buildLookups(data);
        cachedLookup = byId;
        cachedSlugLookup = bySlug;
        return { byId, bySlug };
      })
      .catch(err => {
        console.error('Failed to load areas', err);
        cachedLookup = {};
        cachedSlugLookup = {};
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

export function getAreaBySlugFromCache(slug) {
  if (!cachedSlugLookup) return null;
  const normalized = normalizeAreaSlug(slug);
  if (!normalized) return null;
  return cachedSlugLookup[normalized] || null;
}

export function normalizeAreaSlug(slug, fallbackName) {
  const normalized = normalizeAreaSlugInternal(slug, fallbackName);
  return normalized || '';
}

export async function resolveAreaSlug(slug) {
  const normalized = normalizeAreaSlug(slug);
  if (!normalized) return null;

  if (cachedSlugLookup && cachedSlugLookup[normalized]) {
    return cachedSlugLookup[normalized];
  }

  try {
    const { bySlug } = await loadAreaLookup();
    return bySlug[normalized] || null;
  } catch (err) {
    console.error('Failed to resolve area slug', err);
    return null;
  }
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
          setLookup(result.byId);
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
