import type {PDFFont} from 'pdf-lib';
import type {StudioClientDocumentSource,StudioDocumentPage} from './contract';
/** Exact measured wrapping, including long unbroken names. Never discard text. */
export function documentTextLines(value:string,width:number,size:number,font:Pick<PDFFont,'widthOfTextAtSize'>):string[]{
 const lines:string[]=[];let current='';
 for(const word of value.replace(/\u2014/g,',').trim().split(/\s+/)){
  if(!word)continue;
  if(font.widthOfTextAtSize(word,size)>width){
   if(current)current+=' ';
   for(const character of Array.from(word)){
    if(current&&font.widthOfTextAtSize(current+character,size)>width){lines.push(current);current='';}
    current+=character;
   }
  }else if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){lines.push(current);current=word;}
  else current=current?current+' '+word:word;
 }
 if(current)lines.push(current);return lines;
}
export function documentTextFits(value:string,width:number,height:number,size:number,font:Pick<PDFFont,'widthOfTextAtSize'>,leading=size+4){
 const lines=documentTextLines(value,width,size,font);return !lines.length||(lines.length-1)*leading+size<=height;
}
/** New drawing-only sets have no A00 to reference. Use an explicit ellipsis
 * for the bounded project label while retaining its full frozen metadata. */
export function documentProjectLabel(source:StudioClientDocumentSource,width:number,height:number,size:number,font:Pick<PDFFont,'widthOfTextAtSize'>,leading=size+4){
 if(documentTextFits(source.projectName,width,height,size,font,leading))return source.projectName;
 if(source.layoutVersion!=='studio-booklet-layout.v4')return 'Project details: A00';
 const characters=Array.from(source.projectName);while(characters.length&&!documentTextFits(characters.join('')+'…',width,height,size,font,leading))characters.pop();
 return characters.join('')+'…';
}
export function compactDocumentSheetTitle(source:StudioClientDocumentSource,sheet:StudioDocumentPage){
 if(sheet.kind==='cover')return 'Overview and register';
 const product=source.products.find(p=>p.id===sheet.objectId);if(!product)throw Error('Frozen pergola unavailable');
 if((source.layoutVersion==='studio-booklet-layout.v3'||source.layoutVersion==='studio-booklet-layout.v4'))return `${product.code} / ${{plan:'Plan',iso:'Iso',elevation:'Elev',lighting:'RCP','blind-plan':'Blinds','blind-elevation':'Blind elev',cover:'Overview'}[sheet.kind]}`;
 return `${product.code} / ${sheet.kind==='plan'?'Roof plan':'Isometric'}`;
}
/** Normal sets keep the approved one-column register and large overview.
 * Large sets use exact sheet-code references; full names stay on each sheet.
 * A long project heading moves the body down, retaining the approved 28pt role. */
export function documentCoverLayout(source:StudioClientDocumentSource,sheets:StudioDocumentPage[],font:PDFFont,headingFont:PDFFont=font){
 const headingLines=documentTextLines(source.projectName,1108,28,headingFont);
 const documentTitleY=Math.max(75,36+Math.max(0,headingLines.length-1)*32+28+11);
 const ruleY=documentTitleY+35,registerHeadingY=ruleY+27,registerTop=ruleY+54;
 const note=`Design ${source.designVersionLabel}. Drawings show the saved concept geometry and selected options. Model sections and heights are concept information, not a fabrication schedule or surveyed site levels.`;
 const ordinaryRegisterHeight=sheets.reduce((height,item)=>height+documentTextLines(item.label,202,10,font).length*14+10,0);
 const after=registerTop+ordinaryRegisterHeight+12+documentTextLines(source.siteAddress,246,10,font).length*14+15+documentTextLines(note,246,9,font).length*13;
 const ordinary=after<=724&&ruleY===110&&sheets.every(item=>documentTextFits(item.label,202,56,10,font));
 if(ordinary)return {ordinary,documentTitleY,ruleY,registerHeadingY,registerTop,note,registerColumns:1,registerRows:sheets.length,registerColumnWidth:246,registerRowHeight:15,overview:{x:340,y:150,width:770,height:525},notes:null};
 const available=734-registerTop,rowHeight=15;
 const registerRows=Math.floor(available/rowHeight),registerColumns=Math.ceil(sheets.length/registerRows);
 if(registerRows<1||registerColumns>3)throw Error('The complete drawing register exceeds its supported A3 layout');
 const registerColumnWidth=210,overviewX=42+registerColumns*registerColumnWidth+30,overviewWidth=1150-overviewX;
 const addressHeight=documentTextLines(source.siteAddress,overviewWidth,10,font).length*14;
 const noteHeight=documentTextLines(note,overviewWidth,9,font).length*13;
 const notesHeight=addressHeight+15+noteHeight;
 const overviewHeight=available-notesHeight-28;
 if(overviewWidth<350||overviewHeight<100)throw Error('The complete cover exceeds its supported A3 layout');
 return {ordinary,documentTitleY,ruleY,registerHeadingY,registerTop,note,registerColumns,registerRows,registerColumnWidth,registerRowHeight:rowHeight,overview:{x:overviewX,y:registerTop,width:overviewWidth,height:overviewHeight},notes:{x:overviewX,y:registerTop+overviewHeight+15,width:overviewWidth}};
}
