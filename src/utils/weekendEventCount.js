import { RRule } from 'rrule';
import { supabase } from '../supabaseClient';
import {
  PHILLY_TIME_ZONE,
  parseISODate,
  parseMonthDayYear,
  setEndOfDay,
  setStartOfDay,
  overlaps,
} from './dateUtils';

export const MAX_EVENT_DURATION_DAYS = 30;
export const MAX_EVENT_DURATION_MS = MAX_EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const MAX_ALL_EVENT_DURATION_DAYS = 10;

function toPhillyISODate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PHILLY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function fetchSportsEvents() {
  const clientId = import.meta.env.VITE_SEATGEEK_CLIENT_ID;
  if (!clientId) return [];

  try {
    const teamSlugs = [
      'philadelphia-phillies',
      'philadelphia-76ers',
      'philadelphia-eagles',
      'philadelphia-flyers',
      'philadelphia-union',
    ];
    const collected = [];
    for (const slug of teamSlugs) {
      const response = await fetch(
        `https://api.seatgeek.com/2/events?performers.slug=${slug}&venue.city=Philadelphia&per_page=50&sort=datetime_local.asc&client_id=${clientId}`
      );
      const json = await response.json();
      collected.push(...(json.events || []));
    }

    return collected.map(event => {
      const dt = new Date(event.datetime_local);
      const performers = event.performers || [];
      const home = performers.find(p => p.home_team) || performers[0] || {};
      const away = performers.find(p => p.id !== home.id) || {};
      const title =
        event.short_title ||
        `${(home.name || '').replace(/^Philadelphia\s+/, '')} vs ${(away.name || '').replace(/^Philadelphia\s+/, '')}`;
      const startDate = parseISODate(dt.toISOString().slice(0, 10), PHILLY_TIME_ZONE);
      const endDate = startDate ? setEndOfDay(new Date(startDate)) : null;
      return {
        id: `sg-${event.id}`,
        title,
        startDate,
        endDate,
      };
    });
  } catch (error) {
    console.error('Error fetching sports events for weekend count', error);
    return [];
  }
}

