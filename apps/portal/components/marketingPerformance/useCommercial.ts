import type { InitialReport } from '@/lib/marketingPerformance/reportRead';
import { expandReport, type ColumnarReport } from '@/lib/marketingPerformance/columnarReports';
import { initialReportAttempt } from './initialReportAttempt';
import { useEffect, useState } from 'react';
import { commercialSchema, type CommercialReport } from '@/lib/marketingPerformance/commercial';
import type { Filters } from '@/lib/marketingPerformance/contract';

export type CommercialLoader = (filters: Filters, signal: AbortSignal) => Promise<CommercialReport>;
export const loadCommercial: CommercialLoader = async (filters, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance/commercial?${new URLSearchParams({ start: filters.start, end: filters.end })}`, { signal, cache: 'no-store' });
  if(response.status===401||response.status===403)throw Object.assign(new Error('Current developer access is required.'),{status:response.status});
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'Commercial reporting unavailable.'),{status:response.status});
  const report = commercialSchema.parse(body.report);
  if (report.start !== filters.start || report.end !== filters.end) throw new Error('Commercial period could not be verified.');
  return report;
};
export default function useCommercial(filters: Filters | null, revision: number, loader: CommercialLoader = loadCommercial, seed?:InitialReport<CommercialReport|ColumnarReport>, skipSeed=false) {
  const [initial]=useState(()=>initialReportAttempt(seed,loader,report=>{const value=commercialSchema.parse(expandReport('commercial',report));if(seed?.key!==`${value.start}:${value.end}`)throw new Error('Report period could not be verified.');return value;},()=>new Error('Commercial reporting unavailable. Retry.')));
  const key = filters ? `${filters.start}:${filters.end}:${revision}` : '';
  const [state, setState] = useState<{ key: string; loader: CommercialLoader; report: CommercialReport | null; error: string; busy: boolean; accessDenied:boolean }>({ key, loader, report: null, error: '', busy: true,accessDenied:false });
  useEffect(() => {
    if(skipSeed)initial.retire();
    if (!filters) { setState({key,loader,report:null,error:'',busy:true,accessDenied:false}); return; }
    const controller = new AbortController();
    setState({ key, loader, report: null, error: '', busy: true,accessDenied:false });
    (initial.take(`${filters.start}:${filters.end}`,revision,loader)??loader(filters, controller.signal)).then(report => {
      if (!controller.signal.aborted) setState({ key, loader, report, error: '', busy: false,accessDenied:false });
    }, error => { if (!controller.signal.aborted) setState({ key, loader, report: null, error: error instanceof Error ? error.message : 'Commercial reporting unavailable.', busy: false,accessDenied:error?.status===401||error?.status===403 }); });
    return () => controller.abort();
  }, [filters?.start, filters?.end, revision, loader, initial, skipSeed]);
  return filters && state.key === key && state.loader === loader ? state : { report: null, error: '', busy: true,accessDenied:false };
}
