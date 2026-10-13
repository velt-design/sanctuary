import { webcrypto, createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { emitSubmittedLead, googleLeadHashes, type GoogleEnhancedLead } from './googleEnhancedLead';
import { CONSENT_STORAGE_KEY } from './consent';
const target=window as Window & {dataLayer?:Array<Record<string,unknown>>;sanctuaryGoogleEnhancedLead?:GoogleEnhancedLead};
afterEach(()=>{delete target.dataLayer;delete target.sanctuaryGoogleEnhancedLead;window.localStorage.clear();vi.useRealTimers();vi.unstubAllGlobals();});
it('uses normalized hashes without putting contact or hashes in the generic event',async()=>{
  vi.stubGlobal('crypto',webcrypto);const contact={email:' Test.Person+project@Gmail.com ',phone:'+64 21 1234567'};
  const expected={sha256_email_address:createHash('sha256').update('testperson@gmail.com').digest('hex'),
    sha256_phone_number:createHash('sha256').update('+64211234567').digest('hex')};
  expect(await googleLeadHashes(contact,webcrypto.subtle as SubtleCrypto)).toEqual(expected);
  await emitSubmittedLead({lead_event_id:'synthetic',enquiry_type:'residential'},contact,true,true);
  expect(target.sanctuaryGoogleEnhancedLead).toEqual(expected);
  expect(JSON.stringify(target.dataLayer)).not.toContain('sha256');expect(JSON.stringify(target.dataLayer)).not.toContain('Gmail');
  (target.dataLayer![0].eventCallback as ()=>void)();expect(target.sanctuaryGoogleEnhancedLead).toBeUndefined();
});
it('defaults off and never exposes enhanced identity for analytics-only consent or a cross-tab withdrawal',async()=>{
  vi.stubGlobal('crypto',webcrypto);const contact={email:'demo@example.test',phone:''};
  for(const [allowed,enabled] of [[true,false],[false,true]]) {await emitSubmittedLead({},contact,allowed,enabled);expect(target.sanctuaryGoogleEnhancedLead).toBeUndefined();}
  await emitSubmittedLead({},contact,true,true);expect(target.sanctuaryGoogleEnhancedLead?.sha256_email_address).toBe(createHash('sha256').update(contact.email).digest('hex'));
  localStorage.setItem(CONSENT_STORAGE_KEY,JSON.stringify({version:1,analytics:true,marketing:false,updatedAt:new Date().toISOString()}));
  expect(target.sanctuaryGoogleEnhancedLead).toBeUndefined();
});
it('clears a tag read timeout and omits ambiguous local phone numbers',async()=>{
  vi.stubGlobal('crypto',webcrypto);
  await emitSubmittedLead({}, {email:'demo@example.test',phone:'0211234567'},true,true);
  expect(target.sanctuaryGoogleEnhancedLead?.sha256_phone_number).toBeUndefined();
  const real=Date.now;vi.spyOn(Date,'now').mockImplementation(()=>real()+3000);
  expect(target.sanctuaryGoogleEnhancedLead).toBeUndefined();vi.restoreAllMocks();
  (target.dataLayer![0].eventCallback as ()=>void)();
});
