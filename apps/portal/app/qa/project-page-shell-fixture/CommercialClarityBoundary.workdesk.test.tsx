import { act, useContext } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import Boundary from './CommercialClarityBoundary';
import { invoice, projectId, quotes } from './commercialClarityData';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import Files from '@/components/projects/ProjectPage/tabs/overview/ProjectSharePointFilesPanel';
import { fetchProjectFiles } from '@/lib/projects/sharePointFiles/client';
import { fetchPreparedPreviews } from '@/lib/projects/sharePointFiles/previews/client';
import WorkdeskFrame from './ProjectWorkdeskFixtureFrame';
import { workdeskProjectWork } from './workdeskProjectWork';

const push=vi.hoisted(()=>vi.fn());
let query='workdesk=1&commercial=1';
vi.mock('next/navigation',()=>({useRouter:()=>({push}),useSearchParams:()=>new URLSearchParams(query)}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=> 'https://example.invalid',supabaseHostFromUrl:()=> 'fixture'}));
vi.mock('next/link',()=>({default:({children,href,prefetch:_prefetch,...props}:any)=><a href={href} {...props}>{children}</a>}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({success:vi.fn(),error:vi.fn()})}));
let view:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{view?.unmount();view=undefined;vi.restoreAllMocks();vi.useRealTimers();push.mockClear();document.body.innerHTML='';sessionStorage.clear();query='workdesk=1&commercial=1';window.history.replaceState(null,'','/');});
function StaffProbe(){const staff=useContext(PortalAuthContext);return <span data-staff={staff?.status}>{staff?.role}</span>;}

it('lets the real Files explorer read finite local sources as synthetic staff and verifies actual preview receipts',async()=>{
  view=renderIntoDocument(<Boundary><StaffProbe/><Files projectId={projectId} host="fixture" workspace/></Boundary>);
  await vi.waitFor(async()=>{await act(async()=>{});expect(view!.container.querySelector('[data-staff]')?.textContent).toBe('staff');expect(view!.container.textContent).toContain('Proposals & correspondence');});
  expect(view.container.textContent).not.toContain('File access is unavailable');
  const root=await fetchProjectFiles(projectId,{}),rootId=root.rootId!;
  const folder=await fetchProjectFiles(projectId,{rootId,folderId:'documents'});
  expect(folder.items.map(file=>file.id)).toEqual(['quote-document','roof-question']);
  const decoded:Uint8Array[]=[];
  await fetchPreparedPreviews(projectId,{rootId,folderId:'documents',items:folder.items.map(file=>({id:file.id}))},new AbortController().signal,(item,bytes)=>{expect(item.version).toBe('"workdesk-sample-v1"');if(bytes)decoded.push(bytes);});
  expect(decoded).toHaveLength(2);expect(new TextDecoder().decode(decoded[0]).startsWith('%PDF-1.4')).toBe(true);
  expect((await fetch(`/api/staff/v1/projects/${projectId}/write`,{method:'POST'})).status).toBe(403);
});

