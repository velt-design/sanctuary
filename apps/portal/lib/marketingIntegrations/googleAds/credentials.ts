import { z } from 'zod';
import { ADS_SCOPE, DATA_SCOPE, type AdsConfig } from './config';
import type { Ga4Vault } from '../ga4/lifecycle';
import { googleJson, GoogleFailure } from './transport';

export async function googleAccessToken(config: AdsConfig, vault: Ga4Vault, checkpoint: { before(): Promise<void>; settled(): Promise<void> }, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  await vault.authenticate(); const item = await vault.read();
  if (!item.refreshToken) throw new GoogleFailure('RECONNECT_REQUIRED');
  // The dedicated advertising credential is never GA4's refresh token.
  await checkpoint.before(); signal.throwIfAborted();
  const token = z.object({ access_token: z.string().min(1).max(16384), token_type: z.literal('Bearer'),
    refresh_token: z.string().min(1).max(16384).optional(), expires_in: z.number().int().min(60).max(86400), scope: z.string().min(1) })
    .parse(await googleJson(fetcher, 'https://oauth2.googleapis.com/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId,
        client_secret: config.clientSecret, grant_type: 'refresh_token', refresh_token: item.refreshToken }), signal }, 65536));
  const scopes = new Set(token.scope.split(' ').filter(Boolean));
  if (!scopes.has(ADS_SCOPE) || !scopes.has(DATA_SCOPE) || scopes.size !== 2) throw new GoogleFailure('UNEXPECTED_GOOGLE_SCOPE');
  if (token.refresh_token && token.refresh_token !== item.refreshToken) await vault.write(token.refresh_token);
  await checkpoint.settled(); signal.throwIfAborted();
  return token.access_token;
}
