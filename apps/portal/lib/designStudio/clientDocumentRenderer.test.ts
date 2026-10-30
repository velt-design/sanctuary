import {studioDocumentCapacityFixture,studioDocumentSelectionsFixture} from '../../../../test/fixtures/studio-client-document-capacity';
import {parseStudioClientDocumentSource,studioDocumentPages} from '@sp/studio-documents/contract';
// @vitest-environment node
import {inflateSync} from 'node:zlib';
import {expect,it,vi} from 'vitest';
import {studioClientDocumentFixture} from '../../../../test/fixtures/studio-client-documents';
import {projectStudioClientDocument} from './clientDocumentProjection.server';
import {renderStudioDocumentPage,assembleStudioDocumentPages} from '../../../../packages/studio-documents/src/render';
import {renderDocumentIsometric} from '../../../../packages/studio-documents/src/isometric';
import type {DocumentTriangle} from '../../../../packages/studio-documents/src/mesh';
import {PDFDocument,PDFPage} from 'pdf-lib';
it('produces byte-stable complete page checkpoints from frozen issued data and assembles ordinary native A3 pages',async()=>{
 const source=projectStudioClientDocument(studioClientDocumentFixture(),{designVersionLabel:'V2',snapshotId:'10000000-0000-4000-8000-000000000002',contentHash:'a'.repeat(64),projectName:'Synthetic courtyard',siteAddress:'12 Example Road',issuedDate:'28 OCT 2026',issuedAt:'2026-10-28T00:00:00Z'});
 source.revision=19;
 const a=await renderStudioDocumentPage(source,0),b=await renderStudioDocumentPage(source,0);expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
 const assembled=await PDFDocument.load(await assembleStudioDocumentPages([a,b]));expect(assembled.getPageCount()).toBe(2);expect(assembled.getPage(0).getWidth()).toBeCloseTo(1190.55,1);expect(assembled.getPage(0).getHeight()).toBeCloseTo(841.89,1);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),document=await pdfjs.getDocument({data:a.slice()}).promise,content=await (await document.getPage(1)).getTextContent(),text=content.items.map(item=>'str' in item?item.str:'').join(' ');
 expect(text).toContain('Design V2');expect(text).toContain('DESIGN V2');expect(text).not.toContain('Design revision 19');expect(text).not.toContain('REVISION 19');
});
function world(u:number,v:number,depth:number){const sum=(depth+v)/1.5,diff=2*u/Math.sqrt(3);return{x:(sum+diff)/2,y:(sum-diff)/2,z:sum/2-v};}
function pixel(png:Uint8Array,x:number,y:number){const b=Buffer.from(png),width=b.readUInt32BE(16);let offset=8;const chunks:Buffer[]=[];while(offset<b.length){const size=b.readUInt32BE(offset),kind=b.toString('ascii',offset+4,offset+8);if(kind==='IDAT')chunks.push(b.subarray(offset+8,offset+8+size));offset+=12+size;}const bytes=inflateSync(Buffer.concat(chunks)),start=y*(1+3*width)+1+x*3;return [...bytes.subarray(start,start+3)];}
it('resolves crossing members per pixel instead of painting one whole triangle on top, and yields within the heartbeat budget',async()=>{
 const shape=[[-100,-100],[100,-100],[0,100]],red={points:shape.map(([u,v])=>world(u,v,100)),colour:[230,20,20],glass:false} as DocumentTriangle,blue={points:shape.map(([u,v],i)=>world(u,v,[-100,300,100][i])),colour:[20,20,230],glass:false} as DocumentTriangle;
 let yielded=false;setImmediate(()=>{yielded=true;});const png=await renderDocumentIsometric([red,blue],{width:320,height:240});expect(yielded).toBe(true);const left=pixel(png,105,85),right=pixel(png,215,85);expect(left[0]).toBeGreaterThan(left[2]);expect(right[2]).toBeGreaterThan(right[0]);
 const abort=new AbortController();setImmediate(()=>abort.abort(Error('retired')));await expect(renderDocumentIsometric([red,blue],{width:320,height:240,signal:abort.signal})).rejects.toThrow('retired');
});

