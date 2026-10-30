import {createHash} from 'node:crypto';
import {beforeEach,expect,it,vi} from 'vitest';
import {studioDocumentHandler} from './studioDocument';
import {packStudioDrawing} from '@sp/studio-documents/transport';
import {STUDIO_DOCUMENT_PREVIOUS_LAYOUT_VERSION as STUDIO_DOCUMENT_LAYOUT_VERSION} from '@sp/studio-documents/contract';
import {studioDocumentPages,approvedStudioDocumentPages,type StudioClientDocumentSource} from '@sp/studio-documents/contract';
import {encodeRgbPng} from '../../../../packages/studio-documents/src/png';
const render=vi.hoisted(()=>({page:vi.fn(),assemble:vi.fn()}));
vi.mock('@sp/studio-documents/render',()=>({renderStudioDocumentPage:render.page,assembleStudioDocumentPages:render.assemble}));
const snapshotId='10000000-0000-4000-8000-000000000002';
const source={schemaVersion:'studio_client_document.v1',rendererVersion:'studio-booklet.v1',snapshotId,contentHash:'a'.repeat(64),designId:'fixture',revision:19,designVersionLabel:'V2',projectName:'Synthetic',siteAddress:'12 Example Road',issuedDate:'28 OCT 2026',issuedAt:'2026-10-28T00:00:00Z',houses:[],joins:[],products:[1,2].map(n=>({id:`p${n}`,label:`Pergola ${n}`,pose:{x:0,y:0,rotation:0},widthMm:6000,projectionMm:4000,assembly:{members:[],roofPlanes:[]},plan:{},viewerScene:{layers:[]},accessories:[],selectedDetails:[],extras:{infills:[],blinds:[],lights:[]}}))};
const bytes=(n:number)=>Buffer.from(`%PDF-page-${n}`),hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
beforeEach(()=>{vi.clearAllMocks();render.page.mockImplementation(async(_source,index)=>bytes(index));render.assemble.mockResolvedValue(Buffer.from('%PDF-complete'));});
function fixture(existing=[0,1]){
 const pages=existing.map(index=>({index,sha256:hash(bytes(index)),contentBase64:bytes(index).toString('base64')}));
 const controller=new AbortController();
 const docs={read:vi.fn(async()=>({snapshotId,rendererVersion:'studio-booklet.v1',totalPages:5,readyFileId:null as string|null,source,pages})),stage:vi.fn(async({pageIndex,sha256,contentBase64})=>{pages.push({index:pageIndex,sha256,contentBase64});return pages.length;}),finish:vi.fn(async()=> '10000000-0000-4000-8000-000000000003')};
 const context={claim:{jobId:'10000000-0000-4000-8000-000000000004',kind:'studio_design_booklet_v1'},payload:{payload:{contractVersion:1,snapshotId,rendererVersion:'studio-booklet.v1'}},signal:controller.signal,rpc:{studioDocuments:docs,progress:vi.fn(async()=>({}))},logger:{info:vi.fn()},clock:{}} as any;
 return {context,docs,controller,pages};
}
it('resumes durable completed pages, stages only remaining views, and assembles exact page order',async()=>{
 const f=fixture();const result=await studioDocumentHandler(f.context);
 expect(render.page.mock.calls.map(c=>c[1])).toEqual([2,3,4]);expect(f.docs.stage).toHaveBeenCalledTimes(3);expect(render.assemble.mock.calls[0][0]).toEqual([0,1,2,3,4].map(bytes));expect(f.docs.finish).toHaveBeenCalledOnce();expect(result.safeResult).toMatchObject({processedCount:5,pageCount:5});
 expect(f.context.logger.info.mock.calls.map((c:any[])=>c[1].processedCount)).toEqual([3,4,5]);expect(JSON.stringify(f.context.logger.info.mock.calls)).not.toContain('Example Road');
});
it.each(['studio-booklet-layout.v3','studio-booklet-layout.v4'] as const)('resumes frozen%s inventory without replacing completed pages or guessing the previous five-page plan',async(layoutVersion)=>{
 const logical={...structuredClone(source),layoutVersion,products:source.products.map((p,index)=>({...p,code:`P0${index+1}`,assembly:{...p.assembly,family:'mono'},drawingDetails:{finish:{material:'acrylic'},lights:{rafters:[{id:'rafter-25',point:{x:100,y:100,z:2400},normal:{x:0,y:0,z:1},diameter:40}],cedar:[],strips:[]},blinds:[]}}))} as unknown as StudioClientDocumentSource;
 logical.pageManifest=approvedStudioDocumentPages(logical);const plan=studioDocumentPages(logical),packed=await packStudioDrawing(logical);
 const f=fixture();f.docs.read.mockResolvedValue({...await f.docs.read(),source:packed as any,totalPages:plan.length});
 await studioDocumentHandler(f.context);
 expect(render.page.mock.calls.map(c=>c[1])).toEqual(plan.slice(2).map(p=>p.index));
 expect(render.page.mock.calls[0][0]).toEqual(logical);expect(render.assemble.mock.calls[0][0]).toEqual(plan.map(p=>bytes(p.index)));
 expect(f.docs.stage).toHaveBeenCalledTimes(plan.length-2);expect(f.docs.finish).toHaveBeenCalledOnce();
 expect(f.context.rpc.progress.mock.calls.every((call:any[])=>call[0].safeProgress.totalCount===plan.length)).toBe(true);
 expect(f.context.rpc.progress.mock.calls.at(-1)[0].safeProgress).toMatchObject({processedCount:plan.length,totalCount:plan.length,phase:'assembling_booklet'});
 expect(plan[0].kind).toBe(layoutVersion==='studio-booklet-layout.v4'?'plan':'cover');
});
it.each([undefined,STUDIO_DOCUMENT_LAYOUT_VERSION])('verifies archived source and its frozen layout before resuming pages (layout=%s)',async(layoutVersion)=>{
 const logical={...structuredClone(source),...(layoutVersion?{layoutVersion}:{}),products:source.products.map((p,index)=>({...p,code:`P0${index+1}`,selectedDetails:index===0?Array.from({length:50},()=> 'Synthetic selected option'):[]}))};
 const packed=await packStudioDrawing(logical);if(packed.schemaVersion!=='studio_client_document_archive.v1')throw Error('Expected compressed fixture');
 const f=fixture();f.docs.read.mockResolvedValue({...await f.docs.read(),source:packed as any});await studioDocumentHandler(f.context);
 expect(render.page.mock.calls.map(c=>c[1])).toEqual([2,3,4]);expect(render.page.mock.calls[0][0]).toEqual(logical);expect(f.docs.finish).toHaveBeenCalledOnce();
 render.page.mockClear();const bad=fixture();bad.docs.read.mockResolvedValue({...await bad.docs.read(),source:{...packed,logicalSha256:'0'.repeat(64)} as any});await expect(studioDocumentHandler(bad.context)).rejects.toMatchObject({code:'STUDIO_DOCUMENT_SOURCE_INVALID'});expect(render.page).not.toHaveBeenCalled();expect(bad.docs.finish).not.toHaveBeenCalled();
});
it('reuses an already-published artifact without rendering or finalising it again',async()=>{
 const f=fixture();f.docs.read.mockResolvedValue({...await f.docs.read(),readyFileId:'10000000-0000-4000-8000-000000000003'});
 await studioDocumentHandler(f.context);expect(render.page).not.toHaveBeenCalled();expect(f.docs.stage).not.toHaveBeenCalled();expect(f.docs.finish).not.toHaveBeenCalled();
});
it('refuses an accidental zero-page job instead of rendering or publishing an empty booklet',async()=>{
 const f=fixture([]);
 const empty={...source,layoutVersion:'studio-booklet-layout.v4',products:[],pageManifest:[]};
 f.docs.read.mockResolvedValue({...await f.docs.read(),source:empty as any,totalPages:0});
 await expect(studioDocumentHandler(f.context)).rejects.toMatchObject({code:'STUDIO_DOCUMENT_SOURCE_INVALID'});
 expect(render.page).not.toHaveBeenCalled();expect(render.assemble).not.toHaveBeenCalled();expect(f.docs.stage).not.toHaveBeenCalled();expect(f.docs.finish).not.toHaveBeenCalled();
});
it('refuses another snapshot or corrupt checkpoint before rendering',async()=>{
 const f=fixture();f.pages[0].sha256='b'.repeat(64);await expect(studioDocumentHandler(f.context)).rejects.toMatchObject({code:'STUDIO_DOCUMENT_SOURCE_INVALID'});expect(render.page).not.toHaveBeenCalled();
 const other=fixture();other.context.payload.payload.snapshotId='10000000-0000-4000-8000-000000000099';await expect(studioDocumentHandler(other.context)).rejects.toMatchObject({code:'STUDIO_DOCUMENT_SOURCE_INVALID'});expect(other.docs.finish).not.toHaveBeenCalled();
});
it('honours cancellation after a render and before stage, and never publishes after final cancellation',async()=>{
 const f=fixture([]);render.page.mockImplementation(async()=>{f.controller.abort(Error('cancelled'));return bytes(0);});await expect(studioDocumentHandler(f.context)).rejects.toThrow('cancelled');expect(f.docs.stage).not.toHaveBeenCalled();expect(f.docs.finish).not.toHaveBeenCalled();
 const final=fixture([0,1,2,3,4]);render.assemble.mockImplementation(async()=>{final.controller.abort(Error('cancelled'));return bytes(0);});await expect(studioDocumentHandler(final.context)).rejects.toThrow('cancelled');expect(final.docs.finish).not.toHaveBeenCalled();
});

