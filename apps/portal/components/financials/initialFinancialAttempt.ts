import {initialReportAttempt} from '@/components/marketingPerformance/initialReportAttempt';
import {financialPanelSchema,financialRequestKey,type FinancialCurrent,type FinancialEvidence} from '@/lib/xero/financials/contract';
import {assembleFinancialParts,validateFinancialCurrent,type InitialFinancialSeed} from '@/lib/xero/financials/profitParts';
import {FinancialPartReadError} from './loadFinancialProfitParts';

/** One matching document opportunity; normalized nested Flight thenables are
 * shared through StrictMode replay and cannot revive after selection/Refresh. */
export function initialFinancialAttempt(seed:InitialFinancialSeed|undefined,owner:unknown){
  const legacy=seed&&'result' in seed?initialReportAttempt(seed,owner,report=>{
    const value=financialPanelSchema.parse(report);
    if(financialRequestKey({...value.position.query,section:value.requestedSection})!==seed.key)throw new Error('The source returned different report dates or basis. Retry.');
    return value;
  },()=>new Error('Xero is unavailable. Retry.')):undefined;
  let retired=!seed,pending:Promise<FinancialEvidence>|undefined,current:Promise<FinancialCurrent>|undefined,failed=false;
  return {take(key:string,revision:number,currentOwner:unknown,publish:(report:FinancialCurrent)=>void):Promise<FinancialEvidence>|null{
    if(legacy)return legacy.take(key,revision,currentOwner);
    if(retired)return null;
    if(!seed||'result' in seed||seed.key!==key||revision!==0||currentOwner!==owner){retired=true;return null;}
    if(!pending){
      const unwrap=<T,>(result:{ok:true;report:T}|{ok:false;status:number;error:string})=>{if(!result.ok)throw new FinancialPartReadError(result.error);return result.report;};
      current=Promise.resolve(seed.current).then(unwrap).then(value=>validateFinancialCurrent(value,key));
      const tail=Promise.resolve(seed.tail).then(unwrap);
      const validity=Promise.resolve(seed.validity).then(unwrap);
      pending=Promise.all([current,tail,validity]).then(([current,tail])=>assembleFinancialParts(current,tail)).finally(()=>{retired=true;});
      void pending.catch(()=>{failed=true;});
    }
    void current!.then(value=>{if(!failed)publish(value);},()=>{});
    return pending;
  }};
}
