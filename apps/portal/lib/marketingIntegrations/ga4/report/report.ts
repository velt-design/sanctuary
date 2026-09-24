import type { WebsiteJourney } from "./journey";
import type { BusinessEvidence } from "./outcomes";
export type PaneId = "traffic" | "channels" | "landing" | "events";
export interface Period { start: string; end: string }
export interface ReportQuery { period: Period; comparison: Period | null }
export interface Measure { label: string; value: number | null; previous: number | null }
export interface AnalyticsReport {
  source: "sample" | "ga4";
  property: string | null;
  timezone: string;
  fetchedAt: string;
  query: ReportQuery;
  traffic: Measure[];
  channels: Measure[];
  landing: Measure[];
  events: Measure[];
  sessions: number | null;
  previousSessions: number | null;
  warnings: string[];
  journey?: WebsiteJourney;
  business?: BusinessEvidence;
}
const DAY = 86_400_000;
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}
export function periodDays(period: Period): number {
  return validDate(period.start) && validDate(period.end)
    ? Math.round((Date.parse(period.end) - Date.parse(period.start)) / DAY) + 1 : 0;
}
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}
export function previousPeriod(period: Period): Period {
  const days = periodDays(period);
  return { start: shiftDate(period.start, -days), end: shiftDate(period.start, -1) };
}
export function completedThrough(now: Date): string {
  return shiftDate(now.toISOString().slice(0, 10), -1);
}
export function initialCompletedQuery(now: Date): ReportQuery {
  const period = { start: shiftDate(completedThrough(now), -27), end: completedThrough(now) };
  return { period, comparison: previousPeriod(period) };
}
export function validateCompletedQuery(query: ReportQuery, now: Date): string | null {
  return validateQuery(query) ?? (query.period.end > completedThrough(now)
    ? `Choose completed dates ending on or before ${completedThrough(now)} (UTC cutoff). Today and future dates cannot be loaded.` : null);
}
export function validateQuery(query: ReportQuery): string | null {
  const days = periodDays(query.period);
  if (days < 1 || days > 90) return "Choose a date range of 1–90 days.";
  if (query.comparison) {
    if (periodDays(query.comparison) !== days) return "Comparison must contain the same number of days.";
    if (query.comparison.end >= query.period.start) return "Comparison must finish before the selected period.";
  }
  return null;
}
