import { act } from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import VisitReview from './VisitReview';
const h=vi.hoisted(()=>({api:vi.fn()}));vi.mock('@/lib/repo/apiClient',()=>({apiJson:h.api}));
const project='00000000-0000-4000-8000-000000000002';
const visit:CalendarVisit={id:'00000000-0000-4000-8000-000000000001',revision:1,sourceKey:'synthetic',subject:'Site visit - Synthetic',startsAt:'2026-10-20T00:00:00Z',endsAt:'2026-10-20T00:30:00Z',isAllDay:false,allDayStartDate:null,allDayEndDate:null,sourceUrl:null,address:'12 Example Road',staff:[],assignmentHint:null,kind:'review',sourceKind:'review',cancelled:false,removed:false,duplicate:false,reviewReasons:[],projectId:null,projectName:null,contactName:null,phone:null,linkMode:'manual',kindOverride:null};
let mounted:ReturnType<typeof renderIntoDocument>|undefined;let client:QueryClient;
const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
function change(input:HTMLSelectElement|HTMLInputElement,value:string){act(()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLInputElement?'input':'change',{bubbles:true}));});}
function render(v=visit){const done=vi.fn();const ui=(current:CalendarVisit)=><QueryClientProvider client={client}><VisitReview visit={current} onDone={done}/></QueryClientProvider>;mounted=renderIntoDocument(ui(v));return {done,container:mounted.container,rerender:(next:CalendarVisit)=>mounted!.rerender(ui(next))};}
const button=(container:HTMLElement,text:string)=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text)!;
beforeEach(()=>{h.api.mockReset();client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});h.api.mockResolvedValue({projects:[{id:project,name:'Synthetic project',address:'12 Example Road'}],truncated:false});});
afterEach(()=>{mounted?.unmount();client.clear();});
describe('Visit review recovery',()=>{
 it('keeps the chosen project while the search changes and submits that visible selection',async()=>{
   const {container,done}=render();change(container.querySelector('input')!,'Synthetic');await settle();await settle();
   change(container.querySelectorAll('select')[2],project);change(container.querySelector('input')!,'different');await settle();await settle();
   expect(container.querySelectorAll('select')[2].value).toBe(project);expect(container.querySelectorAll('select')[2].selectedOptions[0].textContent).toContain('Synthetic project');
   act(()=>button(container,'Save review').click());await settle();expect(JSON.parse(h.api.mock.calls.find(c=>c[1]?.method==='POST')![1].body).projectId).toBe(project);expect(done).toHaveBeenCalledOnce();
 });
 it('locks pending saves and preserves choices after a failed save',async()=>{
   let reject!:(error:Error)=>void;h.api.mockImplementation((_path,options)=>options?.method==='POST'?new Promise((_resolve,no)=>{reject=no;}):Promise.resolve({projects:[],truncated:false}));
   const {container,done}=render();change(container.querySelector('select')!,'provisional');act(()=>button(container,'Save review').click());
   expect(container.querySelector('fieldset')!.disabled).toBe(true);expect(button(container,'Cancel').disabled).toBe(true);
   act(()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(h.api.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);
   await act(async()=>reject(new Error('Save failed')));expect(container.textContent).toContain('Save failed');expect(container.querySelector('select')!.value).toBe('provisional');expect(button(container,'Cancel').disabled).toBe(false);expect(done).not.toHaveBeenCalled();
 });
 it('keeps drafts on a source revision and requires acknowledgement before saving that revision',async()=>{
   const {container,rerender}=render();change(container.querySelector('select')!,'excluded');rerender({...visit,revision:2,subject:'Updated source title'});
   expect(container.querySelector('select')!.value).toBe('excluded');expect(button(container,'Save review').disabled).toBe(true);
   act(()=>button(container,'use the updated visit').click());act(()=>button(container,'Save review').click());await settle();
   expect(JSON.parse(h.api.mock.calls.find(c=>c[1]?.method==='POST')![1].body)).toMatchObject({revision:2,kind:'excluded'});
 });
});
