// @vitest-environment node
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {describe,expect,it,vi} from 'vitest';
import {portalNextDevOwner} from '../../../../scripts/ci/portal-next-process-owner.mjs';
const windows='C:/Dev/Portal Example',posix='/work/portal example';
const node='"C:\\Program Files\\nodejs\\node.exe"';
const cli=(root:string,command='dev',directory='')=>`${node} "${root}/node_modules/next/dist/bin/next" ${command} ${directory}`;
const classify=(commandLine:string,root=windows,extra:Record<string,unknown>={})=>portalNextDevOwner({pid:'12',commandLine,...extra},root,{loadScript:()=>''});

describe('checkout-owned Next dev process evidence',()=>{
 it.each([windows,windows.replaceAll('/','\\')])('recognizes quoted root CLI, path separators and any dev port: %s',root=>{
   expect(classify(cli(root,'dev','-p 3456')).kind).toBe('checkout-next-dev-cli');
 });
 it('recognizes POSIX quotes, an explicit project and known node options',()=>{
   expect(classify(`node --import tsx '${posix}/node_modules/next/dist/bin/next' dev '${posix}/apps/portal' --port 4111`,posix)?.kind).toBe('checkout-next-dev-cli');
   expect(classify(`'${posix}/node_modules/.bin/next' dev --port=4122`,posix)?.kind).toBe('checkout-next-dev-cli');
 });
 it.each(['build','start','info','dev --help','dev --version'])('does not mistake a checkout directory named Dev for the %s subcommand',command=>{
   expect(classify(cli(windows,command))).toBeNull();
 });
 it.each([
   `pwsh -Command "${cli(windows)}"`,
   `node -e 'const prose="${windows}/apps/portal next dev"'`,
   `node "${windows}/notes.js" next dev "${windows}/apps/portal"`,
   `echo "${windows}/node_modules/next/dist/bin/next dev"`,
   cli(windows+'-sibling'),
   cli('C:/Dev/Other Checkout'),
   cli(windows,'dev','"C:/Dev/Other Checkout/apps/portal"'),
   cli(windows,'dev','apps/marketing'),
 ])('does not infer ownership from prose or a foreign checkout: %s',command=>expect(classify(command)).toBeNull());
 it('does not treat another cwd as Portal when it is actually reported',()=>{
   expect(classify(cli(windows),windows,{cwd:windows+'/apps/marketing'})).toBeNull();
   expect(classify(cli(windows),windows,{cwd:windows+'/apps/portal'})?.kind).toBe('checkout-next-dev-cli');
 });
 it('uses a real POSIX argument vector when ps cannot quote spaces',()=>{
   expect(classify(`node ${posix}/node_modules/next/dist/bin/next dev`,posix,{argv:['node',posix+'/node_modules/next/dist/bin/next','dev']})?.kind).toBe('checkout-next-dev-cli');
 });
 it('requires a genuine Next-server child plus its own explicit Next-dev parent',()=>{
   const child=`${node} "${windows}/node_modules/next/dist/server/lib/start-server.js"`;
   const owner=classify(child,windows,{parentPid:'4',parentCommandLine:cli(windows)});
   expect(owner).toMatchObject({pid:'12',ownerPid:'4',commandLine:child,ownerCommandLine:cli(windows),kind:'next-server-child'});
   expect(classify(child,windows,{parentPid:'4',parentCommandLine:cli('C:/Dev/foreign')})).toBeNull();
   expect(classify(child,windows,{parentPid:'4',parentCommandLine:cli(windows,'build')})).toBeNull();
   expect(classify(`${node} "${windows}/unrelated.js"`,windows,{parentPid:'4',parentCommandLine:cli(windows)})).toBeNull();
   expect(classify('next-server (v16.4.1)',posix,{parentPid:'4',parentCommandLine:`node '${posix}/node_modules/next/dist/bin/next' dev`})?.ownerPid).toBe('4');
 });
});

describe('observed programmatic Next dev source',()=>{
 const script='C:/private/fixture-server.cjs';
 const source=(root:string,dev='true')=>`const {createRequire}=require('node:module');
 const root='${root}';const req=createRequire(root+'/package.json');
 const app=req('next')({dev:${dev},webpack:true,dir:root+'/apps/portal',conf:{webpack(config){return config}}});
 app.prepare().then(()=>{});`;
 const classifySource=(text:string)=>portalNextDevOwner({pid:'13',commandLine:`${node} "${script}"`},windows,{loadScript:(file:string)=>{expect(file).toBe(script);return text;}});
 it('recognizes the analogous same-checkout observed createRequire/Next form without executing it',()=>{
   expect(classifySource(source(windows))?.kind).toBe('checkout-programmatic-next-dev');
 });
 it('rejects the exact foreign-checkout shape that caused the preflight false positive',()=>{
   expect(classifySource(source('C:/Dev/Foreign Finance Checkout'))).toBeNull();
   expect(classifySource(source(windows+'-sibling'))).toBeNull();
 });
 it.each([
   source(windows,'false'), source(windows,'Boolean(1)'),
   `const text=${JSON.stringify(source(windows))};`,
   `function start(){${source(windows)}}`,
   `const require=()=>()=>({});${source(windows)}`,
   `const app=require('next')({dev:true,dir:'${windows}/apps/portal',...unknown});`,
   `const root=unresolved();const app=require('next')({dev:true,dir:root+'/apps/portal'});`,
 ])('does not interpret unknown, inactive or nonfactory text as ownership',text=>expect(classifySource(text)).toBeNull());
 it('supports the direct required or imported factory with an exact absolute directory',()=>{
   expect(classifySource(`const next=require('next');const app=next({dev:true,dir:'${windows}/apps/portal'});`)?.kind).toBe('checkout-programmatic-next-dev');
   expect(classifySource(`import next from 'next';const app=next({dir:'${windows}/apps/portal',dev:true});`)?.kind).toBe('checkout-programmatic-next-dev');
 });
 it('leaves unavailable or oversized source unknown without inspecting imports or running a server',()=>{
   expect(classifySource('x'.repeat(1024*1024+1))).toBeNull();
   expect(portalNextDevOwner({commandLine:`${node} "${script}"`},windows,{loadScript:()=>{throw Error('unavailable')}})).toBeNull();
 });
});

