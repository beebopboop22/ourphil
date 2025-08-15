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
      const next = rule.after(today, true);
      if (!next) return false;
      const diff = Math.floor((next - today) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
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

