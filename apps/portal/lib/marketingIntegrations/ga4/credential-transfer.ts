import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { loadPraxisConnectorConfig } from '../../praxis/server';
import { supabaseServiceRole } from '../../supabaseClient';
import { ga4Config, ga4VercelBinding } from './config';
import { ga4RuntimeVault } from './runtime';
import { ga4VaultFailure } from './vault-failure';
import { GA4_TRANSFER_PROJECT, ga4TransferJson, ga4TransferPlatform } from './credential-transfer-platform';

const route = '/api/integrations/praxis/ga4-credential-transfer';
const admissionKey = 'SANCTUARY_GA4_TRANSFER_ADMISSION';
const admissionSchema = z.object({ nonceSha256: z.string().regex(/^[a-f0-9]{64}$/), releaseSha: z.string().regex(/^[a-f0-9]{40}$/),
  issuedAt: z.iso.datetime(), expiresAt: z.iso.datetime() }).strict();
const requestSchema = z.object({ nonce: z.string().regex(/^[a-f0-9]{64}$/), platformToken: z.string().min(20).max(2048).regex(/^[!-~]+$/) }).strict();
type TransferAction = 'begin' | 'check' | 'install_begin' | 'installed' | 'failed_before_install' | 'unconfirmed';
const dependencies = {
  env: (): Readonly<Record<string, string | undefined>> => process.env,
  config: ga4Config, source: loadPraxisConnectorConfig, vault: ga4RuntimeVault, fetcher: fetch,
  async command(config: ReturnType<typeof ga4Config>, source: ReturnType<typeof loadPraxisConnectorConfig>, nonceHash: string,
    action: TransferAction, signal: AbortSignal, receipt?: { credentialBinding: string; environmentId: string }) {
    const result = await supabaseServiceRole.rpc('sanctuary_ga4_credential_transfer', { p_actor: config.actor,
      p_property: config.propertyId, p_binding: config.binding, p_source: source.sourceKey, p_connection: source.connectionId,
      p_environment: source.environment, p_nonce_hash: nonceHash, p_action: action,
      p_receipt: action === 'begin' && config.credentialStore === 'vault' ? { vaultId: config.vaultId, itemId: config.itemId } : receipt ?? null }).abortSignal(signal);
    if (result.error) throw new Error('Transfer authority unavailable.');
    const expected = action === 'begin' ? 'working' : action === 'install_begin' ? 'installing' : action;
    z.object({ state: action === 'check' ? z.enum(['working', 'installing']) : z.literal(expected) }).strict().parse(result.data);
  },
};
function reply(state: string, status: number, extra: object = {}) {
  return Response.json({ state, ...extra }, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
}
/** One protected production-target deployment. No canonical-domain or arbitrary-origin admission. */
export async function ga4CredentialTransfer(request: Request, deps = dependencies): Promise<Response> {
  let claimed = false, createAttempted = false, vaultStage = false;
  let settle: ((state: 'failed_before_install' | 'unconfirmed') => Promise<void>) | undefined;
  try {
    const env = deps.env(), url = new URL(request.url), raw = env[admissionKey];
    if (!raw || env.VERCEL_ENV !== 'production' || env.VERCEL_PROJECT_ID !== GA4_TRANSFER_PROJECT
      || !env.VERCEL_URL || url.origin !== `https://${env.VERCEL_URL}` || url.pathname !== route || url.search
      || (request.headers.has('origin') && request.headers.get('origin') !== url.origin)) return reply('denied', 403);
    const admission = admissionSchema.parse(JSON.parse(raw));
    const issued = Date.parse(admission.issuedAt), expires = Date.parse(admission.expiresAt);
    const current = () => {
      const latest = deps.env(); request.signal.throwIfAborted();
      if (latest[admissionKey] !== raw || latest.VERCEL_ENV !== 'production' || latest.VERCEL_PROJECT_ID !== GA4_TRANSFER_PROJECT
        || latest.VERCEL_URL !== env.VERCEL_URL || latest.VERCEL_GIT_COMMIT_SHA !== admission.releaseSha
        || issued > Date.now() || expires <= Date.now() || expires <= issued || expires - issued > 15 * 60000) throw new Error('Transfer admission unavailable.');
    };
    current();
    if (request.method !== 'POST' || request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return reply('denied', 403);
    const input = requestSchema.parse(await ga4TransferJson(request.body, 4096));
    const digest = createHash('sha256').update(input.nonce).digest();
    if (!timingSafeEqual(digest, Buffer.from(admission.nonceSha256, 'hex'))) return reply('denied', 403);
    const config = deps.config(env), source = deps.source();
    if (config.credentialStore !== 'vault' || source.sourceKey !== 'sanctuary' || source.environment !== 'production'
      || source.connectionId !== '9200594e-1f1c-4d8e-b6d8-128a1ccdbdea') return reply('denied', 403);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
    const check = async () => {
      current(); signal.throwIfAborted();
      if (JSON.stringify(deps.config(deps.env())) !== JSON.stringify(config)) throw new Error('Transfer source changed.');
      const latest = deps.source();
      if (latest.sourceKey !== source.sourceKey || latest.connectionId !== source.connectionId || latest.environment !== source.environment) throw new Error('Transfer source changed.');
      await deps.command(config, source, admission.nonceSha256, 'check', signal);
    };
    await deps.command(config, source, admission.nonceSha256, 'begin', signal); claimed = true;
    settle = state => deps.command(config, source, admission.nonceSha256, state, AbortSignal.timeout(10000));
    const platform = ga4TransferPlatform(input.platformToken, signal, check, deps.fetcher);
    await platform.authorize();
    const vault = deps.vault(config); vaultStage = true;
    await check(); await vault.authenticate(); await check();
    const saved = await vault.read(); vaultStage = false;
    if (!saved.refreshToken || saved.refreshToken.length > 16384 || !Number.isSafeInteger(saved.version) || saved.version < 1) {
      await settle('failed_before_install'); return reply('vault_unavailable', 503, { stage: 'item_validation', code: 'invalid_item' });
    }
    await check();
    const credentialBinding = ga4VercelBinding(config.binding, { ...config, refreshToken: saved.refreshToken });
    createAttempted = true;
    await deps.command(config, source, admission.nonceSha256, 'install_begin', signal);
    const environmentId = await platform.install(saved.refreshToken);
    await check();
    await deps.command(config, source, admission.nonceSha256, 'installed', signal, { credentialBinding, environmentId });
    return reply('installed', 201);
  } catch (error) {
    let settlement = 'unconfirmed';
    if (claimed && settle) {
      const outcome = createAttempted ? 'unconfirmed' : 'failed_before_install';
      await settle(outcome).then(() => { settlement = outcome; }).catch(() => undefined);
    }
    if (createAttempted) return reply('unconfirmed', 502, { settlement });
    if (vaultStage) return reply('vault_unavailable', 503, { ...ga4VaultFailure(error), settlement });
    return reply('unavailable', 503, { settlement });
  }
}
