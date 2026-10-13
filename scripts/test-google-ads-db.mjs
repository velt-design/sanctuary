// Disposable local PostgreSQL 17 proof, with synthetic prerequisites. No remote URL accepted.
import { spawnSync } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),bin=process.env.PRAXIS_DISPOSABLE_POSTGRES_BIN;
if(!bin||!path.isAbsolute(bin))throw Error('Set PRAXIS_DISPOSABLE_POSTGRES_BIN to existing local PostgreSQL 17 binaries.');
const directory=mkdtempSync(path.join(tmpdir(),'sanctuary-google-ads-')),data=path.join(directory,'data');
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
function run(name,args,input){return spawnSync(path.join(bin,`${name}${process.platform==='win32'?'.exe':''}`),args,{cwd:root,encoding:'utf8',windowsHide:true,input,timeout:60000,stdio:name==='pg_ctl'?'ignore':'pipe'});}
function success(result){if(result.error||result.status!==0)throw Error(result.error?.message??result.stderr);return result.stdout?.trim()??'';}
const sql=statement=>success(run('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres'],statement));
let started=false;
try{
  success(run('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']));
  success(run('pg_ctl',['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']));started=true;
  assert.equal(Math.floor(Number(sql('show server_version_num'))/10000),17);
  sql('create database google_ads_fixture');
  if(process.argv.slice(2).some(arg=>arg!=='--meta'))throw Error('Only --meta is supported');
  const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',process.argv.includes('--meta')?'test/meta-sales-source.test.ts':'test/google-ads-source.test.ts'],{cwd:root,env:{...process.env,GOOGLE_ADS_NATIVE_TEST_URL:`postgres://postgres@127.0.0.1:${port}/google_ads_fixture`},encoding:'utf8',windowsHide:true,timeout:60000});
  process.stdout.write(result.stdout??'');success(result);
  console.log('PASS: actual advertising migrations and lifecycle on PostgreSQL 17. Synthetic prerequisites only; safeupdate extension, PostgREST and production schema not exercised.');
}finally{
  if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
  const resolved=path.resolve(directory);if(!resolved.startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unsafe temp cleanup');rmSync(resolved,{recursive:true,force:true});
}
