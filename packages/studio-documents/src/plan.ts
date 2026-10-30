import {rgb,pushGraphicsState,popGraphicsState,rectangle,clip,endPath,type PDFPage} from 'pdf-lib';
import type {Point3} from '@sp/geometry';
import type {StudioClientDocumentSource,StudioDocumentProduct} from './contract';
import {PAPER,INK,MUTED,RULE,line,text,drawingHeading,type Fonts} from './layout';
const PT_PER_MM=72/25.4;
export function worldToProduct(p:Point3,product:StudioDocumentProduct){const r=-product.pose.rotation*Math.PI/180,x=p.x-product.pose.x,y=p.y-product.pose.y;return{x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r),z:p.z};}
export function polygon(page:PDFPage,points:{x:number;y:number}[],fill=rgb(.91,.94,.92),stroke=RULE,width=.5){if(points.length<3)return;page.drawSvgPath(points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')+' Z',{x:0,y:PAPER.height,color:fill,borderColor:stroke,borderWidth:width});}
export function dimension(page:PDFPage,fonts:Fonts,a:{x:number;y:number},b:{x:number;y:number},label:string,offset:number,vertical=false){
 if(vertical){const x=a.x+offset;line(page,a.x,a.y,x+7,a.y);line(page,b.x,b.y,x+7,b.y);line(page,x,a.y,x,b.y,.5,INK);line(page,x-3,a.y+3,x+3,a.y-3,.6,INK);line(page,x-3,b.y+3,x+3,b.y-3,.6,INK);text(page,label,x+7,(a.y+b.y)/2-6,10,fonts.medium);}
 else{const y=a.y+offset;line(page,a.x,a.y,a.x,y-7);line(page,b.x,b.y,b.x,y-7);line(page,a.x,y,b.x,y,.5,INK);line(page,a.x-3,y+3,a.x+3,y-3,.6,INK);line(page,b.x-3,y+3,b.x+3,y-3,.6,INK);const w=fonts.medium.widthOfTextAtSize(label,10);page.drawRectangle({x:(a.x+b.x-w)/2-3,y:PAPER.height-y-2,width:w+6,height:13,color:rgb(1,1,1)});text(page,label,(a.x+b.x-w)/2,y-12,10,fonts.medium);}
}
export function leader(page:PDFPage,fonts:Fonts,anchor:{x:number;y:number},label:{x:number;y:number},lines:string[]){
 const right=label.x>anchor.x,elbow={x:right?label.x-14:label.x+150,y:label.y+9};line(page,anchor.x,anchor.y,elbow.x,elbow.y,.55,INK);line(page,elbow.x,elbow.y,right?label.x-4:label.x+145,elbow.y,.55,INK);
 const angle=Math.atan2(elbow.y-anchor.y,elbow.x-anchor.x);line(page,anchor.x,anchor.y,anchor.x+4*Math.cos(angle-.4),anchor.y+4*Math.sin(angle-.4),.7,INK);line(page,anchor.x,anchor.y,anchor.x+4*Math.cos(angle+.4),anchor.y+4*Math.sin(angle+.4),.7,INK);
 lines.forEach((value,i)=>text(page,value,label.x,label.y+i*12,8.5,i?fonts.regular:fonts.medium));
}
export function drawProductPlan(page:PDFPage,source:StudioClientDocumentSource,product:StudioDocumentProduct,fonts:Fonts,drawingBottom=685){
 const outline=product.plan.outline,xs=outline.map(p=>p.x),ys=outline.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const flowHeight=drawingBottom===685?410:Math.max(50,drawingBottom-177-60);const limit=Math.min(690/(maxX-minX),flowHeight/(maxY-minY));const denominator=[20,25,40,50,75,100,150,200].find(d=>PT_PER_MM/d<=limit)??250,scale=PT_PER_MM/denominator;
 const x0=298+(740-(maxX-minX)*scale)/2,y0=177+((drawingBottom===685?470:flowHeight)-(maxY-minY)*scale)/2;
 const map=(p:{x:number;y:number})=>({x:x0+(p.x-minX)*scale,y:y0+(p.y-minY)*scale});
 drawingHeading(page,product,`PROPOSED ROOF PLAN / 1:${denominator} @ A3`,fonts);
 page.pushOperators(pushGraphicsState(),rectangle(275,PAPER.height-drawingBottom,860,drawingBottom-110),clip(),endPath());
 for(const house of source.houses){polygon(page,house.footprint.map(p=>map(worldToProduct(p,product))),rgb(.966,.953,.946),rgb(.69,.63,.62));for(const roof of house.roof)polygon(page,roof.map(p=>map(worldToProduct(p,product))),rgb(.966,.953,.946),rgb(.79,.75,.72));}
 polygon(page,outline.map(map),rgb(.94,.97,.96),rgb(.28,.32,.28),.8);
 for(const region of product.covering?.regions??[])polygon(page,region.boundary.map(map),region.material==='solid'?rgb(.78,.78,.72):rgb(.92,.96,.95),RULE,.3);
 const members=[...product.plan.members.rafters,...product.plan.members.beams,...product.plan.members.ledgers,...product.plan.members.gutters,...product.plan.members.joiners,...product.plan.members.ridge];
 for(const m of members){const a=map(m.centerline.start),b=map(m.centerline.end);line(page,a.x,a.y,b.x,b.y,Math.max(.6,m.profile.widthMm*scale),m.role==='rafter'?rgb(.56,.6,.55):INK);if(m.profile.widthMm*scale>1.2)line(page,a.x,a.y,b.x,b.y,Math.max(.3,m.profile.widthMm*scale-.7),product.frameFinish==='White'?rgb(.94,.95,.93):rgb(.36,.4,.36));}
 for(const m of product.plan.members.posts){const p=map(m.centerline.start),w=Number(m.metadata?.footprintWidthMm??m.profile.widthMm)*scale,h=Number(m.metadata?.footprintProjectionMm??m.profile.widthMm)*scale;page.drawRectangle({x:p.x-w/2,y:PAPER.height-p.y-h/2,width:w,height:h,color:INK});}
 for(const flashing of product.assembly.roofFlashings??[])for(const wing of flashing.wings)polygon(page,wing.boundary.map(map),rgb(.68,.72,.67),INK,.4);
 for(const join of source.joins.filter(j=>j.objectIds.includes(product.id)))for(const points of join.polygons){const world=points.map(p=>map(worldToProduct(p,product)));for(let i=1;i<world.length;i++)line(page,world[i-1].x,world[i-1].y,world[i].x,world[i].y,1.5,rgb(.45,.37,.27));}
 for(const m of product.accessories){const points=Array.from({length:m.positions.length/3},(_,i)=>map({x:m.positions[3*i],y:m.positions[3*i+1]}));if(m.kind==='light'){if(points.length>2)polygon(page,points,rgb(.84,.65,.25),INK,.3);else if(points.length===2)line(page,points[0].x,points[0].y,points[1].x,points[1].y,2,rgb(.84,.65,.25));}else for(let i=0;i<m.indices.length;i+=3)polygon(page,[points[m.indices[i]],points[m.indices[i+1]],points[m.indices[i+2]]],m.kind==='timber'?rgb(.7,.54,.36):m.kind==='acrylic'?rgb(.89,.94,.92):rgb(.3,.35,.3),RULE,.2);}
 page.pushOperators(popGraphicsState());
 const a=map({x:minX,y:minY}),b=map({x:maxX,y:minY}),c=map({x:maxX,y:maxY});
 dimension(page,fonts,a,b,(maxX-minX).toLocaleString('en-NZ'),-43);dimension(page,fonts,b,c,(maxY-minY).toLocaleString('en-NZ'),42,true);
 const posts=product.plan.members.posts.filter(p=>Math.abs(p.centerline.start.y-maxY)<300).map(p=>p.centerline.start.x).sort((a,b)=>a-b);
 for(let i=1;i<posts.length;i++)dimension(page,fonts,map({x:posts[i-1],y:minY}),map({x:posts[i],y:minY}),Math.round(posts[i]-posts[i-1]).toLocaleString('en-NZ'),-19);
 if(posts.length>1)text(page,'POST CENTRES',x0+(maxX-minX)*scale/2-29,y0-13,7,fonts.regular,MUTED);
 for(const plane of product.assembly.roofPlanes){const centroid=plane.boundary.reduce((n,p)=>({x:n.x+p.x/plane.boundary.length,y:n.y+p.y/plane.boundary.length}),{x:0,y:0}),p=map(centroid),fall=plane.fallVector,magnitude=Math.hypot(fall.x,fall.y);if(magnitude){const dx=fall.x/magnitude,dy=fall.y/magnitude,tip={x:p.x+dx*16,y:p.y+dy*16};line(page,p.x-dx*16,p.y-dy*16,tip.x,tip.y,.6,INK);line(page,tip.x,tip.y,tip.x-dx*5-dy*3,tip.y-dy*5+dx*3,.6,INK);line(page,tip.x,tip.y,tip.x-dx*5+dy*3,tip.y-dy*5-dx*3,.6,INK);const normal=plane.plane.normal,pitch=Math.atan2(Math.hypot(normal.x,normal.y),Math.abs(normal.z))*180/Math.PI;text(page,`${Math.round(pitch*10)/10}°`,p.x+11,p.y-12,8.5,fonts.medium);}}
 const center=(points:{x:number;y:number}[])=>map(points.reduce((v,p)=>({x:v.x+p.x/points.length,y:v.y+p.y/points.length}),{x:0,y:0}));
 const acrylic=product.covering?.regions.find(r=>r.material==='acrylic'),solid=product.covering?.regions.find(r=>r.material==='solid');
 if(acrylic)leader(page,fonts,center(acrylic.boundary),{x:914,y:118},['ACRYLIC SKYLIGHT','Selected roof allocation']);
 if(solid)leader(page,fonts,center(solid.boundary),{x:281,y:140},['SOLID ROOF ZONE','Selected roof material / ceiling']);
 if(!solid&&!acrylic)leader(page,fonts,center(product.plan.outline),{x:281,y:140},['ACRYLIC ROOF',product.frameFinish+' aluminium frame']);
 const flashing=product.assembly.roofFlashings?.find(f=>f.metadata?.representativeGableRidge);
 if(flashing?.wings[0])leader(page,fonts,center(flashing.wings[0].boundary),{x:935,y:167},['RIDGE FLASHING','As shown in the concept model']);
 const gutters=product.assembly.members.filter(m=>m.role==='gutter').sort((a,b)=>a.centerline.start.z-b.centerline.start.z);
 if(gutters[0]){const m=gutters[0],anchor=map({x:(m.centerline.start.x+m.centerline.end.x)/2,y:(m.centerline.start.y+m.centerline.end.y)/2});leader(page,fonts,anchor,{x:955,y:drawingBottom===685?665:Math.min(665,drawingBottom-30)},[product.assembly.family==='gable'?'EAVE GUTTER':'LOW-EDGE GUTTER','Outlet / site drainage not specified']);}
 text(page,'Roof outline and selected concept geometry. Dimensions in mm. Full house and arrangement: see A00.',280,drawingBottom===685?712:724,8,fonts.regular,MUTED);
 return `1:${denominator} @ A3`;
}
