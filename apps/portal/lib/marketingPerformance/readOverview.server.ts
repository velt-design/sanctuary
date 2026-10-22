import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { commercialSchema } from './commercial';
import { designerReportSchema } from './designerContract';
import { validPeriod } from './contract';
import type { ReportRead } from './reportRead';
import type { z } from 'zod';

// Caller verifies current staff/developer; each RPC independently reauthorizes.
async function read<T extends {start:string;end:string}>(client:Pick<SupabaseClient,'rpc'>,start:string,end:string,label:string,rpc:string,schema:z.ZodType<T>):Promise<ReportRead<T>> {
  if(!validPeriod(start,end))return {ok:false,status:400,error:'Choose up to 366 days ending today or earlier.'};
  try {
    const {data,error}=await client.rpc(rpc,{p_start:start,p_end:end});
    if(error)return {ok:false,status:error.code==='42501'?403:503,error:error.code==='42501'?'Developer access is required.':error.code==='54000'?`${label} reporting limit reached. No partial totals are shown.`:`${label} reporting is unavailable in this environment. Retry.`};
    const report=schema.safeParse(data);
    if(!report.success||report.data.start!==start||report.data.end!==end)return {ok:false,status:503,error:`${label} evidence could not be verified.`};
    return {ok:true,report:report.data};
  } catch { return overviewFailure(label); }
}
export const overviewFailure=(label:string)=>({ok:false as const,status:503,error:`${label} reporting could not be loaded. Retry.`});
export const readCommercial=(client:Pick<SupabaseClient,'rpc'>,start:string,end:string)=>read(client,start,end,'Commercial','marketing_commercial_performance_read',commercialSchema);
export const readDesigner=(client:Pick<SupabaseClient,'rpc'>,start:string,end:string)=>read(client,start,end,'Designer','marketing_designer_performance_read',designerReportSchema);
