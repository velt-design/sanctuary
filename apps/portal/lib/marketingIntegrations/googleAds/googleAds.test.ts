// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { emailHash, phoneHash, prepareSale, type SaleSource } from './sales';
import { searchAds, reportPeriod, readAdsReport } from './report';
import { destination, ingestSale, retractSale, saleRequestStatus } from './delivery';
import { saleDestinationReference } from './ingestWire.mjs';
import { advertisingRows } from './view';
const now=new Date('2026-10-13T10:00:00Z'),q='44444444-4444-4444-8444-000000000001';
const source:SaleSource={quoteId:q,projectId:q,receiptId:q,fingerprint:'a'.repeat(64),occurredAt:'2026-10-10T09:00:00Z',receivedAt:'2026-10-01T09:00:00Z',valueCents:1500000,currency:'NZD',active:true,marketingConsent:true,consentBasis:'regional_default',disclosureVersion:'2026-10-sale-measurement-v1',email:'Demo@example.test',phone:'0211234567',gclid:null,gbraid:null,wbraid:null};
const provider={config:{customerId:'6328516633',managerId:'6596874249',actionId:'123'},token:'fake-only',before:vi.fn(async()=>{}),signal:new AbortController().signal};
const json=(v:unknown)=>new Response(JSON.stringify(v));
const policy={enhancedMatchingApproved:true,allowedConsentBases:['user_choice','regional_default'],consentEffectiveFrom:'2026-01-01T00:00:00Z',disclosureVersion:'2026-10-sale-measurement-v1'};
const event=()=>{const v=prepareSale(source,policy,now);if(!('event'in v))throw new Error();return v.event;};
describe('privacy and sale preparation',()=>{
  it('normalizes Gmail dots plus suffix but preserves other domain local parts',()=>{
    expect(emailHash(' First.Last+tag@Gmail.com ')).toBe(emailHash('firstlast@gmail.com'));
    expect(emailHash('a.b+x@example.test')).not.toBe(emailHash('ab@example.test'));
    expect(phoneHash('0211234567')).toBeNull();expect(phoneHash('+64 21 123 4567')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('needs a provenance-aware approved policy without changing the saved regional basis',()=>{
    expect(prepareSale(source,{...policy,enhancedMatchingApproved:false},now)).toEqual({reason:'PERMITTED_MATCHING_ID_MISSING'});
    expect(prepareSale(source,{...policy,allowedConsentBases:['user_choice']},now)).toEqual({reason:'CONSENT_POLICY_NOT_APPROVED_FOR_RECEIPT'});
    expect(prepareSale(source,{...policy,consentEffectiveFrom:'2026-10-02T00:00:00Z'},now)).toEqual({reason:'CONSENT_POLICY_NOT_APPROVED_FOR_RECEIPT'});
    const body=event();expect(body.consent.adUserData).toBe('CONSENT_GRANTED');expect(source.consentBasis).toBe('regional_default');
    expect(body.userData?.userIdentifiers).toHaveLength(1);expect(JSON.stringify(body)).not.toContain('example.test');
    expect(prepareSale({...source,marketingConsent:false},policy,now)).toEqual({reason:'MARKETING_CONSENT_NOT_GRANTED'});
  });
  it('rejects missing or reversed dates and old enhanced-only interaction without dropping valid email for phone',()=>{
    expect(prepareSale({...source,receivedAt:'2026-07-01T00:00:00Z'},policy,now)).toEqual({reason:'ENHANCED_MATCHING_WINDOW_EXCEEDED'});
    expect(prepareSale({...source,occurredAt:'2026-09-01T00:00:00Z'},policy,now)).toEqual({reason:'SALE_DATE_UNVERIFIED'});
    expect(event().conversionValue).toBe(15000);
  });
});
it('searches every page with identical query, no retired token/page-size and bounds cyclic cursors',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(json({results:[{a:1}],nextPageToken:'p2'})).mockResolvedValueOnce(json({results:[{a:2}]}));
  const input={...provider.config,token:'fake',before:provider.before,signal:provider.signal,fetcher};
  expect(await searchAds(input,'fixed query')).toHaveLength(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({query:'fixed query',pageToken:'p2'});
  expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('developer-token');
  const cyclic=vi.fn(async()=>json({nextPageToken:'same'}));await expect(searchAds({...input,fetcher:cyclic},'fixed')).rejects.toThrow('REPEATED_PAGE');
});
it('calendar report window is exact in account timezone across DST',()=>{
  expect(reportPeriod(new Date('2026-10-01T12:00:00Z'),'Pacific/Auckland')).toEqual({start:'2026-07-04',end:'2026-10-01'});
});
it('reads spend and outcomes at independent campaign/keyword and date grains',async()=>{
  const fetcher=vi.fn(async(_url:any,init:any)=>{
    const query=JSON.parse(init.body).query as string;
    if(query.includes('FROM customer'))return json({results:[{customer:{id:'6328516633',currencyCode:'NZD',timeZone:'Pacific/Auckland'}}]});
    if(query.includes('FROM conversion_action'))return json({results:[{conversionAction:{id:'123',name:'Closed Sale',category:'PURCHASE',status:'ENABLED',primaryForGoal:false}},{conversionAction:{id:'124',name:'Enquiry',category:'SUBMIT_LEAD_FORM',status:'ENABLED',primaryForGoal:true}}]});
    const keyword=query.includes('FROM keyword_view');
    const row={segments:{date:'2026-10-10',...(query.includes('segments.conversion_action')?{conversionAction:'customers/6328516633/conversionActions/123'}:{})},campaign:{id:'1',name:'Non brand'},...(keyword?{adGroup:{id:'2'},adGroupCriterion:{criterionId:'3',keyword:{text:'pergola auckland',matchType:'EXACT'}}}:{}),
      metrics:query.includes('by_conversion_date')?{allConversionsByConversionDate:0.5,allConversionsValueByConversionDate:7500}:query.includes('all_conversions')?{allConversions:0.5,allConversionsValue:7500}:{costMicros:'615000000',clicks:'255',impressions:'1000'}};
    return json({results:[row]});
  });
  const report=await readAdsReport({...provider.config,token:'fake',before:provider.before,signal:provider.signal,fetcher},now);
  expect(report.conversions).toHaveLength(4);
  const rows=advertisingRows(report,{grain:'campaign',dateBasis:'interaction',start:report.start,end:report.end,saleActionId:'123',enquiryActionIds:['124']});
  expect(rows[0]).toMatchObject({cost:615,clicks:255,sales:0.5,value:7500,enquiries:0});
  expect(()=>advertisingRows(report,{grain:'campaign',dateBasis:'interaction',start:'2020-01-01',end:report.end,saleActionId:null,enquiryActionIds:[]})).toThrow('Dates outside');
});
it('retains transaction identity and distinguishes validation, ingestion and eventual attribution',async()=>{
  const fetcher=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>json({requestId:'request-1'}));
  expect(await ingestSale({...provider,fetcher},event(),true)).toEqual({validated:true,requestId:null});
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toMatchObject({validateOnly:true,encoding:'HEX',destinations:[destination(provider.config)]});
  expect(await ingestSale({...provider,fetcher},event(),false)).toEqual({validated:false,requestId:'request-1'});
  const diagnostics=vi.fn(async()=>json({requestStatusPerDestination:[{destination:destination(provider.config),requestStatus:'SUCCESS',eventsIngestionStatus:{recordCount:'1'}}]}));
  expect(await saleRequestStatus({...provider,fetcher:diagnostics},'request-1')).toEqual({status:'SUCCESS',recordCount:1,errors:[],warnings:[],recovery:'ACCEPTED'});
  await expect(saleRequestStatus({...provider,fetcher:async()=>json({requestStatusPerDestination:[{destination:destination(provider.config),requestStatus:'SUCCESS',eventsIngestionStatus:{recordCount:'2'}}]})},'request-1')).rejects.toThrow();
});
it.each([true,false])('routes the exact frozen sale to its explicit destination in validateOnly=%s',async(validateOnly)=>{
  const frozen=Object.freeze(event()),before=JSON.stringify(frozen),target=destination(provider.config);
  const fetcher=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>json({requestId:'request-routed'}));
  await ingestSale({...provider,fetcher},frozen,validateOnly);
  const body=JSON.parse(fetcher.mock.calls[0][1]!.body as string);
  expect(body).toEqual({destinations:[{...target,reference:'sanctuary_closed_sale'}],encoding:'HEX',
    events:[{...frozen,destinationReferences:['sanctuary_closed_sale']}],validateOnly});
  expect(body.events[0].destinationReferences).toEqual(body.destinations.map((d:{reference:string})=>d.reference));
  expect(JSON.stringify(frozen)).toBe(before);expect(frozen).not.toHaveProperty('destinationReferences');
  expect(target).not.toHaveProperty('reference');
});
it('accepts matching or omitted diagnostic reference while rejecting a different destination or reference',async()=>{
  const check=(d:unknown)=>saleRequestStatus({...provider,fetcher:async()=>json({requestStatusPerDestination:[{destination:d,requestStatus:'SUCCESS',eventsIngestionStatus:{recordCount:'1'}}]})},'request-routed');
  const target=destination(provider.config);
  await expect(check({...target,reference:saleDestinationReference})).resolves.toMatchObject({recovery:'ACCEPTED'});
  await expect(check(target)).resolves.toMatchObject({recovery:'ACCEPTED'});
  await expect(check({...target,reference:'different_destination'})).rejects.toThrow();
  await expect(check({...target,reference:saleDestinationReference,productDestinationId:'999'})).rejects.toThrow();
  await expect(check({...target,reference:saleDestinationReference,loginAccount:undefined})).rejects.toThrow('DESTINATION_MISMATCH');
});
const diagnostic=(body:Record<string,unknown>)=>saleRequestStatus({...provider,fetcher:async()=>json({requestStatusPerDestination:[{destination:destination(provider.config),eventsIngestionStatus:{recordCount:'1'},...body}]})},'request-private');
it('retains only known diagnostic reason codes/counts and safely classifies recovery',async()=>{
  expect(await diagnostic({requestStatus:'FAILED',errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_INTERNAL_ERROR',recordCount:'1'}]}}))
    .toMatchObject({recovery:'RETRY',errors:[{code:'PROCESSING_ERROR_REASON_INTERNAL_ERROR',count:1}]});
  const failed=await diagnostic({requestStatus:'FAILED',errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_DENIED_CONSENT',recordCount:'1'}]}});
  expect(failed.recovery).toBe('REVIEW');expect(failed.errors[0].code).toBe('PROCESSING_ERROR_REASON_DENIED_CONSENT');
  const unknown=await diagnostic({requestStatus:'FAILED',errorInfo:{errorCounts:[{reason:'customer@example.test '.repeat(100),recordCount:'1'}]}});
  expect(unknown).toMatchObject({recovery:'REVIEW',errors:[{code:'UNKNOWN_PROVIDER_REASON',count:1}]});expect(JSON.stringify(unknown)).not.toContain('example.test');
  expect((await diagnostic({requestStatus:'FAILED',errorInfo:{}})).recovery).toBe('REVIEW');
});
it('retains accepted warning counts without resending or mistaking unknown diagnostics for acceptance',async()=>{
  expect(await diagnostic({requestStatus:'SUCCESS',warningInfo:{warningCounts:[{reason:'PROCESSING_WARNING_REASON_INTERNAL_ERROR',recordCount:'1'}]}}))
    .toMatchObject({recovery:'ACCEPTED',warnings:[{code:'PROCESSING_WARNING_REASON_INTERNAL_ERROR',count:1}]});
  expect((await diagnostic({requestStatus:'SUCCESS',warningInfo:{warningCounts:[{reason:'FUTURE_CODE',recordCount:'1'}]}})).recovery).toBe('REVIEW');
  await expect(diagnostic({requestStatus:'SUCCESS',errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_INTERNAL_ERROR',recordCount:'1'}]}})).rejects.toThrow('COUNTS_UNCONFIRMED');
  await expect(diagnostic({requestStatus:'PROCESSING',warningInfo:{warningCounts:[]}})).rejects.toThrow('STATUS_INCONSISTENT');
});
it.each(['-1','2','1.5','9223372036854775808','one'])('rejects malformed or impossible single-event diagnostic count %s',async(recordCount)=>{
  await expect(diagnostic({requestStatus:'FAILED',errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_INTERNAL_ERROR',recordCount}]}})).rejects.toThrow();
});
it('bounds provider diagnostic arrays',async()=>{
  await expect(diagnostic({requestStatus:'FAILED',errorInfo:{errorCounts:Array.from({length:65},()=>({reason:'PROCESSING_ERROR_REASON_INTERNAL_ERROR',recordCount:'1'}))}})).rejects.toThrow();
});
it('requires successful adjustment identity and never calls a zero-value restatement a cancellation',async()=>{
  const fetcher=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>json({results:[{conversionAction:'customers/6328516633/conversionActions/123',orderId:event().transactionId,adjustmentType:'RETRACTION'}]}));
  expect(await retractSale({...provider,fetcher},event(),now,false)).toEqual({validated:false,retracted:true});
  const body=JSON.parse(fetcher.mock.calls[0][1]!.body as string);expect(body.conversionAdjustments[0]).not.toHaveProperty('restatementValue');
  await expect(retractSale({...provider,fetcher:async()=>json({results:[{}],partialFailureError:{code:3}})},event(),now,false)).rejects.toThrow('RETRACTION_REJECTED');
});
