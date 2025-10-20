import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

let cachedLookup = null;
let pendingPromise = null;

async function loadAreaLookup() {
  if (cachedLookup) {
    return cachedLookup;
  }
  if (!pendingPromise) {
    pendingPromise = supabase
      .from('areas')
      .select('id,name')
      .then(({ data, error }) => {
        if (error) throw error;
        const lookup = {};
        (data || []).forEach(area => {
          if (!area?.id) return;
          lookup[area.id] = area.name || '';
        });
        cachedLookup = lookup;
        return lookup;
      })
      .catch(err => {
        console.error('Failed to load areas', err);
        cachedLookup = {};
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
