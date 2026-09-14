import { afterEach,describe,expect,it,vi } from 'vitest';
import { accountingRead,tokenRequest } from './provider';
import { XERO_SCOPES } from './security';
afterEach(()=>vi.unstubAllGlobals());
describe('Xero provider boundary',()=>{
  it('rejects write scopes and never returns provider error bodies',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({access_token:'a',refresh_token:'r',expires_in:1800,scope:XERO_SCOPES+' accounting.invoices'}))
      .mockResolvedValueOnce(new Response('sensitive provider diagnostic',{status:400}));
    vi.stubGlobal('fetch',fetcher);
    await expect(tokenRequest('id','secret',new URLSearchParams())).rejects.toThrow('EXCESS_SCOPE');
    await expect(tokenRequest('id','secret',new URLSearchParams())).rejects.toThrow('RECONNECT_REQUIRED');
  });
  it('uses GET with a pinned tenant and excludes bank and line details',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({BankTransactions:[{BankTransactionID:'b1',Contact:{Name:'Test'},BankAccount:{Code:'private'},LineItems:[{Description:'private'}],Total:100,IsReconciled:true}]}));
    vi.stubGlobal('fetch',fetcher);
    const rows=await accountingRead({accessToken:'a',refreshToken:'r',expiresAt:0},'tenant','BankTransactions','Type=="RECEIVE"');
    expect(JSON.stringify(rows)).not.toContain('private');
    expect(rows[0]).toMatchObject({id:'b1',contact:'Test',total:100,reconciled:true});
    expect(fetcher.mock.calls[0][1].headers['Xero-tenant-id']).toBe('tenant');
    expect(fetcher.mock.calls[0][1].method).toBeUndefined();
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  });
});
