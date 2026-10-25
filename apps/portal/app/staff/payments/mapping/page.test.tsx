import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({context:vi.fn()}));
vi.mock('@/lib/xero/pilotAccess',()=>({getPaymentPilotSession:async()=>({user:{id:'owner'}})}));
vi.mock('@/lib/invoices/financeMappingRepository',()=>({financeMappingContext:mocks.context}));
import MappingPage from './page';
const invoice='11111111-1111-4111-8111-111111111111';
it('returns actual header, forms and Back while one verified invoice context remains pending, before any Xero inspection',async()=>{
 mocks.context.mockReturnValue(new Promise(()=>{}));const page=await MappingPage({searchParams:Promise.resolve({invoice})}),html=renderToStaticMarkup(page);
 expect(mocks.context).toHaveBeenCalledWith('owner',invoice);expect(html).toContain('Confirm Xero details');expect(html).toContain('Back to finance review');expect(html).toContain('name="contactName"');expect(html).toContain('Sales account');expect(html).not.toContain('No accounting defaults have been confirmed');
});
it('converts a failed context to a safe unavailable result owned by the actual client',async()=>{
 mocks.context.mockRejectedValue(new Error('Private source error'));const page=await MappingPage({searchParams:Promise.resolve({invoice})});
 const content=page.props.children[2];expect(await content.props.contextRead).toBeNull();
});
