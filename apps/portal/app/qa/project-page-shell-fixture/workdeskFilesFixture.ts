import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import { previewBatchRequest } from '@/lib/projects/sharePointFiles/previews/contracts';

const projectRoot='10000000-0000-4000-8000-000000000001';
const archiveRoot='10000000-0000-4000-8000-000000000002';

/** Finite fictional originals shared by the fixture preview and native download. */
function pdf(lines:string[]):Uint8Array {
  const content='BT /F1 13 Tf 48 780 Td '+lines.map((line,index)=>`${index?'0 -23 Td ':''}(${line.replace(/[\\()]/g,'\\$&')}) Tj`).join('\n')+' ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let text='%PDF-1.4\n';const offsets=[0];
  objects.forEach((object,index)=>{offsets.push(text.length);text+=`${index+1} 0 obj\n${object}\nendobj\n`;});
  const xref=text.length;text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(text);
}
export const workdeskFileRecords=[
  {id:'quote-document',name:'Current quote - commercial sample.pdf',folder:'documents',root:'root-project',mime:'application/pdf',bytes:pdf(['SANCTUARY - SYNTHETIC COMMERCIAL DOCUMENT','Project: Sample Takapuna outdoor living','Current quote: Q-CLARITY / version 3','The actual Commercial tab owns the stored agreement and totals.','Supply and installation: see the current quote record.','This document is a controlled file-preview fixture.','No invoice, payment, acceptance or send is performed.'])},
  {id:'site-notes',name:'Site information - sample.pdf',folder:'site',root:'root-project',mime:'application/pdf',bytes:pdf(['SANCTUARY - SYNTHETIC SITE NOTES','Project: Sample Takapuna outdoor living','Access and dimensions require site confirmation.','Customer wants weather protection and retained daylight.','Do not use this fictional note as engineering approval.'])},
  {id:'roof-question',name:'Roof options question.pdf',folder:'documents',root:'root-project',mime:'application/pdf',bytes:pdf(['SANCTUARY - CUSTOMER QUESTION','Compare the current roof options before the next discussion.','Obtain the actual manufacturer specifications.','No technical transmission values are invented in this fixture.'])},
  {id:'source-original',name:'Concept-source.svg',folder:'site',root:'root-project',mime:'image/svg+xml',bytes:new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#faf7f0"/><text x="30" y="50" font-family="sans-serif" font-size="20">Synthetic concept source</text><text x="30" y="90" font-family="sans-serif">Not a site survey or engineering drawing.</text><rect x="90" y="140" width="440" height="180" fill="none" stroke="#302f28"/><text x="190" y="240" font-family="sans-serif">Proposed cover area</text></svg>')},
  {id:'earlier-proposal',name:'Earlier proposal - historical.pdf',folder:'',root:'root-archive',mime:'application/pdf',bytes:pdf(['SANCTUARY - HISTORICAL SAMPLE','Earlier proposal, retained as an original source.','The Commercial tab remains authoritative for versions and prices.','This file cannot be accepted or paid.'])},
  {id:'enquiry-receipt',name:'Website enquiry attachment.pdf',folder:'',root:'website',mime:'application/pdf',bytes:pdf(['SANCTUARY - WEBSITE ENQUIRY ATTACHMENT','Synthetic private attachment supplied with the original enquiry.','We are interested in covering our outdoor living space.','Please discuss the options and installation timing with us.'])},
];
export function workdeskFilesPage(rootId=projectRoot,folderId?:string):ProjectFilesPage {
  const folder=folderId??'root';
  const root=rootId===projectRoot?'root-project':rootId===archiveRoot?'root-archive':null;
  const records=workdeskFileRecords.filter(file=>file.root===root&&file.folder===(folder==='root'?'':folder));
  return {state:'ready',roots:[{id:projectRoot,label:'Project documents',itemId:'root'},{id:archiveRoot,label:'Earlier proposals',itemId:'root'}],rootId,folderId:folder,cursor:null,items:[
    ...(rootId===projectRoot&&folder==='root'?[{id:'documents',name:'Proposals & correspondence',kind:'folder' as const,size:0,modifiedAt:null,viewable:false},{id:'site',name:'Site information',kind:'folder' as const,size:0,modifiedAt:null,viewable:false},{id:'installation',name:'Installation',kind:'folder' as const,size:0,modifiedAt:null,viewable:false}]:[]),
    ...records.map(file=>({id:file.id,name:file.name,kind:'file' as const,size:file.bytes.byteLength,modifiedAt:'2026-10-23T02:00:00.000Z',viewable:file.mime==='application/pdf',contentType:file.mime,eTag:'"workdesk-sample-v1"'})),
  ]};
}
/** Finite local receipts exercise the real preparation decoder and memory lease. */
export async function workdeskPreviewResponse(projectId:string,input:unknown):Promise<Response> {
  const parsed=previewBatchRequest.safeParse(input);
  if(!parsed.success)return Response.json({error:'Invalid synthetic preview request'},{status:400});
  const request=parsed.data,page=workdeskFilesPage(request.rootId,request.folderId);
  const allowed=new Set(page.items.filter(item=>item.viewable).map(item=>item.id));
  const lines:unknown[]=[{kind:'project-preview-batch-v1',projectId,rootId:request.rootId,folderId:request.folderId}];
  const unavailable:string[]=[];
  for(const item of request.items){
    const file=workdeskFileRecords.find(file=>file.id===item.id);
    if(!file||!allowed.has(item.id)){unavailable.push(item.id);continue;}
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(file.bytes)));
    const hash=[...digest].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const resident=item.known?.hash===hash&&item.known.version==='"workdesk-sample-v1"'&&item.known.profile==='pdf-v1';
    lines.push({kind:'preview',item:{id:file.id,name:file.name,version:'"workdesk-sample-v1"',profile:'pdf-v1',hash,mime:'application/pdf',size:file.bytes.length,...(resident?{}:{body:btoa(String.fromCharCode(...file.bytes))})}});
  }
  lines.push({kind:'complete',unavailable});
  return new Response(lines.map(line=>JSON.stringify(line)).join('\n')+'\n',{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'private, no-store'}});
}
export function workdeskFileResponse(id:string,download=false):Response {
  const file=workdeskFileRecords.find(record=>record.id===id);
  if(!file)return Response.json({error:'Synthetic file not found'},{status:404});
  return new Response(new Uint8Array(file.bytes),{headers:{'Content-Type':file.mime,'Content-Length':String(file.bytes.byteLength),'Content-Disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','x-project-file-verified-version':'"workdesk-sample-v1"'}});
}
