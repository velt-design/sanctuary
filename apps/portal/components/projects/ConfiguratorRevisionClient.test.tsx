import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
let root: Root | undefined;
let container: HTMLDivElement;
async function cleanup() { if(root) await act(async()=>root!.unmount()); root=undefined; container?.remove(); }
async function render(element:React.ReactNode) { container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root!.render(element)); }
function button(name:string) { const found=Array.from(container.querySelectorAll('button')).find(b=>b.textContent===name);if(!found) throw new Error(`Missing button ${name}`);return found; }
async function click(name:string) {await act(async()=>button(name).click());}

import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const mocks=vi.hoisted(()=>({api:vi.fn(),query:vi.fn()}));
vi.mock('@/lib/repo/apiClient',()=>({apiJson:mocks.api}));
vi.mock('@tanstack/react-query',()=>({useQuery:mocks.query}));
vi.mock('@/components/ui/foundation',()=>({
  Button:(props:React.ButtonHTMLAttributes<HTMLButtonElement>)=><button {...props}/>,
  ButtonLink:(props:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}/>,
  Card:({children}:{children:React.ReactNode})=><div>{children}</div>,
  DataStatePanel:()=> <p>Unavailable</p>,
}));
import ConfiguratorRevisionClient from './ConfiguratorRevisionClient';
const project='11111111-1111-4111-8111-111111111111';
const original={input:{widthMm:6000}}, revised={input:{widthMm:7000}};
const prepared={status:'prepared',preparationHash:'abcdef12'.repeat(8),price:{amountIncGst:12345,includesGst:true,currency:'NZD',breakdown:[{label:'Pergola and accessories',amountIncGst:12345}]}};
beforeEach(()=>{
  (globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.resetAllMocks();window.location.hash=new URLSearchParams({revisionDraft:JSON.stringify(revised)}).toString();
  mocks.query.mockReturnValue({isPending:false,isError:false,data:{projectId:project,sourceEstimateId:'22222222-2222-4222-8222-222222222222',design:original,marketingOrigin:'https://www.sanctuarypergolas.co.nz'}});
});
afterEach(async()=>{await cleanup();window.location.hash='';});
it('reviews returned changes before saving and retains retry identity after a lost response and refresh',async()=>{
  mocks.api.mockResolvedValueOnce(prepared).mockRejectedValueOnce(new Error('Response lost'));
  await render(<ConfiguratorRevisionClient projectId={project}/>);
  await click('Calculate revised price');
  expect(button('Save as new estimate')).toBeTruthy();
  expect(JSON.parse(mocks.api.mock.calls[0][1].body).design).toEqual(revised);
  await click('Save as new estimate');
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Response lost');
  const firstSave=JSON.parse(mocks.api.mock.calls[1][1].body);
  await cleanup();
  mocks.api.mockResolvedValueOnce(prepared).mockResolvedValueOnce({status:'saved',alreadyExisted:true});
  await render(<ConfiguratorRevisionClient projectId={project}/>);
  await click('Calculate revised price');
  expect(button('Save as new estimate')).toBeTruthy();
  await click('Save as new estimate');
  expect(container.querySelector('h2')?.textContent).toBe('Revision saved');
  expect(JSON.parse(mocks.api.mock.calls[3][1].body)).toEqual(firstSave);
  expect(original).toEqual({input:{widthMm:6000}});
});
it('removes an old review when recalculation fails rather than leaving a stale save action',async()=>{
  mocks.api.mockResolvedValueOnce(prepared).mockRejectedValueOnce(new Error('Approved pricebook unavailable'));
  await render(<ConfiguratorRevisionClient projectId={project}/>);
  await click('Calculate revised price');
  expect(button('Save as new estimate')).toBeTruthy();
  await click('Calculate revised price');
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Approved pricebook');
  expect(Array.from(container.querySelectorAll('button')).some(b=>b.textContent==='Save as new estimate')).toBe(false);
});
