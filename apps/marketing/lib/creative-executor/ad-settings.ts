// Persistent writable Ad fields from Meta's generated AdAccount.create_ad.
// Ownership/name/status/creative/tracking and the formal schedule have explicit
// owners; these remaining observed settings must not silently use new defaults.
export const adSettingKeys=['conversion_domain','adlabels','bid_amount','creative_asset_groups_spec','creative_audience_pairing_persona','creative_automation_spec','display_sequence','engagement_audience','priority','audience_id','dataset_split_specs','ad_schedule_start_time','ad_schedule_end_time'] as const;
export const adSettingsFields=adSettingKeys.join(',');
export function observedAdSettings(row:Record<string,unknown>):Record<string,unknown>{if(Object.keys(row).some(key=>!['id','account_id','campaign_id','adset_id','status','creative','tracking_specs',...adSettingKeys].includes(key)))throw new Error('Unknown original ad setting');return Object.fromEntries(adSettingKeys.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]));}
export function wireAdSettings(value:Record<string,unknown>|undefined):Record<string,string>{return Object.fromEntries(Object.entries(value??{}).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));}
export function comparableAdSettings(value:Record<string,unknown>|undefined,formal:boolean){return Object.fromEntries(Object.entries(value??{}).filter(([key])=>!formal||!['ad_schedule_start_time','ad_schedule_end_time'].includes(key)));}