it('keeps fixture occupancy unconditional and build default-port/lock checks scoped without destructive operations',()=>{
 const build=readFileSync('scripts/check-portal-build-env.mjs','utf8'),fixture=readFileSync('scripts/check-portal-fixture-env.mjs','utf8');
 expect(build).toContain('if (portalNextDevOwner(info, ROOT))');
 expect(build).toContain('fs.existsSync(LOCK_PATH)');expect(build).toContain('no owning portal dev process was identified');
 expect(build).not.toContain("commandLine.includes('apps/portal')");
 const occupied=fixture.slice(fixture.indexOf('  if (pid) {'),fixture.indexOf('  const available = await isPortAvailable(port)'));
 expect(occupied).toContain('const processHint = portalNextDevOwner(info, ROOT)');
 expect(occupied).toContain('Port ${port} is already in use');expect(occupied).toContain('    fail([');
 expect(build+'\n'+fixture).not.toMatch(/kill\(|taskkill|Stop-Process|unlink|rmSync/);
 expect(build).toContain('const commandLine = info?.commandLine');
});


describe('actual preflight module behavior with synthetic process/port observations',()=>{
 it.each([
  ['own dev anywhere','build',true,false,false,true],
  ['foreign dev on default build port','build',false,true,false,false],
  ['unknown occupied build port plus lock','build',false,true,true,false],
  ['owned default build port plus lock','build',true,true,true,true],
  ['foreign occupied fixture port','fixture',false,true,false,true],
  ['free fixture port','fixture',false,false,false,false],
 ] as const)('%s',async(_label,gate,owned,occupied,locked,fails)=>{
  const root=process.cwd().replaceAll('\\','/');
  const processRoot=owned?root:root+'-foreign';
  const command=`"${process.execPath}" "${processRoot}/node_modules/next/dist/bin/next" dev -p 3999`;
  const fake={pid:'413',parentPid:'1',commandLine:command};
  const run=vi.fn((_file:string,args:string[])=>{
   const text=args.join(' ');
   if(text.includes('ConvertTo-Json'))return JSON.stringify([{ProcessId:413,ParentProcessId:1,CommandLine:command}]);
   if(text.includes('Get-NetTCPConnection'))return occupied?'413':'';
   if(text.includes('Get-CimInstance'))return `413|1|${command}`;
   if(args.includes('-eo'))return `413 1 ${command}`;
   if(args.includes('args='))return command;
   if(args.includes('ppid='))return '1';
   if(args.includes('-nP'))return occupied?'413':'';
   return '';
  });
  vi.resetModules();
  vi.doMock('node:child_process',()=>({execFileSync:run}));
  vi.doMock('node:net',()=>({default:{createServer:()=>{
   const server=new EventEmitter() as EventEmitter&{listen:()=>void;close:(callback:()=>void)=>void};
   server.listen=()=>queueMicrotask(()=>server.emit(occupied?'error':'listening',{code:'EADDRINUSE'}));server.close=callback=>callback();return server;
  }}}));
  vi.doMock('node:fs',async original=>{
   const real=await original<typeof import('node:fs')>();
   return {...real,default:{...real,existsSync:(file:string)=>file.replaceAll('\\','/').endsWith('/apps/portal/.next/lock')?locked:real.existsSync(file)}};
  });
  vi.stubEnv('PORTAL_BASE_URL','');vi.stubEnv('PORTAL_PLAYWRIGHT_PORT','3011');
  const exit=vi.spyOn(process,'exit').mockImplementation(()=>{throw Error('synthetic preflight refusal');});
  const error=vi.spyOn(console,'error').mockImplementation(()=>{}),log=vi.spyOn(console,'log').mockImplementation(()=>{});
  try{
   const attempt=gate==='build'?import('../../../../scripts/check-portal-build-env.mjs'):import('../../../../scripts/check-portal-fixture-env.mjs');
   if(fails)await expect(attempt).rejects.toThrow('synthetic preflight refusal');else await attempt;
   expect(exit).toHaveBeenCalledTimes(fails?1:0);
   if(fails){expect(error.mock.calls.flat().some(line=>String(line).includes(gate==='fixture'?'Port 3011 is already in use':'PID 413'))).toBe(true);}
   if(locked&&!fails)expect(log.mock.calls.flat().some(line=>String(line).includes('no owning portal dev process'))).toBe(true);
   expect(run.mock.calls.some(([file])=>/kill|remove|delete/i.test(file))).toBe(false);
  }finally{vi.restoreAllMocks();vi.unstubAllEnvs();vi.doUnmock('node:child_process');vi.doUnmock('node:net');vi.doUnmock('node:fs');vi.resetModules();}
 });
});
