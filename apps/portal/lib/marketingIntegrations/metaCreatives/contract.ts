import { z } from 'zod';
import type { MetaCredentialCapability } from '../metaCredentials/capability';

export const CREATIVE_CAPABILITY = 'creatives' satisfies MetaCredentialCapability;
export const CREATIVE_RUNTIME_ENABLED = false as const;
const id = z.string().regex(/^[1-9]\d{0,19}$/);
export const creativeHash = z.string().regex(/^[a-f0-9]{64}$/);
const key = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const stamp = z.iso.datetime({ offset: true });
const pagePath = z.enum(['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland']);
export const creativeScopeSchema = z.object({ app: id, principal: id, business: id, account: id, page: id, campaign: id, adset: id }).strict();
const budget = z.object({ currency: z.literal('NZD'), timezone: z.literal('Pacific/Auckland'),
  dailyAverageMinor: z.number().int().positive().safe(), maximumDayMinor: z.number().int().positive().safe(),
  weeklyAllowanceMinor: z.number().int().positive().safe() }).strict();
const effect = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create_paused_variant'), controlAd: id, assetKey: key, copyKey: key, path: pagePath }).strict(),
  z.object({ kind: z.literal('activate_owned_ad'), ad: id }).strict(),
  z.object({ kind: z.literal('pause_owned_ad'), ad: id }).strict(),
]);
/** Internal policy intent only. These fields are deliberately not Meta wire fields. */
export const creativeIntentSchema = z.object({ version: z.literal(1), capability: z.literal(CREATIVE_CAPABILITY),
  command: z.uuid(), experiment: z.uuid(), generation: z.number().int().positive(), scope: creativeScopeSchema,
  expectedPreState: creativeHash, effect }).strict();
export type CreativeIntent = z.infer<typeof creativeIntentSchema>;
const copySchema = z.object({ key, primary: z.string().min(1).max(1000), headline: z.string().min(1).max(120),
  description: z.string().max(200), action: z.enum(['design', 'enquire']), claims: z.array(key).max(8),
  approvalHash: creativeHash, path: pagePath }).strict();
const assetSchema = z.object({ key, providerId: id, digest: creativeHash, kind: z.enum(['image', 'video']),
  page: id, paidUseApproved: z.literal(true), approvalHash: creativeHash, validUntil: stamp, path: pagePath }).strict();
export const creativePolicySchema = z.object({
  // Trusted source-owned inputs in a later executor. Parsing does not authenticate them.
  scope: creativeScopeSchema, generation: z.number().int().positive(), stopped: z.boolean(), budget,
  controlAd: id, controlSettings: creativeHash,
  assets: z.array(assetSchema).min(1).max(12), copies: z.array(copySchema).min(1).max(12), allowedClaims: z.array(key).max(20),
  approval: z.object({ reference: z.uuid(), intentHash: creativeHash, catalogueHash: creativeHash,
    generator: z.string().min(1).max(150), reviewer: z.string().min(1).max(150), verdict: z.literal('approved'), expiresAt: stamp }).strict(),
  reservation: z.object({ lane: z.enum(['landing', 'creative']), experiment: z.uuid(), generation: z.number().int().positive(),
    status: z.enum(['held', 'cleanup_pending', 'released']), expiresAt: stamp }).strict(),
  preState: z.object({ scope: creativeScopeSchema, budget, controlAd: id, controlSettings: creativeHash, observedAt: stamp }).strict(),
  ownedAds: z.array(z.object({ ad: id, experiment: z.uuid(), createdBy: z.uuid(), requestHash: creativeHash,
    status: z.enum(['PAUSED', 'ACTIVE']), scope: creativeScopeSchema }).strict()).max(2),
  activationEvidence: z.object({ experiment: z.uuid(), verifiedContractHash: creativeHash, unchangedBudget: z.literal(true),
    registryReady: z.literal(true), endCleanupReady: z.literal(true), observedAt: stamp }).strict().nullable(),
  receipt: z.object({ command: z.uuid(), requestHash: creativeHash,
    state: z.enum(['not_dispatched', 'dispatch_uncertain', 'confirmed']), objectId: id.nullable() }).strict(),
}).strict();
export type CreativePolicy = z.infer<typeof creativePolicySchema>;
