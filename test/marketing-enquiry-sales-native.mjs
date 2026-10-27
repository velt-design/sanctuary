// Local disposable PostgreSQL only. Uses an already installed binary; never
// contacts a hosted database, pulls an image, or reads credentials.
import { spawnSync } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
const bin=process.env.PRAXIS_DISPOSABLE_POSTGRES_BIN;
if(!bin||!path.isAbsolute(bin))throw Error('An absolute existing PostgreSQL binary path is required');
const directory=mkdtempSync(path.join(tmpdir(),'sanctuary-sales-proof-'));
const data=path.join(directory,'data');
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
function run(name,args){const result=spawnSync(path.join(bin,`${name}${process.platform==='win32'?'.exe':''}`),args,{windowsHide:true,encoding:'utf8',timeout:60000,stdio:name==='pg_ctl'?'ignore':'pipe'});if(result.status!==0)throw Error(result.stderr||result.error?.message||`${name} failed`);return result.stdout?.trim();}
let started=false;
try{
 run('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
 run('pg_ctl',['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
 console.log(run('psql',['-X','-qAt','-h','127.0.0.1','-p',String(port),'-U','postgres','-c','show server_version']));
 const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','test/marketing-enquiry-sales.test.ts'],{env:{...process.env,MARKETING_SALES_NATIVE_PORT:String(port)},windowsHide:true,stdio:'inherit',timeout:120000});
 if(result.status!==0)throw Error('Native sales evidence checks failed');
}finally{
 if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
 // mkdtemp returned this exact owned directory; never remove a computed parent.
 rmSync(directory,{recursive:true,force:true});
}