function mapAllEvents(allEvents, weekendDayKeys, weekendStart, weekendEnd) {
  return allEvents
    .map(evt => {
      const startKey = (evt.start_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
      const rawEnd = (evt.end_date || evt.start_date || '').slice(0, 10);
      const endKey = /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? rawEnd : startKey;
      const overlapsWeekendDay = weekendDayKeys.some(day => startKey <= day && endKey >= day);
      if (!overlapsWeekendDay) return null;

      const startMs = Date.parse(startKey);
      const endMs = Date.parse(endKey);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

      const spanDays = Math.floor(Math.max(0, endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
      const isShortEvent = spanDays <= MAX_ALL_EVENT_DURATION_DAYS;
      const startsOnWeekendDay = weekendDayKeys.includes(startKey);
      if (!isShortEvent && !startsOnWeekendDay) return null;

      const [ys, ms, ds] = startKey.split('-').map(Number);
      const [ye, me, de] = endKey.split('-').map(Number);
      const startDate = setStartOfDay(new Date(ys, ms - 1, ds));
      const endDate = setEndOfDay(new Date(ye, me - 1, de));
      if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;

      return { startDate, endDate };
    })
    .filter(Boolean);
}

function mapBigBoardEvents(bigBoardEvents, weekendStart, weekendEnd) {
  return bigBoardEvents
    .map(evt => {
      const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
      const endDateRaw = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE);
      if (!startDate || !endDateRaw) return null;
      const endDate = setEndOfDay(new Date(endDateRaw));
      if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
      if (endDate.getTime() - startDate.getTime() > MAX_EVENT_DURATION_MS) return null;
      return { startDate, endDate };
    })
    .filter(Boolean);
}

function mapTraditions(traditions, weekendStart, weekendEnd) {
  return traditions
    .map(evt => {
      const startDate = parseMonthDayYear(evt.Dates, PHILLY_TIME_ZONE);
      const endDateRaw = parseMonthDayYear(evt['End Date'], PHILLY_TIME_ZONE) || startDate;
      if (!startDate || !endDateRaw) return null;
      const endDate = setEndOfDay(new Date(endDateRaw));
      if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
      if (endDate.getTime() - startDate.getTime() > MAX_EVENT_DURATION_MS) return null;
      return { startDate, endDate };
    })
    .filter(Boolean);
}

function mapGroupEvents(groupEvents, weekendStart, weekendEnd) {
  return groupEvents
    .map(evt => {
      const startDate = parseISODate(evt.start_date, PHILLY_TIME_ZONE);
      const endDateRaw = parseISODate(evt.end_date || evt.start_date, PHILLY_TIME_ZONE);
      if (!startDate || !endDateRaw) return null;
      const endDate = setEndOfDay(new Date(endDateRaw));
      if (!overlaps(startDate, endDate, weekendStart, weekendEnd)) return null;
      if (endDate.getTime() - startDate.getTime() > MAX_EVENT_DURATION_MS) return null;
      return { startDate, endDate };
    })
    .filter(Boolean);
}

function expandRecurringEvents(recurringSeries, weekendStart, weekendEnd) {
  if (!recurringSeries?.length) return [];
  const startBoundary = new Date(weekendStart);
  const endBoundary = new Date(weekendEnd);

  return recurringSeries.flatMap(series => {
    if (!series.rrule) return [];
    let options;
    try {
      options = RRule.parseString(series.rrule);
    } catch (error) {
      console.error('Invalid recurring rule for weekend count', series.id, error);
      return [];
    }
    options.dtstart = new Date(`${series.start_date}T${series.start_time || '00:00'}`);
    if (series.end_date) {
      options.until = new Date(`${series.end_date}T23:59:59`);
    }
    const rule = new RRule(options);
    return rule
      .between(startBoundary, endBoundary, true)
      .map(instance => {
        const local = new Date(instance.getFullYear(), instance.getMonth(), instance.getDate());
        const startDate = setStartOfDay(local);
        const endDate = setEndOfDay(new Date(startDate));
        return { startDate, endDate };
      });
  });
}

export async function fetchWeekendEventCount(weekendStart, weekendEnd) {
  if (!weekendStart || !weekendEnd) {
    return 0;
  }

  const fridayStart = setStartOfDay(new Date(weekendStart));
  const saturdayStart = setStartOfDay(new Date(fridayStart));
  saturdayStart.setDate(fridayStart.getDate() + 1);
  const sundayStart = setStartOfDay(new Date(fridayStart));
  sundayStart.setDate(fridayStart.getDate() + 2);

  const saturdayKey = toPhillyISODate(saturdayStart);
  const sundayKey = toPhillyISODate(sundayStart);
  const weekendDayKeys = [saturdayKey, sundayKey];
  const weekendRangeStartKey = saturdayKey;
  const weekendRangeEndKey = sundayKey;

  let fetchAllEvents = supabase
    .from('all_events')
    .select(
      `id, name, description, link, image, start_date, end_date, start_time, end_time, slug, venue_id, venues:venue_id(name, slug)`
    );

  if (weekendRangeStartKey && weekendRangeEndKey) {
    fetchAllEvents = fetchAllEvents
      .lte('start_date', weekendRangeEndKey)
      .or(
        `and(end_date.is.null,start_date.gte.${weekendRangeStartKey},start_date.lte.${weekendRangeEndKey}),` +
          `end_date.gte.${weekendRangeStartKey}`
      );
  }

  fetchAllEvents = fetchAllEvents.order('start_date', { ascending: true }).limit(5000);

  const fetchBigBoard = supabase
    .from('big_board_events')
    .select('id, title, description, start_date, end_date, start_time, end_time, slug')
    .order('start_date', { ascending: true });

  const fetchTraditions = supabase
    .from('events')
    .select('id, "E Name", "E Description", Dates, "End Date", "E Image", slug, start_time, end_time')
    .order('Dates', { ascending: true });

  const fetchGroupEvents = supabase
    .from('group_events')
    .select('*, groups(Name, imag, slug, status)')
    .order('start_date', { ascending: true });

  const fetchRecurring = supabase
    .from('recurring_events')
    .select('id, name, slug, description, address, link, start_date, end_date, start_time, end_time, rrule, image_url, latitude, longitude')
    .eq('is_active', true);

  const [allRes, bigRes, tradRes, groupRes, recurringRes, sportsRaw] = await Promise.all([
    fetchAllEvents,
    fetchBigBoard,
    fetchTraditions,
    fetchGroupEvents,
    fetchRecurring,
    fetchSportsEvents(),
  ]);

  if (allRes.error) throw allRes.error;
  if (bigRes.error) throw bigRes.error;
  if (tradRes.error) throw tradRes.error;
  if (groupRes.error) throw groupRes.error;
  if (recurringRes.error) throw recurringRes.error;

  const weekendStartDate = setStartOfDay(new Date(weekendStart));
  const weekendEndDate = setEndOfDay(new Date(weekendEnd));

  const allRecords = mapAllEvents(allRes.data || [], weekendDayKeys, weekendStartDate, weekendEndDate);
  const bigRecords = mapBigBoardEvents(bigRes.data || [], weekendStartDate, weekendEndDate);
  const traditionRecords = mapTraditions(tradRes.data || [], weekendStartDate, weekendEndDate);
  const groupRecords = mapGroupEvents(groupRes.data || [], weekendStartDate, weekendEndDate);
  const recurringOccurrences = expandRecurringEvents(recurringRes.data || [], weekendStartDate, weekendEndDate);

  const sportsEvents = (sportsRaw || []).filter(evt => overlaps(evt.startDate, evt.endDate, weekendStartDate, weekendEndDate));

  return (
    sportsEvents.length +
    bigRecords.length +
    groupRecords.length +
    recurringOccurrences.length +
    traditionRecords.length +
    allRecords.length
  );
}

export { toPhillyISODate };
