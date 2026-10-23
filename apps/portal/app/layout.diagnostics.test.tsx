// @vitest-environment node
import { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({diagnostics:vi.fn(),regional:vi.fn(),access:vi.fn(),finance:vi.fn(),enabled:vi.fn(),theme:vi.fn(),shell:()=>null}));
vi.mock('next/font/local',()=>({default:()=>({variable:'fixture-font'})}));
vi.mock('@/lib/performance/documentRenderDiagnostics',()=>({getDocumentRenderDiagnostics:h.diagnostics}));
vi.mock('@/lib/auth',()=>({requireRegionalDocumentAccess:h.regional,getPortalAccessState:h.access}));
vi.mock('@/lib/xero/pilotAccess',()=>({getPaymentPilotSession:h.finance,paymentPilotEnabled:h.enabled}));
vi.mock('@/lib/theme/server',()=>({loadPortalThemeForUser:h.theme,portalThemeStyleVars:()=>({})}));
vi.mock('@/components/layout/PortalShell',()=>({default:h.shell}));
vi.mock('@/components/auth/PortalAuthProvider',()=>({default:()=>null}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({ToastProvider:()=>null}));
vi.mock('./providers',()=>({Providers:()=>null}));
vi.mock('@/components/performance/PortalVitalsReporter',()=>({default:()=>null}));
vi.mock('@/components/diagnostics/SupabaseEnvHydrator',()=>({default:()=>null}));
import Layout from './layout';
import { prepareProxyDocumentDiagnostics } from '@/lib/performance/documentDiagnostics';
const session={user:{id:'private-user'}};
beforeEach(()=>{vi.resetAllMocks();h.regional.mockResolvedValue(undefined);h.access.mockResolvedValue({kind:'authenticated',session});h.finance.mockResolvedValue(session);h.enabled.mockReturnValue(true);h.theme.mockResolvedValue({});});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();});
function scope(route='/staff/marketing-performance'){
 vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS',JSON.stringify({until:new Date(Date.now()+60_000).toISOString(),nonce:'A'.repeat(43)}));
 const value=prepareProxyDocumentDiagnostics(new Request('https://portal.example'+route,{headers:{accept:'text/html','sec-fetch-dest':'document'}})).diagnostics!;
 h.diagnostics.mockResolvedValue(value);return value;
}
function shellProps(node:ReactNode):Record<string,unknown>|null {
 if(!isValidElement<{children?:ReactNode}>(node))return null;
 if(node.type===h.shell)return node.props;
 for(const child of Children.toArray(node.props.children)){const found=shellProps(child);if(found)return found;}return null;
}
it('times the existing delayed navigation-finance call once and preserves layout ordering',async()=>{
 vi.useFakeTimers();const current=scope(),log=vi.spyOn(console,'info').mockImplementation(()=>undefined);
 let finish!:(value:typeof session)=>void;h.finance.mockReturnValue(new Promise(yes=>{finish=yes;}));
 const pending=Layout({children:'content'});for(let i=0;i<6;i++)await Promise.resolve();
 expect(h.regional).toHaveBeenCalledOnce();expect(h.finance).toHaveBeenCalledOnce();expect(h.theme).toHaveBeenCalledOnce();
 vi.advanceTimersByTime(45);finish(session);const page=await pending;
 expect(shellProps(page)?.financeUserId).toBe(session.user.id);expect(h.access).toHaveBeenCalledOnce();expect(h.theme).toHaveBeenCalledOnce();
 expect(log.mock.calls.map(call=>call[1])).toContainEqual(expect.objectContaining({requestId:current.id,phase:'navigation.finance',durationMs:45,outcome:'complete'}));
});
it.each(['disabled','empty','failure'] as const)('keeps %s finance navigation null with a safe explicit outcome',async mode=>{
 scope();const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);h.finance.mockResolvedValue(null);
 if(mode==='disabled')h.enabled.mockReturnValue(false);if(mode==='failure')h.finance.mockRejectedValue(new Error('private grant query'));
 expect(shellProps(await Layout({children:'content'}))?.financeUserId).toBeUndefined();expect(h.finance).toHaveBeenCalledOnce();expect(h.theme).toHaveBeenCalledOnce();
 expect(log.mock.calls.map(call=>call[1])).toContainEqual(expect.objectContaining({phase:'navigation.finance',outcome:mode==='disabled'?'skipped':mode==='failure'?'error':'empty'}));
 expect(JSON.stringify(log.mock.calls)).not.toMatch(/private/);
});
it.each(['/staff/projects','/staff/site-visits',null])('retains the old phase set and single finance call for %s',async route=>{
 if(route)scope(route);else h.diagnostics.mockResolvedValue(null);const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);
 expect(shellProps(await Layout({children:'content'}))?.financeUserId).toBe(session.user.id);expect(h.finance).toHaveBeenCalledOnce();
 expect(log.mock.calls.map(call=>call[1].phase)).not.toContain('navigation.finance');
});
it('retains the denied root boundary before finance and theme work',async()=>{
 scope();vi.spyOn(console,'info').mockImplementation(()=>undefined);const denial=new Error('redirect:access');h.regional.mockRejectedValue(denial);
 await expect(Layout({children:'content'})).rejects.toBe(denial);expect(h.finance).not.toHaveBeenCalled();expect(h.theme).not.toHaveBeenCalled();
});
it('does not let a diagnostic transport failure change successful finance navigation',async()=>{
 scope();vi.spyOn(console,'info').mockImplementation(()=>{throw new Error('logger');});
 expect(shellProps(await Layout({children:'content'}))?.financeUserId).toBe(session.user.id);expect(h.finance).toHaveBeenCalledOnce();
});

