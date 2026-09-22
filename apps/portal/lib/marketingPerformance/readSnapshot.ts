import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sliceSnapshot } from './snapshotData';

// Called only after the existing verified-developer staff gate. Never imported
// by client code, never served from public/, never enabled on a production deploy.
export async function readPreviewSnapshot(start:string,end:string,receiptsOnly=false){
  if(process.env.MARKETING_PERFORMANCE_PREVIEW!=='production-snapshot')return null;
  if(process.env.VERCEL_ENV!=='preview')throw new Error('Snapshot requires preview deployment');
  const relative=path.join('.private-preview','marketing-hub.json');
  let content:string;
  try { content=await readFile(path.join(process.cwd(),relative),'utf8'); }
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    content=await readFile(path.join(process.cwd(),'apps','portal',relative),'utf8');
  }
  const raw=JSON.parse(content);
  return sliceSnapshot(raw,start,end,receiptsOnly);
}
