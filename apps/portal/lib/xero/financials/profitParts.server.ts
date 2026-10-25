import 'server-only';
import type {PositionDependencies} from '../financePosition';
import {readFinancialPanel} from './panel';
import type {FinancialCurrent,FinancialPanelQuery,FinancialPanel} from './contract';
import {financialTail} from './profitParts';

function deferred<T>(){
  let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  void promise.catch(()=>{});
  return {promise,resolve,reject};
}
/** A fatal check invalidates displayed parts immediately. Tail still awaits all
 * started workers and cleanup, including when validity has already failed. */
export function startFinancialProfitRead(query:FinancialPanelQuery,deps:PositionDependencies,signal:AbortSignal,close:()=>Promise<void>){
  if(query.section!=='profit')throw new Error('A profit selection is required.');
  const current=deferred<FinancialCurrent>(),validity=deferred<null>();
  let published:FinancialCurrent|null=null;
  const invalidate=(error:unknown)=>{current.reject(error);validity.reject(error);};
  const onAbort=()=>invalidate(signal.reason??new DOMException('Read cancelled','AbortError'));
  signal.addEventListener('abort',onAbort,{once:true});
  const full=signal.aborted?Promise.reject<FinancialPanel>(signal.reason):readFinancialPanel(query,deps,signal,{current:report=>{published=report;current.resolve(report);},fatal:invalidate});
  void full.catch(invalidate);
  const tail=(async()=>{
    let failed=false,failure:unknown;
    let report:Awaited<typeof full>|undefined;
    try{report=await full;}catch(error){failed=true;failure=error;}
    try{await close();}catch(error){if(!failed){failed=true;failure=error;}invalidate(failure);}
    if(failed)throw failure;
    if(!published||!report)throw new Error('The complete profit evidence was not published.');
    const result=financialTail(published,report);
    validity.resolve(null);
    return result;
  })().finally(()=>signal.removeEventListener('abort',onAbort));
  void tail.catch(invalidate);
  return {current:current.promise,tail,validity:validity.promise};
}
export type FinancialProfitRead=ReturnType<typeof startFinancialProfitRead>;
