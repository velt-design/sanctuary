import {consumeReadParts,READ_PARTS_MEDIA_TYPE} from '@/lib/api/readParts';
import {financialRequestKey,type FinancialCurrent,type FinancialPanelQuery,type FinancialPanel} from '@/lib/xero/financials/contract';
import {assembleFinancialParts,validateFinancialCurrent,financialTailSchema,FINANCIAL_PARTS_MAX_BYTES,type FinancialTail} from '@/lib/xero/financials/profitParts';

export class FinancialPartReadError extends Error {
  readonly clearEvidence=true;
}
export type FinancialProfitLoader=(query:FinancialPanelQuery,signal:AbortSignal,publish:(current:FinancialCurrent)=>void)=>Promise<FinancialPanel>;
export const loadFinancialProfitParts:FinancialProfitLoader=(query,signal,publish)=>readFinancialProfitPartsFrom(`/api/staff/v1/marketing-performance/financials?${new URLSearchParams({...query})}`,query,signal,publish);
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
export async function readFinancialProfitPartsFrom(path:string,query:FinancialPanelQuery,signal:AbortSignal,publish:(current:FinancialCurrent)=>void):Promise<FinancialPanel>{
  const key=financialRequestKey(query);
  try{
    // StrictMode can retire the first effect before it starts a source request.
    await Promise.resolve();signal.throwIfAborted();
    const response=await fetch(path,{signal,credentials:'same-origin',cache:'no-store',headers:{Accept:READ_PARTS_MEDIA_TYPE}});
    if(!response.ok)throw new FinancialPartReadError(response.status===401||response.status===403?'Current developer and finance access are required.':'Xero reports could not be verified. Retry.');
    if(response.headers.get('content-type')?.split(';')[0]!==READ_PARTS_MEDIA_TYPE)throw new FinancialPartReadError('The source returned an invalid financial response. Retry.');
    let current:FinancialCurrent|undefined,tail:FinancialTail|undefined,done=false;
    await consumeReadParts(response,signal,FINANCIAL_PARTS_MAX_BYTES,frame=>{
      if(!object(frame)||done||frame.key!==key)throw new FinancialPartReadError('The source returned different financial selection or invalid evidence. Retry.');
      if(frame.phase==='invalidated'){
        const result=frame.result;
        if(!object(result)||result.ok!==false||typeof result.error!=='string')throw new FinancialPartReadError('Financial source verification failed. Retry.');
        throw new FinancialPartReadError(result.error);
      }
      if(frame.done===true){if(!current||!tail)throw new FinancialPartReadError('The financial read did not complete. Retry.');done=true;return;}
      if(frame.phase==='current'&&!current&&!tail){current=validateFinancialCurrent(frame.report,key);publish(current);return;}
      if(frame.phase==='tail'&&current&&!tail){tail=financialTailSchema.parse(frame.report);return;}
      throw new FinancialPartReadError('The source returned an invalid financial part. Retry.');
    });
    if(!done||!current||!tail)throw new FinancialPartReadError('The financial read did not complete. Retry.');
    return assembleFinancialParts(current,tail);
  }catch(error){
    if(signal.aborted)throw error;
    if(error instanceof FinancialPartReadError)throw error;
    throw new FinancialPartReadError('The financial response could not be verified. Retry.');
  }
}
