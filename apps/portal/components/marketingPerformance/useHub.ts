import { useEffect, useRef, useState } from 'react';
import { hubSchema, type HubReport } from '@/lib/marketingPerformance/hub';
import { validPeriod, type Filters, type MarketingReport } from '@/lib/marketingPerformance/contract';
import { previousPeriod } from '@/lib/marketingPerformance/trends';
import { loadReport, type ReportLoader } from './useMarketingReports';

export type HubLoader = (filters: Filters, signal: AbortSignal) => Promise<HubReport>;
export const loadHub: HubLoader = async (filters, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance/hub?${new URLSearchParams({start:filters.start,end:filters.end})}`,{ signal,cache:'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Hub unavailable');
  return hubSchema.parse(body.report);
};
export default function useHub(filters: Filters | null, revision: number, loader = loadHub, priorLoader: ReportLoader = loadReport) {
  const [hub,setHub] = useState<HubReport | null>(null), [previous,setPrevious] = useState<MarketingReport | null>(null);
  const [busy,setBusy] = useState(true), [error,setError] = useState(''), [comparisonError,setComparisonError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    if (!filters) return;
    const seq = ++sequence.current, controller = new AbortController();
    setBusy(true); setHub(null); setPrevious(null); setError(''); setComparisonError('');
    if (!validPeriod(filters.start,filters.end)) { setBusy(false); setError('Choose valid dates, up to 366 days ending today or earlier.'); return; }
    const dates = previousPeriod(filters.start,filters.end);
    Promise.allSettled([loader(filters,controller.signal), priorLoader({...filters,...dates},controller.signal)]).then(([current,prior]) => {
      if (controller.signal.aborted || seq !== sequence.current) return;
      if (current.status === 'fulfilled') setHub(current.value); else setError(current.reason instanceof Error ? current.reason.message : 'Hub unavailable. Retry.');
      if (prior.status === 'fulfilled') setPrevious(prior.value); else setComparisonError('Previous-period evidence unavailable.');
      setBusy(false);
    });
    return () => controller.abort();
  },[filters?.start,filters?.end,revision,loader,priorLoader]);
  return {hub,previous,busy,error,comparisonError};
}
