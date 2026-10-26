import type { Page, CDPSession } from '@playwright/test';
import type { Reporter, FullResult, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

export const NATIVE_BEGIN = 'PORTAL_NATIVE_CAUSAL_BEGIN';
export const NATIVE_END = 'PORTAL_NATIVE_CAUSAL_END';
const NATIVE_JOURNEYS = ['dashboard-cold','contacts-warm','detail-warm','projects-back','dashboard-warm','running-warm','schedule-toggle'] as const;
const NATIVE_EVENTS = ['RunTask','Layout','UpdateLayoutTree','EvaluateScript','FunctionCall','EventDispatch','ParseHTML','Paint','CompositeLayers'] as const;
export type NativeJourney = typeof NATIVE_JOURNEYS[number];
export const NATIVE_LIMITS = { rows: 2_048, bytes: 524_288, rawBytes: 67_108_864, events: 50_000, traceSpans: 128, cpuLocations: 128, batchMs: 160_000, gets: 400 } as const;
type Span = { schema: 1; kind: 'span'; journey: NativeJourney; source: 'trace'; event: string; startMs: number; durationMs: number; chunk?: string; line?: number; column?: number };
type Cpu = { schema:1; kind:'cpu'; journey:NativeJourney; event:'Samples'; firstMs:number; lastMs:number; selfMs:number; samples:number; chunk?:string; line?:number; column?:number };
type Coverage = { schema: 1; kind: 'coverage'; journey: NativeJourney; status: 'complete'|'failed'|'capped'|'unavailable'; projectionCapped:boolean; traceEvents: number; cpuSamples: number; dropped: number };
type Run = { schema: 1; kind: 'run'; status: 'passed'|'failed'|'skipped'|'capped' };
export type NativeRow = Span | Cpu | Coverage | Run;
const object = (v: unknown): Record<string, any> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const number = (v: unknown, max = 180_000) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const integer = (v: unknown) => number(v, 10_000_000) && Number.isInteger(v);
function nativeChunkName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{6,160}\.js$/.test(value);
}
export function emittedNativeChunks(): Set<string> {
  const base=path.resolve('apps/portal/.next'), output=path.resolve('apps/portal',process.env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim()||'.next/playwright-fixture');
  if(!output.startsWith(base+path.sep))throw new Error('Native diagnostic build is unavailable.');
  const files=fs.readdirSync(path.join(output,'static/chunks'),{recursive:true,encoding:'utf8'});
  if(files.length>10_000)throw new Error('Native diagnostic build is unavailable.');
  return new Set(files.map(file=>path.basename(file)).filter(nativeChunkName));
}
export function nativeStaticChunk(value: unknown, origin: string, emitted: ReadonlySet<string>): string | undefined {
  if(typeof value !== 'string')return;
  try { const url = new URL(value); const name = url.pathname.split('/').at(-1)!;
    if(url.origin === origin && !url.search && !url.hash && /^\/_next\/static\/chunks\/[A-Za-z0-9_/-]+\.js$/.test(url.pathname) && nativeChunkName(name) && emitted.has(name))return name;
  } catch { /* Unknown sources never enter output. */ }
}
/** Strict output schema, also applied at the reporter boundary to reject poisoned stdout. */
export function safeNativeRow(value: unknown): NativeRow | null {
  try {
    const row=object(value);if(!row || row.schema!==1)return null;
    const keys=Object.keys(row);
    if(row.kind==='run')return keys.every(k=>['schema','kind','status'].includes(k)) && ['passed','failed','skipped','capped'].includes(row.status) ? {schema:1,kind:'run',status:row.status} : null;
    if(!(NATIVE_JOURNEYS as readonly unknown[]).includes(row.journey))return null;
    if(row.kind==='coverage')return keys.every(k=>['schema','kind','journey','status','projectionCapped','traceEvents','cpuSamples','dropped'].includes(k)) && ['complete','failed','capped','unavailable'].includes(row.status) && typeof row.projectionCapped==='boolean' && [row.traceEvents,row.cpuSamples,row.dropped].every(integer)
      ? {schema:1,kind:'coverage',journey:row.journey,status:row.status,projectionCapped:row.projectionCapped,traceEvents:row.traceEvents,cpuSamples:row.cpuSamples,dropped:row.dropped} : null;
    if(row.kind==='cpu'){
      if(!keys.every(k=>['schema','kind','journey','event','firstMs','lastMs','selfMs','samples','chunk','line','column'].includes(k))||row.event!=='Samples'||![row.firstMs,row.lastMs,row.selfMs].every(v=>number(v))||row.firstMs>row.lastMs||row.selfMs>row.lastMs-row.firstMs+0.001||!integer(row.samples))return null;
      if(row.chunk!==undefined&&!nativeChunkName(row.chunk)||row.line!==undefined&&!integer(row.line)||row.column!==undefined&&!integer(row.column)||row.chunk===undefined&&(row.line!==undefined||row.column!==undefined))return null;
      return {schema:1,kind:'cpu',journey:row.journey,event:'Samples',firstMs:row.firstMs,lastMs:row.lastMs,selfMs:row.selfMs,samples:row.samples,...(row.chunk===undefined?{}:{chunk:row.chunk,...(row.line===undefined?{}:{line:row.line}),...(row.column===undefined?{}:{column:row.column})})};
    }
    if(row.kind!=='span' || !keys.every(k=>['schema','kind','journey','source','event','startMs','durationMs','chunk','line','column'].includes(k)) || !number(row.startMs) || !number(row.durationMs) || row.startMs+row.durationMs>180_000)return null;
    if(row.source!=='trace'||!(NATIVE_EVENTS as readonly unknown[]).includes(row.event))return null;
    if(row.chunk!==undefined && !nativeChunkName(row.chunk))return null;
    if(row.line!==undefined && !integer(row.line) || row.column!==undefined && !integer(row.column))return null;
    if(row.chunk===undefined && (row.line!==undefined || row.column!==undefined))return null;
    return {schema:1,kind:'span',journey:row.journey,source:row.source,event:row.event,startMs:row.startMs,durationMs:row.durationMs,...(row.chunk===undefined?{}:{chunk:row.chunk,...(row.line===undefined?{}:{line:row.line}),...(row.column===undefined?{}:{column:row.column})})};
  } catch { return null; }
}
/** Raw events/profiles remain caller-owned memory. Never returns args, URLs or names. */
export function projectNativeCapture(journey: NativeJourney, events: unknown[], profileValue: unknown, origin: string, emitted: ReadonlySet<string>, status: Coverage['status']): NativeRow[] {
  const rows: NativeRow[]=[],trace:Span[]=[];let dropped=0;
  const traced=events.slice(0,NATIVE_LIMITS.events).map(object).filter((e): e is Record<string,any>=>Boolean(e));
  const tracePresent=traced.some(e=>e.ph==='X'&&typeof e.ts==='number'&&Number.isFinite(e.ts)&&number(e.dur,180_000_000));
  const first=traced.reduce((min,e)=>e.ph==='X'&&typeof e.ts==='number'&&Number.isFinite(e.ts)?Math.min(min,e.ts):min,Infinity);
  for(const e of traced){
    if(!(NATIVE_EVENTS as readonly unknown[]).includes(e.name) || e.ph!=='X' || !number(e.dur,180_000_000) || e.dur<1_000 || typeof e.ts!=='number')continue;
    const chunk=nativeStaticChunk(object(e.args)?.data?.url,origin,emitted);
    const row=safeNativeRow({schema:1,kind:'span',journey,source:'trace',event:e.name,startMs:(e.ts-first)/1_000,durationMs:e.dur/1_000,...(chunk?{chunk}:{})});
    if(row?.kind==='span')trace.push(row);else dropped++;
  }
  // Select longest spans from the FULL action window, not its initial prefix.
  trace.sort((a,b)=>b.durationMs-a.durationMs||a.startMs-b.startMs);
  rows.push(...trace.slice(0,NATIVE_LIMITS.traceSpans));dropped+=Math.max(0,trace.length-NATIVE_LIMITS.traceSpans);
  const profile=object(profileValue),samples=Array.isArray(profile?.samples)?profile.samples:[],deltas=Array.isArray(profile?.timeDeltas)?profile.timeDeltas:[];
  const nodes=new Map((Array.isArray(profile?.nodes)?profile.nodes:[]).slice(0,50_000).map(object).filter(Boolean).map(n=>[n!.id,n!]));let elapsed=0;
  const cpu=new Map<string,Cpu>();
  for(let i=0;i<Math.min(samples.length,50_000);i++){
    const delta=deltas[i];if(!number(delta,180_000_000)){dropped++;continue;}
    const frame=object(nodes.get(samples[i])?.callFrame),chunk=nativeStaticChunk(frame?.url,origin,emitted);
    const location=chunk?{chunk,...(integer(frame?.lineNumber)?{line:frame!.lineNumber}:{}),...(integer(frame?.columnNumber)?{column:frame!.columnNumber}:{})}:{};
    const start=elapsed/1_000;elapsed+=delta;const key=JSON.stringify(location),previous=cpu.get(key);
    const row=safeNativeRow({schema:1,kind:'cpu',journey,event:'Samples',firstMs:previous?.firstMs??start,lastMs:elapsed/1_000,selfMs:(previous?.selfMs??0)+delta/1_000,samples:(previous?.samples??0)+1,...location});
    if(row?.kind==='cpu')cpu.set(key,row);else dropped++;
  }
  const locations=[...cpu.values()].sort((a,b)=>b.selfMs-a.selfMs||a.firstMs-b.firstMs);
  rows.push(...locations.slice(0,NATIVE_LIMITS.cpuLocations));dropped+=Math.max(0,locations.length-NATIVE_LIMITS.cpuLocations);
  const rawExceeded=events.length>NATIVE_LIMITS.events||samples.length>50_000;
  const captureStatus=status!=='complete'?status:rawExceeded?'capped':!tracePresent||cpu.size===0?'unavailable':'complete';
  rows.push({schema:1,kind:'coverage',journey,status:captureStatus,projectionCapped:dropped>0||rawExceeded,traceEvents:Math.min(events.length,NATIVE_LIMITS.events),cpuSamples:Math.min(samples.length,50_000),dropped:Math.min(dropped,10_000_000)});
  return rows;
}
export function nativeTarget(env: Record<string,string|undefined>): string {
  try {const port=Number(env.PORTAL_PLAYWRIGHT_PORT??3011),target=new URL(env.PORTAL_BASE_URL?.trim()||'http://127.0.0.1:'+port);
    if(env.PORTAL_PERF_NATIVE_CAUSAL!=='1'||env.PORTAL_PERF_DIAGNOSTICS==='1'||env.CI!=='true'||env.PORTAL_PLAYWRIGHT_PRODUCTION!=='1'||target.protocol!=='http:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash||!Number.isInteger(port)||port<1024||port>65535||Number(target.port)!==port)throw 0;
    return target.origin;
  } catch {throw new Error('Native diagnostic requires its dedicated CI loopback target.');}
}
/** No framework exception, stdout or stderr is ever forwarded verbatim. */
export default class NativeCausalReporter implements Reporter {
  private buffer='';private rows=0;private bytes=0;private inputBytes=0;private capped=false;private finished=false;
  private readonly emit: (text:string)=>void;
  private readonly emitted: ReadonlySet<string>;
  constructor(emit:(text:string)=>void,emitted?:ReadonlySet<string>);
  constructor(options?:Record<string,unknown>);
  constructor(options: unknown = {}, emitted?: ReadonlySet<string>) {
    this.emit=typeof options==='function' ? options as (text:string)=>void : text=>{process.stdout.write(text);};
    this.emitted=emitted??new Set();
    if(emitted===undefined && process.env.PORTAL_PERF_NATIVE_CAUSAL==='1'){
      try {nativeTarget(process.env);this.emitted=emittedNativeChunks();}catch{/* No source identifiers are admitted without the exact build proof. */}
    }
  }
  onBegin(){this.emit(NATIVE_BEGIN+'\n');}
  private row(value:unknown){const row=safeNativeRow(value);if(!row||(row.kind==='span'||row.kind==='cpu')&&row.chunk!==undefined&&!this.emitted.has(row.chunk))return;const line=JSON.stringify(row)+'\n';if(this.rows>=NATIVE_LIMITS.rows-3||this.bytes+Buffer.byteLength(line)>NATIVE_LIMITS.bytes-256){this.capped=true;return;}this.rows++;this.bytes+=Buffer.byteLength(line);this.emit(line);}
  onStdOut(chunk:string|Buffer){if(this.finished)return;const text=typeof chunk==='string'?chunk:chunk.toString('utf8');this.inputBytes+=Buffer.byteLength(text);if(this.inputBytes>1_048_576){this.buffer='';this.capped=true;return;}const parts=(this.buffer+text).split('\n');this.buffer=parts.pop()!;if(this.buffer.length>16_384){this.buffer='';this.capped=true;}for(const line of parts){if(line.length>16_384){this.capped=true;continue;}try{this.row(JSON.parse(line));}catch{/* Discard all non-schema output. */}}}
  onStdErr(){/* Never print browser, application or framework stderr. */}
  onError(){/* The final fixed status reports failure without exception details. */}
  onTestEnd(_test:TestCase,result:TestResult){this.row({schema:1,kind:'run',status:result.status==='passed'?'passed':result.status==='skipped'?'skipped':'failed'});}
  onEnd(result:FullResult){if(this.finished)return;this.finished=true;this.buffer='';this.emit(JSON.stringify({schema:1,kind:'run',status:this.capped?'capped':result.status==='passed'?'passed':'failed'})+'\n'+NATIVE_END+'\n');}
  finishSanitized(ended:boolean){if(this.finished)return;this.finished=true;this.buffer='';if(this.capped)this.emit(JSON.stringify({schema:1,kind:'run',status:'capped'})+'\n');if(!ended)this.emit(JSON.stringify({schema:1,kind:'run',status:'failed'})+'\n');this.emit(NATIVE_END+'\n');}
}

// The workflow pipe also filters runner/config-launch failures occurring before
// Playwright can install this reporter. Raw input is bounded memory, never a file.
if(process.argv[2]==='--sanitize'){
  const reporter=new NativeCausalReporter();reporter.onBegin();let ended=false,tail='';
  process.stdin.on('data',chunk=>{const text=chunk.toString('utf8');if((tail+text).split(/\r?\n/).includes(NATIVE_END))ended=true;tail=text.slice(-NATIVE_END.length-2);reporter.onStdOut(text);});
  process.stdin.on('end',()=>reporter.finishSanitized(ended));
  process.stdin.on('error',()=>reporter.finishSanitized(false));
}

export async function collectNativeCapture(page:Page,journey:NativeJourney,origin:string,emitted:ReadonlySet<string>,action:()=>Promise<void>,emit:(rows:NativeRow[])=>void){
  let complete=false;
  let onData:((packet:{value:unknown[]})=>void)|undefined,onComplete:(()=>void)|undefined;
  let cdp:CDPSession|null=null,events:unknown[]=[],bytes=0,capped=false,profile:unknown=null,status:'complete'|'failed'|'capped'|'unavailable'='unavailable';
  try {
    cdp=await page.context().newCDPSession(page);
    onData=packet=>{
      if(capped)return;
      const size=Buffer.byteLength(JSON.stringify(packet));bytes+=size;
      if(bytes>NATIVE_LIMITS.rawBytes||events.length+packet.value.length>NATIVE_LIMITS.events){capped=true;events=[];return;}
      events.push(...packet.value);
    };
    cdp.on('Tracing.dataCollected',onData);
    await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1_000});await cdp.send('Profiler.start');
    await cdp.send('Tracing.start',{categories:'devtools.timeline,toplevel,v8',transferMode:'ReportEvents'});
    status='failed';await action();await page.waitForTimeout(journey==='detail-warm'||journey==='projects-back'||journey==='dashboard-warm'?3_000:750);status='complete';
  } catch { /* No exception, URL or application output is reported. */ }
  finally {
    if(cdp){
      try {const stopped=await cdp.send('Profiler.stop');const profileBytes=Buffer.byteLength(JSON.stringify(stopped));if(profileBytes<=NATIVE_LIMITS.rawBytes-bytes){bytes+=profileBytes;profile=stopped.profile;}else capped=true;}catch{status='failed';}
      try {const current=cdp;await new Promise<void>(resolve=>{const timer=setTimeout(()=>{capped=true;resolve();},5_000);onComplete=()=>{clearTimeout(timer);resolve();};current.once('Tracing.tracingComplete',onComplete);void current.send('Tracing.end').catch(()=>{clearTimeout(timer);status='failed';resolve();});});}catch{status='failed';}
      if(onData)cdp.removeListener('Tracing.dataCollected',onData);
      if(onComplete)cdp.removeListener('Tracing.tracingComplete',onComplete);
      await cdp.detach().catch(()=>undefined);
    }
    try {const rows=projectNativeCapture(journey,events,profile,origin,emitted,status==='failed'?'failed':capped?'capped':status);emit(rows);complete=rows.some(row=>row.kind==='coverage'&&row.status==='complete');}catch{emit([{schema:1,kind:'coverage',journey,status:'failed',projectionCapped:false,traceEvents:0,cpuSamples:0,dropped:0}]);}
    events=[];profile=null;
  }
  return complete;
}
