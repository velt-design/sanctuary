import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readCampaignHealth } from './reader';
import { campaignPeriods, type CampaignScope } from './contract';
import type { Boundary } from '../meta/boundary';
const scope: CampaignScope = { account:'99100',campaign:'99200',adset:'99300',ads:[{id:'99401',label:'Riverhead photo'},{id:'99402',label:'Riverhead video'},{id:'99403',label:'Acrylic video'},{id:'99404',label:'Acrylic photo'}],launchDay:'2026-01-01',dailyAverage:100,maximumDay:175,weeklyAllowance:700,weekStartsOn:0,weeklyWindowVerified:true };
const now = new Date('2026-06-17T00:00:00Z');
beforeEach(()=>vi.stubEnv('SANCTUARY_CAMPAIGN_MONITOR_SCOPE',JSON.stringify(scope)));
afterEach(()=>vi.unstubAllEnvs());
const config={actor:'10000000-0000-4000-8000-000000000001',account:scope.account,binding:'a'.repeat(64),app:'1',principal:'2',business:'3',token:'synthetic-token',appSecret:'synthetic-secret'};
function fixture(options: {missing?:boolean;extra?:boolean;wrong?:boolean;paging?:boolean}={}) {
 const calls: Array<{path:string;params:URLSearchParams}> = [];
 const fetcher: typeof fetch = async (_url,init) => {
  const outer = new URLSearchParams(String(init?.body)), batch=JSON.parse(outer.get('batch')!);
  expect(batch).toHaveLength(1);expect(batch[0].method).toBe('GET');
  const url=new URL(`https://graph.invalid/${batch[0].relative_url}`);calls.push({path:url.pathname,params:url.searchParams});
  const period=JSON.parse(url.searchParams.get('time_range')??'{}');
  const data: unknown[]=url.pathname.endsWith('/ads')?scope.ads.map(ad=>({id:ad.id,account_id:scope.account,campaign_id:options.wrong?'99999':scope.campaign,adset_id:scope.adset,effective_status:'ACTIVE',campaign:{id:scope.campaign,effective_status:'ACTIVE',daily_budget:'10000'},adset:{id:scope.adset,effective_status:'ACTIVE'}}))
   : options.missing?[]:scope.ads.map(ad=>({account_id:scope.account,campaign_id:scope.campaign,adset_id:scope.adset,ad_id:ad.id,date_start:period.since,date_stop:period.until,spend:'12.50',impressions:'100',inline_link_clicks:'5',actions:[{action_type:'landing_page_view',value:'3'},{action_type:'offsite_conversion.fb_pixel_lead',value:'1'}]}));
  if(options.extra)data.push(data[0]!);
  return Response.json([{code:200,body:JSON.stringify({data,...(options.paging?{paging:{next:'https://untrusted.invalid'}}:{})})}]);
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
