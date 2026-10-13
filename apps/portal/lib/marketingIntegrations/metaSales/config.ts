import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const id = z.string().regex(/^[1-9]\d{0,19}$/);
const schema = z.object({ actorId: z.uuid(), datasetId: id, token: z.string().min(32).max(16384),
  expiresAt: z.iso.datetime({ offset: true }), binding: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
/** Dedicated CAPI token. The ads_read credential is never consulted or broadened. */
export function metaSalesConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.SANCTUARY_META_SALES_ENABLED !== 'true') throw new Error('Meta sale delivery is disabled');
  const config = schema.parse({ actorId: env.SANCTUARY_META_SALES_ACTOR_ID, datasetId: env.SANCTUARY_META_SALES_DATASET_ID,
    token: env.SANCTUARY_META_SALES_ACCESS_TOKEN, expiresAt: env.SANCTUARY_META_SALES_EXPIRES_AT, binding: env.SANCTUARY_META_SALES_BINDING_SHA256 });
  const expected = createHash('sha256').update(JSON.stringify({ actorId: config.actorId, datasetId: config.datasetId,
    token: config.token, expiresAt: config.expiresAt })).digest('hex');
  if (expected !== config.binding || Date.parse(config.expiresAt) <= Date.now() + 60000) throw new Error('Meta sale authority unavailable');
  return config;
}
export type MetaSalesConfig = ReturnType<typeof metaSalesConfig>;
