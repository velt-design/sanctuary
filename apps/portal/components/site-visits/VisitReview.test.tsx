import { act } from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import VisitReview from './VisitReview';
import { visitEditorDraft,visitEditorDetails,visitPeople } from './visitEditorModel';
const h=vi.hoisted(()=>({api:vi.fn()}));vi.mock('@/lib/repo/apiClient',()=>({apiJson:h.api}));
const project='00000000-0000-4000-8000-000000000002';
const visit:CalendarVisit={id:'00000000-0000-4000-8000-000000000001',revision:1,sourceKey:'synthetic',subject:'Site visit - Synthetic',startsAt:'2026-10-20T00:00:00Z',endsAt:'2026-10-20T00:30:00Z',isAllDay:false,allDayStartDate:null,allDayEndDate:null,sourceUrl:null,address:'12 Example Road',staff:[],assignmentHint:null,kind:'review',sourceKind:'review',cancelled:false,removed:false,duplicate:false,reviewReasons:[],projectId:null,projectName:null,contactName:null,phone:null,linkMode:'manual',kindOverride:null};
let mounted:ReturnType<typeof renderIntoDocument>|undefined;let client:QueryClient;
const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
function change(input:HTMLSelectElement|HTMLInputElement|HTMLTextAreaElement,value:string){act(()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLInputElement?HTMLInputElement.prototype:input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLSelectElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
const field=(container:HTMLElement,label:string)=>Array.from(container.querySelectorAll('label')).find(l=>l.firstChild?.textContent===label)!.querySelector('input,select,textarea') as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
const evidence=(container:HTMLElement)=>change(field(container,'Basis for these details'),'Verified against the linked synthetic project.');
function render(v=visit){const done=vi.fn();const ui=(current:CalendarVisit)=><QueryClientProvider client={client}><VisitReview visit={current} onDone={done}/></QueryClientProvider>;mounted=renderIntoDocument(ui(v));return {done,container:mounted.container,rerender:(next:CalendarVisit)=>mounted!.rerender(ui(next))};}
const button=(container:HTMLElement,text:string)=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text)!;
beforeEach(()=>{h.api.mockReset();client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});h.api.mockImplementation((path,options)=>Promise.resolve(options?.method==='POST'?{visit:{...visit,revision:2}}:path.includes('/projects?')?{projects:[{id:project,name:'Synthetic project',address:'12 Example Road'}],truncated:false}:{events:[{...visit,revision:2}]}));});
afterEach(()=>{mounted?.unmount();client.clear();vi.useRealTimers();});
describe('Visit review recovery',()=>{
 it('offers one canonical roster choice for a mapped source full name without guessing other identities',()=>{
  const mapped={name:'Jordan Synthetic Fullname',email:'original-rep@example.test',staffId:'jordan'};
  const choices=visitPeople({...visit,staff:[mapped,{name:'Unmapped visitor',email:'another@example.test'}]});
  expect(choices.filter(p=>p.staffId==='jordan')).toEqual([{name:'Jordan',email:'',staffId:'jordan'}]);
  expect(choices.some(p=>p.email==='another@example.test')).toBe(true);
 });
 it('keeps unchanged historical staff and facts when editing only its basis',()=>{
   const details={staff:[{name:'Jordan',staffId:'jordan',email:''}],purpose:'initial' as const,status:'attended' as const,address:null,timing:{mode:'unknown' as const,date:null,time:null,endTime:null}};
   const historical:CalendarVisit={...visit,origin:'history',projectId:project,...details,correction:{details,questions:[],basis:'Staff confirms original visit.',referenceUrl:null,sourceChanged:false,updatedAt:'2026-10-20T00:00:00Z'}};
   const draft=visitEditorDraft(historical);draft.basis='Clarified evidence, date intentionally unknown.';
   expect(visitEditorDetails(draft,historical)).toEqual(details);
 });
 it('keeps the chosen project while the search changes and submits that visible selection',async()=>{
   const {container,done}=render();change(field(container,'Find project'),'Synthetic');await settle();await settle();
   change(field(container,'Selected project'),project);change(field(container,'Find project'),'different');await settle();await settle();
   expect(field(container,'Selected project').value).toBe(project);expect((field(container,'Selected project') as HTMLSelectElement).selectedOptions[0].textContent).toContain('Synthetic project');
   evidence(container);act(()=>button(container,'Save details').click());await settle();expect(JSON.parse(h.api.mock.calls.find(c=>c[1]?.method==='POST')![1].body).projectId).toBe(project);expect(done).toHaveBeenCalledOnce();
 });
 it('locks pending saves and preserves choices after a failed save',async()=>{
   let reject!:(error:Error)=>void;h.api.mockImplementation((_path,options)=>options?.method==='POST'?new Promise((_resolve,no)=>{reject=no;}):Promise.resolve({projects:[],truncated:false}));
   const {container,done}=render();change(field(container,'Booking status'),'provisional');evidence(container);act(()=>button(container,'Save details').click());
   expect(container.querySelector('fieldset')!.disabled).toBe(true);expect(button(container,'Cancel').disabled).toBe(true);
   act(()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(h.api.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);
   await act(async()=>reject(new Error('Save failed')));expect(container.textContent).toContain('Save failed');expect(field(container,'Booking status').value).toBe('provisional');expect(button(container,'Cancel').disabled).toBe(false);expect(done).not.toHaveBeenCalled();
 });
 it('keeps the full draft and releases Cancel after a stalled save, requiring latest-state recovery',async()=>{
   vi.useFakeTimers();h.api.mockImplementation(()=>new Promise(()=>{}));
   const {container,done}=render();change(field(container,'Booking status'),'provisional');evidence(container);
   act(()=>button(container,'Save details').click());await act(async()=>{await vi.advanceTimersByTimeAsync(20_000);});
   expect(button(container,'Cancel').disabled).toBe(false);expect(button(container,'Save details').disabled).toBe(true);
   expect(container.textContent).toContain('They may already be saved');
   expect(field(container,'Booking status').value).toBe('provisional');
   expect(field(container,'Basis for these details').value).toBe('Verified against the linked synthetic project.');
   act(()=>button(container,'Reload latest visit').click());await act(async()=>{await vi.advanceTimersByTimeAsync(20_000);});
   expect(button(container,'Cancel').disabled).toBe(false);expect(button(container,'Save details').disabled).toBe(true);
   expect(container.textContent).toContain('latest visit could not be checked');
   act(()=>button(container,'Cancel').click());expect(done).toHaveBeenCalledOnce();
 });
 it('keeps drafts on a source revision and requires acknowledgement before saving that revision',async()=>{
   const {container,rerender}=render();change(field(container,'Include in site visits'),'excluded');evidence(container);rerender({...visit,revision:2,subject:'Updated source title'});
   expect(field(container,'Include in site visits').value).toBe('excluded');expect(button(container,'Save details').disabled).toBe(true);
   act(()=>button(container,'use the updated visit').click());act(()=>button(container,'Save details').click());await settle();
   expect(JSON.parse(h.api.mock.calls.find(c=>c[1]?.method==='POST')![1].body)).toMatchObject({revision:2,kind:'excluded'});
 });
 it('submits staff, address and access-window corrections without inventing exact attendance',async()=>{
   const {container}=render();const jordan=Array.from(container.querySelectorAll('label')).find(l=>l.textContent==='Jordan')!.querySelector('input')!;
   act(()=>jordan.click());change(field(container,'Site address'),'24 Verified Avenue');change(field(container,'Visit type'),'measurement');change(field(container,'Known timing'),'window');
   change(field(container,'Date (New Zealand)'),'2026-10-15');change(field(container,'Access from'),'09:00');change(field(container,'Access until'),'10:30');evidence(container);
   act(()=>button(container,'Save details').click());await settle();const sent=JSON.parse(h.api.mock.calls.find(c=>c[1]?.method==='POST')![1].body);
   expect(sent.details).toMatchObject({staff:[{name:'Jordan',staffId:'jordan',email:''}],address:'24 Verified Avenue',purpose:'measurement',timing:{mode:'window',date:'2026-10-15',time:'09:00',endTime:'10:30'}});expect(sent.details.status).toBeUndefined();
 });
 it('keeps an explicit classification question even when the appointment was booked',async()=>{
   const {container}=render();change(field(container,'Booking status'),'booked');change(field(container,'Include in site visits'),'review');evidence(container);
   act(()=>button(container,'Save details').click());await settle();expect(JSON.parse(h.api.mock.calls.find(c=>c[1]?.method==='POST')![1].body)).toMatchObject({kind:'review',details:{status:'booked'}});
 });
});