it('connects current quote and source IDs and keeps excluded destinations outside the frame flow',async()=>{
  view=renderIntoDocument(<Boundary><header><h1>Sample project</h1></header><a href="/staff/outside-fixture">Other destination</a></Boundary>);
  const heading=view.container.querySelector('h1');
  let command:any;
  await act(async()=>{command=await (await fetch(`/api/staff/v1/projects/${projectId}/command-centre`)).json();});
  expect(command.currentDesign.quote.id).toBe(quotes[0].id);
  expect(command.currentDesign.estimate.id).toBe(quotes[0].sourceEstimateVersionId);
  expect(command.currentDesign.links.quote).toBe(`/staff/projects/${projectId}?tab=quotes&quoteId=${quotes[0].id}`);
  expect(command.currentDesign.links.estimate).toBe(`/staff/projects/${projectId}?tab=estimates&estimateId=${quotes[0].sourceEstimateVersionId}`);
  expect(command.projectWork.openItems.every((item:any)=>item.projectId===projectId)).toBe(true);
  expect(command.projectWork).toEqual(workdeskProjectWork());
  act(()=>view!.container.querySelector('a')!.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('outside the synthetic project');
  expect(view.container.querySelector('h1')).toBe(heading);
  expect(view.container.textContent).not.toContain('outside the synthetic project');
  act(()=>document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('opens the real Commercial frame directly with snapshot work, without first visiting Overview',async()=>{
  query='workdesk=1&commercial=1&tab=invoices';
  window.history.replaceState(null,'',`/qa/project-page-shell-fixture?${query}`);
  const snapshot={workModel:'v2',projectWork:workdeskProjectWork(),project:{id:projectId,name:'Sample project',stage:'deposit',contactName:'Sample customer',hasJobPacks:true},pipeline:{stage:'deposit'},notes:[],emails:[],activity:[]} as const;
  view=renderIntoDocument(<Boundary><WorkdeskFrame snapshot={snapshot as any} host="fixture" tab="invoices" snapshotState="fresh" snapshotContentReady/></Boundary>);
  for(let depth=0;depth<3;depth++)await act(async()=>{await vi.dynamicImportSettled();});
  await vi.waitFor(async()=>{await act(async()=>{});expect(view!.container.querySelector('[data-project-current-status]')?.textContent).toContain('Deposit');expect(view!.container.querySelector('[data-project-active-tab]')?.getAttribute('data-project-active-tab')).toBe('invoices');expect(view!.container.textContent).toContain(invoice.invoiceRef);});
  expect(view.container.textContent).not.toContain('Status unavailable');
  expect(view.container.textContent).not.toContain('Commercial actions paused');
});

it('observes correspondence on each successful late read and empty recheck, preserving original message dates',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-27T00:00:00Z'));
  view=renderIntoDocument(<Boundary><StaffProbe/></Boundary>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(121_000);});
  const path=`/api/staff/v1/projects/${projectId}/correspondence`;
  async function read(init?:RequestInit){const pending=fetch(path,init);await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});return (await pending).json();}
  const first=await read();expect(first.state).toBe('ready');expect(first.context.observedAt).toBe(new Date().toISOString());
  expect(first.context.snapshot).toEqual({checkedAt:first.context.observedAt,expiresAt:new Date(Date.now()+60*60_000).toISOString(),state:'recent',nextAttemptAt:null});
  const original=first.context.messages.map((message:any)=>[message.id,message.sentAt,message.receivedAt]);
  const recorded=first.context.sources.map((source:any)=>source.recordedAt);
  expect(first.context.messages.every((message:any)=>message.observedAt===first.context.observedAt)).toBe(true);
  await act(async()=>{await vi.advanceTimersByTimeAsync(121_000);});
  for(const init of [undefined,{method:'POST'}]){
    const next=await read(init);expect(Date.parse(next.context.observedAt)).toBeGreaterThan(Date.parse(first.context.observedAt));
    expect(next.context.messages.map((message:any)=>[message.id,message.sentAt,message.receivedAt])).toEqual(original);
    expect(next.context.sources.map((source:any)=>source.recordedAt)).toEqual(recorded);
    expect(next.context.sources.every((source:any)=>source.observedAt===next.context.observedAt)).toBe(true);
  }
  for(const [url,init] of [[path,{method:'POST',body:'{}'}],[path+'?analyze=true',{method:'POST'}],[path.replace(projectId,'other-project'),{method:'POST'}],[path,{method:'PUT'}]] as const)expect((await fetch(url,init)).status).toBe(403);
  expect((await fetch(new Request(new URL(path,location.href),{method:'POST',body:'{}'}))).status).toBe(403);
  const emptyRequest=fetch(new Request(new URL(path,location.href),{method:'POST'}));await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});expect((await emptyRequest).status).toBe(200);
  const controller=new AbortController(),pending=fetch(path,{signal:controller.signal});controller.abort();await expect(pending).rejects.toMatchObject({name:'AbortError'});
});

it('retains the controlled correspondence read failure and explicit retry',async()=>{
  query+='&readFailure=1';vi.useFakeTimers();view=renderIntoDocument(<Boundary><StaffProbe/></Boundary>);
  const path=`/api/staff/v1/projects/${projectId}/correspondence`;
  const first=fetch(path);await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});expect((await first).status).toBe(503);
  const retry=fetch(path,{method:'POST'});await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});expect((await retry).status).toBe(200);
});
