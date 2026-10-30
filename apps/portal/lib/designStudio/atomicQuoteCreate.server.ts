import 'server-only';
import {jsonError,jsonOk,requireStaffContext} from '@/lib/api/staffApi';
import {getSupabaseServiceRole} from '@/lib/supabaseClient';
import {studioIdentifier} from './identifiers';
import {readStudioRequestBody} from './readRequestBody.server';
import {parseStudioAtomicQuoteCommand} from './atomicQuoteCommand';
import {buildStudioQuotePreparation} from './quotePrepare.server';
import {mapQuoteSourceEstimateRow} from '@/lib/quotes/serverLoaders';
import {buildEstimateQuoteCreation} from '@/lib/quotes/estimateCreation.server';
import {mapLineItemRow,mapQuoteVersionRow,mapSendLogRow} from '@/lib/quotes/rowMappers';
import type {QuoteVersionDetail} from '@/lib/quotes/types';
import {buildQuotePreviewBasePayload,buildQuoteRenderHash,previewQuoteAcceptLink,quoteLogoUrl,renderExpiresLabel} from '@/lib/quotes/renderArtifacts';
import {addDays,nowIso} from '@/lib/quotes/serverHelpers';
import {generateQuotePdfBytes,quotePdfFilename} from '@/lib/quotes/pdf';
import {appIdFromUuid} from '@/lib/supabase/mappers';
import {isStudioObject} from './contracts';
import {packStudioDrawing} from '@sp/studio-documents/transport';
import {packStudioFrozenAudit} from '@/lib/costing/auditArchive.server';
import {packStudioFrozenConfiguration} from '@/lib/costing/configurationArchive.server';

/** Only committed DB output enters the PDF renderer, never an optimistic quote. */
export function mapStudioCreatedQuote(value:any,projectId:string,estimateId:string,requestId:string):QuoteVersionDetail{
 const row=value?.versionRow,view=value?.studioDesign;
 if(!row||row.quotes?.project_id!==projectId.slice(5)||row.source_estimate_version_id!==estimateId.slice(4)
  ||row.client_intent_id!==`studio:${requestId}`||view?.snapshotId!==requestId||view.schemaVersion!=='studio_quote_snapshot.v2'
  ||view.contentHash!==row.pricing_source_metadata?.studioSnapshotHash||!Array.isArray(value.lineItems)||!Array.isArray(value.sendLogs))throw Error('The committed quote could not be verified. Retry the same request.');
 const lineItems=value.lineItems.map(mapLineItemRow);
 if(lineItems.reduce((sum:number,item:{lineTotalIncGstCents:number})=>sum+item.lineTotalIncGstCents,0)!==row.total_inc_gst_cents)throw Error('The committed quote totals could not be verified.');
 return {...mapQuoteVersionRow(row,new Map([[estimateId.slice(4),String(value.estimateVersionLabel)]]),projectId),
  studioDesign:view,lineItems,sendLogs:value.sendLogs.map(mapSendLogRow),contact:value.contact,project:value.project};
}

