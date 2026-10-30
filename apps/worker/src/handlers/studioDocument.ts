import {createHash} from 'node:crypto';
import {studioDocumentPages,STUDIO_DOCUMENT_RENDERER_VERSION} from '@sp/studio-documents/contract';
import {unpackStudioDrawing} from '@sp/studio-documents/transport';
import {renderStudioDocumentPage,assembleStudioDocumentPages} from '@sp/studio-documents/render';
import {parseStudioFrozenRenders,renderStudioVariantPage,STUDIO_RENDER_VARIANT_VERSION} from '@sp/studio-documents/variant';
import type {BackgroundJobHandler} from '../runtime/contracts';
import {BackgroundJobHandlerError} from '../runtime/errors';
const bufferFrom=Buffer.from;
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export const studioDocumentHandler:BackgroundJobHandler=async({claim,payload,signal,rpc,logger})=>{
 const fail=()=>new BackgroundJobHandlerError({code:'STUDIO_DOCUMENT_SOURCE_INVALID',disposition:'needs_attention'});
 const value=payload.payload;
 const variant=Object.hasOwn(value,'documentId');
 if(Object.keys(value).sort().join(',')!==(variant?'contractVersion,documentId,rendererVersion,snapshotId,variantVersion':'contractVersion,rendererVersion,snapshotId')||value.contractVersion!==1||value.rendererVersion!==STUDIO_DOCUMENT_RENDERER_VERSION||typeof value.snapshotId!=='string'||(variant&&(typeof value.documentId!=='string'||value.variantVersion!==STUDIO_RENDER_VARIANT_VERSION))||claim.kind!=='studio_design_booklet_v1'||!rpc.studioDocuments)throw fail();
 signal.throwIfAborted();
 const owned=rpc.studioDocuments,read=await owned.read();
 let source;try{source=await unpackStudioDrawing(read.source,signal);}catch{throw fail();}
 let renders;try{renders=variant?parseStudioFrozenRenders(read.renders):[];}catch{throw fail();}
 const drawings=studioDocumentPages(source),plan=Array.from({length:drawings.length+renders.length},(_,index)=>({index}));
 if(variant&&(read.documentId!==value.documentId||read.variantVersion!==STUDIO_RENDER_VARIANT_VERSION||!renders.length||source.layoutVersion!=='studio-booklet-layout.v4'))throw fail();
 if(!plan.length)throw fail();
 if(read.snapshotId!==value.snapshotId||source.snapshotId!==value.snapshotId||read.rendererVersion!==STUDIO_DOCUMENT_RENDERER_VERSION||source.rendererVersion!==read.rendererVersion||read.totalPages!==plan.length||!Array.isArray(read.pages))throw fail();
 if(read.readyFileId)return {safeResult:{artifactId:read.readyFileId,processedCount:plan.length,pageCount:plan.length}};
 const pages=new Map<number,Uint8Array>();
 for(const page of read.pages){
  if(!Number.isInteger(page.index)||page.index<0||page.index>=plan.length||pages.has(page.index)||typeof page.contentBase64!=='string'||page.contentBase64.length>16_777_216)throw fail();
  const bytes=bufferFrom(page.contentBase64,'base64');if(hash(bytes)!==page.sha256||bytes.subarray(0,5).toString()!=='%PDF-')throw fail();pages.set(page.index,bytes);
 }
 const resumingAssembly=claim.status==='finalising';
 if(resumingAssembly&&pages.size!==plan.length)throw fail();
 if(!resumingAssembly)await rpc.progress({status:'running',phase:'drawing_pages',safeProgress:{processedCount:pages.size,totalCount:plan.length,phase:'drawing_pages'}});
 for(const page of plan){
  signal.throwIfAborted();if(pages.has(page.index))continue;
  const bytes=variant?await renderStudioVariantPage(source,renders,page.index,signal):await renderStudioDocumentPage(source,page.index,signal);signal.throwIfAborted();
  const completed=await owned.stage({pageIndex:page.index,contentBase64:bufferFrom(bytes).toString('base64'),sha256:hash(bytes)});pages.set(page.index,bytes);
  await rpc.progress({status:'running',phase:'drawing_pages',safeProgress:{processedCount:completed,totalCount:plan.length,phase:'drawing_pages'}});
  logger.info('background_job.document_page_staged',{jobId:claim.jobId,kind:claim.kind,processedCount:completed,batchSize:plan.length});
 }
 await rpc.progress({status:'finalising',phase:'assembling_booklet',safeProgress:{processedCount:plan.length,totalCount:plan.length,phase:'assembling_booklet'}});
 const bytes=await assembleStudioDocumentPages(plan.map(p=>pages.get(p.index)!),signal);signal.throwIfAborted();
 const fileId=await owned.finish({contentBase64:bufferFrom(bytes).toString('base64'),sha256:hash(bytes)});
 return {safeResult:{artifactId:fileId,processedCount:plan.length,pageCount:plan.length}};
};
