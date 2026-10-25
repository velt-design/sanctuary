import {act} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../../test/reactHarness';
import ProgressiveReads from './ProgressiveReads';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it('delays only existing local QA reads, fails once, rejects every send and restores fetch on exit',async()=>{
 vi.useFakeTimers();window.history.replaceState(null,'','/?progressive=1&readFailure=1');const original=vi.fn(async()=>Response.json({fixture:true}));vi.stubGlobal('fetch',original);const view=renderIntoDocument(<ProgressiveReads><p>Actual owner</p></ProgressiveReads>);
 let settled=false;const first=window.fetch('/api/qa/email-preview-workbench?variant=professional').then(value=>{settled=true;return value;});expect(settled).toBe(false);await act(async()=>vi.advanceTimersByTimeAsync(1200));expect((await first).status).toBe(503);expect(original).not.toHaveBeenCalled();const retry=window.fetch('/api/qa/email-preview-workbench?variant=professional');await act(async()=>vi.advanceTimersByTimeAsync(1200));expect((await retry).ok).toBe(true);expect(original).toHaveBeenCalledOnce();expect((await window.fetch('/api/qa/email-preview-workbench',{method:'POST'})).status).toBe(403);expect(original).toHaveBeenCalledOnce();view.unmount();expect(window.fetch).toBe(original);
});
