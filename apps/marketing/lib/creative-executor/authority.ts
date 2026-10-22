import {nativeAnalysisSchema} from './analysis-contract';
import 'server-only';
import {activationProofSchema} from './activation-contract';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { canonicalHash, executionPlanSchema, hash, stateSchema, wireSchema } from './contract';
import { serializeEffect } from './intent';
import {creativeHistoryRequestSchema} from './learning-contract';
import {retentionAdmitSchema,retentionFinishSchema} from './retention-authority';
const payloads = {
  retention_read:z.object({}).strict(),retention_authority:z.object({generation:z.number().int().positive()}).strict(),retention_abort:z.object({generation:z.number().int().positive(),evidenceHash:hash}).strict(),
  retention_admit:retentionAdmitSchema,retention_check:z.object({requestHash:hash}).strict(),retention_finish:retentionFinishSchema,
  retention_confirm:z.object({requestHash:hash,objectId:z.string().regex(/^[1-9]\d{0,19}$/),evidenceHash:hash}).strict(),retention_no_effect:z.object({requestHash:hash,evidenceHash:hash,reason:z.literal('dispatch_not_started')}).strict(),
  history:creativeHistoryRequestSchema,
  analysis_ack:z.object({analysisCommand:z.uuid()}).strict(), begin_analysis:z.object({planHash:hash}).strict(), delivery_health:z.object({planHash:hash,evidenceHash:hash,observedAt:z.iso.datetime()}).strict(), analysis: z.object({analysis:nativeAnalysisSchema}).strict(), read: z.object({}).strict(), cohort: z.object({freeze:z.boolean()}).strict(), authority: z.object({ generation: z.number().int().positive() }).strict(),
  prepare: z.object({ plan: executionPlanSchema, planHash: hash }).strict(),
  admit: z.object({ generation: z.number().int().positive(), intent: wireSchema, cleanup: z.boolean(), activationProof:activationProofSchema.optional() }).strict(),
  check: z.object({ requestHash: hash }).strict(),
  confirm: z.object({ requestHash: hash, objectId: z.string().regex(/^[1-9]\d{0,19}$/), evidenceHash: hash }).strict(),
  no_effect: z.object({ requestHash: hash, evidenceHash: hash, reason: z.literal('dispatch_not_started') }).strict(),
  receipt: z.object({}).strict(), measurement: z.object({}).strict(),
  canary: z.object({ evidenceHash: hash }).strict(), cleanup: z.object({ evidenceHash: hash, terminalStudy: z.object({ id: z.string().regex(/^[1-9]\d{0,19}$/), end: z.number().int().positive(), observationEnd: z.number().int().positive(), observedAt: z.iso.datetime(), evidenceHash: hash, ended: z.literal(true) }).strict().nullable() }).strict(),
};
export function verifyCreativeCommand(raw: unknown, signature: string | null, now = Date.now()) {
  const body = JSON.stringify(raw), key = process.env.SANCTUARY_LANDING_EXPERIMENT_KEY;
  if (!key || key.length < 32 || !signature || Buffer.byteLength(body) > 16000) throw new Error('Creative authority unavailable');
  const expected = createHmac('sha256', key).update(`creative-command\n${body}`).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Invalid creative signature');
  const row = z.object({ version: z.literal(1), command: z.uuid(), experiment: z.uuid().nullable(), stage: z.enum(Object.keys(payloads) as [keyof typeof payloads, ...(keyof typeof payloads)[]]), payload: z.unknown(), at: z.number().int() }).strict().parse(raw);
  if (Math.abs(row.at - now) > 30000 || (row.stage==='history'?row.experiment!==null:row.stage !== 'read' && row.experiment === null)) throw new Error('Expired creative command');
  const payload = payloads[row.stage].parse(row.payload);
  if (row.stage === 'prepare') {
    const prepared = payloads.prepare.parse(payload);
    const formal=prepared.plan.purpose==='formal_experiment';
    if(formal&&process.env.SANCTUARY_META_CREATIVE_PREPARATION_ENABLED!=='true')throw new Error('Formal creative preparation unavailable');
    if (canonicalHash(prepared.plan) !== prepared.planHash || prepared.plan.experiment !== row.experiment
      || (formal ? prepared.plan.start*1000<=now || now-Date.parse(prepared.plan.approvedAt)>30*3600000 || Date.parse(prepared.plan.approvedAt)>now+1000 : Math.abs(prepared.plan.start*1000-now)>300000) || Date.parse(prepared.plan.approvalUntil) <= now) throw new Error('Stale plan');
  }
  return { ...row, payload };
}
export function validateCreativeIntent(payload: unknown, snapshot: unknown, compiledTemplate: string) {
  const intent = payloads.admit.parse(payload), state = stateSchema.parse(snapshot);
  if(intent.intent.kind.startsWith('activate_')&&process.env.SANCTUARY_META_CREATIVE_DELIVERY_ENABLED!=='true')throw new Error('Formal creative delivery unavailable');
  if(!intent.cleanup && (state.template!==compiledTemplate || state.plan?.landingTemplate!==compiledTemplate))throw new Error('Creative template changed');
  if(state.plan?.purpose==='formal_experiment'&&!intent.cleanup&&process.env.SANCTUARY_META_CREATIVE_PREPARATION_ENABLED!=='true')throw new Error('Formal creative execution unavailable');
  if (!state.plan || state.generation !== intent.generation || state.stopped || (intent.cleanup ? !state.cleanupEnabled : !state.enabled)) throw new Error('Source authority changed');
  if (intent.intent.at > Date.now() + 1000 || Date.now() - intent.intent.at > 90000) throw new Error('Stale intent');
  if(intent.intent.kind.startsWith('activate_')!==!!intent.activationProof)throw new Error('Activation proof purpose differs');
  if(intent.activationProof&&(intent.activationProof.planHash!==canonicalHash(state.plan)||intent.activationProof.acceptance!==state.nativeAcceptance?.id||Date.now()-Date.parse(intent.activationProof.observedAt)>60000||Date.parse(intent.activationProof.observedAt)>Date.now()+1000))throw new Error('Activation proof differs');
  const expected = serializeEffect(state.plan, state, intent.intent.kind, intent.intent.at);
  if (canonicalHash(expected) !== canonicalHash(intent.intent)) throw new Error('Creative intent differs');
  if (intent.cleanup !== ['pause_control', 'pause_challenger', 'end_study'].includes(intent.intent.kind)) throw new Error('Cleanup purpose mismatch');
  return intent;
}

export function validateCreativeDispatch(command:string,requestHash:string,snapshot:unknown,compiledTemplate:string){
 const state=stateSchema.parse(snapshot),effect=state.effects.find(e=>e.command===command&&e.requestHash===requestHash);
 if(!effect||effect.state!=='prepared'||!state.plan||state.stopped)throw new Error('Dispatch unavailable');
 const cleanup=['pause_control','pause_challenger','end_study'].includes(effect.kind);
 if(cleanup){if(!state.cleanupEnabled)throw new Error('Cleanup stopped');return;}
 if(!state.enabled||state.template!==compiledTemplate||state.plan.landingTemplate!==compiledTemplate)throw new Error('Dispatch template changed');
 if(state.plan.purpose==='formal_experiment'&&process.env.SANCTUARY_META_CREATIVE_PREPARATION_ENABLED!=='true')throw new Error('Formal preparation stopped');
 if(effect.kind.startsWith('activate_')&&(process.env.SANCTUARY_META_CREATIVE_DELIVERY_ENABLED!=='true'||!state.nativeAcceptance))throw new Error('Delivery stopped');
}
