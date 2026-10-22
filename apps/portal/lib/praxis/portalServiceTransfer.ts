import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { loadPraxisConnectorConfig } from './server';

// One fixed hosted-to-hosted installation. No caller-selected resource or value.
const owner = 'rGPHGaegAnst8s6Zl1VZswuH', team = 'team_yTur5DT5THIdiLGLK1OVLA2V';
const sourceProject = 'prj_nrpZyDHk8RqDXHGax7gnvDlnO5t8', targetProject = 'prj_OC02Z3DAPPxlnGAZwgnlOFJ0rGyo';
const sourceKey = 'PRAXIS_SANCTUARY_READ_TOKEN', sourceEnvironmentId = 'tEbVThmpe5owqeHN';
const targetKey = 'VELT_PORTAL_SERVICE_TOKEN', origin = 'https://portal.sanctuarypergolas.co.nz';
const path = '/api/integrations/praxis/portal-service-transfer';
const admissionKey = 'PRAXIS_PORTAL_SERVICE_TRANSFER_ADMISSION';
const admissionSchema = z.object({ nonceSha256: z.string().regex(/^[a-f0-9]{64}$/), issuedAt: z.string().datetime(), expiresAt: z.string().datetime() }).strict();
const inputSchema = z.object({ nonce: z.string().regex(/^[a-f0-9]{64}$/), platformToken: z.string().min(20).max(2048).regex(/^[!-~]+$/) }).strict();
const entrySchema = z.object({ id: z.string().min(1), key: z.string(), type: z.string(), target: z.array(z.string()),
  gitBranch: z.string().nullable().optional(), customEnvironmentIds: z.array(z.string()).optional() });
