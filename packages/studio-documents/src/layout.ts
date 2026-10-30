import {rgb,type PDFPage,type PDFFont,type Color} from 'pdf-lib';
import {documentTextLines,documentTextFits,compactDocumentSheetTitle,documentProjectLabel} from './textLayout';
import {studioDocumentHeightFacts} from './facts';
import type {StudioClientDocumentSource,StudioDocumentPage,StudioDocumentProduct} from './contract';
export const PAPER={width:1190.551,height:841.89};
export const INK=rgb(.145,.165,.145),MUTED=rgb(.376,.4,.36),RULE=rgb(.725,.753,.718),OLIVE=rgb(.945,.953,.929);
export type Fonts={regular:PDFFont;medium:PDFFont;semibold:PDFFont};
export function line(page:PDFPage,x:number,y:number,x2:number,y2:number,width=.5,colour:Color=RULE){page.drawLine({start:{x,y:PAPER.height-y},end:{x:x2,y:PAPER.height-y2},thickness:width,color:colour});}
export function box(page:PDFPage,x:number,y:number,width:number,height:number,fill?:Color,border:Color=RULE){page.drawRectangle({x,y:PAPER.height-y-height,width,height,color:fill,borderColor:border,borderWidth:.5});}
export function text(page:PDFPage,value:string,x:number,y:number,size:number,font:PDFFont,colour:Color=INK){page.drawText(value.replace(/\u2014/g,',').replace(/[\r\n]+/g,' '),{x,y:PAPER.height-y-size,size,font,color:colour});}
export function wrapped(page:PDFPage,value:string,x:number,y:number,width:number,size:number,font:PDFFont,colour:Color=INK,leading=size+4){
 const lines=documentTextLines(value,width,size,font);lines.forEach((value,index)=>text(page,value,x,y+index*leading,size,font,colour));return y+lines.length*leading;
}
/** Native A3 geometry and roles from the approved 27 October title bar. */
export function titleBar(page:PDFPage,source:StudioClientDocumentSource,sheet:StudioDocumentPage,total:number,fonts:Fonts,scale:string){
 box(page,28,766,1134,48,OLIVE,OLIVE);line(page,28,766,1162,766,1,rgb(.325,.42,.353));
 for(const x of [213,445,775,948])line(page,x,774,x,806,.4);
 box(page,1050,766,112,48,rgb(0,0,0),rgb(0,0,0));
 text(page,'SANCTUARY PERGOLAS',38,774,11,fonts.semibold);text(page,'CONCEPT / NOT FOR CONSTRUCTION',38,799,7,fonts.medium);
 text(page,'PROJECT',224,774,7.2,fonts.medium,MUTED);const projectTitle=documentProjectLabel(source,210,24,10,fonts.medium,12);boundedText(page,projectTitle,224,785,210,24,10,fonts.medium,INK,12);
 text(page,'DRAWING',456,774,7.2,fonts.medium,MUTED);const drawingTitle=fonts.semibold.widthOfTextAtSize(sheet.label,12)<=308?sheet.label:compactDocumentSheetTitle(source,sheet);boundedText(page,drawingTitle,456,785,308,14,12,fonts.semibold);
 text(page,`Design ${source.designVersionLabel} / Dimensions in mm`,456,801,7,fonts.regular,MUTED);
 text(page,'DATE',786,774,7.2,fonts.medium,MUTED);text(page,source.issuedDate,786,785,9,fonts.medium);
 text(page,'DRAWN       CHECKED',786,801,7.2,fonts.regular,MUTED);
 text(page,'SCALE',959,774,7.2,fonts.medium,MUTED);text(page,scale,959,785,9,fonts.medium);text(page,`DESIGN ${source.designVersionLabel}`,959,801,8,fonts.semibold);
 const codeWidth=fonts.semibold.widthOfTextAtSize(sheet.code,24);text(page,sheet.code,1106-codeWidth/2,769,24,fonts.semibold,rgb(1,1,1));
 const number=`${String(sheet.index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;text(page,number,1106-fonts.medium.widthOfTextAtSize(number,8)/2,800,8,fonts.medium,rgb(1,1,1));
}
function section(page:PDFPage,fonts:Fonts,y:number,height:number,label:string){box(page,38,y,205,height);line(page,38,y+20,243,y+20);text(page,label,46,y+6,9,fonts.medium);}
export function drawingFrame(page:PDFPage,source:StudioClientDocumentSource,product:StudioDocumentProduct,fonts:Fonts){
 const supplement=selectionSupplement(product,fonts);
 box(page,28,28,1134,706);line(page,255,28,255,734);
 section(page,fonts,38,94,'PROPERTY / DESIGN');const property=documentTextFits(source.projectName,188,30,10,fonts.semibold)?source.projectName:'Project details: A00';boundedText(page,property,46,64,188,30,10,fonts.semibold);const productTitle=`${product.code} / ${product.label}`;boundedText(page,fonts.medium.widthOfTextAtSize(productTitle,10)<=188?productTitle:`${product.code} / See drawing heading`,46,100,188,12,10,fonts.medium);text(page,`Roof outline: ${(product.widthMm*product.projectionMm/1e6).toFixed(1)} m²`,46,116,8,fonts.regular,MUTED);
 section(page,fonts,143,74,'COLOUR / FINISH');box(page,50,175,30,26,product.frameFinish==='Black'?INK:rgb(.97,.97,.96));text(page,product.frameFinish.toUpperCase(),92,173,11,fonts.medium);text(page,'Aluminium frame',92,191,9,fonts.regular);
 section(page,fonts,227,190,'SPECIFICATIONS');
 let y=255;y=wrapped(page,supplement?'Roof selection: see schedule':product.roofMaterial,46,y,185,9.5,fonts.regular)+7;
 const roles=[['BEAMS',['beam','ledger']],['RAFTERS',['rafter']],['POSTS',['post']],['GUTTER',['gutter']]] as const;
 for(const [label,kinds] of roles){const sizes=[...new Set(product.assembly.members.filter(m=>(kinds as readonly string[]).includes(m.role)).map(m=>m.profile.profileKey?.startsWith('sp_')?m.profile.profileKey.replaceAll('_',' '):`${m.profile.depthMm} x ${m.profile.widthMm} mm`))];text(page,label,46,y,7.5,fonts.medium,MUTED);y=wrapped(page,sizes.join(' / ')||'Not present',110,y-1,123,9,fonts.regular)+5;}
 text(page,'Concept model sections',46,400,8,fonts.regular,MUTED);
 section(page,fonts,427,170,'HEAD HEIGHTS');text(page,'Heights above model base',46,454,8.5,fonts.regular,MUTED);
 const heights=studioDocumentHeightFacts(product),lo=heights.eaves[0],hi=heights.eaves.at(-1)!;
 text(page,product.assembly.family==='gable'?'MAIN EAVE BEAM UNDERSIDE':'MAIN BEARING UNDERSIDE',46,537,8,fonts.medium,MUTED);
 text(page,lo===hi?`${(lo/1000).toFixed(3)} m`:`High ${(hi/1000).toFixed(3)} m / Low ${(lo/1000).toFixed(3)} m`,46,552,9.2,fonts.regular);
 if(heights.ridgeTop!==null)text(page,`Ridge beam top ${(heights.ridgeTop/1000).toFixed(3)} m`,46,567,8.7,fonts.regular);
 text(page,'Concept datum, not a surveyed slab level',46,581,7.6,fonts.regular,MUTED);
 const fall=product.assembly.roofPlanes[0]?.fallVector??{x:0,y:1},length=Math.hypot(fall.x,fall.y)||1;
 const axis=(p:{x:number;y:number})=>(p.x*fall.x+p.y*fall.y)/length;
 const roofLines=product.assembly.roofPlanes.flatMap(p=>p.boundary),maxZ=Math.max(...roofLines.map(p=>p.z)),minZ=Math.min(...roofLines.map(p=>p.z)),minRun=Math.min(...roofLines.map(axis)),maxRun=Math.max(...roofLines.map(axis));
 const profileScale=Math.min(157/Math.max(maxRun-minRun,1),48/Math.max(maxZ-minZ,1));
 for(const plane of product.assembly.roofPlanes){for(let i=0;i<plane.boundary.length;i++){const a=plane.boundary[i],b=plane.boundary[(i+1)%plane.boundary.length];line(page,58+(axis(a)-minRun)*profileScale,522-(a.z-minZ)*profileScale,58+(axis(b)-minRun)*profileScale,522-(b.z-minZ)*profileScale,1,INK);}}
 if(heights.pitchDeg!==null)text(page,`${Math.round(heights.pitchDeg*10)/10}°`,189,472,9,fonts.medium);
 section(page,fonts,607,127,'EXTRAS');let extraY=633;
 for(const [label,key] of [['INFILLS','infills'],['BLINDS','blinds'],['LIGHTS','lights']] as const){text(page,label,46,extraY,7.5,fonts.medium);const details=product.extras[key].join('; ')||'None selected';extraY=wrapped(page,supplement&&product.extras[key].length?'Selected: see schedule':details,46,extraY+9,188,7.6,fonts.regular,MUTED,9)+3;}
 return supplement;
}

/** Approved font roles stay fixed. A caller must choose an accurate reference
 * or a deliberate flowing layout before a field would overflow. */
export function boundedText(page:PDFPage,value:string,x:number,y:number,width:number,height:number,size:number,font:PDFFont,colour:Color=INK,leading=size+4){
 if(!documentTextFits(value,width,height,size,font,leading))throw Error('Drawing text exceeds its reserved field');
 const lines=documentTextLines(value,width,size,font);lines.forEach((value,index)=>text(page,value,x,y+index*leading,size,font,colour));return y+Math.max(0,lines.length-1)*leading+size;
}
export function drawingHeading(page:PDFPage,product:StudioDocumentProduct,subtitle:string,fonts:Fonts){
 const bottom=boundedText(page,`${product.code} / ${product.label.toUpperCase()}`,276,40,866,60,13,fonts.semibold,INK,15);
 const subtitleY=Math.max(64,bottom+11);boundedText(page,subtitle,276,subtitleY,866,12,10,fonts.medium,MUTED);return subtitleY+10;
}

export type SelectionSupplement={top:number;height:number;rows:string[]};
/** Long supported selections receive a measured in-sheet schedule. Full values
 * remain visible; the normal approved sidebar and drawing are unchanged. */
function selectionSupplement(product:StudioDocumentProduct,fonts:Fonts):SelectionSupplement|null{
 let extraHeight=0;for(const key of ['infills','blinds','lights'] as const)extraHeight+=9+documentTextLines(product.extras[key].join('; ')||'None selected',188,7.6,fonts.regular).length*9+3;
 let specHeight=documentTextLines(product.roofMaterial,185,9.5,fonts.regular).length*13.5+7;
 for(const kinds of [['beam','ledger'],['rafter'],['post'],['gutter']]){const sizes=[...new Set(product.assembly.members.filter(m=>kinds.includes(m.role)).map(m=>m.profile.profileKey?.startsWith('sp_')?m.profile.profileKey.replaceAll('_',' '):`${m.profile.depthMm} x ${m.profile.widthMm} mm`))];specHeight+=documentTextLines(sizes.join(' / ')||'Not present',123,9,fonts.regular).length*13+5;}
 if(extraHeight<=97&&specHeight<=140)return null;
 const extras=[...product.extras.infills,...product.extras.blinds,...product.extras.lights];
 const rows=[...new Set([product.roofMaterial,...extras,...product.selectedDetails.filter(detail=>!product.roofMaterial.includes(detail))])];
 const height=29+rows.reduce((sum,row)=>sum+documentTextLines(row,850,8.5,fonts.regular).length*11+5,0)+8;
 if(height>400)throw Error('The complete selected options exceed the supported drawing schedule');
 return{top:714-height,height,rows};
}
export function drawSelectionSupplement(page:PDFPage,supplement:SelectionSupplement,fonts:Fonts){
 box(page,276,supplement.top,866,supplement.height);text(page,'SELECTED OPTIONS / COMPLETE SCHEDULE',284,supplement.top+7,9.5,fonts.semibold);line(page,276,supplement.top+23,1142,supplement.top+23);
 let y=supplement.top+29;for(const row of supplement.rows)y=boundedText(page,row,284,y,850,714-y-5,8.5,fonts.regular,INK,11)+5;
}
