import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import VisitAgendaRow from './VisitAgendaRow';
import ProjectNextVisit from './ProjectNextVisit';
import TodayVisits from './TodayVisits';
const h=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('./useCalendarVisits',()=>({useCalendarVisits:h.read}));
vi.mock('./CalendarFreshness',()=>({default:()=>null}));
const allDay:CalendarVisit={id:'all-day',revision:1,sourceKey:'synthetic',subject:'Synthetic provisional visit',startsAt:'2026-10-18T11:00:00Z',endsAt:'2026-10-21T11:00:00Z',isAllDay:true,allDayStartDate:'2026-10-19',allDayEndDate:'2026-10-22',sourceUrl:null,address:'12 Example Road',staff:[{name:'Example Rep',email:'rep@example.invalid'}],assignmentHint:null,kind:'provisional',sourceKind:'provisional',cancelled:false,removed:false,duplicate:false,reviewReasons:[],projectId:'project',projectName:'Synthetic project',contactName:null,phone:null,linkMode:'auto',kindOverride:null};
const timed:CalendarVisit={...allDay,id:'timed',subject:'Synthetic timed visit',kind:'visit',sourceKind:'visit',isAllDay:false,allDayStartDate:null,allDayEndDate:null,startsAt:'2026-10-19T21:15:00Z',endsAt:'2026-10-19T21:45:00Z'};
const text=(html:string)=>{const node=document.createElement('div');node.innerHTML=html;return node.textContent??'';};
const router: AppRouterInstance = {
  back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(),
  bfcacheId: 'all-day-presentation',
};
const renderTodayVisits=()=>renderToStaticMarkup(
  <AppRouterContext.Provider value={router}><QueryClientProvider client={new QueryClient()}>
    <TodayVisits/>
  </QueryClientProvider></AppRouterContext.Provider>,
);
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T00:00:00Z'));h.read.mockReturnValue({data:{enabled:false,lastSuccess:'2026-10-20T00:00:00Z',events:[allDay]},denied:false,isError:false});});
afterEach(()=>vi.useRealTimers());
describe('All-day visit presentation',()=>{
 it('makes actual unanswered questions visible in review without making provenance the primary message',()=>{
   const html=renderToStaticMarkup(<VisitAgendaRow visit={{...timed,reviewReasons:['Confirm the replacement date','Confirm the site address']}} questionFirst/>);
   expect(text(html)).toContain('Answer neededConfirm the replacement dateConfirm the site address');
   expect(text(html)).toContain('Resolve questions');
   expect(html).not.toContain('<summary>Details to check');
   expect(text(html).indexOf('Confirm the replacement date')).toBeLessThan(text(html).indexOf('Invited in Outlook'));
 });
 it('renders All day and the inclusive date range in agenda and project, with staff/provisional context on the dashboard',()=>{
   const row=text(renderToStaticMarkup(<VisitAgendaRow visit={allDay}/>));
   const project=text(renderToStaticMarkup(<ProjectNextVisit projectId="project" host="test"/>));
   const dashboardHtml=renderTodayVisits();
   const dashboard=text(dashboardHtml);
   for(const value of [row,project]){expect(value).toContain('All day');expect(value).toContain('Monday, 19 October to Wednesday, 21 October');expect(value).not.toMatch(/12:00|1:00/);}
   expect(dashboard).toContain('All day');expect(dashboard).toContain('Example Rep');expect(dashboard).toContain('Provisional');
   expect(dashboardHtml).toContain('href="/staff/site-visits"');
   expect(dashboardHtml).toContain('href="/staff/site-visits?project=project&amp;view=today#visit-all-day"');
   const single={...allDay,allDayStartDate:'2026-10-20',allDayEndDate:'2026-10-21'};
   expect(text(renderToStaticMarkup(<VisitAgendaRow visit={single}/>))).toContain('All dayTuesday, 20 October');
 });
 it('expires at Auckland midnight after the final covered day, while keeping timed clock times',()=>{
   vi.setSystemTime(new Date('2026-10-21T11:00:00Z'));
   expect(text(renderToStaticMarkup(<ProjectNextVisit projectId="project" host="test"/>))).toContain('No upcoming Outlook visit');
   expect(text(renderTodayVisits())).toContain('No site visits in today’s calendar');
   h.read.mockReturnValue({data:{enabled:false,lastSuccess:'2026-10-20T00:00:00Z',events:[timed]},denied:false,isError:false});
   vi.setSystemTime(new Date('2026-10-19T20:00:00Z'));
   expect(text(renderToStaticMarkup(<VisitAgendaRow visit={timed}/>))).toContain('10:15 amto 10:45 am');
   expect(text(renderToStaticMarkup(<ProjectNextVisit projectId="project" host="test"/>))).toContain('10:15 am to 10:45 am');
   expect(text(renderTodayVisits())).toContain('10:15 am');
 });
});
