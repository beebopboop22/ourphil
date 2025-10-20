const STATIC_AREA_LOOKUP = Object.freeze({
  // Populated with the most commonly referenced neighborhoods at build time.
  // Additional mappings collected at runtime are merged into this cache.
});

const runtimeCache = new Map(Object.entries(STATIC_AREA_LOOKUP));
let storageHydrated = false;

function hydrateFromStorage() {
  if (storageHydrated) return;
  storageHydrated = true;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    const globalLookup = window.__OURPHIL_AREA_LOOKUP__;
    if (globalLookup && typeof globalLookup === 'object') {
      Object.entries(globalLookup).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          runtimeCache.set(String(key), value.trim());
        }
      });
    }
  } catch (error) {
    console.warn('Unable to access global area lookup', error);
  }

  try {
    const stored = window.localStorage?.getItem('ourphilly:areaLookup');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, value]) => {
          if (typeof value === 'string' && value.trim()) {
            runtimeCache.set(String(key), value.trim());
          }
        });
      }
    }
  } catch (error) {
    console.warn('Unable to read cached area lookup', error);
  }
}

function persistRuntimeCache() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const obj = Object.fromEntries(runtimeCache.entries());
    window.localStorage?.setItem('ourphilly:areaLookup', JSON.stringify(obj));
  } catch (error) {
    console.warn('Unable to persist area lookup cache', error);
  }
}

export function primeAreaLookup(entries = {}) {
  if (!entries || typeof entries !== 'object') return;
  hydrateFromStorage();
  let didMutate = false;

  Object.entries(entries).forEach(([key, value]) => {
    if (!key || typeof value !== 'string') return;
    const trimmedKey = String(key).trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) return;
    if (!runtimeCache.has(trimmedKey) || runtimeCache.get(trimmedKey) !== trimmedValue) {
      runtimeCache.set(trimmedKey, trimmedValue);
      didMutate = true;
    }
  });

  if (didMutate) {
    persistRuntimeCache();
  }
}

export function resolveAreaName(areaId) {
  if (areaId == null) {
    return null;
  }
  hydrateFromStorage();
  const key = String(areaId).trim();
  if (!key) return null;
  return runtimeCache.get(key) || null;
}

export function getAreaCacheSnapshot() {
  hydrateFromStorage();
  return Object.fromEntries(runtimeCache.entries());
}