// Capacity/PDF correctness budgets include native rendering and text extraction.
// The separate heartbeat/yield assertion above retains its existing bound.
it('preserves all32 products/65 register entries and full maximum-length names without drawing outside reserved A3 regions',async()=>{
 const source=studioDocumentCapacityFixture();expect(source.projectName.length).toBe(280);expect(source.products.every(p=>p.label.length===200)).toBe(true);expect(studioDocumentPages(parseStudioClientDocumentSource(source))).toHaveLength(65);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 async function items(index:number){const bytes=await renderStudioDocumentPage(source,index),document=await pdfjs.getDocument({data:bytes.slice()}).promise;return (await (await document.getPage(1)).getTextContent()).items.filter((item):item is Extract<typeof item,{str:string}>=>'str' in item);}
 const cover=await items(0),coverText=cover.map(item=>item.str).join('');for(let i=0;i<65;i++)expect(coverText).toContain(`A${String(i).padStart(2,'0')}`);
 expect(coverText.replace(/\s/g,'')).toContain(source.projectName);expect(coverText).toContain('Full pergola names appear on their drawing sheets.');
 const last=await items(63),lastText=last.map(item=>item.str).join('');expect(lastText.replace(/\s/g,'')).toContain(source.products[31].label.toUpperCase());expect(lastText).toContain('Project details: A00');expect(lastText).toContain('P32 / Roof plan');
 for(const item of [...cover,...last]){const x=item.transform[4],top=841.89-item.transform[5]-item.height;expect(x).toBeGreaterThanOrEqual(28-.01);expect(x+item.width).toBeLessThanOrEqual(1162+.1);expect(top).toBeGreaterThanOrEqual(28-.1);expect(top+item.height).toBeLessThanOrEqual(814+.1);}
}, 20_000);

it('flows complete canonical side-panel, blind and lighting details inside each sheet instead of overflowing fixed Extras rows',async()=>{
 const source=studioDocumentSelectionsFixture(),pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 expect(source.products[0].accessories.length).toBeGreaterThan(0);
 for(const index of [1,2]){
  const document=await pdfjs.getDocument({data:(await renderStudioDocumentPage(source,index)).slice()}).promise,content=await (await document.getPage(1)).getTextContent(),items=content.items.filter((item):item is Extract<typeof item,{str:string}>=>'str' in item),text=items.map(item=>item.str).join('');
  expect(text).toContain('SELECTED OPTIONS / COMPLETE SCHEDULE');expect(text).toContain('Selected: see schedule');
  for(const detail of [...source.products[0].extras.infills,...source.products[0].extras.blinds,...source.products[0].extras.lights])expect(text.replace(/\s/g,'')).toContain(detail.replace(/\s/g,''));
  for(const item of items){const x=item.transform[4],top=841.89-item.transform[5]-item.height;expect(x).toBeGreaterThanOrEqual(28-.1);expect(x+item.width).toBeLessThanOrEqual(1162+.1);expect(top).toBeGreaterThanOrEqual(28-.1);expect(top+item.height).toBeLessThanOrEqual(814+.1);}
 }
}, 40_000);

it('places the opaque isometric raster below the actual wrapped heading/subtitle instead of painting over extractable text',async()=>{
 const source=studioDocumentCapacityFixture(),draw=vi.spyOn(PDFPage.prototype,'drawImage');
 try{
  const bytes=await renderStudioDocumentPage(source,64),pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),document=await pdfjs.getDocument({data:bytes.slice()}).promise,content=await (await document.getPage(1)).getTextContent();
  const subtitle=content.items.find(item=>'str' in item&&item.str==='ISOMETRIC / ORTHOGRAPHIC / NTS');expect(subtitle&&'transform' in subtitle).toBe(true);if(!subtitle||!('transform' in subtitle))throw Error('Missing isometric subtitle');
  const [,placement]=draw.mock.calls.at(-1)!;const imageTop=841.89-placement!.y!-placement!.height!,subtitleBottom=841.89-subtitle.transform[5];expect(imageTop).toBeGreaterThanOrEqual(subtitleBottom+15.9);
 }finally{draw.mockRestore();}
}, 20_000);