it('refuses an impossible finalising snapshot with a missing durable page instead of moving backwards to drawing',async()=>{
 const f=fixture([0,1]);f.context.claim.status='finalising';await expect(studioDocumentHandler(f.context)).rejects.toMatchObject({code:'STUDIO_DOCUMENT_SOURCE_INVALID'});expect(render.page).not.toHaveBeenCalled();expect(f.docs.stage).not.toHaveBeenCalled();expect(f.docs.finish).not.toHaveBeenCalled();
});

it('resumes exact variant checkpoints and appends frozen render pages without touching the base job identity',async()=>{
 const logical={...structuredClone(source),layoutVersion:'studio-booklet-layout.v4',products:source.products.map((p,index)=>({...p,code:`P0${index+1}`,assembly:{...p.assembly,family:'mono'},drawingDetails:{finish:{material:'acrylic'},lights:{rafters:[],cedar:[],strips:[]},blinds:[]}}))} as unknown as StudioClientDocumentSource;logical.pageManifest=approvedStudioDocumentPages(logical);
 const png=await encodeRgbPng(2,1,new Uint8Array([1,2,3,4,5,6])),documentId='10000000-0000-4000-8000-000000000008',variantVersion='studio-booklet-renders.v1',f=fixture(),images=[{fileId:'10000000-0000-4000-8000-000000000009',sha256:hash(png),label:'Frozen garden view',contentType:'image/png',contentBase64:png.toString('base64')}];
 f.context.payload.payload={...f.context.payload.payload,documentId,variantVersion};f.docs.read.mockResolvedValue({...await f.docs.read(),documentId,variantVersion,renders:images,source:logical,totalPages:logical.pageManifest.length+1} as any);
 const result=await studioDocumentHandler(f.context);expect(render.page.mock.calls.map(call=>call[1])).toEqual(logical.pageManifest.slice(2).map(page=>page.index));expect(f.docs.stage).toHaveBeenCalledTimes(logical.pageManifest.length-1);expect(result.safeResult?.pageCount).toBe(logical.pageManifest.length+1);expect(f.docs.finish).toHaveBeenCalledOnce();
 const wrong=fixture();wrong.context.payload.payload={...wrong.context.payload.payload,documentId,variantVersion};wrong.docs.read.mockResolvedValue({...await f.docs.read(),documentId:'other'} as any);await expect(studioDocumentHandler(wrong.context)).rejects.toMatchObject({code:'STUDIO_DOCUMENT_SOURCE_INVALID'});expect(wrong.docs.stage).not.toHaveBeenCalled();
});
