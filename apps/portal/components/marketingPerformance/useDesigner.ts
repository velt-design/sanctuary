import type { InitialReport } from '@/lib/marketingPerformance/reportRead';
import { expandReport, type ColumnarReport } from '@/lib/marketingPerformance/columnarReports';
import { initialReportAttempt } from './initialReportAttempt';
import { useEffect, useState } from 'react';
import { designerReportSchema, type DesignerReport } from '@/lib/marketingPerformance/designerContract';
import type { Filters } from '@/lib/marketingPerformance/contract';

export type DesignerLoader = (filters: Filters, signal: AbortSignal) => Promise<DesignerReport>;
const loadDesigner: DesignerLoader = async (filters, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance/designers?${new URLSearchParams({ start: filters.start, end: filters.end })}`, { signal, cache: 'no-store' });
  if(response.status===401||response.status===403)throw Object.assign(new Error('Current developer access is required.'),{status:response.status});
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'Designer reporting unavailable.'),{status:response.status});
  const report = designerReportSchema.parse(body.report);
  if (report.start !== filters.start || report.end !== filters.end) throw new Error('Designer period could not be verified.');
  return report;
};
export default function useDesigner(filters: Filters | null, revision: number, loader: DesignerLoader = loadDesigner, seed?:InitialReport<DesignerReport|ColumnarReport>, skipSeed=false) {
  const [initial]=useState(()=>initialReportAttempt(seed,loader,report=>{const value=designerReportSchema.parse(expandReport('designer',report));if(seed?.key!==`${value.start}:${value.end}`)throw new Error('Report period could not be verified.');return value;},()=>new Error('Designer reporting unavailable. Retry.')));
  const key = filters ? `${filters.start}:${filters.end}:${revision}` : '';
  const [state, setState] = useState<{ key: string; loader: DesignerLoader; report: DesignerReport | null; error: string; busy: boolean; accessDenied:boolean }>({ key, loader, report: null, error: '', busy: true,accessDenied:false });
  useEffect(() => {
    if(skipSeed)initial.retire();
    if (!filters) { setState({key,loader,report:null,error:'',busy:true,accessDenied:false}); return; }
    const controller = new AbortController();
    setState({ key, loader, report: null, error: '', busy: true,accessDenied:false });
    (initial.take(`${filters.start}:${filters.end}`,revision,loader)??loader(filters, controller.signal)).then(report => {
      if (!controller.signal.aborted) setState({ key, loader, report, error: '', busy: false,accessDenied:false });
    }, error => { if (!controller.signal.aborted) setState({ key, loader, report: null, error: error instanceof Error ? error.message : 'Designer reporting unavailable.', busy: false,accessDenied:error?.status===401||error?.status===403 }); });
    return () => controller.abort();
  }, [filters?.start, filters?.end, revision, loader, initial, skipSeed]);
  return filters && state.key === key && state.loader === loader ? state : { report: null, error: '', busy: true,accessDenied:false };
}
