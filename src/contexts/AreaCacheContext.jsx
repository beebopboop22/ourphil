import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const AreaCacheContext = createContext({
  areaMap: {},
  loading: true,
  loaded: false,
});

function normalizeAreaRecord(record) {
  if (!record || record.id == null) {
    return null;
  }
  const id = String(record.id);
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const slug = typeof record.slug === 'string' ? record.slug.trim() : '';
  return {
    id,
    name: name || '',
    slug,
  };
}

export function AreaCacheProvider({ children }) {
  const [areaMap, setAreaMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadAreas() {
      try {
        const { data, error } = await supabase
          .from('areas')
          .select('id, name, slug');
        if (!active) return;
        if (error) {
          console.error('Failed to load neighborhood cache', error);
          setAreaMap({});
        } else {
          const map = {};
          (data || []).forEach(record => {
            const normalized = normalizeAreaRecord(record);
            if (normalized) {
              map[normalized.id] = normalized;
            }
          });
          setAreaMap(map);
        }
      } catch (err) {
        if (!active) return;
        console.error('Area cache load error', err);
        setAreaMap({});
      } finally {
        if (active) {
          setLoading(false);
          setLoaded(true);
        }
      }
    }

    loadAreas();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const names = Object.values(areaMap)
      .filter(area => area?.name)
      .map(area => area.name);
    if (!names.length) return undefined;
    const uniqueNames = Array.from(new Set(names));
    document.documentElement.setAttribute(
      'data-neighborhood-count',
      String(uniqueNames.length),
    );
    return () => {
      document.documentElement.removeAttribute('data-neighborhood-count');
    };
  }, [areaMap]);

  const value = useMemo(
    () => ({
      areaMap,
      loading,
      loaded,
    }),
    [areaMap, loading, loaded],
  );

  return <AreaCacheContext.Provider value={value}>{children}</AreaCacheContext.Provider>;
}

export function useAreaCache() {
  return useContext(AreaCacheContext);
}

export function resolveNeighborhood(areaMap, areaId) {
  if (!areaId) return null;
  const key = String(areaId);
  const entry = areaMap[key];
  if (!entry) return null;
  return entry;
}
