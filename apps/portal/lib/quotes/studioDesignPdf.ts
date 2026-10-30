import type {PDFDocument,PDFPage,PDFFont,Color} from 'pdf-lib';
import type {StudioQuoteView} from '@sp/quote-format';
const lineHeight=(size:number)=>size+6;
const specificationLabelSize=11,specificationDetailSize=9.5;
function wrap(text:string,font:PDFFont,size:number,width:number){const lines:string[]=[];let line='';for(const word of text.split(/\s+/)){const next=line?`${line} ${word}`:word;if(line&&font.widthOfTextAtSize(next,size)>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
/** Existing quote pages and footer owner remain in pdf.ts; this owner only lays out frozen design content. */
export async function appendStudioDesignPages(args:{pdf:PDFDocument;design:StudioQuoteView;page:()=>{page:PDFPage;top:number};regular:PDFFont;semibold:PDFFont;ink:Color;muted:Color;x:number;width:number;bottom:number}){
 const {pdf,design,regular,semibold,ink,muted,x,width,bottom}=args;
 let current!:ReturnType<typeof args.page>,y=0,specificationContinuation=false;
 const nextPage=(specification=false)=>{current=args.page();y=current.top;specificationContinuation=specification;};
 const text=(value:string,size=10,font=regular,color=ink,specification=false)=>{for(const line of wrap(value,font,size,width)){if(y-lineHeight(size)<bottom)nextPage(specification);current.page.drawText(line,{x,y,size,font,color});y-=lineHeight(size);}};
 for(const image of design.images){
  const png=await pdf.embedPng(Buffer.from(image.dataUrl.split(',')[1],'base64'));
  const dimensions=png.scale(Math.min(width/png.width,(image.kind==='perspective'?340:470)/png.height));
  const heading=image.kind==='perspective'?'Your design':'Your design: Plan',revision=`Design revision ${design.revision}`;
  const caption='The design and views on these pages are the saved version included with this quote.';
  const blockHeight=wrap(heading,semibold,20,width).length*lineHeight(20)+5
   +wrap(revision,regular,9,width).length*lineHeight(9)+12+dimensions.height+24
   +(image.kind==='perspective'?0:wrap(caption,regular,9,width).length*lineHeight(9));
  // An image keeps its ordinary fresh page unless the preceding specification
  // spilled and its continuation has room for this entire image block.
  if(!specificationContinuation||y-blockHeight<bottom)nextPage();
  specificationContinuation=false;
  text(heading,20,semibold);y-=5;
  text(revision,9,regular,muted);y-=12;
  current.page.drawImage(png,{x:x+(width-dimensions.width)/2,y:y-dimensions.height,width:dimensions.width,height:dimensions.height});y-=dimensions.height+24;
  if(image.kind==='perspective')for(const section of design.selections){
   const height=wrap(section.label,semibold,specificationLabelSize,width).length*lineHeight(specificationLabelSize)+section.details.reduce((sum,detail)=>sum+wrap(detail,regular,specificationDetailSize,width).length*lineHeight(specificationDetailSize),0);
   // Keep an item together only when it fits a fresh page. Long retained
   // specifications keep the existing line-by-line pagination.
   if(height<=current.top-bottom&&y-height<bottom)nextPage(true);
   text(section.label,specificationLabelSize,semibold,ink,true);for(const detail of section.details)text(detail,specificationDetailSize,regular,ink,true);y-=10;
  }
  else text(caption,9,regular,muted);
 }
}
