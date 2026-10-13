import { z } from 'zod';
import { providerCode } from './diagnostics';

export const id = z.string().regex(/^[1-9]\d{0,19}$/);
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const number = z.number().finite().nonnegative();
export const reportSchema = z.object({
  schemaVersion: z.literal(1), customerId: id, currency: z.string().regex(/^[A-Z]{3}$/), timezone: z.string().min(1),
  start: day, end: day, fetchedAt: z.iso.datetime(),
  actions: z.array(z.object({ id, name: z.string(), category: z.string(), status: z.string(), primary: z.boolean() }).strict()),
  campaigns: z.array(z.object({ day, campaignId: id, name: z.string(), costMicros: z.string().regex(/^\d+$/), clicks: number, impressions: number }).strict()),
  keywords: z.array(z.object({ day, campaignId: id, adGroupId: id, criterionId: id, keyword: z.string(), matchType: z.string(), costMicros: z.string().regex(/^\d+$/), clicks: number, impressions: number }).strict()),
  conversions: z.array(z.object({ day, dateBasis: z.enum(['interaction','conversion']), campaignId: id, adGroupId: id.optional(), criterionId: id.optional(), actionId: id, count: number, value: number }).strict()),
}).strict();
export type AdsReport = z.infer<typeof reportSchema>;
const laneHealth = z.object({lastCompletedAt:z.iso.datetime({offset:true}).nullable(),error:z.string().nullable(),
  pending:z.enum(['NONE','RUNNING','EXPIRED']),credentialUncertain:z.boolean()}).strict();
export const statusSchema = z.object({ enabled: z.boolean(), uploadsEnabled: z.boolean(), collectedAt: z.iso.datetime({offset:true}).nullable(),
  health:z.object({report:laneHealth,sales:laneHealth,verify:laneHealth}).strict(),
  diagnostics:z.array(z.object({severity:z.enum(['errors','warnings']),code:providerCode,count:z.number().int().nonnegative()}).strict()),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  reasons: z.record(z.string(), z.number().int().nonnegative()), saleActionId: id.nullable(), enquiryActionIds: z.array(id),
  report: reportSchema.nullable(), checkedAt: z.iso.datetime({offset:true}), expiresAt: z.iso.datetime({offset:true}).nullable(),
}).strict();
export type AdsStatus = z.infer<typeof statusSchema>;
export async function loadAdsStatus(signal: AbortSignal): Promise<AdsStatus> {
  const response = await fetch('/api/staff/v1/marketing-performance/google-ads', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Google advertising evidence is unavailable. Retry after checking the connection.');
  return statusSchema.parse((await response.json()).evidence);
}
