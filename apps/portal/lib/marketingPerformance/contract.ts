import { z } from 'zod';

export const UNKNOWN_SOURCE = 'Unknown / unattributed';
export const NO_CAMPAIGN = 'No recorded campaign';
export const stages = ['visit', 'quote', 'accepted', 'won'] as const;
export type Stage = typeof stages[number];
export const stageLabels: Record<Stage, string> = {
  visit: 'Recorded confirmations', quote: 'Sent-quote evidence', accepted: 'Current accepted scope', won: 'Payment-verified projects',
};
export const rowSchema = z.object({
  enquiryId: z.string().uuid(), receivedAt: z.string().datetime({ offset: true }),
  projectId: z.string().uuid().nullable(), projectName: z.string().nullable(), origin: z.boolean(),
  source: z.string().max(600).nullable(), campaign: z.string().max(600).nullable(),
  qualification: z.enum(['qualified', 'not_qualified', 'unreviewed', 'ineligible', 'unavailable']),
  visit: z.boolean(), quote: z.boolean(), accepted: z.boolean(), won: z.boolean(),
  closedOutcome: z.string().nullable(),
});
export const reportSchema = z.object({
  schemaVersion: z.literal(1), asOf: z.string().datetime({ offset: true }),
  start: z.string(), end: z.string(), timezone: z.literal('Pacific/Auckland'),
  visitHistoryAvailable: z.boolean(),
  excludedTests: z.number().int().nonnegative(), rows: z.array(rowSchema).max(2000),
}).superRefine((report, context) => {
  if (new Set(report.rows.map(row => row.enquiryId)).size !== report.rows.length)
    context.addIssue({ code: 'custom', message: 'Duplicate enquiry evidence' });
  const origins = report.rows.filter(row => row.origin).map(row => row.projectId);
  if (origins.includes(null) || new Set(origins).size !== origins.length)
    context.addIssue({ code: 'custom', message: 'Duplicate or missing origin project' });
});
export type MarketingRow = z.infer<typeof rowSchema>;
export type MarketingReport = z.infer<typeof reportSchema>;
export type Filters = { start: string; end: string; source: string; campaign: string };

export function aucklandDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function defaultFilters(now = new Date()): Filters {
  const end = aucklandDay(now);
  const start = new Date(Date.parse(end) - 29 * 86400000).toISOString().slice(0, 10);
  return { start, end, source: '', campaign: '' };
}
export function validPeriod(start: string, end: string, today = aucklandDay()): boolean {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0 && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
  return valid(start) && valid(end) && start <= end && end <= today
    && Date.parse(end) - Date.parse(start) <= 365 * 86400000;
}
export function filteredRows(report: MarketingReport, filters: Filters): MarketingRow[] {
  return report.rows.filter(row => (!filters.source || (row.source ?? UNKNOWN_SOURCE) === filters.source)
    && (!filters.campaign || (row.campaign ?? NO_CAMPAIGN) === filters.campaign));
}
export function summarize(rows: MarketingRow[]) {
  const origins = rows.filter(row => row.origin);
  return {
    enquiries: rows.length, projects: new Set(rows.flatMap(row => row.projectId ? [row.projectId] : [])).size,
    origins: origins.length, repeats: rows.filter(row => row.projectId && !row.origin).length,
    unlinked: rows.filter(row => !row.projectId).length,
    attributed: rows.filter(row => row.source !== null).length,
    qualified: rows.filter(row => row.qualification === 'qualified').length,
    eligible: rows.filter(row => ['qualified', 'not_qualified', 'unreviewed'].includes(row.qualification)).length,
    unreviewed: rows.filter(row => row.qualification === 'unreviewed').length,
    notQualified: rows.filter(row => row.qualification === 'not_qualified').length,
    visit: origins.filter(row => row.visit).length, quote: origins.filter(row => row.quote).length,
    accepted: origins.filter(row => row.accepted).length, won: origins.filter(row => row.won).length,
    lost: origins.filter(row => row.closedOutcome?.startsWith('LOST_')).length,
  };
}
export const comparisonSorts = ['enquiries', 'qualified', 'won', 'winRate'] as const;
export type ComparisonSort = typeof comparisonSorts[number];
export function comparisonRows(rows: MarketingRow[], sort: ComparisonSort = 'enquiries') {
  const groups = new Map<string, { source: string; campaign: string; rows: MarketingRow[] }>();
  for (const row of rows) {
    const source = row.source ?? UNKNOWN_SOURCE, campaign = row.campaign ?? NO_CAMPAIGN;
    const key = JSON.stringify([source, campaign]);
    const group = groups.get(key) ?? { source, campaign, rows: [] };
    group.rows.push(row); groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ ...group, summary: summarize(group.rows) }))
    .sort((a, b) => {
      const value = (summary: ReturnType<typeof summarize>) => sort === 'winRate'
        ? (summary.origins ? summary.won / summary.origins : -1) : summary[sort];
      return value(b.summary) - value(a.summary) || b.summary.enquiries - a.summary.enquiries
        || a.source.localeCompare(b.source) || a.campaign.localeCompare(b.campaign);
    });
}
export function rate(numerator: number, denominator: number): string {
  return denominator ? `${Math.round(numerator / denominator * 100)}%` : 'Unavailable';
}
