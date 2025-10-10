export const PHILLY_TIME_ZONE = 'America/New_York';

const intlApi = typeof globalThis !== 'undefined' ? globalThis.Intl : undefined;

function formatterFromDate(date, timeZone, options) {
  if (intlApi?.DateTimeFormat) {
    return new intlApi.DateTimeFormat('en-US', {
      timeZone,
      ...options,
    }).format(date);
  }
  return new Date(date).toLocaleString('en-US', options);
}

function getParts(date, timeZone) {
  if (intlApi?.DateTimeFormat) {
    const formatter = new intlApi.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach(({ type, value }) => {
      map[type] = value;
    });
    return map;
  }

  const fallback = new Date(date);
  return {
    year: String(fallback.getFullYear()),
    month: String(fallback.getMonth() + 1).padStart(2, '0'),
    day: String(fallback.getDate()).padStart(2, '0'),
    hour: String(fallback.getHours()).padStart(2, '0'),
    minute: String(fallback.getMinutes()).padStart(2, '0'),
    second: String(fallback.getSeconds()).padStart(2, '0'),
  };
}

export function getZonedDate(date = new Date(), timeZone = PHILLY_TIME_ZONE) {
  const map = getParts(date, timeZone);
  return new Date(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
}

export function setStartOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function setEndOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function parseMonthDayYear(value, timeZone = PHILLY_TIME_ZONE) {
  if (!value) return null;
  const parts = value.split('/').map(Number);
  if (parts.length !== 3) return null;
  const [month, day, year] = parts;
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
  const utc = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
  const zoned = getZonedDate(utc, timeZone);
  return setStartOfDay(zoned);
}

export function parseISODate(value, timeZone = PHILLY_TIME_ZONE) {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  const utc = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
  const zoned = getZonedDate(utc, timeZone);
  return setStartOfDay(zoned);
}

export function parseEventDateValue(value, timeZone = PHILLY_TIME_ZONE) {
  if (!value) return null;
  if (value instanceof Date) {
    return setStartOfDay(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return parseISODate(trimmed, timeZone);
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const datePortion = trimmed.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePortion)) {
        return parseISODate(datePortion, timeZone);
      }
      const asDate = new Date(trimmed);
      if (!Number.isNaN(asDate.getTime())) {
        return setStartOfDay(getZonedDate(asDate, timeZone));
      }
    }
    return parseMonthDayYear(trimmed, timeZone);
  }
  return null;
}

export function overlaps(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return !(endA.getTime() < startB.getTime() || startA.getTime() > endB.getTime());
}

export function getWeekendWindow(reference = new Date(), timeZone = PHILLY_TIME_ZONE) {
  const zonedNow = getZonedDate(reference, timeZone);
  const day = zonedNow.getDay();
  let friday = setStartOfDay(zonedNow);

  if (day >= 1 && day <= 4) {
    friday.setDate(friday.getDate() + (5 - day));
  } else if (day === 6) {
    friday.setDate(friday.getDate() - 1);
  } else if (day === 0) {
    friday.setDate(friday.getDate() - 2);
  }

  const sunday = setStartOfDay(new Date(friday));
  sunday.setDate(friday.getDate() + 2);
  const sundayEnd = setEndOfDay(sunday);

  return {
    start: friday,
    end: sundayEnd,
  };
}

export function getMonthWindow(year, monthIndex, timeZone = PHILLY_TIME_ZONE) {
  const startUTC = new Date(Date.UTC(year, monthIndex - 1, 1, 5, 0, 0));
  const endUTC = new Date(Date.UTC(year, monthIndex, 0, 5, 0, 0));
  const start = setStartOfDay(getZonedDate(startUTC, timeZone));
  const end = setEndOfDay(getZonedDate(endUTC, timeZone));
  return { start, end };
}

export function formatWeekdayAbbrev(date, timeZone = PHILLY_TIME_ZONE) {
  if (!date) return '';
  return formatterFromDate(date, timeZone, { weekday: 'short' });
}

export function formatMonthAbbrev(date, timeZone = PHILLY_TIME_ZONE) {
  if (!date) return '';
  return formatterFromDate(date, timeZone, { month: 'short' });
}

export function formatMonthDay(date, timeZone = PHILLY_TIME_ZONE) {
  if (!date) return '';
  return formatterFromDate(date, timeZone, { month: 'short', day: 'numeric' });
}

export function formatLongWeekday(date, timeZone = PHILLY_TIME_ZONE) {
  if (!date) return '';
  return formatterFromDate(date, timeZone, { weekday: 'long' });
}

export function formatMonthYear(date, timeZone = PHILLY_TIME_ZONE) {
  if (!date) return '';
  return formatterFromDate(date, timeZone, { month: 'long', year: 'numeric' });
}

export function formatMonthName(date, timeZone = PHILLY_TIME_ZONE) {
  if (!date) return '';
  return formatterFromDate(date, timeZone, { month: 'long' });
}

const MONTH_SLUGS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export function monthSlugToIndex(slug) {
  if (!slug) return null;
  const idx = MONTH_SLUGS.indexOf(slug.toLowerCase());
  return idx === -1 ? null : idx + 1;
}

export function indexToMonthSlug(index) {
  if (!index) return null;
  const normalized = ((index - 1) % 12 + 12) % 12;
  return MONTH_SLUGS[normalized];
}

export function formatDateRangeForTitle(start, end, timeZone = PHILLY_TIME_ZONE) {
  if (!start || !end) return '';
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const startMonth = formatMonthAbbrev(start, timeZone);
  const endMonth = formatMonthAbbrev(end, timeZone);
  const startDay = formatterFromDate(start, timeZone, { day: 'numeric' });
  const endDay = formatterFromDate(end, timeZone, { day: 'numeric' });
  if (sameMonth && sameYear) {
    return `${startMonth} ${startDay}–${endDay}, ${start.getFullYear()}`;
  }
  if (sameYear) {
    return `${startMonth} ${startDay}–${endMonth} ${endDay}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${startDay}, ${start.getFullYear()}–${endMonth} ${endDay}, ${end.getFullYear()}`;
}

export function formatEventDateRange(start, end, timeZone = PHILLY_TIME_ZONE) {
  if (!start || !end) return '';
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    if (intlApi?.DateTimeFormat) {
      return new intlApi.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(start);
    }
    return start.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  if (intlApi?.DateTimeFormat) {
    const startStr = new intlApi.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(start);
    const endStr = new intlApi.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(end);
    return `${startStr} – ${endStr}`;
  }

  const startStr = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const endStr = end.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

export { MONTH_SLUGS };
