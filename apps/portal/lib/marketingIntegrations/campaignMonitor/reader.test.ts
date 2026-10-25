import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readCampaignHealth } from './reader';
import * as tracking from './tracking-evidence';
import { campaignPeriods, type CampaignScope, type RegisteredCreativeAd } from './contract';
import type { Boundary } from '../meta/boundary';
const scope: CampaignScope = { account:'99100',campaign:'99200',adset:'99300',ads:[{id:'99401',label:'Riverhead photo'},{id:'99402',label:'Riverhead video'},{id:'99403',label:'Acrylic video'},{id:'99404',label:'Acrylic photo'}],launchDay:'2026-01-01',dailyAverage:100,maximumDay:175,weeklyAllowance:700,weekStartsOn:0,weeklyWindowVerified:true };
const now = new Date('2026-06-17T00:00:00Z');
beforeEach(()=>vi.stubEnv('SANCTUARY_CAMPAIGN_MONITOR_SCOPE',JSON.stringify(scope)));
afterEach(()=>vi.unstubAllEnvs());
const config={actor:'10000000-0000-4000-8000-000000000001',account:scope.account,binding:'a'.repeat(64),app:'1',principal:'2',business:'3',token:'synthetic-token',appSecret:'synthetic-secret'};
function fixture(options: {missing?:boolean;extra?:boolean;wrong?:boolean;paging?:boolean;ids?:string[];tracking?:unknown;oversize?:boolean;rejectTracking?:boolean}={}) {
 const calls: Array<{path:string;params:URLSearchParams}> = [];
 const fetcher: typeof fetch = async (_url,init) => {
  const outer = new URLSearchParams(String(init?.body)), batch=JSON.parse(outer.get('batch')!);
  expect(batch).toHaveLength(1);expect(batch[0].method).toBe('GET');
  const url=new URL(`https://graph.invalid/${batch[0].relative_url}`);calls.push({path:url.pathname,params:url.searchParams});
  const period=JSON.parse(url.searchParams.get('time_range')??'{}');
  if(options.rejectTracking&&url.searchParams.get('fields')?.includes('tracking_specs'))return Response.json([{code:400,body:'private-provider-error'}]);
  const data: unknown[]=url.pathname.endsWith('/ads')?(options.ids??scope.ads.map(ad=>ad.id)).map(id=>({id,account_id:scope.account,campaign_id:options.wrong?'99999':scope.campaign,adset_id:scope.adset,effective_status:'ACTIVE',...('tracking' in options?{tracking_specs:options.tracking}:{}),campaign:{id:scope.campaign,effective_status:'ACTIVE',daily_budget:'10000'},adset:{id:scope.adset,effective_status:'ACTIVE'}}))
   : options.missing?[]:(options.ids??scope.ads.map(ad=>ad.id)).map(id=>({account_id:scope.account,campaign_id:scope.campaign,adset_id:scope.adset,ad_id:id,date_start:period.since,date_stop:period.until,spend:'12.50',impressions:'100',inline_link_clicks:'5',actions:[{action_type:'landing_page_view',value:'3'},{action_type:'offsite_conversion.fb_pixel_lead',value:'1'}]}));
  if(options.extra)data.push(data[0]!);
  return Response.json([{code:200,body:JSON.stringify({data,...(options.oversize?{padding:'x'.repeat(65536)}:{}),...(options.paging?{paging:{next:'https://untrusted.invalid'}}:{})})}]);
 };
 return {fetcher,calls};
}
const boundary:Boundary=async(_step,execute)=>execute();
it('uses exact campaign filters and explicit NZ dates, campaign-level budget and all four ad rows',async()=>{
 const f=fixture(),result=await readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now);
 expect(result.dailyBudget).toBe(100);expect(result.ads).toHaveLength(4);expect(result.periods).toEqual(campaignPeriods(now));
 expect(f.calls).toHaveLength(3);expect(f.calls.every(call=>call.params.get('filtering')===JSON.stringify([{field:'campaign.id',operator:'IN',value:[scope.campaign]}]))).toBe(true);
 expect(result.ads[0]?.week.websiteLeads).toBe(1);
});
it.each([{wrong:true},{extra:true},{paging:true}])('rejects wrong scope, duplicate rows or truncated coverage %j',async options=>{
 await expect(readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,fixture(options).fetcher,now)).rejects.toThrow();
});
it('does not invent zero delivery from absent insights',async()=>{
 const result=await readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,fixture({missing:true}).fetcher,now);
 expect(result.ads.every(row=>row.today.spend===null && row.week.websiteLeads===null)).toBe(true);
});
it('rejects account, currency and timezone mismatch before provider access',async()=>{
 const f=fixture();await expect(readCampaignHealth(config,{currency:'AUD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now)).rejects.toThrow();expect(f.calls).toHaveLength(0);
});

it('reads original plus exact registered ads within the same three requests and rejects unregistered extras',async()=>{
 const ad:RegisteredCreativeAd={experiment:'10000000-0000-4000-8000-000000000099',id:'99500',arm:'control',campaign:scope.campaign,adset:scope.adset,page:'99600',path:'/auckland-outdoor-living',template:'a'.repeat(64),purpose:'paused_capability',delivery:false,startsAt:'2026-06-17T00:00:00.000Z',endsAt:'2026-07-01T00:00:00.000Z'};
 const f=fixture({ids:[...scope.ads.map(row=>row.id),ad.id],tracking:[{'action.type':['synthetic-secret-value']}]});
 const result=await readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now,[ad]);
 expect(result.ads).toHaveLength(4);expect(result.ads.every(row=>row.trackingEvidence?.status==='observed')).toBe(true);expect(result.creativeAds?.[0]).not.toHaveProperty('trackingEvidence');expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');expect(result.creativeAds?.[0]).toMatchObject({...ad,today:{spend:12.5}});expect(f.calls).toHaveLength(3);
 await expect(readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now)).rejects.toThrow();
});

it('adds only the tracking field to the same three GETs and projects only exact originals',async()=>{
 const value=[{'action.type':['offsite_conversion'],fb_pixel:['123456'],'private-secret-key':['private-secret-value']}];
 const f=fixture({tracking:value}),report=await readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now);
 expect(f.calls).toHaveLength(3);expect(f.calls.map(row=>row.path)).toEqual(['/act_99100/ads','/act_99100/insights','/act_99100/insights']);
 expect(f.calls[0]!.params.get('fields')).toBe('id,account_id,campaign_id,adset_id,effective_status,tracking_specs,creative{id},campaign{id,effective_status,daily_budget},adset{id,effective_status,daily_budget}');
 expect(report.ads.every(ad=>ad.trackingEvidence?.status==='observed'&&ad.trackingEvidence.violations.includes('key_syntax')&&ad.trackingEvidence.actionTypeKey===true)).toBe(true);
 expect(JSON.stringify(report)).not.toMatch(/private-secret|offsite_conversion|fb_pixel|action\.type/);
 const legacy=await readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,fixture().fetcher,now);
 expect(report.ads.map(({trackingEvidence:_,...row})=>{void _;return row;})).toEqual(legacy.ads.map(({trackingEvidence:_,...row})=>{void _;return row;}));
 expect(legacy.ads.every(ad=>ad.trackingEvidence?.status==='missing')).toBe(true);
});
it('keeps optional local projection failure unavailable while preserving core health and no retry',async()=>{
 const spy=vi.spyOn(tracking,'projectTrackingEvidence').mockImplementationOnce(()=>{throw Error('private-secret-local-failure');});
 try{const f=fixture({tracking:[]}),report=await readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now);
 expect(report.ads[0]!.trackingEvidence).toEqual({version:1,status:'unavailable'});expect(report.dailyBudget).toBe(100);expect(f.calls).toHaveLength(3);expect(JSON.stringify(report)).not.toContain('private-secret');}finally{spy.mockRestore();}
});
it.each([{rejectTracking:true},{oversize:true}])('retains provider rejection/body-bound semantics without fallback or retries %j',async options=>{
 const f=fixture(options);await expect(readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now)).rejects.toThrow();expect(f.calls).toHaveLength(1);
});

