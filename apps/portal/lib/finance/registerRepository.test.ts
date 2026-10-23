import { afterEach, expect, it, vi } from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../supabaseClient',()=>({supabaseServiceRole:{rpc}}));
import { loadFinanceRegister } from './registerRepository';
const query={tab:'invoices' as const,view:'outstanding',search:'Synthetic',sent:'sent' as const,offset:50};
afterEach(()=>vi.clearAllMocks());
it('uses one bounded actor-scoped RPC and validates the whole response',async()=>{
  rpc.mockResolvedValue({data:{checkedAt:'2026-10-23T00:00:00Z',count:0,hasMore:false,draftsAllowed:true,rows:[],totals:[],privatePayload:'must not escape'},error:null});
  const result=await loadFinanceRegister('server-actor',query);
  expect(rpc).toHaveBeenCalledOnce();expect(rpc).toHaveBeenCalledWith('finance_register_v1',{p_actor:'server-actor',p_tab:'invoices',p_view:'outstanding',p_search:'Synthetic',p_sent:'sent',p_offset:50});
  expect(result).not.toHaveProperty('privatePayload');
});
it('never presents a missing reader or malformed response as no outstanding invoices',async()=>{
  rpc.mockResolvedValue({error:{message:'missing function'}});await expect(loadFinanceRegister('actor',query)).rejects.toThrow('FINANCE_REGISTER_UNAVAILABLE');
  rpc.mockResolvedValue({data:{rows:[],totals:[]},error:null});await expect(loadFinanceRegister('actor',query)).rejects.toThrow('FINANCE_REGISTER_UNAVAILABLE');
});
