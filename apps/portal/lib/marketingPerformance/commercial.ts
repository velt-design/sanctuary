import { z } from 'zod';
import { aucklandDay } from './contract';
import { previousPeriod } from './trends';
import { salesActivity, type ActivityBucket } from './overview';

const timestamp = z.string().datetime({ offset: true });
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
const version = { versionId: z.string().uuid(), versionNumber: z.number().int().positive(), amountCents: amount };
export const commercialRowSchema = z.object({
  quoteId: z.string().uuid(), projectId: z.string().uuid(), quoteRef: z.string(), scopeKind: z.enum(['base', 'add_on']),
  originAt: timestamp.nullable(), firstSentAt: timestamp.nullable(),
  currentSent: z.object({ ...version, sentAt: timestamp }).nullable(),
  priorSent: z.object({ ...version, sentAt: timestamp }).nullable(),
  accepted: z.object({ ...version, acceptedAt: timestamp.nullable() }).nullable(),
});
export const commercialSchema = z.object({
  schemaVersion: z.literal(1), asOf: timestamp, start: z.string().date(), end: z.string().date(), priorStart: z.string().date(), priorEnd: z.string().date(),
  currency: z.literal('NZD'), taxBasis: z.literal('including_gst'), earliestSentAt: timestamp.nullable(),
  rows: z.array(commercialRowSchema).max(5000),
}).superRefine((report, ctx) => {
  if (!Number.isFinite(Date.parse(report.start)) || !Number.isFinite(Date.parse(report.end))) return;
  const prior = previousPeriod(report.start, report.end);
  if (new Set(report.rows.map(r => r.quoteId)).size !== report.rows.length || prior.start !== report.priorStart || prior.end !== report.priorEnd
    || report.rows.some(r => (r.currentSent && !inPeriod(r.currentSent.sentAt, report.start, report.end))
      || (r.priorSent && !inPeriod(r.priorSent.sentAt, report.priorStart, report.priorEnd))))
    ctx.addIssue({ code: 'custom', message: 'Inconsistent commercial evidence' });
});
export type CommercialReport = z.infer<typeof commercialSchema>;
export type CommercialRow = z.infer<typeof commercialRowSchema>;
export type CommercialMetric = 'quoted' | 'accepted' | 'average' | 'enquiryDays' | 'acceptanceDays';
export type Contribution = { row: CommercialRow; at: string; amountCents: number | null; from: string | null; days: number | null; versionNumber: number | null };
export function inPeriod(value: string | null, start: string, end: string) {
  if (!value) return false;
  const day = aucklandDay(new Date(value));
  return day >= start && day <= end;
}
function elapsed(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  return days >= 0 ? days : null;
}
export function contributions(report: CommercialReport, rows: CommercialRow[], prior = false) {
  const start = prior ? report.priorStart : report.start, end = prior ? report.priorEnd : report.end;
  const quoted: Contribution[] = [], accepted: Contribution[] = [], enquiryDays: Contribution[] = [], acceptanceDays: Contribution[] = [];
  for (const row of rows) {
    const sent = prior ? row.priorSent : row.currentSent;
    if (sent) quoted.push({ row, at: sent.sentAt, amountCents: sent.amountCents, from: null, days: null, versionNumber: sent.versionNumber });
    if (row.accepted && inPeriod(row.accepted.acceptedAt, start, end)) {
      const item = { row, at: row.accepted.acceptedAt!, amountCents: row.accepted.amountCents, from: row.firstSentAt,
        days: elapsed(row.firstSentAt, row.accepted.acceptedAt), versionNumber: row.accepted.versionNumber };
      accepted.push(item);
      if (row.scopeKind === 'base') acceptanceDays.push(item);
    }
    if (row.scopeKind === 'base' && inPeriod(row.firstSentAt, start, end)) enquiryDays.push({ row, at: row.firstSentAt!,
      amountCents: null, from: row.originAt, days: elapsed(row.originAt, row.firstSentAt), versionNumber: null });
  }
  return { quoted, accepted, average: accepted, enquiryDays, acceptanceDays };
}
export function total(items: Contribution[]) {
  if (items.some(item => item.amountCents === null)) return null;
  const sum = items.reduce((n, item) => n + item.amountCents!, 0);
  return Number.isSafeInteger(sum) ? sum : null;
}
export function median(items: Contribution[]) {
  const values = items.flatMap(item => item.days === null ? [] : [item.days]).sort((a, b) => a - b);
  return !values.length ? null : (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2;
}
export function metricValue(metric: CommercialMetric, items: Contribution[]) {
  if (metric.endsWith('Days')) return median(items);
  const value = total(items);
  return metric === 'average' ? items.length && value !== null ? value / items.length : null : value;
}
export function comparison(current: number | null, prior: number | null) {
  if (current === null || prior === null) return 'Comparison unavailable';
  if (prior === 0) return current === 0 ? 'No change from zero' : 'Previous period: zero';
  const change = (current - prior) / Math.abs(prior) * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}% vs previous`;
}
export function commercialTrend(report: CommercialReport, values: ReturnType<typeof contributions>, bucket: ActivityBucket = 'month') {
  return salesActivity([], report.start, report.end, bucket).map(b => {
    const quoted = values.quoted.filter(item => inPeriod(item.at, b.start, b.end));
    const accepted = values.accepted.filter(item => inPeriod(item.at, b.start, b.end));
    return { key: b.key, label: b.label, start: b.start, end: b.end, partial: b.partial,
      quoted: total(quoted), accepted: total(accepted), quotedCount: quoted.length, acceptedCount: accepted.length };
  });
}
