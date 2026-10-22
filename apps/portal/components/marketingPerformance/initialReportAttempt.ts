import type { InitialReport } from '@/lib/marketingPerformance/reportRead';
/** One matching opportunity, shared by Strict Mode effect replay, never revived. */
export function initialReportAttempt<T>(seed:InitialReport<T>|undefined,owner:unknown,verify:(report:T)=>T,failure:()=>Error) {
  let retired=!seed;
  let pending:Promise<T>|undefined;
  return {
    take(key:string,revision:number,currentOwner:unknown) {
      if(retired)return null;
      if(!seed||seed.key!==key||revision!==0||currentOwner!==owner){retired=true;return null;}
      pending??=Promise.resolve(seed.result).then(result=>{
        if(!result.ok)throw Object.assign(new Error(result.error),{status:result.status});
        return verify(result.report);
      },()=>{throw failure();}).finally(()=>{retired=true;});
      return pending;
    },
    retire(){retired=true;},
  };
}
