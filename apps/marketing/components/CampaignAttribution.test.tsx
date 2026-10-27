// @vitest-environment-options {"url":"https://www.sanctuarypergolas.co.nz/"}
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CampaignAttribution from './CampaignAttribution';
import { ConsentProvider, useConsent } from './ConsentProvider';
import { CONSENT_STORAGE_KEY, createStoredConsent, serializeConsent } from '../lib/consent';
import { CAMPAIGN_PERSISTENCE_KEY, clearMetaCookies } from '../lib/campaignPersistence';
import { CAMPAIGN_SESSION_KEY } from '../lib/campaignSession';
import { trackingAudienceAllowed } from '../lib/trackingAudience';

vi.mock('next/navigation',()=>({usePathname:()=>window.location.pathname,useSearchParams:()=>new URLSearchParams(window.location.search)}));
let host:HTMLDivElement,root:ReturnType<typeof createRoot>,withdraw:()=>void,grant:()=>void;
const denied=()=>createStoredConsent({analytics:false,marketing:false});
function Controls(){const {setConsent}=useConsent();withdraw=()=>setConsent(denied());grant=()=>setConsent({analytics:true,marketing:true});return null;}
const mount=()=>act(async()=>root.render(<ConsentProvider><Controls/><CampaignAttribution/></ConsentProvider>));
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('performance',{now:()=>Date.now(),getEntriesByType:()=>[]});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({policy:'consent_required'})}));
 localStorage.clear();sessionStorage.clear();clearMetaCookies(document,location.hostname);
 history.replaceState(null,'','/?measurement=normal');trackingAudienceAllowed();
 history.replaceState(null,'','/?utm_source=synthetic&gclid=synthetic_click');
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

for(const via of ['same tab','other tab'] as const)it.each(['verification','session getter denied','session read denied'] as const)(`clears accessible identifiers and cookies on ${via} withdrawal with %s`,async(mode)=>{
 localStorage.setItem(CONSENT_STORAGE_KEY,serializeConsent(createStoredConsent({analytics:true,marketing:true})));
 await mount();
 const session=window.sessionStorage,read=Storage.prototype.getItem;
 expect(localStorage.getItem(CAMPAIGN_PERSISTENCE_KEY)).not.toBeNull();
 expect(session.getItem(CAMPAIGN_SESSION_KEY)).not.toBeNull();
 document.cookie='_fbc=synthetic; Path=/';document.cookie='_fbp=synthetic; Path=/; Domain=sanctuarypergolas.co.nz';
 if(mode==='verification')history.replaceState(null,'','/?measurement=verification&gclid=another_click');
 if(mode==='session getter denied')vi.spyOn(window,'sessionStorage','get').mockImplementation(()=>{throw Error('Storage unavailable');});
 if(mode==='session read denied')vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,key){if(this===session)throw Error('Storage unavailable');return read.call(this,key);});
 expect(trackingAudienceAllowed()).toBe(false);
 await act(async()=>{
  if(via==='same tab')withdraw();
  else window.dispatchEvent(new StorageEvent('storage',{key:CONSENT_STORAGE_KEY,newValue:serializeConsent(denied())}));
 });
 expect(localStorage.getItem(CAMPAIGN_PERSISTENCE_KEY)).toBeNull();
 expect(document.cookie).not.toMatch(/_fb[cp]=/);
 // An inaccessible session cannot be erased; other accessible stores still must be.
 if(mode!=='session getter denied')expect(read.call(session,CAMPAIGN_SESSION_KEY)).toBeNull();
 expect(trackingAudienceAllowed()).toBe(false);
 expect(fetch).not.toHaveBeenCalled();
});

it('does not capture a tagged arrival before a consent decision',async()=>{
 await mount();
 expect(localStorage.getItem(CAMPAIGN_PERSISTENCE_KEY)).toBeNull();
 expect(sessionStorage.getItem(CAMPAIGN_SESSION_KEY)).toBeNull();
 expect(fetch).toHaveBeenCalledTimes(1);
});

it('does not replay campaign evidence from a denied route when permission returns',async()=>{
 localStorage.setItem(CONSENT_STORAGE_KEY,serializeConsent(createStoredConsent({analytics:true,marketing:true})));
 await mount();
 expect(localStorage.getItem(CAMPAIGN_PERSISTENCE_KEY)).not.toBeNull();
 history.replaceState(null,'','/contact?utm_source=denied_arrival&gclid=denied_click');
 await act(async()=>withdraw());
 expect(localStorage.getItem(CAMPAIGN_PERSISTENCE_KEY)).toBeNull();
 await act(async()=>grant());
 expect(localStorage.getItem(CAMPAIGN_PERSISTENCE_KEY)).toBeNull();
 expect(sessionStorage.getItem(CAMPAIGN_SESSION_KEY)).toBeNull();
});
