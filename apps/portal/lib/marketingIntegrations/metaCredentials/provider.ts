import 'server-only';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { metaRead } from '../meta/transport';
import type { MetaCredentialConfig } from './config';

export interface VerifiedCredential { expiresAt: string | null; dataAccessExpiresAt: string | null }
export interface MetaCredentialProvider {
  verify(token: string, before: () => Promise<void>): Promise<VerifiedCredential>;
  refresh(token: string, before: () => Promise<void>): Promise<string>;
}
export type ExchangeTransport = (options: RequestOptions, signal: AbortSignal) => Promise<unknown>;
/** Native HTTPS deliberately avoids Next's instrumented fetch for the documented OAuth GET.
 * No redirects, retries, request telemetry or original errors escape this boundary. */
export const exchangeJson: ExchangeTransport = (options, signal) => new Promise((resolve, reject) => {
  const fail = () => reject(new Error('Meta token exchange outcome uncertain'));
  if (options.hostname !== 'graph.facebook.com' || options.port !== 443 || options.method !== 'GET'
    || !options.path?.startsWith('/v26.0/oauth/access_token?')) { fail(); return; }
  const req = httpsRequest(options, response => {
    if (response.statusCode !== 200) { response.destroy(); fail(); return; }
    let bytes = 0; const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 65536) { response.destroy(); fail(); } else chunks.push(chunk); });
    response.on('error', fail);
    response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { fail(); } });
  });
  const abort = () => { req.destroy(); fail(); };
  const timer = setTimeout(abort, 15000);
  req.setTimeout(15000, abort); req.on('error', fail); req.on('close', () => { clearTimeout(timer); signal.removeEventListener('abort', abort); });
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort(); else req.end();
});

export function metaCredentialProvider(config: MetaCredentialConfig, signal: AbortSignal, fetcher: typeof fetch = fetch,
  exchange: ExchangeTransport = exchangeJson): MetaCredentialProvider {
  const { identity: pin } = config;
  const read: typeof fetch = (url, init) => fetcher(url, { ...init, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  return {
    async verify(token, before) {
      signal.throwIfAborted(); await before();
      const response = await metaRead(read, 'debug_token', new URLSearchParams({ input_token: token }), `${pin.appId}|${config.appSecret}`);
      const data = z.object({ data: z.object({ app_id: z.literal(pin.appId), user_id: z.literal(pin.principalId),
        type: z.literal('SYSTEM_USER'), is_valid: z.literal(true), scopes: z.array(z.string()).max(20),
        expires_at: z.number().int().nonnegative(), data_access_expires_at: z.number().int().nonnegative(),
        granular_scopes: z.array(z.object({ scope: z.string(), target_ids: z.array(z.string()).optional() })).optional() }) }).parse(response.body).data;
      if (JSON.stringify([...data.scopes].sort()) !== JSON.stringify(pin.scopes)
        || (data.expires_at !== 0 && data.expires_at * 1000 <= Date.now() + 60000)
        || (data.data_access_expires_at !== 0 && data.data_access_expires_at * 1000 <= Date.now() + 60000)) throw new Error('Meta identity or expiry changed');
      // Missing granular targets are not evidence of a new grant. Source-approved
      // asset task provenance remains mandatory, and real CAPI delivery is a separate proof.
      const targets = data.granular_scopes?.filter(item => pin.scopes.includes(item.scope) && item.target_ids?.length).flatMap(item => item.target_ids!) ?? [];
      if (targets.length && !targets.includes(pin.targetId)) throw new Error('Meta asset target changed');
      if (pin.capability === 'reports') {
        await before();
        const account = await metaRead(read, `act_${pin.targetId}`, new URLSearchParams({ fields: 'id,account_id,account_status,business',
          appsecret_proof: createHmac('sha256', config.appSecret).update(token).digest('hex') }), token);
        z.object({ id: z.literal(`act_${pin.targetId}`), account_id: z.literal(pin.targetId), account_status: z.literal(1),
          business: z.object({ id: z.literal(pin.businessId) }) }).parse(account.body);
      }
      return { expiresAt: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null,
        dataAccessExpiresAt: data.data_access_expires_at ? new Date(data.data_access_expires_at * 1000).toISOString() : null };
    },
    async refresh(token, before) {
      signal.throwIfAborted(); await before();
      // Only this documented exchange carries secrets in a query. The options
      // never leave memory and must not be passed through a logging fetch wrapper.
      const query = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: pin.appId,
        client_secret: config.appSecret, set_token_expires_in_60_days: 'true', fb_exchange_token: token });
      try {
        const body = z.object({ access_token: z.string().min(32).max(16384), token_type: z.string().optional(),
          expires_in: z.number().int().positive().optional(), error: z.never().optional() })
          .parse(await exchange({ hostname: 'graph.facebook.com', port: 443, method: 'GET', path: `/v26.0/oauth/access_token?${query}`,
            headers: { Accept: 'application/json', 'Cache-Control': 'no-store' } }, signal));
        return body.access_token;
      } catch { throw new Error('Meta token exchange outcome uncertain'); }
    },
  };
}
