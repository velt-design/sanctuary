/** Source-only assessment. Never calls Meta and cannot enable delivery. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { runMetaSales } from '../apps/portal/lib/marketingIntegrations/metaSales/worker';
import { execFileSync } from 'node:child_process';
async function main() {
const mode=process.argv[2];
if(mode==='--plan') {
  console.log('Assess current paid scopes against saved Meta policy. Writes assessment records and a private per-scope exclusion report; no provider request or delivery activation. Requires META_ASSESS_SOURCE_URL, META_ASSESS_PROJECT_REF, META_ASSESS_SERVICE_KEY, META_ASSESS_ACTOR_ID and META_ASSESS_BINDING_SHA256. Run with --assess; outputs only to ignored .local-evidence/meta-assessments using a new timestamped file.');
} else if(mode==='--assess'&&process.argv.length===3) {
  const config=z.object({url:z.url(),project:z.string().regex(/^[a-z]{20}$/),key:z.string().min(32),actor:z.uuid(),binding:z.string().regex(/^[a-f0-9]{64}$/)}).parse({
    url:process.env.META_ASSESS_SOURCE_URL,project:process.env.META_ASSESS_PROJECT_REF,key:process.env.META_ASSESS_SERVICE_KEY,
    actor:process.env.META_ASSESS_ACTOR_ID,binding:process.env.META_ASSESS_BINDING_SHA256});
  if(config.url!==`https://${config.project}.supabase.co`)throw Error('Source project does not match');
  const directory=path.resolve('.local-evidence/meta-assessments');
  if(!directory.startsWith(path.resolve('.local-evidence')+path.sep))throw Error('Private evidence path required');
  execFileSync('git',['check-ignore','--quiet',path.join(directory,'privacy-check.json')],{stdio:'ignore'});
  const rows:unknown[]=[];
  try {
    const result=await runMetaSales({lane:'assess',signal:AbortSignal.timeout(210000),store:async(action,input={},run)=>{
      if(!['begin','sources','assess','finish'].includes(action))throw Error('Assessment command denied');
      const response=await fetch(`${config.url}/rest/v1/rpc/meta_sale_command`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
        headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({p_actor:config.actor,p_binding:config.binding,p_action:action,p_run:run??null,p_input:input})});
      if(!response.ok){await response.body?.cancel();throw Error('Assessment source unavailable');}
      const raw=await response.text();if(raw.length>4*1024*1024)throw Error('Assessment size limit');
      const data=JSON.parse(raw);
      if(action==='assess')rows.push({quoteId:input.quoteId,sourceFingerprint:input.fingerprint,...input.assessment as object});
      return data;
    }});
    mkdirSync(directory,{recursive:true});const output=path.join(directory,`${new Date().toISOString().replaceAll(':','-')}.json`);
    writeFileSync(output,JSON.stringify({schemaVersion:1,assessedAt:new Date().toISOString(),rows},null,2),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({completed:result.completed,assessed:result.assessed,privateEvidence:path.relative(process.cwd(),output)}));
  } catch {console.error('Meta source assessment did not complete. Inspect the source run before retrying; no provider request was made.');process.exitCode=1;}
} else throw Error('Use --plan or --assess');
}
void main().catch(()=>{console.error('Meta assessment setup is unavailable. No provider request was made.');process.exitCode=1;});
