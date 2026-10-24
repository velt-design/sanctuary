import { steadyAdSchema } from './steady-contract';
export { steadyAdSchema, type SteadyAd } from './steady-contract';
import { z } from 'zod';

// Fixed owner-approved scope. This is not a general ads query endpoint.
export const entityId = z.string().regex(/^[1-9]\d{0,19}$/);
export const adLabel = z.enum(['Riverhead photo', 'Riverhead video', 'Acrylic photo', 'Acrylic video']);
export const scopeSchema = z.object({ account: entityId, campaign: entityId, adset: entityId,
  ads: z.array(z.object({ id: entityId, label: adLabel }).strict()).length(4).refine(rows => new Set(rows.map(row => row.id)).size === 4 && new Set(rows.map(row => row.label)).size === 4),
  launchDay: z.iso.date(), dailyAverage: z.number().positive(), maximumDay: z.number().positive(), weeklyAllowance: z.number().positive(),
  weekStartsOn: z.number().int().min(0).max(6), weeklyWindowVerified: z.boolean() }).strict();
export type CampaignScope = z.infer<typeof scopeSchema>;
export function campaignScope(env: Readonly<Record<string, string | undefined>> = process.env) {
  return scopeSchema.parse(JSON.parse(env.SANCTUARY_CAMPAIGN_MONITOR_SCOPE ?? 'null'));
}
export const TIMEZONE = 'Pacific/Auckland';
export const campaignRequest = { kind: 'marketing/campaign-health' } as const;
export const periodSchema = z.object({ start: z.iso.date(), end: z.iso.date() }).strict();
export function campaignPeriods(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const date = new Date(`${today}T00:00:00Z`), offset = (date.getUTCDay() - campaignScope().weekStartsOn + 7) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return { today: { start: today, end: today }, week: { start: date.toISOString().slice(0, 10), end: today } };
}
const amount = z.number().nonnegative().finite().max(Number.MAX_SAFE_INTEGER).nullable();
export const metricsSchema = z.object({ spend: amount, impressions: amount, linkClicks: amount, landingViews: amount, websiteLeads: amount }).strict();
const status = z.string().regex(/^[A-Z_]{1,50}$/);
export const registeredCreativeAdSchema = z.object({ experiment: z.uuid(), id: entityId, arm: z.enum(['control','challenger']),
  campaign: entityId, adset: entityId, page: entityId, path: z.enum(['/auckland-outdoor-living','/acrylic-roof-pergolas-auckland']),
  template: z.string().regex(/^[a-f0-9]{64}$/), purpose: z.enum(['paused_capability','formal_experiment']), delivery: z.boolean(),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }) }).strict();
export type RegisteredCreativeAd = z.infer<typeof registeredCreativeAdSchema>;
// Finite structural evidence only. Counts saturate at the first rejected value:
// UTF-8 JSON bytes6001, value nodes501 and root-zero depth9. No provider keys/values.
export const trackingRules = ['bytes','nodes','depth','array_length','object_keys','key_syntax','reserved_key','string_length','control_character','non_json'] as const;
export const trackingEvidenceSchema = z.discriminatedUnion('status', [
  z.object({version:z.literal(1),status:z.literal('observed'),type:z.enum(['null','boolean','number','string','array','object','unsupported']),
    utf8Bytes:z.number().int().min(0).max(6001),nodes:z.number().int().min(1).max(501),depth:z.number().int().min(0).max(9),scanComplete:z.boolean(),
    violations:z.array(z.enum(trackingRules)).max(trackingRules.length).refine(rows=>new Set(rows).size===rows.length),actionTypeKey:z.boolean().nullable()}).strict(),
  z.object({version:z.literal(1),status:z.enum(['missing','unavailable'])}).strict(),
]);
export type TrackingEvidence = z.infer<typeof trackingEvidenceSchema>;

export const campaignHealthSchema = z.object({
  version: z.literal('sanctuary-campaign-health-v1'), account: entityId, campaign: entityId, adset: entityId,
  observedAt: z.iso.datetime(), currency: z.literal('NZD'), timezone: z.literal(TIMEZONE),
  periods: z.object({ today: periodSchema, week: periodSchema }).strict(),
  campaignStatus: status, adsetStatus: status, dailyBudget: amount,
  ads: z.array(z.object({ id: entityId, label: adLabel, status, today: metricsSchema, week: metricsSchema, trackingEvidence:trackingEvidenceSchema.optional() }).strict()).length(4)
    .refine(rows => new Set(rows.map(row => row.id)).size === 4),
  creativeAds: z.array(registeredCreativeAdSchema.extend({ status, today: metricsSchema, week: metricsSchema }).strict()).max(40).refine(rows => new Set(rows.map(row => row.id)).size === rows.length).optional(),
  steadyAds: z.array(steadyAdSchema.safeExtend({ status, today: metricsSchema, week: metricsSchema })).max(40).refine(rows => new Set(rows.map(row => row.id)).size === rows.length && rows.filter(row => row.current).length <= 4 && new Set(rows.filter(row => row.current).map(row => row.donor)).size === rows.filter(row => row.current).length).optional(),
  attribution: z.literal('Ad-set attribution settings; impression-time reporting'),
}).strict();
export type CampaignHealth = z.infer<typeof campaignHealthSchema>;
export const campaignContactSchema = z.object({ key: z.string().regex(/^[a-f0-9]{64}$/), ad: entityId, enquiryId: z.uuid(), projectId: z.uuid(), contactId: z.uuid(),
  email: z.email().max(254), multipleProjects: z.boolean(), createdAt: z.iso.datetime({ offset: true }), changedAt: z.iso.datetime({ offset: true }),
  intake: z.object({ provenance:z.literal('meta_form_user_text'),suburb:z.string().max(100),message:z.string().max(400),shortened:z.boolean() }).strict().nullable().optional() }).strict();
export const cohortContextSchema = z.object({ total: z.number().int().nonnegative(), eligible: z.number().int().nonnegative(), unlinked: z.number().int().nonnegative(), omitted: z.number().int().nonnegative(), contacts: z.array(campaignContactSchema).max(200) }).strict();
export const adOutcomesSchema = z.object({ id: entityId, enquiries: z.number().int().nonnegative(), qualified: z.number().int().nonnegative(),
    unreviewed: z.number().int().nonnegative(), confirmedVisits: z.number().int().nonnegative(), quotedProjects: z.number().int().nonnegative(),
    acceptedProjects: z.number().int().nonnegative(), paidProjects: z.number().int().nonnegative() }).strict();
export const outcomesSchema = z.object({ observedAt: z.iso.datetime(), cohortStart: z.iso.date(),
  ads: z.array(adOutcomesSchema).length(4)
    .refine(rows => new Set(rows.map(row => row.id)).size === 4),
  creativeAds: z.array(adOutcomesSchema).max(40).refine(rows => new Set(rows.map(row => row.id)).size === rows.length).optional(),
  steadyAds: z.array(adOutcomesSchema).max(40).refine(rows => new Set(rows.map(row => row.id)).size === rows.length).optional(),
  // Opaque correlation hashes only, never names, addresses, subjects or bodies.
  correspondence: cohortContextSchema,
  enquiryReferenceHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(2000),
  unmatchedCampaignEnquiries: z.number().int().nonnegative(),
}).strict();
