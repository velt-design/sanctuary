import { aucklandDay, summarize, type MarketingRow } from './contract';

const DAY = 86400000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
export function previousPeriod(start: string, end: string) {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
  return { start: isoDay(Date.parse(start) - days * DAY), end: isoDay(Date.parse(start) - DAY), days };
}
export function countChange(current: number, previous: number): string {
  const difference = current - previous;
  if (!previous) return current ? `+${difference} · no previous records` : 'No change in recorded count';
  return `${difference > 0 ? '+' : ''}${difference} (${difference > 0 ? '+' : ''}${Math.round(difference / previous * 100)}%)`;
}
export function weeklyEnquiries(rows: MarketingRow[], start: string, end: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = aucklandDay(new Date(row.receivedAt));
    if (day >= start && day <= end) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const weeks: Array<{ start: string; end: string; days: number; enquiries: number; dailyAverage: number }> = [];
  let cursor = Date.parse(start);
  const finish = Date.parse(end);
  while (cursor <= finish) {
    const mondayOffset = (new Date(cursor).getUTCDay() + 6) % 7;
    const last = Math.min(cursor + (6 - mondayOffset) * DAY, finish);
    let enquiries = 0;
    for (let day = cursor; day <= last; day += DAY) enquiries += counts.get(isoDay(day)) ?? 0;
    const days = Math.round((last - cursor) / DAY) + 1;
    weeks.push({ start: isoDay(cursor), end: isoDay(last), days, enquiries, dailyAverage: enquiries / days });
    cursor = last + DAY;
  }
  return weeks;
}
export function comparisonMetrics(rows: MarketingRow[]) {
  const totals = summarize(rows);
  return { enquiries: totals.enquiries, qualified: totals.qualified, eligible: totals.eligible, unreviewed: totals.unreviewed };
}
