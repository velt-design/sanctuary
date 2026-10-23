import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn()}));
vi.mock('@/lib/xero/pilotAccess',()=>({getPaymentPilotSession:mocks.session}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('@/components/finance/FinanceRegister',()=>({default:()=> <div>Invoice and quote register</div>}));
vi.mock('./XeroFinanceReview',()=>({default:()=> <div>Existing Xero review</div>}));
import Page from './page';
beforeEach(()=>{mocks.session.mockReset();mocks.session.mockResolvedValue({user:{id:'finance'}});});
it('opens the ordinary register by default and for quote tabs',async()=>{
  expect(renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}))).toContain('Invoice and quote register');
  expect(renderToStaticMarkup(await Page({searchParams:Promise.resolve({tab:'quotes',view:'history'})}))).toContain('Invoice and quote register');
});
it.each([{view:'attention'},{view:'current'},{view:'history'},{tab:'xero'}])('preserves legacy Xero entry %j',async query=>{
  expect(renderToStaticMarkup(await Page({searchParams:Promise.resolve(query)}))).toContain('Existing Xero review');
});
it('denies the whole finance surface before either read path',async()=>{
  mocks.session.mockResolvedValue(null); await expect(Page({searchParams:Promise.resolve({})})).rejects.toThrow('NOT_FOUND');
});
