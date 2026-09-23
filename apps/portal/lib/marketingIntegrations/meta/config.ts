import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const id = z.string().regex(/^[1-9]\d{0,19}$/);
const schema = z.object({
  actor: z.uuid(), account: id, app: id, principal: id, business: id,
  token: z.string().min(32).max(16384), appSecret: z.string().min(16).max(1024),
  expiresAt: z.iso.datetime(),
});
export function metaControlConfig(env: NodeJS.ProcessEnv = process.env, deletion = false) {
  if (!deletion && (env.SANCTUARY_META_REPORTS_ENABLED !== 'true' || env.SANCTUARY_META_ASSIGNMENT_VERIFIED !== 'true')) throw new Error('Meta capability unavailable.');
  return z.object({ actor: z.uuid(), account: id, binding: z.string().regex(/^[a-f0-9]{64}$/) }).parse({
    actor: env.SANCTUARY_META_ACTOR_ID, account: env.SANCTUARY_META_ACCOUNT_ID, binding: env.SANCTUARY_META_BINDING_SHA256,
  });
}
export function metaConfig(env: NodeJS.ProcessEnv = process.env) {
  const control = metaControlConfig(env);
  const value = schema.parse({ actor: env.SANCTUARY_META_ACTOR_ID, account: env.SANCTUARY_META_ACCOUNT_ID,
    app: env.SANCTUARY_META_APP_ID, principal: env.SANCTUARY_META_PRINCIPAL_ID, business: env.SANCTUARY_META_BUSINESS_ID,
    token: env.SANCTUARY_META_ACCESS_TOKEN, appSecret: env.SANCTUARY_META_APP_SECRET, expiresAt: env.SANCTUARY_META_EXPIRES_AT });
  const expiry = Date.parse(value.expiresAt);
  if (expiry <= Date.now() + 60000 || expiry > Date.now() + 30 * 86400000) throw new Error('Meta credential lifetime unavailable.');
  // Provision the matching hash into the disabled source control row separately.
  // No credential, provider body or deployment environment is written to audit.
  const binding = createHash('sha256').update(JSON.stringify(value)).digest('hex');
  if (binding !== control.binding) throw new Error('Meta credential binding changed.');
  return { ...value, binding };
}
export type MetaConfig = ReturnType<typeof metaConfig>;
