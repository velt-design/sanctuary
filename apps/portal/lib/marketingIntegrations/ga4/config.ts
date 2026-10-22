import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Ga4Control } from './store';

const property = z.string().regex(/^[1-9]\d{0,19}$/);
const vaultReference = z.string().regex(/^[a-z2-7]{26}$/);
const controlSchema = z.object({ actor: z.uuid(), property, binding: z.string().regex(/^[a-f0-9]{64}$/) });
const credentialSchema = z.object({
  actor: z.uuid(), propertyId: property, vaultId: vaultReference, itemId: vaultReference,
  clientId: z.string().min(1).max(1024), clientSecret: z.string().min(1).max(4096),
  vaultToken: z.string().min(1).max(16384),
});
const vercelSchema = z.object({
  actor: z.uuid(), propertyId: property, clientId: z.string().min(1).max(1024),
  clientSecret: z.string().min(1).max(4096), refreshToken: z.string().min(1).max(16384),
});
/** Separate credential authority from retained report authority. Never log either input. */
export function ga4VercelBinding(binding: string, value: z.infer<typeof vercelSchema>): string {
  return createHash('sha256').update(JSON.stringify({ store: 'vercel', environment: 'production', binding,
    actor: value.actor, propertyId: value.propertyId, clientId: value.clientId,
    clientSecret: value.clientSecret, refreshToken: value.refreshToken })).digest('hex');
}
export function ga4ControlConfig(env: Readonly<Record<string, string | undefined>> = process.env, deletion = false): Ga4Control {
  if (!deletion && env.SANCTUARY_GA4_REPORTS_ENABLED !== 'true') throw new Error('GA4 capability unavailable.');
  const parsed = controlSchema.safeParse({ actor: env.SANCTUARY_GA4_ACTOR_ID,
    property: env.SANCTUARY_GA4_PROPERTY_ID, binding: env.SANCTUARY_GA4_BINDING_SHA256 });
  if (!parsed.success) throw new Error('GA4 control configuration unavailable.');
  return parsed.data;
}
export function ga4Config(env: Readonly<Record<string, string | undefined>> = process.env) {
  const control = ga4ControlConfig(env);
  if (env.SANCTUARY_GA4_CREDENTIAL_STORE === 'vercel') {
    if (env.VERCEL_ENV !== 'production') throw new Error('GA4 credential environment unavailable.');
    const value = vercelSchema.safeParse({ actor: control.actor, propertyId: control.property,
      clientId: env.SANCTUARY_GA4_CLIENT_ID, clientSecret: env.SANCTUARY_GA4_CLIENT_SECRET,
      refreshToken: env.SANCTUARY_GA4_REFRESH_TOKEN });
    if (!value.success) throw new Error('GA4 credential configuration unavailable.');
    return { ...value.data, binding: control.binding, credentialStore: 'vercel' as const,
      credentialBinding: ga4VercelBinding(control.binding, value.data) };
  }
  if (env.SANCTUARY_GA4_CREDENTIAL_STORE && env.SANCTUARY_GA4_CREDENTIAL_STORE !== 'vault') {
    throw new Error('GA4 credential store unavailable.');
  }
  const parsed = credentialSchema.safeParse({ actor: control.actor, propertyId: control.property,
    vaultId: env.SANCTUARY_GA4_VAULT_ID, itemId: env.SANCTUARY_GA4_CREDENTIAL_ITEM_ID,
    clientId: env.SANCTUARY_GA4_CLIENT_ID, clientSecret: env.SANCTUARY_GA4_CLIENT_SECRET,
    vaultToken: env.SANCTUARY_GA4_SERVICE_ACCOUNT_TOKEN });
  if (!parsed.success) throw new Error('GA4 credential configuration unavailable.');
  // The mutable refresh token remains only in the vault. Changing deployment
  // authority requires separately updating the disabled database control.
  const binding = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
  if (binding !== control.binding) throw new Error('GA4 credential binding changed.');
  return { ...parsed.data, binding, credentialStore: 'vault' as const };
}
