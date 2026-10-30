import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('exempts only the verified fontkit bytes and still rejects vendor drift and authored replacement characters',()=>{
 const temporaryRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sanctuary-mojibake-'));
 const script=fileURLToPath(new URL('./check-mojibake.mjs',import.meta.url));
 const vendorSource=fileURLToPath(new URL('../packages/studio-documents/vendor/fontkit.umd.cjs',import.meta.url));
 const relativeVendor='packages/studio-documents/vendor/fontkit.umd.cjs',vendor=path.join(temporaryRoot,relativeVendor);
 const git=(args)=>{const result=spawnSync('git',args,{cwd:temporaryRoot,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);};
 const run=()=>spawnSync(process.execPath,[script],{cwd:temporaryRoot,encoding:'utf8',windowsHide:true});
 try{
  git(['init','--quiet']);fs.mkdirSync(path.dirname(vendor),{recursive:true});const lf=fs.readFileSync(vendorSource,'utf8').replaceAll('\r\n','\n');
  fs.writeFileSync(vendor,lf);git(['add','--intent-to-add',relativeVendor]);
  for(const bytes of [lf,lf.replaceAll('\n','\r\n')]){
    fs.writeFileSync(vendor,bytes);assert.equal(run().status,0);
    fs.appendFileSync(vendor,'\n// changed vendor \uFFFD\n');const drift=run();assert.equal(drift.status,1);assert.match(drift.stderr,/fontkit\.umd\.cjs/);
  }
  fs.copyFileSync(vendorSource,vendor);fs.writeFileSync(path.join(temporaryRoot,'authored.ts'),'export const label="\uFFFD";');git(['add','--intent-to-add','authored.ts']);const authored=run();assert.equal(authored.status,1);assert.match(authored.stderr,/authored\.ts/);
 }finally{
  assert(path.resolve(temporaryRoot).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(temporaryRoot,{recursive:true,force:true});
 }
});
