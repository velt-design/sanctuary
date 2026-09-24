import 'server-only';
import { z } from 'zod';
import { GA4_READ_SCOPE, type Ga4Google, type Ga4Vault } from './lifecycle';
import { boundedGoogleJson } from './report/transport';

const tokenSchema = z.object({
  access_token: z.string().min(1).max(16384), refresh_token: z.string().min(1).max(16384).optional(),
  scope: z.literal(GA4_READ_SCOPE), token_type: z.literal('Bearer'), expires_in: z.number().int().positive().max(86400),
});

export function ga4Google(fetcher: typeof fetch = fetch, signal?: AbortSignal): Ga4Google {
  return {
    async token(parameters) {
      const value = tokenSchema.parse(await boundedGoogleJson(fetcher, 'https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: parameters, signal,
      }));
      return { accessToken: value.access_token, refreshToken: value.refresh_token, scope: value.scope, expiresIn: value.expires_in };
    },
    async property(accessToken, propertyId) {
      if (!/^[1-9]\d{0,19}$/.test(propertyId)) throw new Error('Invalid property.');
      z.object({ name: z.literal(`properties/${propertyId}`), deleteTime: z.never().optional(), expireTime: z.never().optional() })
        .parse(await boundedGoogleJson(fetcher, `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }, signal,
        }));
    },
  };
}

// The composition root supplies the actual SDK and its enum values. Keep SDK
// package loading and credentials out of this independently testable boundary.
export interface Ga4VaultSdk {
  apiCredentialsCategory: string;
  concealedFieldType: string;
  createClient(options: { auth: string; integrationName: string; integrationVersion: string }): Promise<{
    items: { get(vaultId: string, itemId: string): Promise<unknown>; put(item: Record<string, unknown>): Promise<unknown> };
  }>;
}
const itemSchema = z.object({
  id: z.string(), vaultId: z.string(), category: z.string(), version: z.number().int().positive().refine(Number.isSafeInteger),
  fields: z.array(z.object({ id: z.string(), fieldType: z.string(), value: z.string() }).passthrough()),
}).passthrough();
type CredentialItem = z.infer<typeof itemSchema>;

async function boundedVault<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Vault outcome uncertain.')), 15000);
    })]);
  } finally { clearTimeout(timer); }
}

export function ga4Vault(config: { vaultId: string; itemId: string; vaultToken: string }, sdk: Ga4VaultSdk): Ga4Vault {
  let client: Awaited<ReturnType<Ga4VaultSdk['createClient']>> | undefined;
  let item: CredentialItem | undefined;
  let writeAttempted = false;
  function validate(raw: unknown) {
    const value = itemSchema.parse(raw);
    const fields = value.fields.filter(field => field.id === 'refresh_token');
    if (value.id !== config.itemId || value.vaultId !== config.vaultId || value.category !== sdk.apiCredentialsCategory
      || fields.length !== 1 || fields[0]?.fieldType !== sdk.concealedFieldType) throw new Error('Invalid credential item.');
    z.string().max(16384).parse(fields[0].value);
    return { item: value, token: fields[0].value || null };
  }
  return {
    async authenticate() {
      client = undefined; item = undefined;
      client = await boundedVault(sdk.createClient({ auth: config.vaultToken, integrationName: 'Sanctuary GA4', integrationVersion: '1.0.0' }));
    },
    async read() {
      if (!client || writeAttempted) throw new Error('Vault session required.');
      item = undefined;
      const checked = validate(await boundedVault(client.items.get(config.vaultId, config.itemId)));
      item = checked.item;
      return { refreshToken: checked.token, version: item.version };
    },
    async write(refreshToken) {
      if (!client || !item || writeAttempted) throw new Error('Read the exact credential item first.');
      z.string().min(1).max(16384).parse(refreshToken);
      // A timeout or malformed acknowledgement can still follow a successful
      // write. Never retry that effect in this adapter; the durable ledger owns recovery.
      writeAttempted = true;
      const checked = validate(await boundedVault(client.items.put({ ...item,
        fields: item.fields.map(field => field.id === 'refresh_token' ? { ...field, value: refreshToken } : field),
      })));
      if (checked.item.version <= item.version || checked.token !== refreshToken) throw new Error('Vault write could not be confirmed.');
      item = checked.item;
      return { version: item.version };
    },
  };
}
