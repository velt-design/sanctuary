import 'server-only';
import {readPartsResponse} from '@/lib/api/readParts';
import type {ReportRead} from '@/lib/marketingPerformance/reportRead';
import type {FinancialProfitRead} from './profitParts.server';
import {FINANCIAL_PARTS_MAX_BYTES} from './profitParts';
import {financialProfitFailure} from './readPortal.server';

/** Fatal invalidation is delivered while started workers drain; only the settled
 * tail can complete the stream. No provider payload or private error crosses it. */
export function financialProfitPartsResponse(request:Request,key:string,start:(signal:AbortSignal)=>Promise<ReportRead<FinancialProfitRead>>):Response{
  const response=readPartsResponse(request,async(emit,signal)=>{
    const result=await start(signal);
    if(!result.ok){emit({key,phase:'invalidated',result});return;}
    let failed=false;
    const invalidate=(error:unknown)=>{if(!failed&&!signal.aborted){failed=true;emit({key,phase:'invalidated',result:financialProfitFailure(error)});}};
    const current=result.report.current.then(report=>{if(!failed&&!signal.aborted)emit({key,phase:'current',report});},invalidate);
    const tail=result.report.tail.then(report=>{if(!failed&&!signal.aborted)emit({key,phase:'tail',report});},invalidate);
    const validity=result.report.validity.catch(invalidate);
    await Promise.allSettled([current,tail,validity]);
    if(!failed&&!signal.aborted)emit({key,done:true});
  },FINANCIAL_PARTS_MAX_BYTES);
  response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
