// Disposable PostgreSQL 17 only (local binaries or an isolated Docker container).
// Never accepts a service/database URL or mounts the repository into a container.
import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const bin=process.env.PRAXIS_DISPOSABLE_POSTGRES_BIN;
if(!bin)throw new Error('Set local PostgreSQL17 binaries for the briefing native query proof.');
if(bin&&!path.isAbsolute(bin))throw new Error('PRAXIS_DISPOSABLE_POSTGRES_BIN must be an absolute local PostgreSQL17 bin directory.');
const image=process.env.PRAXIS_REPORTING_DB_IMAGE?.trim() || 'postgres:17-alpine';
const container=`sanctuary-praxis-specialist-${process.pid}-${Date.now()}`;
const directory=bin ? mkdtempSync(path.join(tmpdir(),'sanctuary-praxis-specialist-')) : null;
const data=directory ? path.join(directory,'data') : null;
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
function run(name,args,input){return spawnSync(path.join(bin,`${name}${process.platform==='win32'?'.exe':''}`),args,{cwd:root,encoding:'utf8',windowsHide:true,input,timeout:60000,stdio:name==='pg_ctl'?'ignore':'pipe'});}
function success(result){if(result.error||result.status!==0)throw new Error(result.error?.message??result.stderr);return result.stdout?.trim()??'';}
function docker(args,input){return spawnSync('docker',args,{cwd:root,encoding:'utf8',windowsHide:true,input,timeout:60000,maxBuffer:10*1024*1024});}
function sql(statement,reader=false,allowFailure=false){
  const args=['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(bin?port:5432),'-U',reader?'workload_probe':'postgres','-d','postgres'];
  const result=bin ? run('psql',args,statement) : docker(['exec','-i',container,'psql',...args],statement);
  return allowFailure?result:success(result);
}
const read=file=>readFileSync(path.join(root,file),'utf8');
let started=false;
try{
  if(bin){
    success(run('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']));
    success(run('pg_ctl',['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']));started=true;
  }else{
    // Trust is confined to a disposable container with no network or host ports.
    success(docker(['run','--detach','--rm','--network','none','--name',container,'--env','POSTGRES_HOST_AUTH_METHOD=trust',image]));started=true;
    let ready=false;
    for(let attempt=0;attempt<60;attempt++){
      if(docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!ready)throw new Error('Disposable workload PostgreSQL did not become ready.');
  }
  const major=Math.floor(Number(sql('show server_version_num'))/10000);
  assert.equal(major,17,'Workload denial proof requires PostgreSQL 17.');
  sql('create database briefing_fixture');
  const test=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','test/praxis-briefing-read.test.ts'],{cwd:root,env:{...process.env,PRAXIS_BRIEFING_NATIVE_URL:`postgres://postgres@127.0.0.1:${port}/briefing_fixture`},encoding:'utf8',windowsHide:true,timeout:60000});
  process.stdout.write(test.stdout??'');success(test);
  console.log('PASS: real PostgreSQL17 briefing query/complete-family proof (synthetic projection prerequisites; existing reporting migrations unchanged).');
}finally{
  if(started){if(bin)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);else docker(['stop',container]);}
  if(directory){const resolved=path.resolve(directory);if(!resolved.startsWith(path.resolve(tmpdir())+path.sep))throw new Error('Unsafe temp cleanup');rmSync(resolved,{recursive:true,force:true});}
}