it('preserves complete44-ad inventory and bounded optional output without projecting owned rows',async()=>{
 const registered:RegisteredCreativeAd[]=Array.from({length:40},(_,i)=>({experiment:'10000000-0000-4000-8000-000000000099',id:String(99500+i),arm:i%2?'control':'challenger',campaign:scope.campaign,adset:scope.adset,page:'99600',path:'/auckland-outdoor-living',template:'a'.repeat(64),purpose:'paused_capability',delivery:false,startsAt:'2026-06-17T00:00:00.000Z',endsAt:'2026-07-01T00:00:00.000Z'}));
 const f=fixture({ids:[...scope.ads.map(ad=>ad.id),...registered.map(ad=>ad.id)],tracking:[]});
 const report=await readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,f.fetcher,now,registered);
 expect(f.calls).toHaveLength(3);expect(report.ads).toHaveLength(4);expect(report.creativeAds).toHaveLength(40);expect(report.creativeAds!.every(row=>!('trackingEvidence' in row))).toBe(true);expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThan(65536);
 const invalid=fixture();await expect(readCampaignHealth(config,{currency:'NZD',timezone:'Pacific/Auckland'},boundary,invalid.fetcher,now,[...registered,{...registered[0]!,id:'99999'}])).rejects.toThrow();expect(invalid.calls).toHaveLength(0);
});
