// @vitest-environment-options {"url":"https://www.sanctuarypergolas.co.nz/"}
import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import { trackingAudienceAllowed,trackingRuntimeGuard,VERIFICATION_TRAFFIC_KEY } from './trackingAudience';
import { sendGoogleAnalyticsEvent } from './googleAnalyticsEvent';
import { emitMetaLead,flushPendingMetaLeads,setMetaLeadPermission,clearPendingMetaLeads } from './metaLead';
import { getBrowserMarketingAttribution } from './attribution';
beforeEach(()=>{sessionStorage.clear();localStorage.clear();history.replaceState(null,'','/?measurement=normal');trackingAudienceAllowed();history.replaceState(null,'','/');});
afterEach(()=>{clearPendingMetaLeads();vi.unstubAllGlobals();vi.restoreAllMocks();});
const delayedRuntime=()=>Function(`${trackingRuntimeGuard} return true;`)();
it('suppresses first use, delayed runtime and subsequent navigation until explicitly cleared',()=>{
 history.replaceState(null,'','/?measurement=verification');
 expect(trackingAudienceAllowed()).toBe(false);expect(delayedRuntime()).not.toBe(true);
 expect(sessionStorage.getItem(VERIFICATION_TRAFFIC_KEY)).toBe('true');
 history.replaceState(null,'','/design-enquiry');expect(trackingAudienceAllowed()).toBe(false);expect(delayedRuntime()).not.toBe(true);
 const gtag=vi.fn();vi.stubGlobal('gtag',gtag);
 expect(sendGoogleAnalyticsEvent('contact_success',{},true)).toBe(false);expect(gtag).not.toHaveBeenCalled();
 const attribution=getBrowserMarketingAttribution({consent:{analytics:true,marketing:true},trackingBasis:'user_choice',trackingRegionPolicy:null});
 expect(attribution.verification).toBe(true);
 history.replaceState(null,'','/?measurement=normal');expect(trackingAudienceAllowed()).toBe(true);expect(delayedRuntime()).toBe(true);
 expect(sessionStorage.getItem(VERIFICATION_TRAFFIC_KEY)).toBeNull();
 expect(sendGoogleAnalyticsEvent('contact_success',{},false)).toBe(false);
 expect(sendGoogleAnalyticsEvent('contact_success',{},true)).toBe(true);
});
it('prevents a queued Meta lead from escaping when verification mode begins before onReady',()=>{
 setMetaLeadPermission(true);emitMetaLead({configured_design:true},'synthetic-submission',true);
 history.replaceState(null,'','/?measurement=verification');const pixel=vi.fn();vi.stubGlobal('fbq',pixel);
 flushPendingMetaLeads(true);expect(pixel).not.toHaveBeenCalled();
 history.replaceState(null,'','/?measurement=normal');flushPendingMetaLeads(true);expect(pixel).not.toHaveBeenCalled();
});
it.each(['localhost','preview.vercel.app','sanctuarypergolas.co.nz.evil.test'])('blocks development and lookalike host %s even with consent',hostname=>{
 vi.stubGlobal('location',{hostname,search:''});expect(trackingAudienceAllowed()).toBe(false);expect(delayedRuntime()).not.toBe(true);
});
it('fails closed when tab storage is unavailable',()=>{
 vi.stubGlobal('sessionStorage',{getItem(){throw Error('unavailable');}});expect(trackingAudienceAllowed()).toBe(false);
});

for(const analytics of [false,true])for(const marketing of [false,true]) {
 it.each(['available','getter denied','operations denied'] as const)(`requires positive test evidence with analytics=${analytics}, marketing=${marketing}, storage=%s`,storage=>{
  if(storage==='getter denied')vi.spyOn(window,'sessionStorage','get').mockImplementation(()=>{throw Error('unavailable');});
  if(storage==='operations denied')vi.stubGlobal('sessionStorage',{getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');},removeItem(){throw Error('unavailable');}});
  const attribution=()=>getBrowserMarketingAttribution({consent:{analytics,marketing},trackingBasis:'user_choice',trackingRegionPolicy:null});
  expect(attribution().verification).toBeUndefined();
  expect(trackingAudienceAllowed()).toBe(storage==='available');
  history.replaceState(null,'','/?measurement=verification');
  expect(attribution().verification).toBe(true);expect(trackingAudienceAllowed()).toBe(false);
  history.replaceState(null,'','/contact');expect(attribution().verification).toBe(true);
  history.replaceState(null,'','/?measurement=normal');expect(attribution().verification).toBeUndefined();
 });
}
