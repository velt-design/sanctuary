import {expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({context:vi.fn(),url:vi.fn(),session:vi.fn()}));
vi.mock('@/lib/xero/pilotAccess',()=>({getPaymentPilotSession:mocks.session}));
vi.mock('@/lib/invoices/invoicePaymentRepository',()=>({loadInvoicePaymentContext:mocks.context}));
vi.mock('@/lib/xero/security',()=>({config:()=>({tenantId:'tenant'})}));
vi.mock('@/lib/xero/invoiceLink',()=>({xeroInvoiceUrl:mocks.url}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('NOT_FOUND')},redirect:(url:string)=>{throw Error(url)}}));
import Page from './page';
const invoice='11111111-1111-4111-8111-111111111111';
it('uses the server-bound Xero identity rather than the query as the provider ID',async()=>{
 mocks.session.mockResolvedValue({user:{id:'actor'}}); mocks.context.mockResolvedValue({providerInvoiceId:'saved-xero-id'}); mocks.url.mockResolvedValue('https://go.xero.com/exact');
 await expect(Page({searchParams:Promise.resolve({invoice})})).rejects.toThrow('https://go.xero.com/exact');
 expect(mocks.context).toHaveBeenCalledWith('actor',invoice,'tenant'); expect(mocks.url).toHaveBeenCalledWith('saved-xero-id');
});
it('requires finance permission before resolving the link',async()=>{
 mocks.context.mockClear(); mocks.session.mockResolvedValue(null);
 await expect(Page({searchParams:Promise.resolve({invoice})})).rejects.toThrow('NOT_FOUND'); expect(mocks.context).not.toHaveBeenCalled();
});
