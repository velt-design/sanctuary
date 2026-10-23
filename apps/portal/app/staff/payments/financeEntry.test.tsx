import {act,useEffect} from 'react';
import {renderIntoDocument} from '../../../../../test/reactHarness';
import {PortalPageSourceProvider,usePortalPageSourceController} from '@/components/page-state/PortalPageSource';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),xero:vi.fn(),mounts:0,retired:0}));
function PrivateLeaf({kind}:{kind:string}){useEffect(()=>{mocks.mounts++;return()=>{mocks.mounts--;mocks.retired++;};},[]);return <div data-finance-private={kind}>{kind==='register'?'Invoice and quote register':'Existing Xero review'}</div>;}
vi.mock('@/lib/xero/pilotAccess',()=>({getPaymentPilotSession:mocks.session}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');},useRouter:()=>({refresh:vi.fn()})}));
vi.mock('@/components/finance/FinanceRegister',()=>({default:()=> <PrivateLeaf kind="register"/>}));
vi.mock('./XeroFinanceReview',()=>({default:(...args:unknown[])=>mocks.xero(...args)}));
import Page from './page';
beforeEach(()=>{mocks.session.mockReset();mocks.xero.mockReset();mocks.xero.mockReturnValue(<PrivateLeaf kind="xero"/>);mocks.session.mockResolvedValue({user:{id:'finance'}});mocks.mounts=mocks.retired=0;});
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

let rendered:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{rendered?.unmount();rendered=undefined;});
it.each([{}, {tab:'xero'}])('retires the actual Finance private owner on accepted Projects selection and restores a valid cached return %j',async query=>{
 window.history.replaceState(null,'','/staff/payments');const leaf=await Page({searchParams:Promise.resolve(query)});
 let source!:ReturnType<typeof usePortalPageSourceController>;
 function Host(){source=usePortalPageSourceController(window.location.pathname,'/staff/payments','');return <PortalPageSourceProvider value={source}>{leaf}</PortalPageSourceProvider>;}
 rendered=renderIntoDocument(<Host/>);expect(mocks.mounts).toBe(1);
 rendered.rerender(<Host/>);expect(mocks.retired).toBe(0);
 act(()=>{source.begin('/staff/projects');window.history.pushState(null,'','/staff/projects');});
 expect(rendered.container.querySelector('[data-finance-private]')).toBeNull();expect(mocks.mounts).toBe(0);expect(mocks.retired).toBe(1);
 act(()=>{source.cancel();window.history.replaceState(null,'','/staff/payments');});rendered.rerender(<Host/>);
 expect(rendered.container.querySelector('[data-finance-private]')).not.toBeNull();expect(mocks.mounts).toBe(1);
});
it('awaits the existing Xero owner guard/setup and preserves its query before creating the completion',async()=>{
 let resolve!:(node:ReturnType<typeof PrivateLeaf>)=>void;
 const query={tab:'xero',view:'history',search:'Example',offset:'50'};
 mocks.xero.mockReturnValue(new Promise(r=>{resolve=r;}));let settled=false;
 const pending=Page({searchParams:Promise.resolve(query)}).then(value=>{settled=true;return value;});
 await Promise.resolve();await Promise.resolve();expect(settled).toBe(false);expect(mocks.session).not.toHaveBeenCalled();
 const args=mocks.xero.mock.calls[0][0];expect(await args.searchParams).toEqual(query);
 resolve(<PrivateLeaf kind="xero"/>);expect(renderToStaticMarkup(await pending)).toContain('Existing Xero review');
});
