import type { AdsStatus } from '@/lib/marketingIntegrations/googleAds/contract';
export function googleFixture(mode='complete'):AdsStatus {
  const now=new Date().toISOString(),fetchedAt=new Date(Date.now()-(mode==='stale'?48:1)*3600000).toISOString();
  return {enabled:mode!=='disabled',uploadsEnabled:false,checkedAt:now,collectedAt:fetchedAt,expiresAt:new Date(Date.now()+86400000).toISOString(),lastError:mode==='stale'?'GOOGLE_CONNECTION_REQUIRES_REVIEW':null,
    saleActionId:'123',enquiryActionIds:mode==='unmapped'?[]:['124'],counts:{ACCEPTED:2,SUBMITTED:1,SKIPPED:8,REVIEW_REQUIRED:1},reasons:{PERMITTED_MATCHING_ID_MISSING:6,CONSENT_POLICY_NOT_APPROVED_FOR_RECEIPT:2,RETRACTION_REQUIRES_OPERATOR:1},
    report:mode==='missing'||mode==='disabled'?null:{schemaVersion:1,customerId:'1234567890',currency:'NZD',timezone:'Pacific/Auckland',start:'2026-09-01',end:'2026-09-30',fetchedAt,
      actions:[{id:'123',name:'Demo Closed Sale',category:'PURCHASE',status:'ENABLED',primary:false},{id:'124',name:'Demo enquiry submitted',category:'SUBMIT_LEAD_FORM',status:'ENABLED',primary:true}],
      campaigns:[{day:'2026-09-25',campaignId:'1',name:'Demo non-brand',costMicros:'610000000',clicks:154,impressions:6000},{day:'2026-09-25',campaignId:'2',name:'Demo brand',costMicros:'5000000',clicks:101,impressions:700}],
      keywords:[{day:'2026-09-25',campaignId:'1',adGroupId:'3',criterionId:'4',keyword:'outdoor pergola',matchType:'PHRASE',costMicros:'400000000',clicks:100,impressions:4000},{day:'2026-09-25',campaignId:'1',adGroupId:'3',criterionId:'5',keyword:'pergola auckland',matchType:'EXACT',costMicros:'210000000',clicks:54,impressions:2000}],
      conversions:[{day:'2026-09-25',dateBasis:'interaction',campaignId:'1',actionId:'124',count:2,value:0},{day:'2026-09-25',dateBasis:'interaction',campaignId:'1',actionId:'123',count:0.75,value:11250},
        {day:'2026-09-25',dateBasis:'interaction',campaignId:'2',actionId:'124',count:2,value:0},{day:'2026-09-25',dateBasis:'interaction',campaignId:'1',adGroupId:'3',criterionId:'4',actionId:'124',count:2,value:0},
        {day:'2026-09-25',dateBasis:'interaction',campaignId:'1',adGroupId:'3',criterionId:'4',actionId:'123',count:0.75,value:11250},{day:'2026-09-29',dateBasis:'conversion',campaignId:'1',actionId:'123',count:0.75,value:11250},
        {day:'2026-09-29',dateBasis:'conversion',campaignId:'1',adGroupId:'3',criterionId:'4',actionId:'123',count:0.75,value:11250}]}};
}
export async function googleFixtureLoader(signal:AbortSignal) {
  signal.throwIfAborted();const mode=new URLSearchParams(window.location.search).get('google')??'complete';
  if(mode==='failure')throw Error('Synthetic Google failure');return googleFixture(mode);
}
