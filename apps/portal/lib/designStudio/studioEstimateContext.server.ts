import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadEstimateQuoteEditability} from '@/lib/estimates/flow';

/** Reuse the caller's RLS-read target and canonical quote authority. Job-pack
 * history does not decide Studio editability; full flow remains a separate read. */
export async function loadStudioEstimateEditability(
 client:SupabaseClient,
 projectUuid:string,
 estimateUuid:string,
 row:Record<string,unknown>,
){
 if(row.id!==estimateUuid||row.project_id!==projectUuid)return null;
 const map=await loadEstimateQuoteEditability([estimateUuid],client);
 const editability=map.get(estimateUuid);
 if(!editability)throw Error('Estimate quote authority is unavailable.');
 return editability;
}
