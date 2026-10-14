import 'server-only';
import { z } from 'zod';
import type { Ga4VaultSdk } from '../ga4/providers';
import type { MetaCredentialConfig } from './config';

export const savedCredentialSchema = z.object({ version: z.literal(1), binding: z.string().regex(/^[a-f0-9]{64}$/),
  accessToken: z.string().min(32).max(16384), expiresAt: z.iso.datetime().nullable(), dataAccessExpiresAt: z.iso.datetime().nullable() }).strict();
export type SavedMetaCredential = z.infer<typeof savedCredentialSchema>;
export interface MetaVault {
  read(): Promise<{ credential: SavedMetaCredential; version: number }>;
  write(value: SavedMetaCredential): Promise<{ version: number }>;
}
const itemSchema = z.object({ id: z.string(), vaultId: z.string(), category: z.string(), version: z.number().int().positive().refine(Number.isSafeInteger),
  fields: z.array(z.object({ id: z.string(), fieldType: z.string(), value: z.string() }).passthrough()) }).passthrough();
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Meta vault outcome uncertain')), 15000); })]); }
  finally { clearTimeout(timer); }
}
/** One version-checked write per session. A timeout never authorizes a second put. */
export function metaCredentialVault(config: MetaCredentialConfig, sdk: Ga4VaultSdk): MetaVault {
  let client: Awaited<ReturnType<Ga4VaultSdk['createClient']>> | undefined;
  let item: z.infer<typeof itemSchema> | undefined;
  let attempted = false;
  const validate = (raw: unknown) => {
    const value = itemSchema.parse(raw), fields = value.fields.filter(field => field.id === 'meta_credential');
    if (value.id !== config.identity.itemId || value.vaultId !== config.identity.vaultId || value.category !== sdk.apiCredentialsCategory
      || fields.length !== 1 || fields[0].fieldType !== sdk.concealedFieldType || fields[0].value.length > 18000) throw new Error('Meta vault item mismatch');
    const credential = savedCredentialSchema.parse(JSON.parse(fields[0].value));
    if (credential.binding !== config.binding) throw new Error('Meta vault binding mismatch');
    return { item: value, credential };
  };
  return {
    async read() {
      if (attempted) throw new Error('Fresh vault session required');
      client ??= await bounded(sdk.createClient({ auth: config.vaultToken, integrationName: 'Sanctuary Meta Credentials', integrationVersion: '1.0.0' }));
      const result = validate(await bounded(client.items.get(config.identity.vaultId, config.identity.itemId)));
      item = result.item; return { credential: result.credential, version: item.version };
    },
    async write(value) {
      const credential = savedCredentialSchema.parse(value);
      if (!client || !item || attempted || credential.binding !== config.binding) throw new Error('Meta vault write unavailable');
      attempted = true;
      const result = validate(await bounded(client.items.put({ ...item, fields: item.fields.map(field => field.id === 'meta_credential'
        ? { ...field, value: JSON.stringify(credential) } : field) })));
      if (result.item.version <= item.version || JSON.stringify(result.credential) !== JSON.stringify(credential)) throw new Error('Meta vault write uncertain');
      return { version: result.item.version };
    },
  };
}
