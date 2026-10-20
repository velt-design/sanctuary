import { act, useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import CommercialTab from './CommercialTab';
import { useProjectViewDraftGuard } from '../projectViewNavigation';
const dynamicState = vi.hoisted(() => ({ callCount: 0 }));
const serverReplace = vi.fn();
const prefetchQuery = vi.fn();
vi.mock('next/dynamic', () => ({ default: () => {
  const kind = ['estimates','quotes','invoices'][dynamicState.callCount++] ?? 'unknown';
  return (props: any) => <div data-testid={`${kind}-subview`} data-selected-quote-id={props.selectedQuoteId ?? ''} />;
}}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({replace:serverReplace}),
  useSearchParams: () => new URLSearchParams(useSyncExternalStore(
    listener => {window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener);},
    ()=>window.location.search,()=>'',
  )),
}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({prefetchQuery})}));
const push=window.history.pushState.bind(window.history),replace=window.history.replaceState.bind(window.history);
let rendered:ReturnType<typeof renderIntoDocument>;
function mount(search='tab=estimates',extra={}){replace(null,'',`/staff/projects/proj_1?${search}`);rendered=renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="estimates" {...extra}/>);}
function click(label:string){act(()=>Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===label)!.click());}
function active(){return rendered.container.querySelector('[data-project-commercial-view]')?.getAttribute('data-project-commercial-view');}
async function historyGo(direction:'back'|'forward'){await act(async()=>{await new Promise<void>(resolve=>{window.addEventListener('popstate',()=>resolve(),{once:true});window.history[direction]();});});}
beforeEach(()=>{
  serverReplace.mockReset();prefetchQuery.mockReset();
  // Model Next's documented native history bridge; real browser QA verifies Next itself.
  for(const [method,original] of [['pushState',push],['replaceState',replace]] as const){
    vi.spyOn(window.history,method).mockImplementation((...args)=>{original(...args);window.dispatchEvent(new Event('popstate'));});
  }
});
afterEach(()=>{rendered?.unmount();vi.restoreAllMocks();replace(null,'','/');});
describe('Commercial view navigation',()=>{
  it('keeps the last rapid click even when old route props arrive, without server navigation',()=>{
    mount();click('Quotes');click('Invoices');click('Estimates');click('Invoices');
    expect(active()).toBe('invoices');
    rendered.rerender(<CommercialTab host="host" projectId="proj_1" view="quotes"/>);
    expect(active()).toBe('invoices');expect(serverReplace).not.toHaveBeenCalled();
    expect(rendered.container.querySelectorAll('[data-testid$="-subview"]')).toHaveLength(1);
    expect(rendered.container.querySelector('[data-testid="invoices-subview"]')).not.toBeNull();
  });
  it('clears nested selection while keeping unrelated project context',()=>{
    mount('tab=quotes&quoteId=q1&quotePreview=1&estimateId=e1&fromEstimateId=e0&createFromEstimateId=e2&newDesign=1&mode=edit&campaign=winter');
    click('Invoices');expect(window.location.search).toBe('?tab=invoices&campaign=winter');expect(active()).toBe('invoices');
  });
  it('restores selected tabs and exact quote detail through Back and Forward',async()=>{
    mount('tab=quotes&quoteId=q1&campaign=winter');click('Invoices');click('Estimates');
    await historyGo('back');expect(active()).toBe('invoices');
    await historyGo('back');expect(active()).toBe('quotes');
    expect(rendered.container.querySelector('[data-testid="quotes-subview"]')?.getAttribute('data-selected-quote-id')).toBe('q1');
    await historyGo('forward');expect(active()).toBe('invoices');
  });
  it('retains Details and Preview for the selected quote',()=>{
    mount('tab=quotes&quoteId=q1&campaign=winter');click('Preview');
    expect(window.location.search).toBe('?tab=quotes&quoteId=q1&campaign=winter&quotePreview=1');
    click('Details');expect(window.location.search).toBe('?tab=quotes&quoteId=q1&campaign=winter');
  });
  it('leaves a dirty quote in place when the user cancels navigation',()=>{
    function Guard(){useProjectViewDraftGuard(true);return null;}
    replace(null,'','/staff/projects/proj_1?tab=quotes&quoteId=q1');
    rendered=renderIntoDocument(<><Guard/><CommercialTab host="host" projectId="proj_1" view="quotes"/></>);
    vi.spyOn(window,'confirm').mockReturnValue(false);click('Invoices');
    expect(active()).toBe('quotes');expect(window.location.search).toContain('quoteId=q1');
    vi.mocked(window.confirm).mockReturnValue(true);click('Invoices');expect(active()).toBe('invoices');
  });
  it('keeps calculator mode free of commercial chrome',()=>{
    mount('tab=estimates&estimateId=e1',{calculatorWorkspace:true});
    expect(rendered.container.querySelector('[role="tablist"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="estimates-subview"]')).not.toBeNull();
  });
});
