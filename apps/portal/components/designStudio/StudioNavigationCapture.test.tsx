import {act} from 'react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import StudioNavigationCapture from './StudioNavigationCapture';
const mocks=vi.hoisted(()=>({navigate:vi.fn(),error:vi.fn()}));
vi.mock('@/lib/designStudio/studioDocumentNavigation',()=>({navigateStudioDocument:mocks.navigate}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:mocks.error})}));
const href='/staff/design-studio/proj_10000000-0000-4000-8000-000000000001/est_20000000-0000-4000-8000-000000000001/edit';
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
beforeEach(()=>{vi.clearAllMocks();mocks.navigate.mockResolvedValue(undefined);history.replaceState({},'','/staff/projects');});
afterEach(()=>mounted?.unmount());
function mount(props:Record<string,unknown>={}){mounted=renderIntoDocument(<><StudioNavigationCapture enabled/><a href={href} {...props}>Open</a></>);return mounted.container.querySelector('a')!;}
it('captures before a Next/React bubble handler can unmount the old editor',async()=>{
 const anchor=mount(),bubbled=vi.fn();anchor.addEventListener('click',bubbled);const event=new MouseEvent('click',{bubbles:true,cancelable:true,button:0});
 await act(async()=>{anchor.dispatchEvent(event);});expect(event.defaultPrevented).toBe(true);expect(bubbled).not.toHaveBeenCalled();expect(mocks.navigate).toHaveBeenCalledOnce();
});
it.each([{ctrlKey:true},{metaKey:true},{shiftKey:true},{button:1}])('leaves modified/new-tab navigation native: %j',async options=>{
 const anchor=mount(),event=new MouseEvent('click',{bubbles:true,cancelable:true,...options});anchor.addEventListener('click',event=>event.preventDefault());
 await act(async()=>{anchor.dispatchEvent(event);});expect(mocks.navigate).not.toHaveBeenCalled();
});
it.each([{target:'_blank'},{download:'design'}])('leaves target/download behavior native: %j',async props=>{
 const anchor=mount(props);anchor.addEventListener('click',event=>event.preventDefault());await act(async()=>anchor.click());expect(mocks.navigate).not.toHaveBeenCalled();
});
it('reports failure while retaining a live page and releases its click latch for a retry',async()=>{
 mocks.navigate.mockRejectedValueOnce(Error('Local work is kept'));const anchor=mount();await act(async()=>anchor.click());expect(mocks.error).toHaveBeenCalledWith('Local work is kept');
 await act(async()=>anchor.click());expect(mocks.navigate).toHaveBeenCalledTimes(2);
});
