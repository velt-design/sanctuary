import 'server-only';
import { isDeveloper } from '@/lib/developerAccess';
import { getFreshPaymentPilotSession } from '../pilotAccess';
import { positionRuntime } from '../financePositionRuntime';
import { readFinancialPanel } from './panel';
import { readFinancials } from './read';
import { financialPanelQuery, financialsQuery, nzDay, type FinancialEvidence } from './contract';
import type { ReportRead } from '@/lib/marketingPerformance/reportRead';

export const financialReadFailure=():ReportRead<FinancialEvidence>=>({ok:false,status:503,error:'Xero reports could not be verified. Retry; if this continues, check the existing finance connection and report access.'});
/** API and document seeds share current, uncached caller/finance authority. */
export async function readPortalFinancials(params:URLSearchParams,signal:AbortSignal,userId:string):Promise<ReportRead<FinancialEvidence>> {
  const denied=():ReportRead<FinancialEvidence>=>({ok:false,status:403,error:'Current developer and finance access are required.'});
  try {
    const finance=await getFreshPaymentPilotSession();
    if(!finance||finance.user.id!==userId||!isDeveloper(finance.user))return denied();
    const panel=params.has('section')?financialPanelQuery.safeParse(Object.fromEntries(params)):null;
    const parsed=panel??financialsQuery.safeParse(Object.fromEntries(params));
    if([...params.keys()].some(key=>params.getAll(key).length!==1)||!parsed.success||parsed.data.to>nzDay())return {ok:false,status:400,error:'Choose a basis and 1 to 366 accounting dates ending today or earlier.'};
    const source=positionRuntime(signal,undefined,async()=>{
      const current=await getFreshPaymentPilotSession();
      if(!current||current.user.id!==userId||!isDeveloper(current.user))throw new Error('FINANCIALS_ACCESS_CHANGED');
    },true);
    try {
      const report=panel?.success?await readFinancialPanel(panel.data,source.deps,source.deadline):await readFinancials(parsed.data,source.deps,source.deadline);
      return {ok:true,report};
    } finally { await source.close(); }
  } catch(error) {
    if(error instanceof Error&&error.message==='FINANCIALS_ACCESS_CHANGED')return denied();
    return financialReadFailure();
  }
}
