import 'server-only';
import { POSITION_SCOPES } from '../financePositionProvider';
import type { financePositionReader } from '../financePosition';
import { previousQuery, yearAgoQuery, trendQueries, type FinancialsQuery, type ReportEvidence } from './contract';

type ProfitPrimary = {
  profitAndLoss: ReportEvidence;
  previous: {query:FinancialsQuery;report:ReportEvidence};
  yearAgo: {query:FinancialsQuery;report:ReportEvidence};
};
function deferred<T>() {
  let resolve!: (value:T)=>void;
  let reject!: (error:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  // Every exact period is observed even if a fatal check prevents it starting.
  void promise.catch(()=>{});
  return {promise,resolve,reject};
}
/** One exact-period pool, two work-conserving workers, including the primary.
 * Optional primary publication never releases the connection while workers run. */
export async function readProfitPanel(
  query:FinancialsQuery,
  reader:Awaited<ReturnType<typeof financePositionReader>>,
  onPrimary?: (primary:ProfitPrimary)=>Promise<void>,
  onFatal?: (error:unknown)=>void,
) {
  const previous=previousQuery(query),yearAgo=yearAgoQuery(query),months=trendQueries(query);
  const key=(value:FinancialsQuery)=>`${value.from}/${value.to}/${value.basis}`;
  const unique=[...new Map([query,previous,yearAgo,...months].map(value=>[key(value),value])).values()];
  const waiting=new Map(unique.map(value=>[key(value),deferred<ReportEvidence>()]));
  const reports=new Map<string,ReportEvidence>();
  let index=0,stopped=false,fatal:unknown;
  function stop(error:unknown) {
    if(stopped)return;
    stopped=true;fatal=error;
    for(const part of waiting.values())part.reject(error);
    try{onFatal?.(error);}catch{/* An observer cannot replace the source failure. */}
  }
  const primary=Promise.all([query,previous,yearAgo].map(value=>waiting.get(key(value))!.promise)).then(async values=>{
    if(stopped)throw fatal;
    const result:ProfitPrimary={profitAndLoss:values[0],previous:{query:previous,report:values[1]},yearAgo:{query:yearAgo,report:values[2]}};
    await onPrimary?.(result);
    if(stopped)throw fatal;
    return result;
  }).catch(error=>{stop(error);throw error;});
  void primary.catch(()=>{});
  async function worker() {
    while(!stopped&&index<unique.length){
      const next=unique[index++];
      try{
        // Preserve comparison metadata scope labels, including reused trend periods.
        const report=key(next)!==key(query)&&reader.organisation.status!=='available'
          ? {status:'unavailable' as const,reason:'metadata_unavailable' as const,requiredScopes:[POSITION_SCOPES.organisation[0]]}
          : await reader.reportDomain('profitAndLoss',next);
        if(stopped)return;
        reports.set(key(next),report);
        waiting.get(key(next))!.resolve(report);
      }catch(error){stop(error);throw error;}
    }
  }
  const outcomes=await Promise.allSettled([worker(),worker()]);
  // Primary publication may itself be waiting for its fresh authority check.
  const result=await primary;
  if(stopped)throw fatal;
  for(const outcome of outcomes)if(outcome.status==='rejected')throw outcome.reason;
  return {...result,months:months.map(query=>({query,report:reports.get(key(query))!}))};
}
