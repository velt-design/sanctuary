import { useEffect, useRef, useState } from 'react';
import { hubSchema, type HubReport } from '@/lib/marketingPerformance/hub';
import { validPeriod, type Filters, type MarketingReport } from '@/lib/marketingPerformance/contract';
import { previousPeriod } from '@/lib/marketingPerformance/trends';
import { loadReport, type ReportLoader } from './useMarketingReports';
import type { InitialHubSeed } from '@/lib/marketingPerformance/initialHub';
import { initialHubAttempt } from './initialHubAttempt';

export type HubLoader = (filters: Filters, signal: AbortSignal) => Promise<HubReport>;
export const loadHub: HubLoader = async (filters, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance/hub?${new URLSearchParams({start:filters.start,end:filters.end})}`,{ signal,cache:'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Hub unavailable');
  return hubSchema.parse(body.report);
};
export default function useHub(filters: Filters | null, revision: number, loader = loadHub, priorLoader: ReportLoader = loadReport, comparison = true, initialHubSeed?: InitialHubSeed, skipInitialHubSeed = false) {
  const [initial] = useState(() => initialHubAttempt(initialHubSeed, loader));
  const [hub,setHub] = useState<HubReport | null>(null), [previous,setPrevious] = useState<MarketingReport | null>(null);
  const [busy,setBusy] = useState(true), [error,setError] = useState(''), [comparisonError,setComparisonError] = useState('');
  const [comparisonBusy,setComparisonBusy]=useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    if (skipInitialHubSeed) initial.retire();
    if (!filters) return;
    const seq = ++sequence.current, controller = new AbortController();
    setBusy(true); setHub(null); setError('');
    if (!validPeriod(filters.start,filters.end)) { initial.retire(); setBusy(false); setError('Choose valid dates, up to 366 days ending today or earlier.'); return; }
    (initial.take(filters, revision, loader) ?? loader(filters,controller.signal)).then(current => {
      if (controller.signal.aborted || seq !== sequence.current) return;
      setHub(current);
      setBusy(false);
    },reason=>{
      if(controller.signal.aborted||seq!==sequence.current)return;
      setError(reason instanceof Error?reason.message:'Hub unavailable. Retry.');setBusy(false);
    });
    return () => controller.abort();
  },[filters?.start,filters?.end,revision,loader,initial,skipInitialHubSeed]);
  useEffect(()=>{
    setPrevious(null);setComparisonError('');setComparisonBusy(false);
    if(!filters||!comparison)return;
    const controller=new AbortController(),dates=previousPeriod(filters.start,filters.end);
    if(!validPeriod(filters.start,filters.end)||!validPeriod(dates.start,dates.end)){setComparisonError('Previous-period evidence unavailable.');return;}
    setComparisonBusy(true);
    priorLoader({...filters,...dates},controller.signal).then(prior=>{if(!controller.signal.aborted)setPrevious(prior);},()=>{if(!controller.signal.aborted)setComparisonError('Previous-period evidence unavailable.');}).finally(()=>{if(!controller.signal.aborted)setComparisonBusy(false);});
    return()=>controller.abort();
  },[filters?.start,filters?.end,revision,comparison,priorLoader]);
  return {hub,previous,busy,error,comparisonError,comparisonBusy};
}
