// @vitest-environment node
import { expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({abortSignal:vi.fn()}));
vi.mock('../../supabaseClient',()=>({supabaseServiceRole:{rpc:()=>({abortSignal:f.abortSignal})}}));
import { metaStore, MetaStoreFailure } from './store';
const id='10000000-0000-4000-8000-000000000001';
it.each(['42501','P0001','private-secret-code',null])('retains only allowlisted SQLSTATE for %s',async code=>{
 f.abortSignal.mockResolvedValue({error:{code,message:'private secret',details:'provider body',hint:'credential'}});
 const command=metaStore({actor:id,account:'123',binding:'a'.repeat(64)},{sourceKey:'synthetic',connectionId:id,environment:'test',token:'synthetic',databaseUrl:'postgres://unused',databaseSsl:false});
 let caught:unknown;try{await command('complete',id,new AbortController().signal);}catch(error){caught=error;}
 expect(caught).toBeInstanceOf(MetaStoreFailure);
 expect((caught as MetaStoreFailure).sqlState).toBe(code==='42501'||code==='P0001'?code:'unknown');
 expect(JSON.stringify(caught)).not.toMatch(/private|provider|credential/);
});