export async function createStudioClientQuoteRequest(request:Request,ids:{projectId:string;estimateId:string}){
 if(process.env.ENABLE_PORTAL_DESIGN_STUDIO!=='1'||process.env.ENABLE_STUDIO_CLIENT_DOCUMENTS!=='1')return jsonError('Not found',404);
 const started=performance.now(),stages:{stage:string;durationMs:number}[]=[];
 async function measure<T>(stage:string,work:()=>PromiseLike<T>|T):Promise<T>{const at=performance.now();try{return await work();}finally{stages.push({stage,durationMs:Number((performance.now()-at).toFixed(1))});}}
 try{
  const auth=await measure('guard',()=>requireStaffContext());if(!auth.ok)return auth.response;
  if(!['staff','admin'].includes(auth.session.role))return jsonError('Staff access required',403);
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return jsonError('Request origin is not allowed',403);
  const project=studioIdentifier(ids.projectId,'proj'),estimate=studioIdentifier(ids.estimateId,'est');
  const command=parseStudioAtomicQuoteCommand(await readStudioRequestBody(request,2*1024*1024));
  const service=getSupabaseServiceRole();
  // Pure preparation and replay/access reads overlap. A completed replay wins
  // before an old base can fail merge/reprice; it still needs current RLS access.
  const preparation=measure('fresh-price-projection',()=>buildStudioQuotePreparation(request,ids,auth,{command})).then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));
  const [visible,replay]=await measure('replay-access',()=>Promise.all([
   auth.supabase.from('estimates').select('id').eq('id',estimate.uuid).eq('project_id',project.uuid).maybeSingle(),
   service.rpc('studio_client_quote_create_replay',{p_project_id:project.uuid,p_estimate_id:estimate.uuid,p_actor_user_id:auth.session.user.id,p_request_id:command.requestId,p_client_request:command}),
  ]));
  if(visible.error||!visible.data)return jsonError('The saved design is unavailable.',404);
  if(replay.error)return jsonError('This quote request could not be verified. Keep it and retry the same request.',409);
  let committed=replay.data;
  if(!committed){
   const prepared=await preparation;if(!prepared.ok)throw prepared.error;
   const data=prepared.value;if(data instanceof Response)return data;if(!data.save)throw Error('The save could not be verified.');
   const estimateSource=mapQuoteSourceEstimateRow({...data.row,outputs:{...data.row.outputs,studio_authored:data.command.p_authored,drawing_object_first:data.command.p_spatial,studio_quote_handoff:data.handoff},pricing_source:'workbench_solved',pricing_source_metadata:{studioSnapshotId:command.requestId,studioSnapshotHash:data.command.p_content_hash,studioDocumentMode:'separate_v1'}});
   const financial=buildEstimateQuoteCreation(estimateSource,estimate.uuid,auth.session.user.email??null,`studio:${command.requestId}`,null,null,true);
   const [drawing,configuration,evidence]=await measure('lossless-transport',()=>Promise.all([packStudioDrawing(data.command.p_drawing_source),packStudioFrozenConfiguration(data.command.p_private_evidence.configuration),packStudioFrozenAudit(data.command.p_private_evidence,data.command.p_publication_id)]));
   const transport={...data.command,p_drawing_source:drawing,p_private_evidence:{...evidence,configuration}};
   const result=await measure('atomic-save-prepare-commit',()=>service.rpc('studio_client_quote_create',{
    p_project_id:project.uuid,p_estimate_id:estimate.uuid,p_actor_user_id:auth.session.user.id,p_request_id:command.requestId,
    p_client_request:command,p_save:data.save,p_preparation:transport,p_command:financial.command,
   }));
   if(result.error)return jsonError('The design or price changed, or this request could not be confirmed. Your work is kept. Retry the same request.',409);
   committed=result.data;
  }
  let quote=mapStudioCreatedQuote(committed,project.appId,estimate.appId,command.requestId);
  if(!isStudioObject(committed.saveReceipt)||committed.saveReceipt.revision!==committed.savedView?.revision||typeof committed.sourceUpdatedAt!=='string')throw Error('The saved quote source could not be verified.');
  const renderHash=buildQuoteRenderHash(quote),bytes=await measure('financial-pdf',()=>generateQuotePdfBytes(quote,process.env.STUDIO_REQUEST_DIAGNOSTICS==='1'?{onTiming:(stage,durationMs)=>{stages.push({stage:`financial-pdf.${stage}`,durationMs});}}:undefined));
  const expiresAtDate=quote.expiresAt??addDays(nowIso(),30);
  const preview=buildQuotePreviewBasePayload({detail:quote,quoteAcceptUrl:previewQuoteAcceptLink(quote.id),expiresAtLabel:renderExpiresLabel(expiresAtDate),logoUrl:quoteLogoUrl()});
  const stored=await measure('atomic-pdf-artifact',()=>service.rpc('studio_client_quote_store_pdf',{
   p_quote_version_id:quote.id.slice(3),p_actor_user_id:auth.session.user.id,p_snapshot_id:command.requestId,p_content_hash:quote.studioDesign!.contentHash,
   p_commercial_revision:quote.commercialRevision,p_render_hash:renderHash,p_preview_payload:preview,p_filename:quotePdfFilename(quote.quoteRef,quote.versionNumber),p_content_base64:Buffer.from(bytes).toString('base64'),
  }));
  if(stored.error||typeof stored.data!=='string')throw Error('The quote was saved. Its PDF could not be confirmed. Retry the same request.');
  quote={...quote,renderHash,pdfFileId:appIdFromUuid('file',stored.data)};
  return jsonOk({quoteVersion:quote,quotePdf:{contentBase64:Buffer.from(bytes).toString('base64'),renderHash},saveReceipt:committed.saveReceipt,savedView:committed.savedView,sourceUpdatedAt:committed.sourceUpdatedAt},201);
 }catch(error){return jsonError(error instanceof Error?error.message:'The quote could not be confirmed. Retry the same request. Your work is kept.',422);}
 finally{if(process.env.STUDIO_REQUEST_DIAGNOSTICS==='1')console.info('[studio]',{event:'studio.client_quote_create',durationMs:Number((performance.now()-started).toFixed(1)),stages});}
}
