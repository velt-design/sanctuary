import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
export const ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
export const DATA_SCOPE = 'https://www.googleapis.com/auth/datamanager';
const schema = z.object({ actorId: z.uuid(), clientId: z.string().min(1).max(1024), clientSecret: z.string().min(1).max(4096),
  vaultId: z.string().regex(/^[a-z2-7]{26}$/), itemId: z.string().regex(/^[a-z2-7]{26}$/), vaultToken: z.string().min(1).max(16384) });
export function adsConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  const credentials = schema.parse({ actorId: env.SANCTUARY_GOOGLE_ADS_ACTOR_ID, clientId: env.SANCTUARY_GOOGLE_ADS_CLIENT_ID,
    clientSecret: env.SANCTUARY_GOOGLE_ADS_CLIENT_SECRET, vaultId: env.SANCTUARY_GOOGLE_ADS_VAULT_ID,
    itemId: env.SANCTUARY_GOOGLE_ADS_CREDENTIAL_ITEM_ID, vaultToken: env.SANCTUARY_GOOGLE_ADS_SERVICE_ACCOUNT_TOKEN });
  const binding = createHash('sha256').update(JSON.stringify(credentials)).digest('hex');
  if (env.SANCTUARY_GOOGLE_ADS_BINDING_SHA256 !== binding) throw new Error('Google credential binding is unavailable.');
  return { ...credentials, binding };
}
export type AdsConfig = ReturnType<typeof adsConfig>;
