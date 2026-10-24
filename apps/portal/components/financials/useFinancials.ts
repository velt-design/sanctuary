import {initialFinancialAttempt} from './initialFinancialAttempt';
import {loadFinancialProfitParts,type FinancialProfitLoader} from './loadFinancialProfitParts';
import type {InitialFinancialSeed} from '@/lib/xero/financials/profitParts';
import { financialRequestKey } from '@/lib/xero/financials/contract';
import { useEffect, useRef, useState } from 'react';
import { financialPanelSchema, type FinancialEvidence, type FinancialDisplayEvidence, type FinancialsQuery, type FinancialPanelQuery, type FinancialSection } from '@/lib/xero/financials/contract';

export type FinancialsLoader = (query: FinancialPanelQuery, signal: AbortSignal) => Promise<FinancialEvidence>;
const loadFinancials: FinancialsLoader = async (query, signal) => {
  const response = await fetch(`/api/staff/v1/marketing-performance/financials?${new URLSearchParams({from:query.from,to:query.to,basis:query.basis,section:query.section})}`, { signal, cache: 'no-store' });
  if (response.status === 401 || response.status === 403) throw new FinancialAccessError('Current developer and finance access are required.');
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'The Xero report could not be loaded. Retry.');
  const report = financialPanelSchema.parse(body.report);
  if (report.requestedSection !== query.section || report.position.query.from !== query.from || report.position.query.to !== query.to || report.position.query.basis !== query.basis) throw new Error('The source returned different report dates or basis. Retry.');
  return report;
};
export class FinancialAccessError extends Error {}
export default function useFinancials(query: FinancialsQuery & {section?:FinancialSection}, revision: number, loader?:FinancialsLoader, seed?:InitialFinancialSeed, enabled=true, profitLoader?:FinancialProfitLoader) {
  const fullLoader=loader??loadFinancials,partLoader=profitLoader??loadFinancialProfitParts;
  const progressive=!loader||Boolean(profitLoader),owner=progressive?partLoader:fullLoader;
  const [initial]=useState(()=>initialFinancialAttempt(seed,owner));
  const [report,setReport]=useState<FinancialDisplayEvidence|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const [retained,setRetained]=useState<FinancialDisplayEvidence|null>(null);
  const [profitEvidence,setProfitEvidence]=useState<FinancialDisplayEvidence|null>(null);
  const requestKey=financialRequestKey({...query,section:query.section??'profit'});
  type ReadOwner={key:string;revision:number;full:typeof fullLoader;parts:typeof partLoader};
  const [activeRead,setActiveRead]=useState<ReadOwner|null>(null),[reportOwner,setReportOwner]=useState<ReadOwner|null>(null);
  const matches=(value:ReadOwner|null)=>Boolean(value&&value.key===requestKey&&value.revision===revision&&value.full===fullLoader&&value.parts===partLoader);
  const sequence = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const seq = ++sequence.current, controller = new AbortController();
    const readOwner={key:requestKey,revision,full:fullLoader,parts:partLoader};
    setActiveRead(readOwner);setBusy(true); setError('');
    const request={from:query.from,to:query.to,basis:query.basis,section:query.section??'profit'};
    const accept=(report:FinancialDisplayEvidence)=>{
      if(controller.signal.aborted||sequence.current!==seq)return;
      if('requestedSection' in report&&report.requestedSection!==(query.section??'profit'))throw new Error('The source returned a different financial section. Retry.');
        setReportOwner(readOwner);setReport(report);
        setProfitEvidence(old => report.position.profitAndLoss.status === 'available' ? report : old && JSON.stringify(old.position.query) === JSON.stringify(report.position.query) && old.position.identity.tenantId === report.position.identity.tenantId ? old : null);
        setRetained(old => {
          if (!old || JSON.stringify(old.position.query) !== JSON.stringify(report.position.query) || old.position.identity.tenantId !== report.position.identity.tenantId) return report;
          const next = structuredClone(report);
          for (const family of ['organisation', 'profitAndLoss', 'bankSummary', 'receivables', 'payables'] as const) {
            if (report.position[family].status === 'unavailable') Object.assign(next.position, { [family]: old.position[family] });
          }
          return next;
        });
    };
    const read=initial.take(financialRequestKey(request),revision,owner,accept)
      ??(progressive&&request.section==='profit'?partLoader(request,controller.signal,accept):fullLoader(request,controller.signal));
    read.then(accept).catch(error => {
      if (!controller.signal.aborted && sequence.current === seq) {
        if (error instanceof FinancialAccessError || error?.status===401 || error?.status===403 || error?.clearEvidence===true) { setReport(null); setRetained(null); setProfitEvidence(null); }
        setError(error instanceof Error ? error.message : 'Xero is unavailable. Retry.');
      }
    }).finally(() => { if (!controller.signal.aborted && sequence.current === seq) setBusy(false); });
    return () => controller.abort();
  }, [query.from, query.to, query.basis, query.section, revision, fullLoader, partLoader, progressive, owner, initial, enabled,requestKey]);
  return {report,retained,profitEvidence,busy:busy||(enabled&&!matches(activeRead)),error:matches(activeRead)?error:'',reportIsCurrent:matches(reportOwner)};
}
