import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export type MetaCapability = 'reports' | 'sales';
const id = z.string().regex(/^[1-9]\d{0,19}$/);
export const identitySchema = z.object({ capability: z.enum(['reports','sales']), actorId: z.uuid(), appId: id,
  principalId: id, businessId: id, targetId: id, scopes: z.array(z.string().regex(/^[a-z_]{1,80}$/)).max(20),
  vaultId: z.string().regex(/^[a-z2-7]{26}$/), itemId: z.string().regex(/^[a-z2-7]{26}$/) }).strict();
export type MetaIdentity = z.infer<typeof identitySchema>;
export const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex');
export function credentialConfig(capability: MetaCapability, env: Readonly<Record<string,string|undefined>> = process.env) {
  const prefix = capability === 'reports' ? 'SANCTUARY_META' : 'SANCTUARY_META_SALES';
  if (env[`${prefix}_VAULT_ENABLED`] !== 'true') throw new Error('Meta vault capability disabled');
  const identity = identitySchema.parse({ capability, actorId: env[`${prefix}_ACTOR_ID`], appId: env[`${prefix}_APP_ID`],
    principalId: env[`${prefix}_PRINCIPAL_ID`], businessId: env[`${prefix}_BUSINESS_ID`],
    targetId: env[`${prefix}_${capability === 'reports' ? 'ACCOUNT' : 'DATASET'}_ID`],
    scopes: z.string().max(500).parse(env[`${prefix}_EXPECTED_SCOPES`]).split(' ').filter(Boolean).sort(),
    vaultId: env[`${prefix}_VAULT_ID`], itemId: env[`${prefix}_CREDENTIAL_ITEM_ID`] });
  if (new Set(identity.scopes).size !== identity.scopes.length || (capability === 'reports'
    && (!identity.scopes.includes('ads_read') || identity.scopes.some(scope => !['ads_read','public_profile'].includes(scope)))))
    throw new Error('Meta scope policy unavailable');
  const binding = fingerprint(JSON.stringify(identity));
  if (env[`${prefix}_BINDING_SHA256`] !== binding) throw new Error('Meta stable binding changed');
  return { identity, binding, renewalEnabled: env[`${prefix}_RENEWAL_ENABLED`] === 'true',
    vaultToken: z.string().min(1).max(20000).parse(env[`${prefix}_SERVICE_ACCOUNT_TOKEN`]),
    appSecret: z.string().min(16).max(1024).parse(env[`${prefix}_APP_SECRET`]) };
}
export type MetaCredentialConfig = ReturnType<typeof credentialConfig>;
