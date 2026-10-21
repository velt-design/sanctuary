import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join,resolve,dirname,basename } from 'node:path';
import {landingExperimentTestBootstrap} from './lib/landing-experiment-test-bootstrap.mjs';
const bin=process.env.SANCTUARY_DISPOSABLE_POSTGRES_BIN;
if(!bin)throw new Error('Set SANCTUARY_DISPOSABLE_POSTGRES_BIN to a local PostgreSQL installation. No remote database is used.');
const suffix=process.platform==='win32'?'.exe':'',directory=mkdtempSync(join(tmpdir(),'sanctuary-experiment-'));
let started=false;
const run=(name,args,input,background=false)=>{const result=spawnSync(join(bin,name+suffix),args,{input,encoding:'utf8',windowsHide:true,stdio:background?'ignore':undefined,env:{NODE_ENV:'test'},maxBuffer:2e6});if(result.status!==0)throw new Error(result.stderr??String(result.error));return result.stdout;};
const port=await new Promise((done,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return reject();server.close(()=>done(address.port));});});
const sql=value=>run('psql',['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','cluster_admin','-d','postgres','-q','-At'],value);
try{
 run('initdb',['-D',directory,'-U','cluster_admin','-A','trust','--no-locale','-E','UTF8']);run('pg_ctl',['-D',directory,'-l',join(directory,'postgres.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','start'],undefined,true);started=true;
 sql(landingExperimentTestBootstrap(process.cwd()));
 sql(readFileSync('supabase/migrations/20261021020002_landing_experiments.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_experiments.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_experiment_probes.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_experiment_layout.sql','utf8'));
 sql(readFileSync('supabase/tests/campaign_intake_evidence.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021020003_campaign_intake_evidence.sql','utf8'));
 sql(readFileSync('supabase/tests/campaign_intake_evidence_assertions.sql','utf8'));
 if(sql('select count(*) from public.landing_experiments').trim()!=='0')throw new Error('Synthetic fixture did not roll back');
 process.stdout.write(JSON.stringify({postgres:sql('show server_version').trim(),sourceContract:true,intakeProvenance:true,fixturesRolledBack:true,liveCalls:0}));
}finally{
 if(started)run('pg_ctl',['-D',directory,'-m','immediate','-w','stop'],undefined,true);
 if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith('sanctuary-experiment-'))rmSync(directory,{recursive:true,force:true});
}
