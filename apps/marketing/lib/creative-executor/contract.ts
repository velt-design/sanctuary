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
// Raw selected creative structure stays in the protected approval/source boundary,
// never the general report/model receipt. Preserve unknown nested settings intact;
// an unsupported top-level shape abstains rather than silently dropping fields.
export type CreativeJson = string | number | boolean | null | CreativeJson[] | { [key: string]: CreativeJson };
const boundedJson = z.custom<CreativeJson>((value) => {
  let nodes = 0;
  const valid = (v: unknown, depth: number): boolean => {
    if (++nodes > 500 || depth > 8) return false;
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v === 'string') return v.length <= 2000 && !/[\u0000-\u0008]/.test(v);
    if (Array.isArray(v)) return v.length <= 30 && v.every(x => valid(x, depth + 1));
    return !!v && typeof v === 'object' && Object.entries(v).length <= 40 && Object.entries(v).every(([key, child]) =>
      /^[a-zA-Z0-9_]{1,80}$/.test(key) && !['__proto__','constructor','prototype','access_token','appsecret_proof'].includes(key) && valid(child, depth + 1));
  };
  return valid(value, 0) && Buffer.byteLength(JSON.stringify(value)) <= 6000;
});
const tags = z.literal('utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}');
const common = { id, page: id, primary: text, path, urlTags: tags };
export const imageCreativeSchema = z.object({ ...common, format: z.literal('image'), imageHash: z.string().regex(/^[a-f0-9]{32}$/),
  headline: z.string().min(1).max(120), description: z.string().max(200), action: z.enum(['LEARN_MORE', 'GET_QUOTE']) }).strict();
export const videoCreativeSchema = z.object({ ...common, format: z.literal('video_assets'), payload: z.object({
  object_story_spec: boundedJson, asset_feed_spec: boundedJson, degrees_of_freedom_spec: boundedJson.optional(),
  interactive_components_spec: boundedJson.optional(), platform_customizations: boundedJson.optional(),
  contextual_multi_ads: boundedJson.optional(), instagram_user_id: id.optional(),
}).strict() }).strict();
export const creativeSchema = z.discriminatedUnion('format', [imageCreativeSchema, videoCreativeSchema]);
export type Creative = z.infer<typeof creativeSchema>;
export function creativeAssetHash(creative: Creative) {
  const copy = structuredClone(creative);
  copy.primary = '';
  if (copy.format === 'video_assets') {
    const feed = copy.payload.asset_feed_spec as { bodies?: { text?: string }[] };
    if (feed.bodies?.length === 1) feed.bodies[0]!.text = '';
    const story = copy.payload.object_story_spec as { video_data?: { message?: string } };
    if (story.video_data?.message !== undefined) story.video_data.message = '';
  }
  return canonicalHash(copy);
}
export const executionPlanSchema = z.object({ version: z.literal(1), purpose: z.enum(['paused_capability', 'formal_experiment']), experiment: z.uuid(),
  scope: z.object({ app: id, principal: id, business: id, account: id, page: id, campaign: id, adset: id }).strict(),
  originalAds: z.array(id).length(4).refine(v => new Set(v).size === 4), controlAd: id,
  control: creativeSchema, adTracking: boundedJson, nativeObjective: z.object({ type: z.literal('CONVERSIONS'), is_primary: z.literal(true), name: z.literal('Website Lead'),
    adspixels: z.array(z.object({ id, event_names: z.tuple([z.literal('Lead')]) }).strict()).length(1) }).strict(), challengerPrimary: text, approvedAssetHash: hash, approvedCopyHash: hash,
  approvalHash: hash, evidenceHash: hash, generator: z.string().regex(/^resp_[A-Za-z0-9_-]{1,140}$/),
  reviewer: z.string().regex(/^resp_[A-Za-z0-9_-]{1,140}$/), approvedAt: stamp, approvalUntil: stamp,
  start: z.number().int().positive().safe(), end: z.number().int().positive().safe(),
  dailyMinor: z.literal(40000), weeklyMinor: z.literal(280000), studyDailyMinor: z.literal(8000),
  currency: z.literal('NZD'), timezone: z.literal('Pacific/Auckland'),
  nativeContractHash: hash, preStateHash: hash,
  evaluation: z.object({ primary: z.literal('genuine_saved_enquiries_per_actual_NZD'), interval: z.literal('exact_conditional_poisson_rate_ratio_95'), providerEvent: z.literal('website_lead'), durationDays: z.literal(14), maturationHours: z.literal(72),
    formalAnalyses: z.literal(1), qualityMinimumEach: z.literal(5), qualityCoverageMinimum: z.literal(0.5), maximumCoverageGap: z.literal(0.2), unknownMeans: z.literal('inconclusive') }).strict(),
}).strict().superRefine((p, ctx) => {
  if (p.generator === p.reviewer || !p.originalAds.includes(p.controlAd) || p.control.page !== p.scope.page
    || p.challengerPrimary === p.control.primary || p.end <= p.start || p.end - p.start !== 14 * 86400
    || Date.parse(p.approvalUntil) <= Date.parse(p.approvedAt)
    || p.approvedCopyHash !== canonicalHash({ control: p.control.primary, challenger: p.challengerPrimary })
    || p.approvedAssetHash !== creativeAssetHash(p.control)) {
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
export type SourceCommand = (stage: 'read' | 'authority' | 'admit' | 'check' | 'confirm' | 'no_effect' | 'measurement' | 'canary' | 'cleanup' | 'receipt',
  experiment: string | null, command: string, payload: unknown) => Promise<unknown>;
