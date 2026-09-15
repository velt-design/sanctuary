import {expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('server-only',()=>({}));
vi.mock('../supabaseClient',()=>({supabaseServiceRole:{rpc}}));
import {financeMappingContext} from './financeMappingRepository';
it('distinguishes invoice details needing correction from database outages',async()=>{
 rpc.mockResolvedValue({data:null,error:{message:'XERO_MAPPING_CONTEXT_UNAVAILABLE'}});
 await expect(financeMappingContext('actor','invoice')).rejects.toThrow('XERO_MAPPING_DETAILS_REQUIRED');
 rpc.mockResolvedValue({data:null,error:{message:'connection unavailable'}});
 await expect(financeMappingContext('actor','invoice')).rejects.toThrow('XERO_MAPPING_CONTEXT_UNAVAILABLE');
});
