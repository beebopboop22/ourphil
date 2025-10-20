import { supabase } from '../supabaseClient';

let areaLookup = null;
let loadPromise = null;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export async function ensureAreaCache() {
  const now = Date.now();
  if (areaLookup && now - lastLoadedAt < CACHE_TTL_MS) {
    return areaLookup;
  }
  if (!loadPromise) {
    loadPromise = supabase
      .from('areas')
      .select('id,name')
      .then(({ data, error }) => {
        if (error) {
          console.warn('Failed to load areas', error);
          areaLookup = {};
          return areaLookup;
        }
        areaLookup = Object.fromEntries((data || []).map(area => [area.id, area.name]));
        lastLoadedAt = Date.now();
        return areaLookup;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export async function getAreaName(areaId) {
  if (!areaId) return null;
  const lookup = await ensureAreaCache();
  return lookup?.[areaId] || null;
}
