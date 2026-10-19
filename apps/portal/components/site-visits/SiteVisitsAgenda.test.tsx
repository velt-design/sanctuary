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
vi.mock('@/components/ui/foundation',()=>({PageLayout:({children}:{children:ReactNode})=><main>{children}</main>,Button:({children,...props}:{children:ReactNode})=><button {...props}>{children}</button>}));
vi.mock('./CalendarFreshness',()=>({default:()=>null}));
vi.mock('./VisitAgendaRow',()=>({default:({visit}:{visit:CalendarVisit})=><article>{visit.subject}</article>}));
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
const base:CalendarVisit={id:'first',revision:1,sourceKey:'synthetic',subject:'Courtyard next day',startsAt:'2026-10-21T00:00:00Z',endsAt:'2026-10-21T01:00:00Z',sourceUrl:null,address:'12 Example Road',staff:[{email:'morgan@example.test',name:'Morgan'}],assignmentHint:null,kind:'visit',sourceKind:'visit',cancelled:false,removed:false,duplicate:false,reviewReasons:[],projectId:'project',projectName:'Courtyard',contactName:null,phone:null,linkMode:'auto',kindOverride:null};
const replace=window.history.replaceState.bind(window.history);
function change(input:HTMLSelectElement|HTMLInputElement,value:string){act(()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLInputElement?'input':'change',{bubbles:true}));});}
function button(text:string){return Array.from(mounted!.container.querySelectorAll('button')).find(b=>b.textContent===text)!;}
async function historyGo(direction:'back'|'forward'){
  await act(async()=>{await new Promise<void>(resolve=>{window.addEventListener('popstate',()=>resolve(),{once:true});window.history[direction]();});});
}
beforeEach(()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T00:00:00Z'));
  replace(null,'','/staff/site-visits');
  // Model Next's documented native history bridge. Browser QA separately verifies the real router.
  vi.spyOn(window.history,'replaceState').mockImplementation((...args)=>{replace(...args);window.dispatchEvent(new Event('popstate'));});
  h.read.mockReset();h.read.mockReturnValue({data:{enabled:false,events:[base,{...base,id:'second',subject:'Harbour today',projectName:'Harbour',startsAt:'2026-10-20T01:00:00Z',endsAt:'2026-10-20T02:00:00Z',staff:[{email:'alex@example.test',name:'Alex'}]}],lastSuccess:'2026-10-20T00:00:00Z'},denied:false,isError:false});
});
afterEach(()=>{mounted?.unmount();mounted=undefined;vi.restoreAllMocks();vi.useRealTimers();replace(null,'','/');});
describe('Site visit URL and return state',()=>{
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
