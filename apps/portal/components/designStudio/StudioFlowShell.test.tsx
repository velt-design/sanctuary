import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import StudioFlowShell from './StudioFlowShell';
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=><a {...props}/>}));
let mounted:ReturnType<typeof renderIntoDocument>;
afterEach(()=>mounted?.unmount());
it.each([['review',false],['review',true],['quote',true]] as const)('keeps Design a visual route from %s, including protected=%s', (stage,readOnly)=>{
 mounted=renderIntoDocument(<ToastProvider><StudioFlowShell projectId="proj-project" estimateId="est-source" versionLabel="V2" stage={stage} readOnly={readOnly} quoteId="qv-exact"><p>Existing commercial surface</p></StudioFlowShell></ToastProvider>);
 const nav=mounted.container.querySelector('nav[aria-label="Studio stages"]')!;
 expect([...nav.querySelectorAll('a')].find(a=>a.textContent==='Design')?.getAttribute('href')).toBe('/staff/design-studio/proj-project/est-source/edit');
 expect([...nav.querySelectorAll('a')].find(a=>a.textContent==='Review & quote')?.getAttribute('href')).toBe('/staff/design-studio/proj-project/est-source');
 expect([...nav.querySelectorAll('a')].find(a=>a.textContent==='Quote')?.getAttribute('href')).toBe('/staff/design-studio/proj-project/est-source?quoteVersionId=qv-exact');
});
