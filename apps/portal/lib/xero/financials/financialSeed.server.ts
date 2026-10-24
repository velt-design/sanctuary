import 'server-only';
import type {ReportRead} from '@/lib/marketingPerformance/reportRead';
import type {FinancialProfitRead} from './profitParts.server';
import type {FinancialPartsSeed} from './profitParts';
import {financialProfitFailure} from './readPortal.server';

/** One request owner; nested Flight promises transport each validated part once. */
export function financialProfitSeed(key:string,start:Promise<ReportRead<FinancialProfitRead>>):FinancialPartsSeed{
  const part=<K extends keyof FinancialProfitRead>(name:K)=>start.then(async result=>{
    if(!result.ok)return result;
    return {ok:true as const,report:await result.report[name]};
  }).catch(financialProfitFailure);
  return {key,current:part('current'),tail:part('tail'),validity:part('validity')};
}
