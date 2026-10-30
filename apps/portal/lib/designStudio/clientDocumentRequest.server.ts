import 'server-only';
import {jsonError,jsonOk,requireStaffContext} from '@/lib/api/staffApi';
import {getSupabaseServiceRole} from '@/lib/supabaseClient';
import {studioIdentifier} from './identifiers';
import {readStudioRequestBody} from './readRequestBody.server';
import {isStudioObject} from './contracts';
/** The caller first proves visibility of this quote/project through its RLS client. */
export async function studioClientDocumentRequest(request:Request,quoteVersionId:string){
 if(process.env.ENABLE_PORTAL_DESIGN_STUDIO!=='1')return jsonError('Not found',404);
 const auth=await requireStaffContext();if(!auth.ok)return auth.response;
 if(!['staff','admin'].includes(auth.session.role))return jsonError('Staff access required',403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return jsonError('Request origin is not allowed',403);
 try{
  const id=studioIdentifier(quoteVersionId,'qv');
  const visible=await auth.supabase.from('quote_versions').select('id,quotes!inner(project_id)').eq('id',id.uuid).abortSignal(request.signal).maybeSingle();
  if(visible.error)return jsonError('Could not verify quote access',503);
  if(!visible.data||visible.data.id!==id.uuid)return jsonError('Quote not found',404);
  const service=getSupabaseServiceRole();
  if(request.method==='POST'){
   const body=await readStudioRequestBody(request,1024);
   if(!isStudioObject(body)||Object.keys(body).join(',')!=='snapshotId'||typeof body.snapshotId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.snapshotId))return jsonError('Invalid booklet retry',400);
   const result=await service.rpc('studio_client_document_retry',{p_quote_version_id:id.uuid,p_snapshot_id:body.snapshotId,p_actor_user_id:auth.session.user.id});
   return result.error?jsonError('The booklet could not be retried. Reload its current status.',409):jsonOk({document:result.data});
  }
  const download=new URL(request.url).searchParams.get('download')==='1';
  const result=await service.rpc('studio_client_document_status',{p_quote_version_id:id.uuid,p_actor_user_id:auth.session.user.id,p_download:download});
  if(result.error)return jsonError('The booklet status could not be checked.',503);
  if(!result.data)return jsonError('No separate booklet for this quote.',404);
  if(download){
   if(result.data.state==='unavailable')return jsonError('This quote has no pergola drawings.',409);
   const file=result.data.file;
   if(result.data.state!=='ready'||!file||typeof file.filename!=='string'||typeof file.contentBase64!=='string')return jsonError('The booklet is still being prepared.',409);
   return new Response(Buffer.from(file.contentBase64,'base64'),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store'}});
  }
  return jsonOk({document:result.data});
 }catch{return jsonError('The booklet could not be accessed. Retry its current status.',503);}
}
