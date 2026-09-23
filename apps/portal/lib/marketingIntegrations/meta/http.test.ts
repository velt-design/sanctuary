// @vitest-environment node
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
vi.mock('./store', () => ({metaStore:vi.fn()}));
import { sanctuaryMetaResponse } from './http';
import { sampleMetaReport } from './report';
const id='10000000-0000-4000-8000-000000000001', binding='a'.repeat(64);
function fixture() {
 const source={databaseUrl:'postgres://unused',databaseSsl:false as const,token:'t'.repeat(32),sourceKey:'synthetic',connectionId:id,environment:'test'};
 const control={actor:id,account:'123',binding};
 const report={...sampleMetaReport({start:'2026-08-01',end:'2026-08-07'}),fetchedAt:new Date().toISOString()};
 const payload=JSON.stringify(report), resultHash=createHash('sha256').update(payload).digest('hex');
 const command=vi.fn(async(action:string)=>action==='claim'?{operation:id,generation:1}:action==='complete'?{status:'completed',operation:id,retained:true}:action==='delete'?{status:'deleted'}:action==='read'?{status:'available',operation:id,generation:1,payload,resultHash,expiresAt:new Date(Date.parse(report.fetchedAt)+7*86400000).toISOString()}:{});
 const credentials=vi.fn(()=>({...control,app:'12',principal:'13',business:'14',token:'secret',appSecret:'private',expiresAt:new Date(Date.now()+86400000).toISOString()}));
 const dependencies={source:()=>source,control:()=>control,credentials,store:()=>command,verify:vi.fn(async()=>({timezone:'Pacific/Auckland',currency:'NZD'})),read:vi.fn(async()=>report),fetcher:vi.fn<typeof fetch>(),delegation:()=>async()=>{}};
 const request=(query='action=refresh&start=2026-08-01&end=2026-08-07&retain=true',patch:Record<string,string>={},method='GET')=>new Request(`https://portal.test/api/integrations/praxis/v1/marketing/meta?${query}`,{method,headers:{authorization:`Bearer ${source.token}`,'x-praxis-source-key':'synthetic','x-praxis-connection-id':id,'x-praxis-environment':'test',...patch}});
 return {dependencies,request,command,report};
}
it('refreshes, stores and returns a verified source wire without exposing credential fields',async()=>{
 const f=fixture(),r=await sanctuaryMetaResponse(f.request(),f.dependencies);expect(r.status).toBe(200);
 const wire=await r.json();expect(wire.report).toEqual(f.report);expect(wire.source.accountId).toBe('123');expect(JSON.stringify(wire)).not.toMatch(/secret|private/);expect(r.headers.get('cache-control')).toContain('no-store');
 if(process.env.SANCTUARY_META_SYNTHETIC_WIRE_PATH) await writeFile(process.env.SANCTUARY_META_SYNTHETIC_WIRE_PATH,JSON.stringify(wire));
});
it('reopens and deletes saved source evidence without reading Meta credentials or provider',async()=>{
 const f=fixture();expect((await sanctuaryMetaResponse(f.request('action=read'),f.dependencies)).status).toBe(200);
 expect((await sanctuaryMetaResponse(f.request('action=delete',{},'DELETE'),f.dependencies)).status).toBe(200);
 expect(f.dependencies.credentials).not.toHaveBeenCalled();expect(f.dependencies.read).not.toHaveBeenCalled();
});
it('passes page-only intent to storage without changing the caller contract',async()=>{
 const f=fixture();const original=f.command.getMockImplementation()!;
 f.command.mockImplementation(async(action)=>action==='complete'?{status:'completed',operation:id,retained:false}:original(action));
 const r=await sanctuaryMetaResponse(f.request('action=refresh&start=2026-08-01&end=2026-08-07&retain=false'),f.dependencies);
 expect(r.status).toBe(200);expect((await r.json()).retained).toBe(false);
 expect(f.command).toHaveBeenCalledWith('claim',null,expect.any(AbortSignal),{query:JSON.stringify({start:'2026-08-01',end:'2026-08-07',retain:false})});
});
it('revoked initiating operation prevents source completion even after the provider returned',async()=>{
 const f=fixture(),guard=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new Error('stopped'));
 f.dependencies.delegation=()=>guard;
 const r=await sanctuaryMetaResponse(f.request(),f.dependencies);expect(r.status).toBe(503);
 expect(f.command.mock.calls.some(call=>call[0]==='complete')).toBe(false);
});
it.each(['bearer','source','duplicate','unknown','wrong-method'])('denies %s before source claim',async(mode)=>{
 const f=fixture();const r=await sanctuaryMetaResponse(f.request(mode==='duplicate'?'action=read&action=read':mode==='unknown'?'action=read&account=other':'action=read',mode==='bearer'?{authorization:'wrong'}:mode==='source'?{'x-praxis-source-key':'wrong'}:{},mode==='wrong-method'?'POST':'GET'),f.dependencies);
 expect(r.status).toBeGreaterThanOrEqual(400);expect(f.command).not.toHaveBeenCalled();
});
it('withholds a report when final authority, payload integrity or storage fails',async()=>{
 const f=fixture();f.command.mockRejectedValueOnce(new Error('private database'));const r=await sanctuaryMetaResponse(f.request(),f.dependencies);expect(r.status).toBe(503);expect(await r.text()).not.toContain('private');
});
