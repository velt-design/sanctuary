import 'server-only';
import { createClient, ItemCategory, ItemFieldType, type Item } from '@1password/sdk';
import { ga4Vault } from './providers';
import { ga4HttpDependencies, sanctuaryGa4Response } from './http';

const dependencies = { ...ga4HttpDependencies, vault: (config: Parameters<typeof ga4Vault>[0]) => ga4Vault(config, {
  apiCredentialsCategory: ItemCategory.ApiCredentials, concealedFieldType: ItemFieldType.Concealed,
  createClient: async options => {
    const client = await createClient(options);
    return { items: { get: (vaultId: string, itemId: string) => client.items.get(vaultId, itemId),
      // ga4Vault retains the exact SDK item and changes only its validated
      // refresh_token value; the generic test boundary does not model SDK fields.
      put: (item: Record<string, unknown>) => client.items.put(item as unknown as Item) } };
  },
}) };
export const sanctuaryGa4Runtime = (request: Request) => sanctuaryGa4Response(request, dependencies);
