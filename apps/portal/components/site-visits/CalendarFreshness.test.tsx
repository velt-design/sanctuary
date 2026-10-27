import {act} from 'react';
import {renderIntoDocument} from '../../../../test/reactHarness';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,describe,it,expect,vi } from 'vitest';
import CalendarFreshness from './CalendarFreshness';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
const data:VisitSnapshot={enabled:true,lastSuccess:'2026-10-20T00:00:00Z',lastAttempt:null,error:null,rangeStart:null,rangeEnd:null,syncing:false,events:[]};
afterEach(()=>vi.useRealTimers());
describe('Honest calendar freshness',()=>{
 it('withholds cadence claims when runtime connection is disabled',()=>{
   vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-20T00:10:00Z'));
   const html=renderToStaticMarkup(<CalendarFreshness data={{...data,enabled:false}}/>);expect(html).toContain('connection is not active');expect(html).not.toContain('Updates every');expect(html).toContain('Outlook updated');
 });
 it('shows stale and failed reads alongside saved data, then clears the failure on successful recovery',()=>{
   vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-20T01:00:00Z'));
   expect(renderToStaticMarkup(<CalendarFreshness data={data}/>)).toContain('updates are overdue');
   expect(renderToStaticMarkup(<CalendarFreshness data={{...data,error:'SOURCE_UNAVAILABLE'}}/>)).toContain('last Outlook update failed');
   expect(renderToStaticMarkup(<CalendarFreshness data={data} readFailed/>)).toContain('Showing saved data');
   const recovered=renderToStaticMarkup(<CalendarFreshness data={{...data,lastSuccess:'2026-10-20T00:59:00Z'}}/>);expect(recovered).toContain('Updates every 15 minutes');expect(recovered).not.toContain('overdue');
 });
});

it('keeps one compact status through the existing freshness timer and exposes full context without moving work',()=>{
 vi.useFakeTimers({toFake:['Date','setInterval','clearInterval']});vi.setSystemTime(new Date('2026-10-20T00:29:00Z'));
 const view=renderIntoDocument(<CalendarFreshness compact data={data}/>),status=view.container.firstElementChild;
 expect(status?.textContent).not.toContain('overdue');act(()=>vi.advanceTimersByTime(120000));expect(view.container.firstElementChild).toBe(status);expect(status?.textContent).toContain('Calendar updates are overdue');
 const details=[...view.container.querySelectorAll('button')].find(button=>button.textContent==='Details')!;act(()=>details.click());expect(document.body.textContent).toContain('Check Outlook for recent changes');
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.activeElement).toBe(details);
 view.rerender(<CalendarFreshness compact data={data} readFailed message="Outlook calendar updated."/>);expect(view.container.firstElementChild).toBe(status);expect(status?.textContent).toContain('Latest Portal read failed');
 act(()=>details.click());expect(document.body.textContent).toContain('Outlook calendar updated.');expect(document.body.textContent).toContain('Latest Portal read failed. Showing saved data.');view.unmount();
});


it('keeps the same freshness root, disclosure and focus from an unresolved read through adoption and failure',()=>{
 const view=renderIntoDocument(<CalendarFreshness compact/>),root=view.container.firstElementChild;
 const details=view.container.querySelector<HTMLButtonElement>('button')!;act(()=>details.focus());
 view.rerender(<CalendarFreshness compact data={data}/>);expect(view.container.firstElementChild).toBe(root);expect(view.container.querySelector('button')).toBe(details);expect(document.activeElement).toBe(details);
 view.rerender(<CalendarFreshness compact data={data} readFailed/>);expect(view.container.querySelector('button')).toBe(details);expect(document.activeElement).toBe(details);
 act(()=>details.click());expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Showing saved data');
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.activeElement).toBe(details);view.unmount();
});
