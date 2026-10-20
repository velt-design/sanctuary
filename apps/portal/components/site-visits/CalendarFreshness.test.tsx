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
