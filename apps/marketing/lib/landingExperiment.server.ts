import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { LANDING_EXPERIMENT_PATHS, LANDING_EXPERIMENT_VERSION, LANDING_COPY,experimentCookieName,type ExperimentPath } from './landingExperiment';
import template from '../data/landing-template.generated.json';
import {copyChoice} from './landingCopyContract';

export const experimentHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const EXPERIMENT_TEMPLATE = experimentHash({ version: LANDING_EXPERIMENT_VERSION, paths: LANDING_EXPERIMENT_PATHS, slots: LANDING_COPY,
  renderer: template.hash });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const operation = z.string().regex(/^resp_[A-Za-z0-9_-]{1,140}$/);
const common = { generation: z.number().int().positive(), candidateHash: hash };
export const experimentPayloads = {
  read: z.object({}).strict(),
  receipt: z.object({command:z.string().uuid(),stage:z.enum(['prepare','probe','review','visual','publish','verify','evaluate','rollback','owner_decision','owner_end']),payload:z.record(z.string(),z.unknown())}).strict(),
  owner_decision:z.object({owner:z.uuid(),request:z.uuid(),generation:common.generation,template:z.literal(EXPERIMENT_TEMPLATE),controls:z.record(z.string(),z.unknown()),
    prior:z.object({id:z.uuid(),candidateHash:hash,state:z.enum(['rejected','reverted','inconclusive','retained'])}).strict().nullable(),
    expiresAt:z.iso.datetime({offset:true}),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),correction:z.string().regex(/^[a-f0-9]{40}$/),
    funding:z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),receiptHash:hash,maximumModelUsd:z.literal(.14308)}).strict()}).strict(),
  owner_end:z.object({ownerDecision:z.uuid(),result:z.enum(['no_candidate','no_landing_hypothesis','stopped'])}).strict(),
  prepare: z.object({ generation: common.generation, candidateHash: hash, evidenceHash: hash, template: z.literal(EXPERIMENT_TEMPLATE),
    path: z.enum(LANDING_EXPERIMENT_PATHS), copy: z.string().max(125).refine(value=>copyChoice(value)!==null), generator: operation,
    minimumExposures: z.literal(100), durationDays: z.literal(14),ownerDecision:z.uuid().optional(),ownerRequest:z.uuid().optional() }).strict(),
  review: z.object({ ...common, reviewer: operation, verdict: z.enum(['pass','reject']) }).strict(),
  visual: z.object({ ...common, visualHash: hash, template: z.literal(EXPERIMENT_TEMPLATE) }).strict(),
  publish: z.object(common).strict(),
  probe: z.object({...common,template:z.literal(EXPERIMENT_TEMPLATE),mode:z.enum(['prepare','live']),probe:z.string().uuid(),ownerDecision:z.uuid().optional(),ownerRequest:z.uuid().optional()}).strict(),
  verify: z.object({ ...common, servedHash: hash,probe:z.string().uuid() }).strict(),
  renew: z.object({ ...common, servedHash: hash,probe:z.string().uuid() }).strict(),
  evaluate: z.object({ ...common, decision: z.enum(['retain','revert','inconclusive']), qualityGuard: z.enum(['pass','concern','unknown']), qualityHash: hash }).strict(),
  rollback: z.object({ ...common, reason: z.enum(['form','served_mismatch','unavailable','guard','owner_stop']) }).strict(),
};
export const experimentCommandSchema = z.object({ version: z.literal(1), command: z.string().uuid(), experiment: z.string().uuid().nullable(),
  stage: z.enum(['read','receipt','prepare','review','visual','publish','probe','verify','renew','evaluate','rollback','owner_decision','owner_end']), payload: z.unknown(),
  at: z.number().int().positive() }).strict().superRefine((row, ctx) => {
  const noExperiment=['read','owner_decision','owner_end'].includes(row.stage)||row.stage==='receipt'&&['owner_decision','owner_end'].includes((row.payload as {stage:string})?.stage);
  if (!experimentPayloads[row.stage].safeParse(row.payload).success || (!noExperiment && row.experiment === null)||(['owner_decision','owner_end'].includes(row.stage)&&row.experiment!==null)) ctx.addIssue({ code: 'custom', message: 'Invalid command payload' });
});
function key() {
  const secret = process.env.SANCTUARY_LANDING_EXPERIMENT_KEY;
  if (!secret || secret.length < 32) throw new Error('Experiment capability unavailable');
  return secret;
}
const mac = (purpose: string, value: string) => createHmac('sha256', key()).update(`${purpose}\n${value}`).digest('base64url');
function equal(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
const probeSchema=z.object({probe:z.string().uuid(),experiment:z.string().uuid(),candidateHash:hash,template:z.literal(EXPERIMENT_TEMPLATE),generation:z.number().int().positive(),mode:z.enum(['prepare','live']),path:z.enum(LANDING_EXPERIMENT_PATHS),expires:z.number().int()}).strict();
export function signProbe(input:z.infer<typeof probeSchema>){const body=Buffer.from(JSON.stringify(probeSchema.parse(input))).toString('base64url');return `${body}.${mac('serving-probe',body)}`;}
export function readProbe(value:string|null){
  try{if(!value||value.length>2000)return null;const [body,signature,...rest]=value.split('.');if(rest.length||!signature||!equal(signature,mac('serving-probe',body)))return null;
    const parsed=probeSchema.parse(JSON.parse(Buffer.from(body,'base64url').toString()));return parsed.expires>Date.now()&&parsed.expires<=Date.now()+120000?parsed:null;
  }catch{return null;}
}
export const PROBE_COOKIE='sp_landing_diagnostic';
export function signProbeReceipt(probe:string){const body=Buffer.from(JSON.stringify({probe,expires:Date.now()+120000})).toString('base64url');return `${body}.${mac('diagnostic-assignment',body)}`;}
export function readProbeReceipt(value:string|undefined|null,probe:string){
  try{if(!value||value.length>1500)return false;const [body,signature,...rest]=value.split('.');if(rest.length||!signature||!equal(signature,mac('diagnostic-assignment',body)))return false;
    const parsed=z.object({probe:z.string().uuid(),expires:z.number().int()}).strict().parse(JSON.parse(Buffer.from(body,'base64url').toString()));return parsed.probe===probe&&parsed.expires>Date.now();
  }catch{return false;}
}
export function verifyExperimentCommand(body: string, signature: string | null) {
  if (Buffer.byteLength(body) > 16000 || !signature || !equal(signature, mac('command', body))) throw new Error('Invalid experiment authority');
  const command = experimentCommandSchema.parse(JSON.parse(body));
  if (Math.abs(Date.now() - command.at) > 30_000) throw new Error('Expired experiment authority');
  return command;
}
const receiptSchema = z.object({ assignment: z.string().uuid(), experiment: z.string().uuid(), path: z.enum(LANDING_EXPERIMENT_PATHS), expires: z.number().int() }).strict();
export function signAssignment(input: Omit<z.infer<typeof receiptSchema>, 'expires'>) {
  const body = Buffer.from(JSON.stringify({ ...input, expires: Date.now() + 28 * 86400_000 })).toString('base64url');
  return `${body}.${mac('assignment', body)}`;
}
export function readAssignment(receipt: string | undefined | null) {
  try {
    if (!receipt || receipt.length > 1500) return null;
    const parts = receipt.split('.');
    if (parts.length !== 2 || !equal(parts[1], mac('assignment', parts[0]))) return null;
    const row = receiptSchema.parse(JSON.parse(Buffer.from(parts[0], 'base64url').toString()));
    return row.expires > Date.now() ? row : null;
  } catch { return null; }
}
export function requestAssignment(request: Request,path:ExperimentPath) {
  const name=experimentCookieName(path);
  const matches = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  return matches.length === 1 ? readAssignment(matches[0].slice(name.length + 1)) : null;
}
