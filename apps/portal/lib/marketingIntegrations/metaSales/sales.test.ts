import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { assessMetaSale, prepareMetaSale, metaEmailHash, metaPhoneHash, type MetaSaleSource, type MetaSalePolicy } from './sales';
const now=new Date('2026-10-14T00:00:00Z');
export const metaFixtureSource: MetaSaleSource={quoteId:'44444444-4444-4444-8444-444444444444',projectId:'55555555-5555-4555-8555-555555555555',receiptId:'66666666-6666-4666-8666-666666666666',
  fingerprint:'a'.repeat(64),occurredAt:'2026-10-13T10:00:00Z',receivedAt:'2026-10-12T10:00:00Z',valueCents:1234567,active:true,
  marketingConsent:true,marketingDenied:false,suppressed:false,consentBasis:'regional_default',disclosureVersion:'2026-10-sale-measurement-v2',
  email:'Test.Person+sale@gmail.com',phone:'0211234567',crmEmail:'changed@example.test',crmPhone:null,fbc:null,fbp:null,historicalApproval:null};
export const metaFixturePolicy:MetaSalePolicy={consentPolicyApproved:true,contactMatchingApproved:true,disclosureVersion:'2026-10-sale-measurement-v2',allowedConsentBases:['regional_default','user_choice'],consentEffectiveFrom:'2026-10-12T00:00:00Z',historicalEnabled:false};
it('uses original contact, real payment date and full accepted value without changing Google normalization',()=>{
  const result=prepareMetaSale(metaFixtureSource,metaFixturePolicy,now);expect(result.assessment.reasons).toEqual([]);
  expect(result.event).toMatchObject({event_name:'Purchase',action_source:'other',event_time:Math.floor(Date.parse(metaFixtureSource.occurredAt!)/1000),custom_data:{value:12345.67,currency:'NZD'}});
  expect(result.event?.user_data).toEqual({em:[createHash('sha256').update('test.person+sale@gmail.com').digest('hex')]});
  expect(metaEmailHash(' A+B@gmail.com ')).toBe(createHash('sha256').update('a+b@gmail.com').digest('hex'));
  expect(metaPhoneHash('+64 (21) 123-4567')).toBe(createHash('sha256').update('64211234567').digest('hex'));
  expect(metaPhoneHash('0211234567')).toBeNull();
});
it('lists independent historical exclusions without treating saved CRM contact as authority',()=>{
  const assessment=assessMetaSale({...metaFixtureSource,receiptId:null,receivedAt:null,marketingConsent:false,disclosureVersion:null,occurredAt:'2026-09-01T00:00:00Z',email:null},metaFixturePolicy,now);
  expect(assessment.reasons).toEqual(expect.arrayContaining(['ORIGIN_ENQUIRY_MISSING','MARKETING_CONSENT_NOT_GRANTED','META_DISCLOSURE_NOT_PRESENT','CONTACT_POLICY_NOT_APPROVED','META_EVENT_WINDOW_EXCEEDED','PERMITTED_MATCHING_ID_MISSING']));
  expect(assessment.matching.crmEmail).toBe(true);
});
it('requires an exact reviewed historical approval and never overrides withdrawal or event age',()=>{
  const source={...metaFixtureSource,receiptId:null,receivedAt:null,marketingConsent:false,disclosureVersion:null,historicalApproval:{identitySource:'crm' as const,approvedAt:'2026-10-14T00:00:00Z'}};
  expect(prepareMetaSale(source,metaFixturePolicy,now).event).toBeUndefined();
  expect(prepareMetaSale(source,{...metaFixturePolicy,historicalEnabled:true},now).event?.user_data.em).toEqual([metaEmailHash(source.crmEmail)]);
  for(const change of [{marketingDenied:true},{suppressed:true},{occurredAt:'2026-10-01T00:00:00Z'}])
    expect(prepareMetaSale({...source,...change},{...metaFixturePolicy,historicalEnabled:true},now).event).toBeUndefined();
});
it('rejects old notice, exact7day boundary and unapproved contact matching independently',()=>{
  expect(prepareMetaSale({...metaFixtureSource,disclosureVersion:'2026-10-sale-measurement-v1'},metaFixturePolicy,now).event).toBeUndefined();
  expect(prepareMetaSale({...metaFixtureSource,occurredAt:'2026-10-07T00:00:00Z',receivedAt:'2026-10-06T00:00:00Z'},metaFixturePolicy,now).assessment.reasons).toContain('META_EVENT_WINDOW_EXCEEDED');
  expect(prepareMetaSale(metaFixtureSource,{...metaFixturePolicy,contactMatchingApproved:false},now).assessment.reasons).toContain('PERMITTED_MATCHING_ID_MISSING');
  expect(prepareMetaSale({...metaFixtureSource,disclosureVersion:'2026-10-sale-measurement-v1'},{...metaFixturePolicy,disclosureVersion:'2026-10-sale-measurement-v1'},now).event).toBeUndefined();
});
