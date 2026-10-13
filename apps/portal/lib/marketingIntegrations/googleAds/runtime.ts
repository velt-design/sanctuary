import 'server-only';
import { createClient, ItemCategory, ItemFieldType, type Item } from '@1password/sdk';
import { ga4Vault } from '../ga4/providers';
import { adsConfig } from './config';
import { googleStore } from './store';
import { runGoogleConnection } from './worker';

export async function googleConnectionRuntime(lane: 'report' | 'sales', signal: AbortSignal) {
  const config = adsConfig();
  const vault = ga4Vault(config, { apiCredentialsCategory: ItemCategory.ApiCredentials, concealedFieldType: ItemFieldType.Concealed,
    createClient: async options => { const client = await createClient({ ...options, integrationName: 'Sanctuary Google Ads' });
      return { items: { get: (vaultId: string, itemId: string) => client.items.get(vaultId, itemId),
        put: (item: Record<string, unknown>) => client.items.put(item as unknown as Item) } }; },
  });
  return runGoogleConnection({ lane, config, vault, store: googleStore(config, signal), signal });
}
