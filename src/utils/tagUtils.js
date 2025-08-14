import { RRule } from 'rrule';

function parseLocalYMD(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isTagActive(tag) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (tag.rrule) {
    try {
      const opts = RRule.parseString(tag.rrule);
      if (tag.season_start) opts.dtstart = parseLocalYMD(tag.season_start);
      const rule = new RRule(opts);
      const searchStart = new Date(today);
      searchStart.setDate(searchStart.getDate() - 8);
      const next = rule.after(searchStart, true);
      if (!next) return false;
      const start = new Date(next);
      start.setDate(start.getDate() - 7);
      const end = new Date(next);
      end.setDate(end.getDate() + 1);
      return today >= start && today < end;
    } catch {
      return false;
    }
  }
  if (tag.season_start && tag.season_end) {
    const start = parseLocalYMD(tag.season_start);
    const end = parseLocalYMD(tag.season_end);
    if (!start || !end) return false;
    start.setDate(start.getDate() - 7);
    return today >= start && today <= end;
  }
  return true;
}

