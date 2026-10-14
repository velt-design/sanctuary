import 'server-only';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { metaRead } from '../meta/transport';
import type { Boundary } from '../meta/boundary';
import type { MetaConfig } from '../meta/config';
import { entityId, campaignScope, TIMEZONE, campaignPeriods, campaignHealthSchema, type CampaignHealth } from './contract';

const numeric = z.string().regex(/^\d+(\.\d+)?$/).transform(Number).refine(Number.isSafeInteger);
const money = z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).refine(Number.isFinite);
const metric = z.string().regex(/^\d+(\.\d+)?$/).transform(Number).refine(Number.isFinite);
const state = z.string().regex(/^[A-Z_]{1,50}$/);
const statusRow = z.object({ id: entityId, account_id: entityId, campaign_id: entityId, adset_id: entityId, effective_status: state,
  campaign: z.object({ id: entityId, effective_status: state, daily_budget: numeric.optional() }),
  adset: z.object({ id: entityId, effective_status: state, daily_budget: numeric.optional() }) });
const insight = z.object({ account_id: entityId, campaign_id: entityId, adset_id: entityId, ad_id: entityId,
  date_start: z.string(), date_stop: z.string(), spend: money.optional(), impressions: numeric.optional(), inline_link_clicks: numeric.optional(),
  actions: z.array(z.object({ action_type: z.string(), value: metric })).max(100).optional() });
function page<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const result = z.object({ data: z.array(schema).max(4), paging: z.object({ next: z.unknown().optional() }).optional() }).parse(value);
  if (result.paging?.next) throw new Error('Campaign read is incomplete.');
  return result.data;
}
export async function readCampaignHealth(config: Omit<MetaConfig, 'expiresAt'>, account: { timezone: string; currency: string }, boundary: Boundary, fetcher: typeof fetch, now = new Date()): Promise<CampaignHealth> {
  const scope = campaignScope(), { account: ACCOUNT, campaign: CAMPAIGN, adset: ADSET } = scope, ADS = scope.ads.map(row => row.id);
  if (config.account !== ACCOUNT || account.timezone !== TIMEZONE || account.currency !== 'NZD') throw new Error('Campaign account differs.');
  const periods = campaignPeriods(now), proof = createHmac('sha256', config.appSecret).update(config.token).digest('hex');
  const filtering = JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: [CAMPAIGN] }]);
  const read = (edge: 'ads' | 'insights', fields: string, extra: Record<string, string> = {}) => boundary('report_read', async () =>
    (await metaRead(fetcher, `act_${ACCOUNT}/${edge}`, new URLSearchParams({ fields, filtering, limit: '100', appsecret_proof: proof, ...extra }), config.token)).body);
  const states = page(statusRow, await read('ads', 'id,account_id,campaign_id,adset_id,effective_status,campaign{id,effective_status,daily_budget},adset{id,effective_status,daily_budget}'));
  if (states.length !== 4 || new Set(states.map(row => row.id)).size !== 4) throw new Error('Campaign ad coverage differs.');
  if (states.some(row => !ADS.includes(row.id) || row.account_id !== ACCOUNT || row.campaign_id !== CAMPAIGN || row.adset_id !== ADSET || row.campaign.id !== CAMPAIGN || row.adset.id !== ADSET)) throw new Error('Campaign scope differs.');
  const first = states[0]!;
  if (states.some(row => JSON.stringify(row.campaign) !== JSON.stringify(first.campaign) || JSON.stringify(row.adset) !== JSON.stringify(first.adset))) throw new Error('Campaign state is inconsistent.');
  const values: Record<string, Map<string, z.infer<typeof insight>>> = {};
  for (const [key, period] of Object.entries(periods)) {
    const rows = page(insight, await read('insights', 'account_id,campaign_id,adset_id,ad_id,date_start,date_stop,spend,impressions,inline_link_clicks,actions', {
      level: 'ad', time_range: JSON.stringify({ since: period.start, until: period.end }), use_unified_attribution_setting: 'true', action_report_time: 'impression',
    }));
    if (new Set(rows.map(row => row.ad_id)).size !== rows.length || rows.some(row => !ADS.includes(row.ad_id) || row.account_id !== ACCOUNT || row.campaign_id !== CAMPAIGN || row.adset_id !== ADSET || row.date_start !== period.start || row.date_stop !== period.end)) throw new Error('Campaign metrics are inconsistent.');
    values[key] = new Map(rows.map(row => [row.ad_id, row]));
  }
  const metrics = (key: string, id: string) => {
    const row = values[key]!.get(id);
    // An absent insight row is unknown. Status does not prove zero delivery.
    const action = (name: string) => {
      const found = row?.actions?.filter(item => item.action_type === name);
      if (found && found.length > 1) throw new Error('Duplicate action metric.');
      return found?.[0]?.value ?? null;
    };
    return { spend: row?.spend ?? null, impressions: row?.impressions ?? null, linkClicks: row?.inline_link_clicks ?? null,
      landingViews: action('landing_page_view'), websiteLeads: action('offsite_conversion.fb_pixel_lead') };
  };
  return campaignHealthSchema.parse({ version: 'sanctuary-campaign-health-v1', account: ACCOUNT, campaign: CAMPAIGN, adset: ADSET,
    observedAt: now.toISOString(), currency: 'NZD', timezone: TIMEZONE, periods, campaignStatus: first.campaign.effective_status,
    adsetStatus: first.adset.effective_status, dailyBudget: (first.campaign.daily_budget ?? first.adset.daily_budget) === undefined ? null : (first.campaign.daily_budget ?? first.adset.daily_budget)! / 100,
    ads: scope.ads.map(({ id, label }) => ({ id, label, status: states.find(row => row.id === id)!.effective_status, today: metrics('today', id), week: metrics('week', id) })),
    attribution: 'Ad-set attribution settings; impression-time reporting' });
}
