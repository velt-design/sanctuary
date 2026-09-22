import { useEffect, useRef, useState } from 'react';
import { reportSchema, validPeriod, type Filters, type MarketingReport } from '@/lib/marketingPerformance/contract';
import { previousPeriod } from '@/lib/marketingPerformance/trends';

export type ReportLoader = (filters: Filters, signal: AbortSignal) => Promise<MarketingReport>;
export const loadReport: ReportLoader = async (filters, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance?${new URLSearchParams({ start: filters.start, end: filters.end })}`, { signal, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'The report could not be loaded.');
  return reportSchema.parse(body.report);
};
export default function useMarketingReports(applied: Filters | null, revision: number, loader: ReportLoader) {
  const [report, setReport] = useState<MarketingReport | null>(null);
  const [previous, setPrevious] = useState<MarketingReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [comparisonError, setComparisonError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    if (!applied) return;
    const current = ++sequence.current;
    const controller = new AbortController();
    setReport(null); setPrevious(null); setBusy(true); setError(''); setComparisonError('');
    if (!validPeriod(applied.start, applied.end)) {
      setError('Choose valid dates, up to 366 days ending today or earlier.'); setBusy(false);
      return () => controller.abort();
    }
    const prior = previousPeriod(applied.start, applied.end);
    // Each bounded, authenticated read succeeds or fails independently. Missing comparison is never zero.
    Promise.allSettled([
      loader(applied, controller.signal),
      validPeriod(prior.start, prior.end) ? loader({ ...applied, ...prior }, controller.signal) : Promise.reject(new Error('Previous period outside supported dates')),
    ]).then(([selected, comparison]) => {
      if (current !== sequence.current || controller.signal.aborted) return;
      if (selected.status === 'fulfilled') setReport(selected.value);
      else setError(selected.reason instanceof Error ? selected.reason.message : 'The report could not be loaded. Retry.');
      if (comparison.status === 'fulfilled') setPrevious(comparison.value);
      else setComparisonError('Previous-period evidence is unavailable. Retry or choose a shorter range.');
      setBusy(false);
    });
    return () => controller.abort();
  }, [applied?.start, applied?.end, revision, loader]); // Source/campaign filter both complete snapshots locally.
  return { report, previous, busy, error, comparisonError };
}
