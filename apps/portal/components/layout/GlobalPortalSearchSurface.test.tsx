import {act} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {PortalQueryClientScope} from '@/lib/react-query/PortalQueryClientContext';
import {PortalGuardedPage,PortalPageSourceProvider,usePortalPageSourceController} from '@/components/page-state/PortalPageSource';
import {GlobalPortalSearchStateProvider} from './GlobalPortalSearchState';
import GuardedGlobalPortalSearch from './GuardedGlobalPortalSearch';
import StaffPageHeaderSurface from './StaffPageHeaderSurface';
import GlobalPortalSearchSurface, {type SearchInputEvidence,type SearchReadProps} from './GlobalPortalSearchSurface';

const controlled=vi.hoisted(()=>({props:null as SearchReadProps|null,mounts:0}));
// Isolate code arrival only. The real registration/source/input/evidence owners remain connected.
vi.mock('next/dynamic',()=>({default:()=>function ControlledReader(props:SearchReadProps){controlled.props=props;controlled.mounts++;return null;}}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('@/components/page-state/PortalRouteTransition',()=>({usePortalRouteTransition:()=>({pathname:window.location.pathname,routeKey:window.location.pathname,instantRoute:null})}));
let source:ReturnType<typeof usePortalPageSourceController>;
function Host({canonical,completion,denied=false}:{canonical:string;completion?:Record<string,never>;denied?:boolean}){
  source=usePortalPageSourceController(window.location.pathname,canonical,'');
  return <PortalPageSourceProvider value={source}><GlobalPortalSearchStateProvider><StaffPageHeaderSurface title="Contacts"/>
    {completion?<PortalGuardedPage pathname={canonical} completion={completion} unavailable={denied}><GuardedGlobalPortalSearch/></PortalGuardedPage>:null}
  </GlobalPortalSearchStateProvider></PortalPageSourceProvider>;
}
function evidence(onKeyDown=vi.fn()):SearchInputEvidence{return {state:'results',responseQuery:'re',refreshing:false,navigating:false,showPanel:true,activeOptionId:'private-option',onChange:vi.fn(),onKeyDown};}
afterEach(()=>{document.body.innerHTML='';controlled.props=null;controlled.mounts=0;});

it.each(['pending','denied'] as const)('never revives A input evidence or callbacks when a %s source adopts B before B evidence arrives',scenario=>{
  window.history.replaceState(null,'','/staff/contacts');const a={},b={},client=new QueryClient();
  const ui=(canonical:string,completion?:Record<string,never>,denied=false)=><QueryClientProvider client={client}><PortalQueryClientScope client={client}><Host canonical={canonical} completion={completion} denied={denied}/></PortalQueryClientScope></QueryClientProvider>;
  const view=renderIntoDocument(ui('/staff/contacts',a));const input=view.container.querySelector('input')!;
  act(()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'re');input.dispatchEvent(new Event('input',{bubbles:true}));});
  const old=controlled.props!.publish,oldKey=vi.fn();act(()=>old(evidence(oldKey)));expect(input.getAttribute('aria-activedescendant')).toBe('private-option');
  if(scenario==='pending'){
    act(()=>{source.begin('/staff/projects');window.history.pushState(null,'','/staff/projects');});
    view.rerender(ui('/staff/contacts',a));
  }else view.rerender(ui('/staff/contacts',a,true));
  expect(input.getAttribute('aria-activedescendant')).toBeNull();expect(input.getAttribute('aria-expanded')).toBe('false');
  const target=scenario==='pending'?'/staff/projects':'/staff/contacts';view.rerender(ui(target,b));const current=controlled.props!.publish;
  expect(current).not.toBe(old);expect(input.getAttribute('aria-activedescendant')).toBeNull();
  act(()=>{old(evidence(oldKey));input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));});
  expect(oldKey).not.toHaveBeenCalled();expect(input.getAttribute('aria-activedescendant')).toBeNull();
  const newKey=vi.fn();act(()=>current(evidence(newKey)));act(()=>{old(null);input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));});
  expect(newKey).toHaveBeenCalledTimes(1);expect(oldKey).not.toHaveBeenCalled();expect(view.container.querySelector('input')).toBe(input);expect(input.value).toBe('re');expect(document.activeElement).toBe(input);
  // A late result for the previous typed query also cannot rebind input commands.
  act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'new');input.dispatchEvent(new Event('input',{bubbles:true}));});
  act(()=>current(evidence(newKey)));expect(input.getAttribute('aria-activedescendant')).toBeNull();
  view.unmount();client.clear();
});

it('uses an explicit domain registration without falling back or restoring a retired same-component reader', () => {
  const client = new QueryClient(); let props: SearchReadProps | null = null;
  function Reader(value: SearchReadProps) { props = value; return null; }
  const first = { component: Reader }, next = { component: Reader };
  const ui = (registration: typeof first | null) => <QueryClientProvider client={client}><PortalQueryClientScope client={client}>
    <GlobalPortalSearchSurface reader={Reader} registration={registration}/>
  </PortalQueryClientScope></QueryClientProvider>;
  const view = renderIntoDocument(ui(first)), input = view.container.querySelector('input')!;
  act(() => { input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'re'); input.dispatchEvent(new Event('input',{bubbles:true})); });
  const old = props!.publish, oldKey = vi.fn(); act(() => old(evidence(oldKey)));
  expect(input.getAttribute('aria-expanded')).toBe('true');
  view.rerender(ui(null)); expect(input.getAttribute('aria-expanded')).toBe('false'); const pendingProps = props;
  view.rerender(ui(next)); expect(props).not.toBe(pendingProps); expect(input.getAttribute('aria-expanded')).toBe('false');
  act(() => { old(evidence(oldKey)); input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); });
  expect(oldKey).not.toHaveBeenCalled(); const current = props!.publish, newKey = vi.fn();
  act(() => current(evidence(newKey))); act(() => { old(null); input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); });
  expect(newKey).toHaveBeenCalledTimes(1); expect(view.container.querySelector('input')).toBe(input); expect(input.value).toBe('re'); expect(document.activeElement).toBe(input);
  view.unmount(); client.clear();
});
