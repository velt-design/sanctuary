import { useEffect, useRef, useState } from 'react';
import { financialsSchema, type Financials, type FinancialsQuery } from '@/lib/xero/financials/contract';

export type FinancialsLoader = (query: FinancialsQuery, signal: AbortSignal) => Promise<Financials>;
const loadFinancials: FinancialsLoader = async (query, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance/financials?${new URLSearchParams({from:query.from,to:query.to,basis:query.basis})}`, { signal, cache: 'no-store' });
  if (response.status === 401 || response.status === 403) throw new FinancialAccessError('Current developer and finance access are required.');
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'The Xero report could not be loaded. Retry.');
  const report = financialsSchema.parse(body.report);
  if (report.position.query.from !== query.from || report.position.query.to !== query.to || report.position.query.basis !== query.basis) throw new Error('The source returned different report dates or basis. Retry.');
  return report;
};
export class FinancialAccessError extends Error {}
export default function useFinancials(query: FinancialsQuery, revision: number, loader = loadFinancials) {
  const [report, setReport] = useState<Financials | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [retained, setRetained] = useState<Financials | null>(null);
  const [profitEvidence, setProfitEvidence] = useState<Financials | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    const seq = ++sequence.current, controller = new AbortController();
    setBusy(true); setError('');
    loader({from:query.from,to:query.to,basis:query.basis}, controller.signal).then(report => {
      if (!controller.signal.aborted && sequence.current === seq) {
        setReport(report);
        setProfitEvidence(old => report.position.profitAndLoss.status === 'available' ? report : old && JSON.stringify(old.position.query) === JSON.stringify(report.position.query) && old.position.identity.tenantId === report.position.identity.tenantId ? old : null);
        setRetained(old => {
          if (!old || JSON.stringify(old.position.query) !== JSON.stringify(report.position.query) || old.position.identity.tenantId !== report.position.identity.tenantId) return report;
          const next = structuredClone(report);
          for (const family of ['organisation', 'profitAndLoss', 'bankSummary', 'receivables', 'payables'] as const) {
            if (report.position[family].status === 'unavailable') Object.assign(next.position, { [family]: old.position[family] });
          }
          return next;
        });
      }
    }).catch(error => {
      if (!controller.signal.aborted && sequence.current === seq) {
        if (error instanceof FinancialAccessError) { setReport(null); setRetained(null); setProfitEvidence(null); }
        setError(error instanceof Error ? error.message : 'Xero is unavailable. Retry.');
      }
    }).finally(() => { if (!controller.signal.aborted && sequence.current === seq) setBusy(false); });
    return () => controller.abort();
  }, [query.from, query.to, query.basis, revision, loader]);
  return { report, retained, profitEvidence, busy, error };
}
