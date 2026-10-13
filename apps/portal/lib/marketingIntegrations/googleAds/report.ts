import { z } from 'zod';
import { id, reportSchema, type AdsReport } from './contract';
import { googleJson, GoogleFailure } from './transport';

const numeric = z.union([z.string().regex(/^\d+(\.\d+)?$/), z.number().finite().nonnegative()]).transform(Number).refine(Number.isFinite);
const integer = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform(String).refine(v => BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER));
const metric = z.object({ clicks: numeric, impressions: numeric, costMicros: integer });
const campaign = z.object({ id, name: z.string().max(1000) });
const segment = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const actionResource = z.string().regex(/^customers\/\d+\/conversionActions\/[1-9]\d*$/);
export type AdsRead = { customerId: string; conversionCustomerId?: string; managerId?: string; token: string; before: () => Promise<void>; signal: AbortSignal; fetcher?: typeof fetch };

export async function searchAds(input: AdsRead, query: string): Promise<unknown[]> {
  id.parse(input.customerId); if (input.managerId) id.parse(input.managerId);
  const rows: unknown[] = [], seen = new Set<string>(); let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    await input.before(); input.signal.throwIfAborted();
    const response = z.object({ results: z.array(z.unknown()).default([]), nextPageToken: z.string().min(1).max(8192).optional() })
      .parse(await googleJson(input.fetcher ?? fetch, `https://googleads.googleapis.com/v25/customers/${input.customerId}/googleAds:search`, {
        method: 'POST', headers: { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json',
          ...(input.managerId ? { 'login-customer-id': input.managerId } : {}) },
        body: JSON.stringify({ query, ...(cursor ? { pageToken: cursor } : {}) }), signal: input.signal,
      }));
    rows.push(...response.results); if (rows.length > 100000) throw new GoogleFailure('REPORT_ROW_LIMIT');
    if (!response.nextPageToken) return rows;
    if (seen.has(response.nextPageToken)) throw new GoogleFailure('REPEATED_PAGE');
    seen.add(response.nextPageToken); cursor = response.nextPageToken;
  }
  throw new GoogleFailure('REPORT_PAGE_LIMIT');
}
export function reportPeriod(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  const today = Date.parse(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);
  return { start: new Date(today - 90 * 86400000).toISOString().slice(0, 10), end: new Date(today - 86400000).toISOString().slice(0, 10) };
}
export async function readAdsReport(input: AdsRead, now = new Date()): Promise<AdsReport> {
  const accounts = await searchAds(input, 'SELECT customer.id, customer.currency_code, customer.time_zone FROM customer');
  const account = z.array(z.object({ customer: z.object({ id: z.literal(input.customerId), currencyCode: z.string().regex(/^[A-Z]{3}$/), timeZone: z.string().min(1) }) })).length(1).parse(accounts)[0].customer;
  const period = reportPeriod(now, account.timeZone), filter = `segments.date BETWEEN '${period.start}' AND '${period.end}'`;
  const actionRows = await searchAds({ ...input, customerId: input.conversionCustomerId ?? input.customerId }, 'SELECT conversion_action.id, conversion_action.name, conversion_action.category, conversion_action.status, conversion_action.primary_for_goal FROM conversion_action');
  const actions = actionRows.map(row => { const a = z.object({ conversionAction: z.object({ id, name: z.string(), category: z.string(), status: z.string(), primaryForGoal: z.boolean() }) }).parse(row).conversionAction;
    return { id: a.id, name: a.name, category: a.category, status: a.status, primary: a.primaryForGoal }; });
  const campaigns = (await searchAds(input, `SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions FROM campaign WHERE ${filter}`))
    .map(row => { const r = z.object({ segments: segment, campaign, metrics: metric }).parse(row);
      return { day: r.segments.date, campaignId: r.campaign.id, name: r.campaign.name, ...r.metrics }; });
  const keywords = (await searchAds(input, `SELECT segments.date, campaign.id, ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, metrics.cost_micros, metrics.clicks, metrics.impressions FROM keyword_view WHERE ${filter}`))
    .map(row => { const r = z.object({ segments: segment, campaign: z.object({ id }), adGroup: z.object({ id }), adGroupCriterion: z.object({ criterionId: id, keyword: z.object({ text: z.string(), matchType: z.string() }) }), metrics: metric }).parse(row);
      return { day: r.segments.date, campaignId: r.campaign.id, adGroupId: r.adGroup.id, criterionId: r.adGroupCriterion.criterionId, keyword: r.adGroupCriterion.keyword.text, matchType: r.adGroupCriterion.keyword.matchType, ...r.metrics }; });
  const conversions: AdsReport['conversions'] = [];
  for (const grain of ['campaign', 'keyword_view'] as const) for (const dateBasis of ['interaction', 'conversion'] as const) {
    const keywordFields = grain === 'keyword_view' ? ', ad_group.id, ad_group_criterion.criterion_id' : '';
    const metricFields = dateBasis === 'interaction' ? 'metrics.all_conversions, metrics.all_conversions_value' : 'metrics.all_conversions_by_conversion_date, metrics.all_conversions_value_by_conversion_date';
    const rows = await searchAds(input, `SELECT segments.date, campaign.id${keywordFields}, segments.conversion_action, ${metricFields} FROM ${grain} WHERE ${filter}`);
    for (const row of rows) { const r = z.object({ segments: segment.extend({ conversionAction: actionResource }), campaign: z.object({ id }),
      adGroup: z.object({ id }).optional(), adGroupCriterion: z.object({ criterionId: id }).optional(), metrics: z.object({ allConversions: numeric.optional(), allConversionsValue: numeric.optional(), allConversionsByConversionDate: numeric.optional(), allConversionsValueByConversionDate: numeric.optional() }) }).parse(row);
      if (grain === 'keyword_view' && (!r.adGroup || !r.adGroupCriterion)) throw new GoogleFailure('KEYWORD_GRAIN_MISSING');
      const count = dateBasis === 'interaction' ? r.metrics.allConversions : r.metrics.allConversionsByConversionDate;
      const value = dateBasis === 'interaction' ? r.metrics.allConversionsValue : r.metrics.allConversionsValueByConversionDate;
      if (count === undefined || value === undefined) throw new GoogleFailure('CONVERSION_METRICS_MISSING');
      conversions.push({ day: r.segments.date, dateBasis, campaignId: r.campaign.id, ...(grain === 'keyword_view' ? { adGroupId: r.adGroup!.id, criterionId: r.adGroupCriterion!.criterionId } : {}), actionId: r.segments.conversionAction.split('/').at(-1)!, count, value });
    }
  }
  const keys = (rows: unknown[], get: (r: any) => string) => { if (new Set(rows.map(get)).size !== rows.length) throw new GoogleFailure('DUPLICATE_REPORT_GRAIN'); };
  keys(actions, r => r.id); keys(campaigns, r => `${r.day}/${r.campaignId}`); keys(keywords, r => `${r.day}/${r.campaignId}/${r.adGroupId}/${r.criterionId}`);
  keys(conversions, r => `${r.dateBasis}/${r.day}/${r.campaignId}/${r.adGroupId ?? ''}/${r.criterionId ?? ''}/${r.actionId}`);
  return reportSchema.parse({ schemaVersion: 1, customerId: account.id, currency: account.currencyCode, timezone: account.timeZone, ...period, fetchedAt: now.toISOString(), actions, campaigns, keywords, conversions });
}
