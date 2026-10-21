import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const tracking=vi.hoisted(()=>({consent:{analytics:true,marketing:true},hasTrackingDecision:true,trackingBasis:'user_choice',trackingRegionPolicy:null}));
vi.mock('../ConsentProvider',()=>({useConsent:()=>tracking}));
vi.mock('../../lib/attribution',()=>({getBrowserMarketingAttribution:()=>({utm:{utm_source:'facebook',utm_medium:'paid_social',utm_campaign:'11001',utm_content:'11003',utm_term:'11002'}})}));
import {LandingExperiment,LandingCopy,OriginalLandingCopy,LandingHeroOrder} from './LandingExperiment';
import {ExperimentReceiptField} from './ExperimentReceiptField';
import {EXPERIMENT_SEEN_EVENT,experimentCookieName,experimentSeenKey,rememberLandingExperience,LANDING_EXPERIMENT_PATHS} from '../../lib/landingExperiment';
import {clearLandingAssignment} from '../../lib/landingExperimentConsent';
let element:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('matchMedia',()=>({matches:true}));});
beforeEach(()=>{sessionStorage.clear();vi.stubEnv('NEXT_PUBLIC_LANDING_EXPERIMENT_ENABLED','true');Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});element=document.createElement('div');document.body.append(element);root=createRoot(element);tracking.consent={analytics:true,marketing:true};tracking.hasTrackingDecision=true;vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 1;});});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();for(const path of LANDING_EXPERIMENT_PATHS)document.cookie=`${experimentCookieName(path)}=;Path=/;Max-Age=0`;vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each(LANDING_EXPERIMENT_PATHS)('paints one permitted slot, captures the experienced receipt and leaves original content on denied consent: %s',async path=>{
 const receipt='syntheticreceipt'.repeat(6),assignment={experiment:'a1000000-0000-4000-8000-000000000001',assignment:'a2000000-0000-4000-8000-000000000001',path,arm:'challenger',copies:{design:'explore'},receipt};
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({assignment})));vi.stubGlobal('fetch',fetcher);
 const view=()=> <LandingExperiment path={path}><LandingCopy slot="design"><OriginalLandingCopy path={path} slot="design"/></LandingCopy><form><ExperimentReceiptField sourcePath={path}/></form></LandingExperiment>;
 await act(async()=>{root.render(view());});
 expect(element.textContent).toContain('Explore your pergola');expect(new FormData(element.querySelector('form')!).get('experimentReceipt')).toBe(receipt);
 expect(fetcher).toHaveBeenCalledTimes(2);
 tracking.consent={analytics:false,marketing:false};await act(async()=>root.render(view()));expect(element.textContent).toContain('Design your pergola');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('keeps the form experience through another-tab cookie changes and canonical designer remount, then clears on withdrawal',async()=>{
 const path=LANDING_EXPERIMENT_PATHS[0],other=LANDING_EXPERIMENT_PATHS[1],name=experimentCookieName(path);
 document.cookie=`${name}=old-receipt;Path=/`;
 rememberLandingExperience(path,'old-receipt');
 await act(async()=>root.render(<form><ExperimentReceiptField sourcePath={path}/></form>));
 document.cookie=`${name}=new-other-tab-receipt;Path=/`;
 await act(async()=>window.dispatchEvent(new CustomEvent(EXPERIMENT_SEEN_EVENT,{detail:{path:other,receipt:'unrelated'}})));
 expect(new FormData(element.querySelector('form')!).get('experimentReceipt')).toBe('old-receipt');
 // A new form on the canonical designer uses that route's signed cookie.
 await act(async()=>root.render(<form key="designer-return"><ExperimentReceiptField sourcePath={path}/></form>));
 expect(new FormData(element.querySelector('form')!).get('experimentReceipt')).toBe('old-receipt');
 vi.stubGlobal('fetch',vi.fn());await act(async()=>clearLandingAssignment());expect(new FormData(element.querySelector('form')!).get('experimentReceipt')).toBe('');
});
it('serves a retained control to a denied-consent visitor without an assignment request, and fails back on request error',async()=>{
 tracking.consent={analytics:false,marketing:false};const fetcher=vi.fn(async()=>{throw new Error('Synthetic unavailable');});vi.stubGlobal('fetch',fetcher);
 const view=()=> <LandingExperiment path={LANDING_EXPERIMENT_PATHS[0]} control={{help:'project'}}><LandingCopy slot="help">Original help</LandingCopy></LandingExperiment>;
 await act(async()=>root.render(view()));expect(element.textContent).toBe('Tell us about your project');expect(fetcher).not.toHaveBeenCalled();
 tracking.consent={analytics:true,marketing:true};await act(async()=>root.render(view()));expect(element.textContent).toBe('Tell us about your project');expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(LANDING_EXPERIMENT_PATHS)('withdraws a cookie-less experienced assignment and clears the mounted field: %s',async path=>{
 const receipt=btoa(JSON.stringify({path}))+'.synthetic-signature',fetcher=vi.fn<(url:unknown,init:RequestInit)=>Promise<Response>>(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',fetcher);
 rememberLandingExperience(path,receipt);expect(document.cookie).not.toContain(experimentCookieName(path));
 await act(async()=>root.render(<form><ExperimentReceiptField sourcePath={path}/></form>));
 expect(new FormData(element.querySelector('form')!).get('experimentReceipt')).toBe(receipt);
 await act(async()=>clearLandingAssignment());
 expect(sessionStorage.getItem(experimentSeenKey(path))).toBeNull();expect(new FormData(element.querySelector('form')!).get('experimentReceipt')).toBe('');
 expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(fetcher.mock.calls[0]![1].body as string)).toEqual({stage:'revoke',path,receipt,consent:false});
});
it.each([false,true])('revokes experienced and current-cookie assignments, deduplicating identical receipts (same=%s)',async same=>{
 const path=LANDING_EXPERIMENT_PATHS[0],receipt=(id:string)=>btoa(JSON.stringify({path,id}))+'.synthetic-signature';
 const experienced=receipt('experienced'),cookie=same?experienced:receipt('other-tab');rememberLandingExperience(path,experienced);document.cookie=`${experimentCookieName(path)}=${cookie};Path=/`;
 const fetcher=vi.fn<(url:unknown,init:RequestInit)=>Promise<Response>>(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',fetcher);
 await act(async()=>clearLandingAssignment());
 expect(fetcher).toHaveBeenCalledTimes(same?1:2);expect(fetcher.mock.calls.map(call=>JSON.parse(call[1].body as string).receipt).sort()).toEqual([...new Set([experienced,cookie])].sort());
});
it('defers an outdoor hero wording change while its unwrapped action link has keyboard focus',async()=>{
 const path=LANDING_EXPERIMENT_PATHS[0],assignment={experiment:'a1000000-0000-4000-8000-000000000001',assignment:'a2000000-0000-4000-8000-000000000001',path,arm:'challenger',copies:{design:'explore'},receipt:'syntheticreceipt'.repeat(6)};
 let answer!:(value:Response)=>void;
 const fetcher=vi.fn((_url:unknown,init:RequestInit)=>JSON.parse(init.body as string).stage==='assign'?new Promise<Response>(resolve=>{answer=resolve;}):Promise.resolve(new Response(null,{status:204})));vi.stubGlobal('fetch',fetcher);
 await act(async()=>root.render(<LandingExperiment path={path}><a href="#your-design"><LandingCopy slot="design">Design your pergola</LandingCopy></a></LandingExperiment>));
 const link=element.querySelector('a')!;link.focus();
 await act(async()=>answer(new Response(JSON.stringify({assignment}))));
 expect(link.textContent).toBe('Design your pergola');expect(document.activeElement).toBe(link);expect(fetcher).toHaveBeenCalledTimes(1);
 await act(async()=>link.blur());expect(link.textContent).toBe('Explore your pergola');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not move the hero action group under a held pointer, preserves links, and records the actual exposed treatment only after release',async()=>{
 const path=LANDING_EXPERIMENT_PATHS[1],assignment={experiment:'a1000000-0000-4000-8000-000000000001',assignment:'a2000000-0000-4000-8000-000000000001',path,arm:'challenger',copies:{layout:'action-first'},receipt:'syntheticreceipt'.repeat(6)};
 let answer!:(value:Response)=>void;
 const fetcher=vi.fn((_url:unknown,init:RequestInit)=>JSON.parse(init.body as string).stage==='assign'?new Promise<Response>(resolve=>{answer=resolve;}):Promise.resolve(new Response(JSON.stringify({assignment}))));vi.stubGlobal('fetch',fetcher);
 await act(async()=>root.render(<LandingExperiment path={path}><LandingHeroOrder className="hero"><p>Original support</p><div><a href="#your-design">Design</a><a href="#project-details">Help</a></div></LandingHeroOrder></LandingExperiment>));
 const pointer=(type:string)=>{const event=new Event(type,{bubbles:true});Object.defineProperty(event,'pointerId',{value:1});window.dispatchEvent(event);};
 await act(async()=>{pointer('pointerdown');answer(new Response(JSON.stringify({assignment})));});
 expect(element.querySelector('[data-landing-copy="layout"]')?.getAttribute('data-landing-copy-key')).toBe('control');expect(fetcher).toHaveBeenCalledTimes(1);
 await act(async()=>pointer('pointerup'));
 expect(element.querySelector('[data-landing-copy="layout"]')?.getAttribute('data-landing-copy-key')).toBe('action-first');
 expect(Array.from(element.querySelectorAll('a')).map(a=>a.getAttribute('href'))).toEqual(['#your-design','#project-details']);
 expect(JSON.parse(fetcher.mock.calls[1]![1].body as string)).toMatchObject({stage:'expose',display:{mobile:true,actionFirst:true}});
});
