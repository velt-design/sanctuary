import type {PDFDocument,PDFPage,PDFFont,Color} from 'pdf-lib';
import type {StudioQuoteView} from '@sp/quote-format';
function wrap(text:string,font:PDFFont,size:number,width:number){const lines:string[]=[];let line='';for(const word of text.split(/\s+/)){const next=line?`${line} ${word}`:word;if(line&&font.widthOfTextAtSize(next,size)>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
/** Existing quote pages and footer owner remain in pdf.ts; this owner only lays out frozen design content. */
export async function appendStudioDesignPages(args:{pdf:PDFDocument;design:StudioQuoteView;page:()=>{page:PDFPage;top:number};regular:PDFFont;semibold:PDFFont;ink:Color;muted:Color;x:number;width:number;bottom:number}){
 const {pdf,design,regular,semibold,ink,muted,x,width,bottom}=args;
 for(const image of design.images){
  let current=args.page(),y=current.top;
  const text=(value:string,size=10,font=regular,color=ink)=>{for(const line of wrap(value,font,size,width)){if(y-size-6<bottom){current=args.page();y=current.top;}current.page.drawText(line,{x,y,size,font,color});y-=size+6;}};
  text(image.kind==='perspective'?'Your design':'Your design: Plan',20,semibold);y-=5;
  text(`Design revision ${design.revision}`,9,regular,muted);y-=12;
  const png=await pdf.embedPng(Buffer.from(image.dataUrl.split(',')[1],'base64'));
  const dimensions=png.scale(Math.min(width/png.width,(image.kind==='perspective'?340:470)/png.height));
  current.page.drawImage(png,{x:x+(width-dimensions.width)/2,y:y-dimensions.height,width:dimensions.width,height:dimensions.height});y-=dimensions.height+24;
  if(image.kind==='perspective')for(const section of design.selections){text(section.label,11,semibold);for(const detail of section.details)text(detail,9.5);y-=10;}
  else text('The design and views on these pages are the saved version included with this quote.',9,regular,muted);
 }
}
