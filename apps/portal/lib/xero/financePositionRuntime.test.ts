import { expect,it,vi } from 'vitest';
vi.mock('./financePositionAuthority',()=>({financePositionBinding:vi.fn()}));
import { positionRuntime } from './financePositionRuntime';
const id='10000000-0000-4000-8000-000000000001';
function fixture(){return {connector:()=>({databaseUrl:'postgres://unused',databaseSsl:false as const,token:'t'.repeat(32),sourceKey:'synthetic',connectionId:id,environment:'test'}),env:()=>({PRAXIS_XERO_FINANCE_POSITION_ENABLED:'true',XERO_PAYMENT_MATCHING_ENABLED:'true',PRAXIS_XERO_FINANCE_ACTOR_ID:id,XERO_TENANT_ID:id}),binding:vi.fn(async()=>({tenantId:id,scope:'organisation' as const})),read:vi.fn(async()=>[] as unknown[]),now:()=>new Date()};}
it('turns provider-budget expiry into family unavailability while allowing final authority verification',async()=>{
  const provider=new AbortController(),outer=new AbortController();let calls=0;
  const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>++calls===1?outer.signal:provider.signal);
  try {const deps=fixture(),source=positionRuntime(new AbortController().signal,deps);provider.abort();
    await expect(source.deps.read({family:'profitAndLoss',tenantId:id,query:{from:'2026-09-01',to:'2026-09-30',basis:'accrual'},page:1})).rejects.toMatchObject({reason:'provider_unavailable'});
    await expect(source.deps.binding(source.deadline)).resolves.toEqual({tenantId:id,scope:'organisation'});expect(deps.read).not.toHaveBeenCalled();
    outer.abort();expect(source.deadline.aborted).toBe(true);
  }finally{timeout.mockRestore();}
});
