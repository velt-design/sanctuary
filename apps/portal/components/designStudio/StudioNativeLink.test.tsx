import {act} from 'react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import StudioNativeLink,{StudioNativeButtonLink} from './StudioNativeLink';
const mocks=vi.hoisted(()=>({navigate:vi.fn(),error:vi.fn()}));
vi.mock('@/lib/designStudio/studioDocumentNavigation',()=>({navigateStudioDocument:mocks.navigate}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:mocks.error})}));
vi.mock('next/link',()=>({default:({onClick,prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=><a data-prefetch={String(prefetch)} {...props} onClick={event=>{onClick?.(event);event.preventDefault();}}/>}));
const href='/staff/design-studio/proj_10000000-0000-4000-8000-000000000001/est_20000000-0000-4000-8000-000000000001/edit';
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
beforeEach(()=>{vi.clearAllMocks();mocks.navigate.mockResolvedValue(undefined);history.replaceState({},'','/staff/projects');});
afterEach(()=>{mounted?.unmount();mounted=undefined;});
function mount(button=false,props:Record<string,unknown>={}){mounted=renderIntoDocument(button?<StudioNativeButtonLink href={href} {...props}>Open design</StudioNativeButtonLink>:<StudioNativeLink href={href} {...props}>Open design</StudioNativeLink>);return mounted.container.querySelector('a')!;}
it.each([false,true])('keeps href and native local-drain entry for plain/button link %s',async button=>{
 const anchor=mount(button);expect(anchor.getAttribute('href')).toBe(href);await act(async()=>anchor.click());expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(new URL(href,location.href).href,false,undefined,expect.any(AbortSignal));
});
it.each([{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}])('keeps modified/new-tab behaviour %j',async options=>{
 const anchor=mount();await act(async()=>anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,...options})));expect(mocks.navigate).not.toHaveBeenCalled();
});
it.each([{target:'_blank'},{download:'design'},{href:href+'#roof'},{href:href+'?intent=duplicate'},{href:href+'?unknown=x'},{href:'/staff/calculator'},{href:'https://outside.invalid/'+href}])('retains the ordinary noneligible link behaviour %j',async props=>{
 const anchor=mount(false,props);await act(async()=>anchor.click());expect(mocks.navigate).not.toHaveBeenCalled();
});
it('keeps disabled Foundation button accessibility and does not dispatch navigation',async()=>{
 const anchor=mount(true,{disabled:true});expect(anchor.getAttribute('aria-disabled')).toBe('true');expect(anchor.tabIndex).toBe(-1);await act(async()=>anchor.click());expect(mocks.navigate).not.toHaveBeenCalled();
});
it('honours caller prevention and retains a usable retry after local drain failure',async()=>{
 const anchor=mount(false,{onClick:(event:React.MouseEvent)=>event.preventDefault()});await act(async()=>anchor.click());expect(mocks.navigate).not.toHaveBeenCalled();mounted!.unmount();mounted=undefined;
 mocks.navigate.mockRejectedValueOnce(Error('Local work is kept'));const retry=mount();await act(async()=>retry.click());expect(mocks.error).toHaveBeenCalledWith('Local work is kept');await act(async()=>retry.click());expect(mocks.navigate).toHaveBeenCalledTimes(2);
});

it.each([false,true])('does not prefetch an exact native Studio entry, including caller opt-in %s',button=>{
 const anchor=mount(button,{prefetch:true});expect(anchor.dataset.prefetch).toBe('false');
});
it.each([href+'?intent=revision',href+'?intent=duplicate',href+'?unknown=x','/staff/calculator',href.replace('proj_','project_')])('retains default or deliberate prefetch for protected/noneligible fallback %s',target=>{
 const anchor=mount(false,{href:target});expect(anchor.dataset.prefetch).toBe('undefined');mounted!.unmount();mounted=undefined;
 expect(mount(false,{href:target,prefetch:true}).dataset.prefetch).toBe('true');
});