it('starts finance and theme only after the current root gate, overlaps both and awaits final finance props',async()=>{
 h.diagnostics.mockResolvedValue(null);let grant!:()=>void,finance!:(value:typeof session)=>void,theme!:(value:object)=>void;
 h.regional.mockReturnValue(new Promise<void>(resolve=>{grant=resolve;}));h.finance.mockReturnValue(new Promise(resolve=>{finance=resolve;}));h.theme.mockReturnValue(new Promise(resolve=>{theme=resolve;}));
 let complete=false;const pending=Layout({children:'content'}).then(page=>{complete=true;return page;});
 await Promise.resolve();await Promise.resolve();expect(h.access).not.toHaveBeenCalled();expect(h.finance).not.toHaveBeenCalled();expect(h.theme).not.toHaveBeenCalled();
 grant();for(let i=0;i<6;i++)await Promise.resolve();
 expect(h.finance).toHaveBeenCalledOnce();expect(h.access).toHaveBeenCalledOnce();expect(h.theme).toHaveBeenCalledExactlyOnceWith(session.user.id,null);expect(complete).toBe(false);
 theme({});for(let i=0;i<4;i++)await Promise.resolve();expect(complete).toBe(false);
 finance(session);const page=await pending;expect(shellProps(page)?.financeUserId).toBe(session.user.id);expect(complete).toBe(true);
});
it('retains theme fallback and caught finance failure while completing exactly once with unchanged empty props',async()=>{
 scope();const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);h.theme.mockRejectedValue(new Error('private theme'));h.finance.mockRejectedValue(new Error('private finance'));
 const page=await Layout({children:'content'});expect(shellProps(page)?.financeUserId).toBeUndefined();
 expect(h.access).toHaveBeenCalledOnce();expect(h.finance).toHaveBeenCalledOnce();expect(h.theme).toHaveBeenCalledOnce();
 expect(log.mock.calls.map(call=>call[1].phase)).toContain('theme.fallback');expect(log.mock.calls.filter(call=>call[1].phase==='layout.complete')).toHaveLength(1);expect(JSON.stringify(log.mock.calls)).not.toContain('private');
});
