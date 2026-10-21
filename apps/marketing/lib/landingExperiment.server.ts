import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { LANDING_EXPERIMENT_PATHS, LANDING_EXPERIMENT_VERSION, LANDING_COPY,experimentCookieName,type ExperimentPath } from './landingExperiment';
import template from '../data/landing-template.generated.json';

export const experimentHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const EXPERIMENT_TEMPLATE = experimentHash({ version: LANDING_EXPERIMENT_VERSION, paths: LANDING_EXPERIMENT_PATHS, slots: LANDING_COPY,
  renderer: template.hash });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const operation = z.string().regex(/^resp_[A-Za-z0-9_-]{1,140}$/);
const common = { generation: z.number().int().positive(), candidateHash: hash };
export const experimentPayloads = {
  read: z.object({}).strict(),
  prepare: z.object({ generation: common.generation, candidateHash: hash, evidenceHash: hash, template: z.literal(EXPERIMENT_TEMPLATE),
    path: z.enum(LANDING_EXPERIMENT_PATHS), copy: z.enum(['explore','project','estimate']), generator: operation,
    minimumExposures: z.literal(100), durationDays: z.literal(14) }).strict(),
  review: z.object({ ...common, reviewer: operation, verdict: z.enum(['pass','reject']) }).strict(),
  visual: z.object({ ...common, visualHash: hash, template: z.literal(EXPERIMENT_TEMPLATE) }).strict(),
  publish: z.object(common).strict(),
  verify: z.object({ ...common, servedHash: hash }).strict(),
  renew: z.object({ ...common, servedHash: hash }).strict(),
  evaluate: z.object({ ...common, decision: z.enum(['retain','revert','inconclusive']), qualityGuard: z.enum(['pass','concern','unknown']), qualityHash: hash }).strict(),
  rollback: z.object({ ...common, reason: z.enum(['form','served_mismatch','unavailable','guard','owner_stop']) }).strict(),
};
export const experimentCommandSchema = z.object({ version: z.literal(1), command: z.string().uuid(), experiment: z.string().uuid().nullable(),
  stage: z.enum(['read','prepare','review','visual','publish','verify','renew','evaluate','rollback']), payload: z.unknown(),
  at: z.number().int().positive() }).strict().superRefine((row, ctx) => {
  if (!experimentPayloads[row.stage].safeParse(row.payload).success || (row.stage !== 'read' && row.experiment === null)) ctx.addIssue({ code: 'custom', message: 'Invalid command payload' });
});
function key() {
  const secret = process.env.SANCTUARY_LANDING_EXPERIMENT_KEY;
  if (!secret || secret.length < 32) throw new Error('Experiment capability unavailable');
  return secret;
}
const mac = (purpose: string, value: string) => createHmac('sha256', key()).update(`${purpose}\n${value}`).digest('base64url');
function equal(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
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
