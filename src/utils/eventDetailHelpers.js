import { PHILLY_TIME_ZONE, formatEventDateRange, parseEventDateValue } from './dateUtils.js';

function pickFirstString(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '';
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseTimeString(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!match) {
    return null;
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  const meridiem = match[4];
  if (meridiem) {
    const upper = meridiem.toUpperCase();
    if (upper === 'PM' && hours < 12) {
      hours += 12;
    }
    if (upper === 'AM' && hours === 12) {
      hours = 0;
    }
  }
  return { hours, minutes };
}

function composeDateTime(dateValue, timeValue) {
  const baseDate = parseEventDateValue(dateValue);
  if (!baseDate) {
    return null;
  }
  if (!timeValue) {
    return baseDate;
  }
  const timeParts = parseTimeString(timeValue);
  if (!timeParts) {
    return baseDate;
  }
  const withTime = new Date(baseDate);
  withTime.setHours(timeParts.hours, timeParts.minutes, 0, 0);
  return withTime;
}

export function toDateKey(date) {
  if (!date) return '';
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeRange(startDateTime, endDateTime) {
  if (!startDateTime) {
    return 'Time TBA';
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILLY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });
  const startLabel = formatter.format(startDateTime);
  if (!endDateTime) {
    return startLabel;
  }
  const endLabel = formatter.format(endDateTime);
  return `${startLabel} – ${endLabel}`;
}

function extractVenue(raw) {
  const record = Array.isArray(raw?.venues) ? raw.venues[0] : raw?.venues;
  if (!record) {
    return null;
  }
  const venueName = pickFirstString(record.name, record.Name);
  const areaId = record.area_id ?? record.areaId ?? null;
  return {
    id: record.id ?? null,
    name: venueName || '',
    slug: pickFirstString(record.slug, record.Slug),
    area_id: areaId != null ? areaId : null,
    short_address: pickFirstString(record.short_address, record.address, record.Address),
    latitude: normalizeNumber(record.latitude),
    longitude: normalizeNumber(record.longitude),
  };
}

export function normalizeEventRecord(raw) {
  if (!raw) return null;
  const id = raw.id ?? raw.event_id ?? null;
  const slug = pickFirstString(raw.slug, raw.Slug);
  const title = pickFirstString(
    raw.title,
    raw.name,
    raw['E Name'],
    raw['Name'],
  );
  const description = pickFirstString(
    raw.description,
    raw['E Description'],
    raw['Description'],
  );
  const heroImageUrl = pickFirstString(
    raw.image_url,
    raw['E Image'],
    raw.image,
    raw.hero_image,
  );
  const websiteUrl = pickFirstString(raw.link, raw['E Link'], raw.url);
  const primaryAddress = pickFirstString(
    raw.short_address,
    raw['E Address Short'],
    raw.address,
    raw['E Address'],
  );
  const fullAddress = pickFirstString(raw.address, raw['E Address']);
  const venue = extractVenue(raw);

  const areaId = raw.area_id ?? venue?.area_id ?? null;
  const venueAreaId = venue?.area_id ?? null;

  const latitude = normalizeNumber(raw.latitude ?? venue?.latitude);
  const longitude = normalizeNumber(raw.longitude ?? venue?.longitude);

  const startDateValue =
    raw.start_date ??
    raw['Start Date'] ??
    raw['E Start Date'] ??
    raw.startDate ??
    raw.Dates ??
    raw.date;
  const endDateValue =
    raw.end_date ??
    raw['End Date'] ??
    raw['E End Date'] ??
    raw.endDate ??
    raw.Dates ??
    startDateValue;

  const startTimeValue = pickFirstString(
    raw.start_time,
    raw['Start Time'],
    raw.time,
  );
  const endTimeValue = pickFirstString(
    raw.end_time,
    raw['End Time'],
    raw.finish_time,
  );

  const startDate = parseEventDateValue(startDateValue);
  const endDate = parseEventDateValue(endDateValue) || startDate;
  const startDateTime = composeDateTime(startDateValue, startTimeValue);
  const endDateTime = composeDateTime(endDateValue ?? startDateValue, endTimeValue);

  return {
    id,
    slug,
    title,
    description,
    heroImageUrl,
    websiteUrl,
    areaId,
    venueAreaId,
    venue,
    address: primaryAddress || fullAddress,
    fullAddress: fullAddress || primaryAddress,
    latitude,
    longitude,
    startDate,
    endDate,
    startDateTime,
    endDateTime,
    startDateKey: startDate ? toDateKey(startDate) : '',
    endDateKey: endDate ? toDateKey(endDate) : '',
    startTimeRaw: startTimeValue || '',
    endTimeRaw: endTimeValue || '',
    ownerUsername: pickFirstString(
      raw.owner_username,
      raw.submitted_by_username,
      raw.submitted_by,
      raw.creator_username,
    ),
  };
}

export function buildScheduleCopy(event) {
  if (!event) {
    return {
      dateLabel: '',
      timeLabel: 'Time TBA',
    };
  }
  const dateLabel = event.startDate && event.endDate
    ? formatEventDateRange(event.startDate, event.endDate, PHILLY_TIME_ZONE)
    : '';
  const timeLabel = formatTimeRange(event.startDateTime, event.endDateTime);
  return {
    dateLabel,
    timeLabel,
  };
}

export function buildSeoDescription(text, maxLength = 160) {
  if (!text) return '';
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, maxLength - 1).trimEnd();
  return `${sliced}…`;
}

export function ensureAbsoluteImage(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}
