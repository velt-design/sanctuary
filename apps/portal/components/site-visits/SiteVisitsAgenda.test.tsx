import { act, useSyncExternalStore, type ReactNode } from 'react';
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import SiteVisitsAgenda from './SiteVisitsAgenda';

const h=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(useSyncExternalStore(
  listener=>{window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener);},
  ()=>window.location.search,()=>'',
))}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock('./useCalendarVisits',()=>({calendarVisitKey:['test-visits'],useCalendarVisits:h.read}));
vi.mock('@/components/layout/StaffPageHeader',()=>({default:({title}:{title:string})=><h1>{title}</h1>}));
vi.mock('@/components/ui/foundation',()=>({
  PageLayout:({children}:{children:ReactNode})=><main>{children}</main>,
  Button:({children,...props}:{children:ReactNode})=><button {...props}>{children}</button>,
  LoadingSkeleton:({label}:{label:string})=><p>{label}</p>,
  DataStatePanel:({title}:{title:string})=><p>{title}</p>,
}));
vi.mock('./VisitAgendaRow',()=>({default:({visit}:{visit:CalendarVisit})=><article>{visit.subject}</article>}));
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
const base:CalendarVisit={id:'first',revision:1,sourceKey:'synthetic',subject:'Courtyard next day',startsAt:'2026-10-21T00:00:00Z',endsAt:'2026-10-21T01:00:00Z',isAllDay:false,allDayStartDate:null,allDayEndDate:null,sourceUrl:null,address:'12 Example Road',staff:[{email:'morgan@example.test',name:'Morgan'}],assignmentHint:null,kind:'visit',sourceKind:'visit',cancelled:false,removed:false,duplicate:false,reviewReasons:[],projectId:'project',projectName:'Courtyard',contactName:null,phone:null,linkMode:'auto',kindOverride:null};
const replace=window.history.replaceState.bind(window.history);
const push=window.history.pushState.bind(window.history);
function change(input:HTMLSelectElement|HTMLInputElement,value:string){act(()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLInputElement?'input':'change',{bubbles:true}));});}
function button(text:string){return Array.from(mounted!.container.querySelectorAll('button')).find(b=>b.textContent===text)!;}
async function historyGo(direction:'back'|'forward'){
  await act(async()=>{await new Promise<void>(resolve=>{window.addEventListener('popstate',()=>resolve(),{once:true});window.history[direction]();});});
}
beforeEach(()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T00:00:00Z'));
  replace(null,'','/staff/site-visits');
  // Next copies router metadata for external native writes. Passing its internal
  // marker back explicitly bypasses the bridge (and must not be done by controls).
  function bridge(native:typeof replace,data:unknown,unused:string,url?:string|URL|null){
    const internal=Boolean((data as {__NA?:boolean}|null)?.__NA);
    native({...window.history.state,...(data as object|null)},unused,url);
    if(!internal)window.dispatchEvent(new Event('popstate'));
  }
  vi.spyOn(window.history,'replaceState').mockImplementation((...args)=>bridge(replace,...args));
  vi.spyOn(window.history,'pushState').mockImplementation((...args)=>bridge(push,...args));
  h.read.mockReset();h.read.mockReturnValue({data:{enabled:false,events:[base,{...base,id:'second',subject:'Harbour today',projectName:'Harbour',startsAt:'2026-10-20T01:00:00Z',endsAt:'2026-10-20T02:00:00Z',staff:[{email:'alex@example.test',name:'Alex'}]}],lastSuccess:'2026-10-20T00:00:00Z'},denied:false,isError:false});
});
afterEach(()=>{mounted?.unmount();mounted=undefined;vi.restoreAllMocks();vi.useRealTimers();replace(null,'','/');});
describe('Site visit URL and return state',()=>{
  it('keeps controls before changing source/scope content through delayed data, errors and scope clearing',()=>{
    replace(null,'','/staff/site-visits?project=project&view=history');
    const saved=h.read();const refetch=vi.fn();
    h.read.mockReturnValue({data:undefined,isPending:true,denied:false,isError:false,refetch});
    mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    const group=mounted.container.querySelector('[aria-label="Show visits"]')!;
    const review=Array.from(group.querySelectorAll('button')).find(b=>b.textContent?.startsWith('Needs review'))!;
    const count=review.querySelector('span')!,attending=mounted.container.querySelector('select')!,search=mounted.container.querySelector('input')!;
    const context=mounted.container.querySelector('[aria-label="Calendar source and scope"]')!;
    const before=(left:Node,right:Node)=>expect(left.compareDocumentPosition(right)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    before(group,context);before(attending,context);before(search,context);
    expect(count.getAttribute('data-pending')).toBe('true');
    expect(mounted.container.textContent).toContain('Loading site visits');
    act(()=>mounted!.container.querySelector<HTMLAnchorElement>('a')!.click());
    act(()=>review.click());
    expect(new URL(window.location.href).searchParams.get('view')).toBe('review');
    expect(new URL(window.location.href).searchParams.has('project')).toBe(false);
    expect(review.getAttribute('aria-pressed')).toBe('true');
    h.read.mockReturnValue({...saved,isPending:false,isError:true,refetch});mounted.rerender(<SiteVisitsAgenda/>);
    expect(mounted.container.querySelector('[aria-label="Show visits"]')).toBe(group);
    expect(mounted.container.querySelector('select')).toBe(attending);expect(mounted.container.querySelector('input')).toBe(search);
    expect(review.querySelector('span')).toBe(count);expect(count.hasAttribute('data-pending')).toBe(false);
    expect(context.textContent).toContain('Latest Portal read failed. Showing saved data.');
    before(search,button('Retry loading saved visits'));act(()=>button('Retry loading saved visits').click());expect(refetch).toHaveBeenCalledOnce();
    expect(review.getAttribute('aria-pressed')).toBe('true');
  });
  it('retains one count slot for zero, larger counts and loading without changing later button identity',()=>{
    mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    const review=Array.from(mounted.container.querySelectorAll('button')).find(b=>b.textContent?.startsWith('Needs review'))!;
    const count=review.querySelector('span')!,history=button('History'),changes=button('Changes');
    expect(count.textContent).toBe('0');
    const saved=h.read();
    h.read.mockReturnValue({...saved,data:{...saved.data,events:Array.from({length:1000},(_,i)=>({...base,id:`review-${i}`,kind:'review',sourceKind:'review'}))}});mounted.rerender(<SiteVisitsAgenda/>);
    expect(review.querySelector('span')).toBe(count);expect(count.textContent).toBe('999+');expect(review.getAttribute('aria-label')).toBe('Needs review, 1000 entries');
    expect(button('History')).toBe(history);expect(button('Changes')).toBe(changes);
    h.read.mockReturnValue({data:undefined,isPending:true,denied:false,isError:false});mounted.rerender(<SiteVisitsAgenda/>);
    expect(review.querySelector('span')).toBe(count);expect(count.getAttribute('data-pending')).toBe('true');
    expect(button('History')).toBe(history);expect(button('Changes')).toBe(changes);
  });
  it('changes scope immediately so a rapid next view cannot restore the previous project',async()=>{
    replace({__NA:true,tree:['existing-router-state']},'','/staff/site-visits?project=project&view=upcoming&q=Courtyard');
    mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    const all=mounted.container.querySelector<HTMLAnchorElement>('a')!;
    expect(all.getAttribute('href')).toBe('/staff/site-visits?view=upcoming&q=Courtyard');
    act(()=>all.click());act(()=>button('This week').click());
    expect(new URL(window.location.href).searchParams.has('project')).toBe(false);
    expect(button('This week').getAttribute('aria-pressed')).toBe('true');
    expect(h.read).toHaveBeenLastCalledWith(undefined);
    expect(window.history.state).toEqual({__NA:true,tree:['existing-router-state']});
    await historyGo('back');expect(h.read).toHaveBeenLastCalledWith('project');expect(button('Upcoming').getAttribute('aria-pressed')).toBe('true');
    await historyGo('forward');expect(h.read).toHaveBeenLastCalledWith(undefined);expect(button('This week').getAttribute('aria-pressed')).toBe('true');
    expect(mounted.container.querySelector('input')!.value).toBe('Courtyard');
  });
  it('shows one attending filter for mapped Outlook and manual versions of the same staff member',()=>{
    h.read.mockReturnValue({data:{enabled:false,lastSuccess:'2026-10-20T00:00:00Z',events:[{...base,staff:[{name:'Jordan Synthetic Fullname',email:'original-rep@example.test',staffId:'jordan'}]},{...base,id:'manual',staff:[{name:'Jordan',email:'',staffId:'jordan'}]}]},denied:false,isError:false});
    replace(null,'','/staff/site-visits?view=week&person=original-rep%40example.test');mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    expect(Array.from(mounted.container.querySelectorAll('option')).filter(o=>o.value==='staff:jordan').map(o=>o.textContent)).toEqual(['Jordan']);
    expect(mounted.container.querySelector('select')!.value).toBe('staff:jordan');expect(mounted.container.querySelectorAll('article')).toHaveLength(2);
    change(mounted.container.querySelector('select')!,'staff:jordan');expect(mounted.container.querySelectorAll('article')).toHaveLength(2);
  });
  it('reevaluates the all-day boundary on a poll render even when saved data is unchanged',()=>{
    h.read.mockReturnValue({data:{enabled:false,lastSuccess:'2026-10-20T00:00:00Z',events:[{...base,isAllDay:true,allDayStartDate:'2026-10-20',allDayEndDate:'2026-10-21',startsAt:'2026-10-19T11:00:00Z',endsAt:'2026-10-20T11:00:00Z'}]},denied:false,isError:false});
    vi.setSystemTime(new Date('2026-10-20T10:59:59Z'));mounted=renderIntoDocument(<SiteVisitsAgenda/>);expect(mounted.container.querySelectorAll('article')).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-20T11:00:00Z'));mounted.rerender(<SiteVisitsAgenda/>);expect(mounted.container.querySelectorAll('article')).toHaveLength(0);
  });
  it('restores all controls and matching rows from the return URL after a project round trip',async()=>{
    mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    change(mounted.container.querySelector('select')!,'morgan@example.test');act(()=>button('This week').click());change(mounted.container.querySelector('input')!,'Courtyard');
    const returnUrl=window.location.href;
    expect(mounted.container.querySelector('article')!.textContent).toBe('Courtyard next day');
    mounted.unmount();mounted=undefined;window.history.pushState(null,'','/staff/projects/project');
    await historyGo('back');mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    expect(window.location.href).toBe(returnUrl);expect(button('This week').getAttribute('aria-pressed')).toBe('true');
    expect(mounted.container.querySelector('select')!.value).toBe('morgan@example.test');expect(mounted.container.querySelector('input')!.value).toBe('Courtyard');
    expect(Array.from(mounted.container.querySelectorAll('article')).map(row=>row.textContent)).toEqual(['Courtyard next day']);
  });
  it('follows Back and Forward with a mounted agenda, including project scope',async()=>{
    replace(null,'','/staff/site-visits?view=week&person=morgan%40example.test&q=Courtyard&project=project');
    window.history.pushState(null,'','/staff/site-visits?view=today');mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    await historyGo('back');expect(button('This week').getAttribute('aria-pressed')).toBe('true');expect(h.read).toHaveBeenLastCalledWith('project');
    expect(mounted.container.querySelector('input')!.value).toBe('Courtyard');
    await historyGo('forward');expect(button('Today').getAttribute('aria-pressed')).toBe('true');expect(h.read).toHaveBeenLastCalledWith(undefined);
    expect(mounted.container.querySelector('input')!.value).toBe('');expect(mounted.container.querySelector('select')!.value).toBe('');
    expect(mounted.container.querySelector('article')!.textContent).toBe('Harbour today');
  });
  it('keeps rapid typing and clearing in the URL without adding history entries or dropping scope',()=>{
    replace(null,'','/staff/site-visits?view=week&project=project');mounted=renderIntoDocument(<SiteVisitsAgenda/>);
    const length=window.history.length,input=mounted.container.querySelector('input')!;
    for(const text of ['C','Co','Cou','Court','Courtyard'])change(input,text);
    expect(input.value).toBe('Courtyard');expect(new URL(window.location.href).searchParams.get('q')).toBe('Courtyard');expect(window.history.length).toBe(length);
    act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(input.value).toBe('');expect(new URL(window.location.href).searchParams.get('project')).toBe('project');expect(button('This week').getAttribute('aria-pressed')).toBe('true');
  });
});
