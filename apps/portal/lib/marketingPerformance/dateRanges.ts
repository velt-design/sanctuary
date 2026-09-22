import { aucklandDay } from './contract';

export const dateRanges = [
  ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'],
  ['12m', 'Last 12 months'], ['ytd', 'Year to date'], ['previous-ytd', 'Last year to date'],
] as const;
export type DateRange = typeof dateRanges[number][0];
const dayAfter = (day: string, offset: number) => new Date(Date.parse(day) + offset * 86400000).toISOString().slice(0, 10);

export function presetDates(range: DateRange, now = new Date()) {
  const today = aucklandDay(now);
  const year = Number(today.slice(0, 4));
  // Clamp leap day to 28 February in a non-leap comparison year.
  const previousDay = `${year - 1}${today.slice(4) === '-02-29' ? '-02-28' : today.slice(4)}`;
  if (range === 'previous-ytd') return { start: `${year - 1}-01-01`, end: previousDay };
  if (range === 'ytd') return { start: `${year}-01-01`, end: today };
  if (range === '12m') return { start: dayAfter(previousDay, 1), end: today };
  return { start: dayAfter(today, -(Number(range.slice(0, -1)) - 1)), end: today };
}

export function matchingPreset(start: string, end: string, now = new Date()): DateRange | undefined {
  return dateRanges.find(([key]) => { const dates = presetDates(key, now); return dates.start === start && dates.end === end; })?.[0];
}