type Entry = z.infer<typeof entrySchema>;
function productionSecret(entry: Entry) {
  return entry.type === 'sensitive' && entry.target.length === 1 && entry.target[0] === 'production'
    && !entry.gitBranch && !entry.customEnvironmentIds?.length;
}
function reply(state: 'installed' | 'present_unconfirmed' | 'unconfirmed' | 'existing' | 'unavailable' | 'denied', status: number) {
  return Response.json({ state }, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
}
export function portalServiceTransferVersion(request: Request): Response {
  const url = new URL(request.url), releaseSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (request.method !== 'GET' || url.origin !== origin || url.pathname !== path || url.search
    || process.env.VERCEL_ENV !== 'production' || process.env.VERCEL_PROJECT_ID !== sourceProject
    || !releaseSha || !/^[a-f0-9]{40}$/.test(releaseSha)) return reply('denied', 403);
  return Response.json({ releaseSha }, { headers: { 'Cache-Control': 'private, no-store, max-age=0',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
}
async function boundedJson(body: ReadableStream<Uint8Array> | null, maximum: number) {
  if (!body) throw new Error('Transfer unavailable.');
  const reader = body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength; if (size > maximum) throw new Error('Transfer unavailable.'); chunks.push(part.value);
  } } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export async function portalServiceTransfer(request: Request): Promise<Response> {
  let attempted = false;
  try {
    const url = new URL(request.url), rawAdmission = process.env[admissionKey];
    if (request.method !== 'POST' || url.origin !== origin || url.pathname !== path || url.search
      || request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json'
      || (request.headers.has('origin') && request.headers.get('origin') !== origin)
      || process.env.VERCEL_ENV !== 'production' || process.env.VERCEL_PROJECT_ID !== sourceProject || !rawAdmission) return reply('denied', 403);
    const admission = admissionSchema.parse(JSON.parse(rawAdmission));
    const issued = Date.parse(admission.issuedAt), expires = Date.parse(admission.expiresAt);
    let initialConfig: ReturnType<typeof loadPraxisConnectorConfig> | undefined;
    const current = () => {
      request.signal.throwIfAborted();
      if (process.env[admissionKey] !== rawAdmission || process.env.VERCEL_ENV !== 'production'
        || process.env.VERCEL_PROJECT_ID !== sourceProject || issued > Date.now() || expires <= Date.now()
        || expires <= issued || expires - issued > 15 * 60_000) throw new Error('Transfer unavailable.');
      const config = loadPraxisConnectorConfig();
      if (config.sourceKey !== 'sanctuary' || config.connectionId !== '9200594e-1f1c-4d8e-b6d8-128a1ccdbdea'
        || config.environment !== 'production' || config.token.length > 1024 || !/^[!-~]+$/.test(config.token)) throw new Error('Transfer unavailable.');
      if (initialConfig && JSON.stringify(config) !== JSON.stringify(initialConfig)) throw new Error('Transfer unavailable.');
      return config;
    };
    initialConfig = current();
    const input = inputSchema.parse(await boundedJson(request.body, 4096));
    const digest = createHash('sha256').update(input.nonce).digest();
    if (!timingSafeEqual(digest, Buffer.from(admission.nonceSha256, 'hex'))) return reply('denied', 403);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
    const api = async (resource: string, init?: RequestInit) => {
      current(); signal.throwIfAborted();
      const response = await fetch(`https://api.vercel.com${resource}`, { ...init, signal, cache: 'no-store', redirect: 'error',
        headers: { authorization: `Bearer ${input.platformToken}`, ...(init ? { 'content-type': 'application/json' } : {}) } });
      if (!response.ok) { await response.body?.cancel(); throw new Error('Transfer unavailable.'); }
      return boundedJson(response.body, 262144);
    };
    const user = z.object({ user: z.object({ id: z.string() }) }).parse(await api('/v2/user'));
    if (user.user.id !== owner) return reply('denied', 403);
    for (const project of [sourceProject, targetProject]) {
      const value = z.object({ id: z.string(), accountId: z.string() }).parse(await api(`/v9/projects/${project}?teamId=${team}`));
      if (value.id !== project || value.accountId !== team) return reply('denied', 403);
    }
    const environments = async (project: string) => {
      const value = z.object({ envs: z.array(entrySchema) }).parse(await api(`/v10/projects/${project}/env?teamId=${team}`));
      return value.envs;
    };
    const source = (await environments(sourceProject)).filter(entry => entry.key === sourceKey);
    if (source.length !== 1 || source[0]?.id !== sourceEnvironmentId || !productionSecret(source[0])) return reply('denied', 403);
    if ((await environments(targetProject)).some(entry => entry.key === targetKey)) return reply('existing', 409);
    // Snapshot only at the effect boundary, after all authorization and absence checks.
    const config = current();
    let createdId: string | undefined;
    attempted = true;
    try {
      const result = await api(`/v10/projects/${targetProject}/env?teamId=${team}`, { method: 'POST',
        body: JSON.stringify({ key: targetKey, value: config.token, type: 'sensitive', target: ['production'] }) });
      const direct = entrySchema.safeParse(result);
      const batch = z.object({ created: z.union([entrySchema, z.array(entrySchema)]), failed: z.array(z.unknown()).optional() }).safeParse(result);
      const created = direct.success ? [direct.data] : batch.success && !batch.data.failed?.length
        ? Array.isArray(batch.data.created) ? batch.data.created : [batch.data.created] : [];
      if (created.length === 1 && created[0]?.key === targetKey && productionSecret(created[0])) createdId = created[0].id;
    } catch { /* An uncertain create is never retried. Only destination metadata may reconcile it. */ }
    const installed = (await environments(targetProject)).filter(entry => entry.key === targetKey);
    if (installed.length === 1 && productionSecret(installed[0]!) && createdId === installed[0]?.id) return reply('installed', 201);
    return installed.length ? reply('present_unconfirmed', 409) : reply('unconfirmed', 502);
  } catch {
    // Vercel and validation failures can contain either secret. Never expose/log raw diagnostics.
    return attempted ? reply('unconfirmed', 502) : reply('unavailable', 503);
  }
}
