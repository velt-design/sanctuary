import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('./store',()=>({access:async()=>({accessToken:'synthetic-test-token'})}));
const id='11111111-1111-4111-8111-111111111111';
vi.mock('./security',()=>({config:()=>({tenantId:'11111111-1111-4111-8111-111111111111'})}));
import {xeroInvoiceUrl} from './invoiceLink';
afterEach(()=>vi.unstubAllGlobals());
it('links the exact invoice within the verified organisation',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({Organisations:[{OrganisationID:id,ShortCode:'!Demo'}]}));
 vi.stubGlobal('fetch',fetcher);
 expect(await xeroInvoiceUrl(id)).toBe(`https://go.xero.com/app/!Demo/invoicing/view/${id}`);
 expect(fetcher.mock.calls[0][1].headers['Xero-tenant-id']).toBe(id);
});
it.each([{OrganisationID:'other',ShortCode:'!Demo'},{OrganisationID:id,ShortCode:'../../evil'},{OrganisationID:id}])('fails closed for invalid organisation evidence',async organisation=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({Organisations:[organisation]})));
 await expect(xeroInvoiceUrl(id)).rejects.toThrow('XERO_LINK_UNAVAILABLE');
});
