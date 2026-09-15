import { beforeEach,describe,expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const mocks=vi.hoisted(()=>({developer:vi.fn(),status:vi.fn()}));
vi.mock('./http',()=>({developer:mocks.developer}));
vi.mock('./store',()=>({status:mocks.status}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
import Page from '../../app/staff/developer/xero/page';
beforeEach(()=>vi.resetAllMocks());
describe('developer page',()=>{
  it('does not render or read connection information for ordinary users',async()=>{
    mocks.developer.mockResolvedValue(null);
    await expect(Page({searchParams:Promise.resolve({})})).rejects.toThrow('NOT_FOUND');
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it('renders a safe unavailable state without internal diagnostics',async()=>{
    mocks.developer.mockResolvedValue({user:{id:'developer'}});
    mocks.status.mockRejectedValue(new Error('private-database-url'));
    const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));
    expect(html).toContain('Setup unavailable');expect(html).not.toContain('private-database-url');
    expect(html).not.toContain('action="/api/integrations/xero/start"');
  });
  it('offers read-only inspection and labels verification separately from accounting sync',async()=>{
    mocks.developer.mockResolvedValue({user:{id:'developer'}});
    mocks.status.mockResolvedValue({connected:true,organisation:'Demo company',lastVerifiedAt:'2026-09-14T00:00:00Z',error:null});
    const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));
    expect(html).toContain('Last verified with Xero');expect(html).toContain('Receipt contact name');
    expect(html).toContain('Connecting does not record portal payments or post Xero invoices');
  });
});
