import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import StudioBookletProgress from './StudioBookletProgress';
import StudioNavigationCapture from './StudioNavigationCapture';
const mocks=vi.hoisted(()=>({api:vi.fn(),navigate:vi.fn()}));vi.mock('@/lib/repo/apiClient',()=>({apiJson:mocks.api}));
vi.mock('@/lib/designStudio/studioDocumentNavigation',()=>({navigateStudioDocument:mocks.navigate}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:vi.fn()})}));
let mount:ReturnType<typeof renderIntoDocument>|undefined;
beforeEach(()=>vi.resetAllMocks());afterEach(()=>{mount?.unmount();mount=undefined;});
it('shows actual completed durable pages and the same ready download after a remount',async()=>{
 mocks.api.mockResolvedValue({document:{snapshotId:'snapshot',state:'ready',completedPages:5,totalPages:5,percent:100,canRetry:false}});
 mount=renderIntoDocument(<StudioBookletProgress quoteId="qv-exact" snapshotId="snapshot"/>);await act(async()=>{});expect(mount.container.querySelector('a')?.getAttribute('href')).toBe('/api/quotes/qv-exact/studio-document?download=1');
 mount.unmount();mount=renderIntoDocument(<StudioBookletProgress quoteId="qv-exact" snapshotId="snapshot"/>);await act(async()=>{});expect(mocks.api).toHaveBeenCalledTimes(2);expect(mocks.api.mock.calls.every(([,options])=>!options.method)).toBe(true);
});
it('keeps a ready booklet download native through the real Studio navigation capture',async()=>{
 mocks.api.mockResolvedValue({document:{snapshotId:'snapshot',state:'ready',completedPages:5,totalPages:5,percent:100}});
 mount=renderIntoDocument(<><StudioNavigationCapture enabled/><StudioBookletProgress quoteId="qv-exact" snapshotId="snapshot"/></>);await act(async()=>{});
 const anchor=mount.container.querySelector('a')!;expect(anchor.hasAttribute('download')).toBe(true);
 const event=new MouseEvent('click',{bubbles:true,cancelable:true,button:0});await act(async()=>anchor.dispatchEvent(event));
 expect(event.defaultPrevented).toBe(false);expect(mocks.navigate).not.toHaveBeenCalled();expect(mount.container.textContent).toContain('Download design booklet');
});
it('retries only the same failed intent without any quote creation request',async()=>{
 mocks.api.mockResolvedValue({document:{snapshotId:'snapshot',state:'failed',completedPages:2,totalPages:5,percent:33,canRetry:true}});
 mount=renderIntoDocument(<StudioBookletProgress quoteId="qv-exact" snapshotId="snapshot"/>);await act(async()=>{});expect(mount.container.textContent).toContain('The quote is ready');
 await act(async()=>mount!.container.querySelector('button')!.click());const retry=mocks.api.mock.calls.find(([,options])=>options.method==='POST')!;expect(retry[0]).toBe('/api/quotes/qv-exact/studio-document');expect(JSON.parse(retry[1].body)).toEqual({snapshotId:'snapshot'});expect(mocks.api.mock.calls.every(([url])=>url.endsWith('/studio-document'))).toBe(true);
});
it('aborts polling when the fresh frame is withdrawn and refuses a late other-snapshot result',async()=>{
 const lifetime=new AbortController();let resolve!:(v:unknown)=>void;mocks.api.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 mount=renderIntoDocument(<StudioBookletProgress quoteId="qv-exact" snapshotId="snapshot" lifetime={lifetime.signal}/>);await act(async()=>{});const signal=mocks.api.mock.calls[0][1].signal;
 lifetime.abort();expect(signal.aborted).toBe(true);await act(async()=>resolve({document:{snapshotId:'another',state:'ready'}}));expect(mount.container.querySelector('a')).toBeNull();
});
it('keeps the financial quote available without a false loading bar, download or retry when it has no pergola drawings',async()=>{
 vi.useFakeTimers();try{
  mocks.api.mockResolvedValue({document:{snapshotId:'snapshot',state:'unavailable',completedPages:0,totalPages:0,percent:0,canRetry:false}});
  mount=renderIntoDocument(<StudioBookletProgress quoteId="qv-financial-only" snapshotId="snapshot"/>);await act(async()=>{});
  expect(mount.container.textContent).toContain('This quote has no pergola drawings.');
  expect(mount.container.querySelector('progress,a,button')).toBeNull();
  await act(async()=>vi.advanceTimersByTime(5000));expect(mocks.api).toHaveBeenCalledOnce();
 }finally{vi.useRealTimers();}
});
