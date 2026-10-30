import {fonts} from './assets';
import {renderRefinedStudioDocumentPage} from './refinedRender';
import {renderApprovedStudioDocumentPage} from './approvedRender';
import {studioDocumentLayoutVersion,isApprovedStudioDocumentLayout} from './contract';
import {PDFDocument,rgb} from 'pdf-lib';
import {documentCoverLayout,compactDocumentSheetTitle} from './textLayout';
import {studioDocumentPages,type StudioClientDocumentSource} from './contract';
import {PAPER,INK,MUTED,line,text,wrapped,titleBar,drawingFrame,drawSelectionSupplement,boundedText,drawingHeading,type Fonts} from './layout';
import {drawProductPlan,polygon,leader} from './plan';
import {studioDocumentTriangles} from './mesh';
import {renderDocumentIsometric,trueIsometric,documentIsometricFrame} from './isometric';

/** A complete page is a durable restart checkpoint. Rendering is Node-only;
 * browser/camera state and live database reads are deliberately absent. */
export async function renderStudioDocumentPage(source:StudioClientDocumentSource,index:number,signal?:AbortSignal,totalPages?:number):Promise<Uint8Array>{
 signal?.throwIfAborted();const layout=studioDocumentLayoutVersion(source);if(isApprovedStudioDocumentLayout(layout))return renderApprovedStudioDocumentPage(source,index,signal,totalPages);if(layout==='studio-booklet-layout.v2')return renderRefinedStudioDocumentPage(source,index,signal);const sheets=studioDocumentPages(source),sheet=sheets[index];if(!sheet)throw Error('Invalid document page');
 const pdf=await PDFDocument.create(),page=pdf.addPage([PAPER.width,PAPER.height]),f=await fonts(pdf);
 pdf.setTitle(`${source.projectName} - ${sheet.label}`);pdf.setAuthor('Sanctuary Pergolas');pdf.setSubject('Concept design / Not for construction');
 pdf.setCreationDate(new Date(source.issuedAt));pdf.setModificationDate(new Date(source.issuedAt));
 let scale='NTS @ A3';
 if(sheet.kind==='cover'){
  const cover=documentCoverLayout(source,sheets,f.regular,f.semibold);
  boundedText(page,source.projectName,42,36,1108,cover.documentTitleY-47,28,f.semibold,INK,32);text(page,'Design booklet',42,cover.documentTitleY,16,f.medium);line(page,42,cover.ruleY,1150,cover.ruleY);
  text(page,'DRAWING REGISTER',42,cover.registerHeadingY,10,f.semibold);
  if(cover.ordinary){
   let y=cover.registerTop;for(const item of sheets){text(page,item.code,42,y,10,f.semibold);y=wrapped(page,item.label,84,y,202,10,f.regular)+10;}
   y+=12;y=wrapped(page,source.siteAddress,42,y,246,10,f.medium)+15;wrapped(page,cover.note,42,y,246,9,f.regular,MUTED);
  }else{
   text(page,'Full pergola names appear on their drawing sheets.',42,cover.registerHeadingY+13,7.5,f.regular,MUTED);
   for(const [i,item] of sheets.entries()){const column=Math.floor(i/cover.registerRows),row=i%cover.registerRows,x=42+column*cover.registerColumnWidth,y=cover.registerTop+row*cover.registerRowHeight;text(page,item.code,x,y,9.3,f.semibold);boundedText(page,compactDocumentSheetTitle(source,item),x+36,y,170,12,9.3,f.regular);}
   if(cover.notes){let y=wrapped(page,source.siteAddress,cover.notes.x,cover.notes.y,cover.notes.width,10,f.medium)+15;boundedText(page,cover.note,cover.notes.x,y,cover.notes.width,734-y,9,f.regular,MUTED,13);}
  }
  const outlines=[...source.houses.map(h=>({label:h.label,points:h.footprint,house:true})),...source.products.map(p=>{const r=p.pose.rotation*Math.PI/180;return{label:`${p.code} / ${p.label}`,points:p.plan.outline.map(v=>({x:p.pose.x+v.x*Math.cos(r)-v.y*Math.sin(r),y:p.pose.y+v.x*Math.sin(r)+v.y*Math.cos(r),z:0})),house:false};})];
  const points=outlines.flatMap(o=>o.points),xs=points.map(p=>p.x),ys=points.map(p=>p.y),loX=points.length?Math.min(...xs):0,hiX=points.length?Math.max(...xs):1,loY=points.length?Math.min(...ys):0,hiY=points.length?Math.max(...ys):1,s=Math.min(cover.overview.width/Math.max(hiX-loX,1),cover.overview.height/Math.max(hiY-loY,1));
  const map=(p:{x:number;y:number})=>({x:cover.overview.x+(cover.overview.width-(hiX-loX)*s)/2+(p.x-loX)*s,y:cover.overview.y+(cover.overview.height-(hiY-loY)*s)/2+(p.y-loY)*s});
  for(const o of outlines){polygon(page,o.points.map(map),o.house?rgb(.965,.953,.946):rgb(.93,.96,.94));const center=o.points.reduce((v,p)=>({x:v.x+p.x/o.points.length,y:v.y+p.y/o.points.length}),{x:0,y:0}),p=map(center);if(cover.ordinary&&f.medium.widthOfTextAtSize(o.label,10)<=180)text(page,o.label,p.x-45,p.y,10,f.medium);}
  for(const house of source.houses)for(const plane of house.roof)polygon(page,plane.map(map),rgb(.965,.953,.946),rgb(.76,.72,.69));
  for(const product of source.products){const r=product.pose.rotation*Math.PI/180,world=(p:{x:number;y:number})=>map({x:product.pose.x+p.x*Math.cos(r)-p.y*Math.sin(r),y:product.pose.y+p.x*Math.sin(r)+p.y*Math.cos(r)});
   for(const region of product.covering?.regions??[])polygon(page,region.boundary.map(world),region.material==='solid'?rgb(.78,.79,.73):rgb(.92,.96,.94));
   const members=[...product.plan.members.rafters,...product.plan.members.beams,...product.plan.members.ledgers,...product.plan.members.gutters,...product.plan.members.joiners,...product.plan.members.ridge];
   for(const member of members){const a=world(member.centerline.start),b=world(member.centerline.end);line(page,a.x,a.y,b.x,b.y,Math.max(.35,member.profile.widthMm*s),INK);}
   for(const m of product.plan.members.posts){const p=world(m.centerline.start),size=Math.max(2,m.profile.widthMm*s);page.drawRectangle({x:p.x-size/2,y:PAPER.height-p.y-size/2,width:size,height:size,color:INK});}
   const p=world(product.plan.outline.reduce((v,p)=>({x:v.x+p.x/product.plan.outline.length,y:v.y+p.y/product.plan.outline.length}),{x:0,y:0}));text(page,product.code,p.x-12,p.y-22,10,f.semibold);
  }
  text(page,'SAVED DESIGN ARRANGEMENT / NTS',cover.overview.x,cover.ordinary?706:cover.overview.y+cover.overview.height+2,cover.ordinary?9:8.5,f.medium,MUTED);
 }else{
  const product=source.products.find(p=>p.id===sheet.objectId);if(!product)throw Error('Frozen pergola unavailable');
  const supplement=drawingFrame(page,source,product,f);
  if(sheet.kind==='plan')scale=drawProductPlan(page,source,product,f,supplement?supplement.top-15:685);
  else{
   const headingBottom=drawingHeading(page,product,'ISOMETRIC / ORTHOGRAPHIC / NTS',f);
   const triangles=studioDocumentTriangles(product,source.joins),png=await renderDocumentIsometric(triangles,{signal});signal?.throwIfAborted();
   const image=await pdf.embedPng(png),imageTop=Math.max(105,headingBottom+16),imageBottom=supplement?supplement.top-20:700;const ratio=Math.min(870/image.width,(imageBottom-imageTop)/image.height),imageX=275+(870-image.width*ratio)/2;page.drawImage(image,{x:imageX,y:PAPER.height-imageTop-image.height*ratio,width:image.width*ratio,height:image.height*ratio});
   const frame=documentIsometricFrame(triangles),map=(p:{x:number;y:number;z:number})=>{const v=trueIsometric(p);return{x:imageX+(frame.ox+(v.x-frame.loX)*frame.scale)*ratio,y:imageTop+(frame.oy+(v.y-frame.loY)*frame.scale)*ratio};};
   const post=product.assembly.members.filter(m=>m.role==='post').sort((a,b)=>(b.centerline.start.x+b.centerline.start.y)-(a.centerline.start.x+a.centerline.start.y))[0];if(post)leader(page,f,map({x:post.centerline.start.x,y:post.centerline.start.y,z:(post.centerline.start.z+post.centerline.end.z)/2}),{x:280,y:206},['POSTS',`${post.profile.depthMm} x ${post.profile.widthMm} mm concept model section`]);
   const roof=product.assembly.roofPlanes[0];if(roof){const point=roof.boundary.reduce((v,p)=>({x:v.x+p.x/roof.boundary.length,y:v.y+p.y/roof.boundary.length,z:v.z+p.z/roof.boundary.length}),{x:0,y:0,z:0});leader(page,f,map(point),{x:930,y:Math.max(114,headingBottom+20)},[product.covering?'SELECTED ROOF ZONES':'ACRYLIC ROOF',product.frameFinish+' aluminium frame']);}
   const flashing=product.assembly.roofFlashings?.find(v=>v.metadata?.representativeGableRidge);if(flashing?.wings[0]){const points=flashing.wings[0].boundary,point=points.reduce((v,p)=>({x:v.x+p.x/points.length,y:v.y+p.y/points.length,z:v.z+p.z/points.length}),{x:0,y:0,z:0});leader(page,f,map(point),{x:965,y:Math.max(165,headingBottom+71)},['RIDGE FLASHING','Same geometry as Plan']);}
   text(page,'TRUE ISOMETRIC / ORTHOGRAPHIC',280,supplement?supplement.top-17:690,9,f.medium);text(page,'Same pergola, roof form and member geometry as the corresponding Plan sheet.',280,supplement?724:709,8,f.regular,MUTED);
  }
  if(supplement)drawSelectionSupplement(page,supplement,f);
 }
 titleBar(page,source,sheet,sheets.length,f,scale);signal?.throwIfAborted();return pdf.save();
}
export async function assembleStudioDocumentPages(pages:readonly Uint8Array[],signal?:AbortSignal){
 if(!pages.length)throw Error('No pergola drawings are available for this quote.');
 const pdf=await PDFDocument.create();for(const bytes of pages){signal?.throwIfAborted();const source=await PDFDocument.load(bytes);if(source.getPageCount()!==1)throw Error('A document checkpoint must contain one complete page');if(!pdf.getPageCount()){const issuedAt=source.getCreationDate();if(issuedAt){pdf.setCreationDate(issuedAt);pdf.setModificationDate(issuedAt);}}const [page]=await pdf.copyPages(source,[0]);pdf.addPage(page);await new Promise<void>(resolve=>setImmediate(resolve));}
 return pdf.save();
}
