import { useEffect, useState } from 'react';
import { fetchPromotedEvent } from './promotedEvent';

export function usePromotedEvent() {
  const [promotedEvent, setPromotedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPromotedEvent()
      .then(result => {
        if (!active) return;
        setPromotedEvent(result);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        if (typeof console !== 'undefined') {
          console.error('Failed to fetch promoted event', err);
        }
        setPromotedEvent(null);
        setError(err);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { promotedEvent, loading, error };
}

