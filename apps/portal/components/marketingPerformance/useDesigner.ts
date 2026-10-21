import { useEffect, useState } from 'react';
import { designerReportSchema, type DesignerReport } from '@/lib/marketingPerformance/designerContract';
import type { Filters } from '@/lib/marketingPerformance/contract';

export type DesignerLoader = (filters: Filters, signal: AbortSignal) => Promise<DesignerReport>;
const loadDesigner: DesignerLoader = async (filters, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance/designers?${new URLSearchParams({ start: filters.start, end: filters.end })}`, { signal, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Designer reporting unavailable.');
  const report = designerReportSchema.parse(body.report);
  if (report.start !== filters.start || report.end !== filters.end) throw new Error('Designer period could not be verified.');
  return report;
};
export default function useDesigner(filters: Filters, revision: number, loader: DesignerLoader = loadDesigner) {
  const key = `${filters.start}:${filters.end}:${revision}`;
  const [state, setState] = useState<{ key: string; loader: DesignerLoader; report: DesignerReport | null; error: string; busy: boolean }>({ key, loader, report: null, error: '', busy: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, loader, report: null, error: '', busy: true });
    loader(filters, controller.signal).then(report => {
      if (!controller.signal.aborted) setState({ key, loader, report, error: '', busy: false });
    }, error => { if (!controller.signal.aborted) setState({ key, loader, report: null, error: error instanceof Error ? error.message : 'Designer reporting unavailable.', busy: false }); });
    return () => controller.abort();
  }, [filters.start, filters.end, revision, loader]);
  return state.key === key && state.loader === loader ? state : { report: null, error: '', busy: true };
}
