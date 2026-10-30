import 'server-only';
import {getSupabaseServiceRole} from '@/lib/supabaseClient';
/** Server-owned rollout capability remains subject to fresh staff/project admission. */
export async function studioClientDocumentsEnabled(projectUuid:string,actorId:string):Promise<boolean>{
 if(process.env.ENABLE_STUDIO_CLIENT_DOCUMENTS!=='1')return false;
 const result=await getSupabaseServiceRole().rpc('studio_client_document_capability',{p_project_id:projectUuid,p_actor_user_id:actorId});
 return !result.error&&result.data===true;
}
