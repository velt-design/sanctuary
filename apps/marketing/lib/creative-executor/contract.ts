import { z } from 'zod';
import { createHash } from 'node:crypto';
export const id = z.string().regex(/^[1-9]\d{0,19}$/);
export const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const stamp = z.iso.datetime({ offset: true });
export const path = z.enum(['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland']);
export const canonicalHash = (value: unknown): string => {
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, child]) => [k, sorted(child)])) : v;
  return createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
};
const text = z.string().min(1).max(1000);
// A finite single-image hook test first. Unsupported dynamic/video formats are
// reported, never reconstructed by dropping provider fields or inventing media.
export const imageCreativeSchema = z.object({ id, page: id, imageHash: z.string().regex(/^[a-f0-9]{32}$/),
  primary: text, headline: z.string().min(1).max(120), description: z.string().max(200),
  action: z.enum(['LEARN_MORE', 'GET_QUOTE']), path, urlTags: z.literal('utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}') }).strict();
export const executionPlanSchema = z.object({ version: z.literal(1), experiment: z.uuid(),
  scope: z.object({ app: id, principal: id, business: id, account: id, page: id, campaign: id, adset: id }).strict(),
  originalAds: z.array(id).length(4).refine(v => new Set(v).size === 4), controlAd: id,
  control: imageCreativeSchema, challengerPrimary: text, approvedAssetHash: hash, approvedCopyHash: hash,
  approvalHash: hash, evidenceHash: hash, generator: z.string().regex(/^resp_[A-Za-z0-9_-]{1,140}$/),
  reviewer: z.string().regex(/^resp_[A-Za-z0-9_-]{1,140}$/), approvedAt: stamp, approvalUntil: stamp,
  start: z.number().int().positive().safe(), end: z.number().int().positive().safe(),
  dailyMinor: z.literal(40000), weeklyMinor: z.literal(280000), studyDailyMinor: z.literal(8000),
  currency: z.literal('NZD'), timezone: z.literal('Pacific/Auckland'),
  nativeContractHash: hash, preStateHash: hash,
  evaluation: z.object({ primary: z.literal('genuine_saved_enquiries'), providerEvent: z.literal('website_lead'), durationDays: z.literal(14), maturationHours: z.literal(72),
    formalAnalyses: z.literal(1), qualityMinimumEach: z.literal(5), qualityCoverageMinimum: z.literal(0.5), maximumCoverageGap: z.literal(0.2), unknownMeans: z.literal('inconclusive') }).strict(),
}).strict().superRefine((p, ctx) => {
  if (p.generator === p.reviewer || !p.originalAds.includes(p.controlAd) || p.control.page !== p.scope.page
    || p.challengerPrimary === p.control.primary || p.end <= p.start || p.end - p.start !== 14 * 86400
    || Date.parse(p.approvalUntil) <= Date.parse(p.approvedAt)
    || p.approvedCopyHash !== canonicalHash({ control: p.control.primary, challenger: p.challengerPrimary })
    || p.approvedAssetHash !== canonicalHash({ page: p.control.page, imageHash: p.control.imageHash, path: p.control.path })) {
    ctx.addIssue({ code: 'custom', message: 'Invalid reviewed creative plan' });
  }
});
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;
export const effectKinds = ['create_creative', 'create_control', 'create_challenger', 'create_study', 'pause_control', 'pause_challenger', 'end_study'] as const;
export type EffectKind = typeof effectKinds[number];
export const objectSchema = z.object({ kind: z.enum(['creative', 'control', 'challenger', 'study']), id, command: z.uuid(), requestHash: hash }).strict();
export const wireSchema = z.object({ kind: z.enum(effectKinds), path: z.string().regex(/^[A-Za-z0-9_\/]{1,80}$/), body: z.record(z.string(), z.string().max(6000)), target: id.nullable(), requestHash: hash, at: z.number().int().positive() }).strict();
export const effectSchema = z.object({ command: z.uuid(), kind: z.enum(effectKinds), requestHash: hash,
  state: z.enum(['prepared', 'uncertain', 'confirmed', 'no_effect']), object: id.nullable(), evidenceHash: hash.nullable(), intent: wireSchema }).strict();
export const stateSchema = z.object({ enabled: z.boolean(), cleanupEnabled: z.boolean(), stopped: z.boolean(), generation: z.number().int().positive(),
  plan: executionPlanSchema.nullable(), objects: z.array(objectSchema).max(4), effects: z.array(effectSchema).max(32),
  state: z.enum(['empty', 'prepared', 'canary_ready', 'cleanup', 'closed', 'uncertain']),
  measurementReady: z.boolean(), activationReady: z.literal(false),
}).strict();
export type ExecutorState = z.infer<typeof stateSchema>;
