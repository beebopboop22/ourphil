function pushToDataLayer(eventName, payload = {}) {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : undefined;
  if (!globalObj) return;
  const isProduction =
    typeof import.meta !== 'undefined' &&
    import.meta?.env?.MODE === 'production';
  try {
    if (Array.isArray(globalObj.dataLayer)) {
      globalObj.dataLayer.push({ event: eventName, ...payload });
      return;
    }
    if (typeof globalObj.gtag === 'function') {
      globalObj.gtag('event', eventName, payload);
      return;
    }
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.error('Analytics dispatch failed', error);
    }
  }
  if (!isProduction && typeof console !== 'undefined') {
    console.debug(`[analytics] ${eventName}`, payload);
  }
}

export function trackPromotedEventImpression({ page, position, eventId }) {
  if (!eventId) return;
  pushToDataLayer('promoted_event_impression', {
    page,
    position,
    event_id: eventId,
  });
}

export function trackPromotedEventClick({ cta, eventId }) {
  if (!eventId) return;
  pushToDataLayer('promoted_event_click', {
    cta,
    event_id: eventId,
  });
}

export function trackPromotedRelatedGroupClick({ groupId, eventId }) {
  if (!groupId || !eventId) return;
  pushToDataLayer('promoted_related_group_click', {
    group_id: groupId,
    event_id: eventId,
  });
}

