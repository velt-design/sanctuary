import 'server-only';
import { POSITION_SCOPES } from '../financePositionProvider';
import type { financePositionReader } from '../financePosition';
import { previousQuery, yearAgoQuery, trendQueries, type FinancialsQuery, type ReportEvidence } from './contract';

/** Same exact periods, with two work-conserving workers including the primary.
 * Wait for both workers before the request-owned connector can be closed. */
export async function readProfitPanel(query: FinancialsQuery, reader: Awaited<ReturnType<typeof financePositionReader>>) {
  const previous = previousQuery(query), yearAgo = yearAgoQuery(query), months = trendQueries(query);
  const key = (q: FinancialsQuery) => `${q.from}/${q.to}/${q.basis}`;
  const unique = [...new Map([query, previous, yearAgo, ...months].map(q => [key(q), q])).values()];
  const reports = new Map<string, ReportEvidence>();
  let index = 0, stopped = false;
  async function worker() {
    while (!stopped && index < unique.length) {
      const next = unique[index++];
      try {
        // Preserve the legacy comparison's metadata scope label; the primary
        // retains its Organisation requirement, including periods reused by trend.
        const report = key(next)!==key(query)&&reader.organisation.status!=='available'
          ? {status:'unavailable' as const,reason:'metadata_unavailable' as const,requiredScopes:[POSITION_SCOPES.organisation[0]]}
          : await reader.reportDomain('profitAndLoss', next);
        reports.set(key(next), report);
      }
      catch (error) { stopped = true; throw error; }
    }
  }
  const outcomes = await Promise.allSettled([worker(), worker()]);
  for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
  const dated = (query: FinancialsQuery) => ({query, report: reports.get(key(query))!});
  return {profitAndLoss: reports.get(key(query))!, previous: dated(previous), yearAgo: dated(yearAgo), months: months.map(dated)};
}
