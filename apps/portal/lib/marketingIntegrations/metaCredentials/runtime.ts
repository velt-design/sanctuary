import 'server-only';
import { createClient, ItemCategory, ItemFieldType, type Item } from '@1password/sdk';
import { z } from 'zod';
import { credentialConfig, type MetaCapability } from './config';
import { metaCredentialVault } from './vault';
import { metaCredentialProvider } from './provider';
import { metaCredentialStore } from './store';
import { metaCredentialSession } from './lifecycle';

function dependencies(capability: MetaCapability, signal: AbortSignal) {
  const config = credentialConfig(capability);
  return { config, signal, command: metaCredentialStore(config, signal), provider: metaCredentialProvider(config, signal),
    vault: metaCredentialVault(config, { apiCredentialsCategory: ItemCategory.ApiCredentials, concealedFieldType: ItemFieldType.Concealed,
      createClient: async options => { const client = await createClient(options); return { items: {
        get: (vaultId, itemId) => client.items.get(vaultId, itemId), put: item => client.items.put(item as unknown as Item),
      } }; },
    }) };
}
export async function openMetaCredential(capability: MetaCapability, signal: AbortSignal, authorize?: () => Promise<void>) {
  const deps = dependencies(capability, signal);
  const lease = await metaCredentialSession({ ...deps, authorize }, 'use');
  if (!('token' in lease)) throw new Error('Meta credential lease unavailable');
  return { ...lease, config: deps.config };
}
export async function openMetaReportCredential(signal: AbortSignal, authorize?: () => Promise<void>) {
  if (process.env.SANCTUARY_META_VAULT_ENABLED !== 'true') return undefined;
  const session = await openMetaCredential('reports', signal, authorize), { identity } = session.config;
  return { ...session, reportConfig: { actor: identity.actorId, account: identity.targetId, binding: session.config.binding,
    app: identity.appId, principal: identity.principalId, business: identity.businessId, token: session.token,
    appSecret: session.config.appSecret, expiresAt: session.expiresAt } };
}
export async function maintainMetaCredentials(signal: AbortSignal) {
  const outcomes: Record<string, 'disabled' | 'not_due' | 'renewed' | 'reconciled' | 'review_required'> = {};
  for (const capability of ['reports','sales'] as const) {
    const prefix = capability === 'reports' ? 'SANCTUARY_META' : 'SANCTUARY_META_SALES';
    if (process.env[`${prefix}_VAULT_ENABLED`] !== 'true' || process.env[`${prefix}_RENEWAL_ENABLED`] !== 'true') { outcomes[capability] = 'disabled'; continue; }
    try {
      const deps = dependencies(capability, signal);
      const status = z.object({ state: z.enum(['READY','EXCHANGE_PENDING','VAULT_PENDING','REVIEW_REQUIRED']) }).strict().parse(await deps.command('status'));
      if (status.state === 'REVIEW_REQUIRED') { outcomes[capability] = 'review_required'; continue; }
      const purpose = status.state === 'READY' ? 'renew' : 'reconcile';
      const result = await metaCredentialSession(deps, purpose);
      outcomes[capability] = purpose === 'reconcile' ? 'reconciled' : 'renewed' in result && result.renewed ? 'renewed' : 'not_due';
    } catch { outcomes[capability] = 'review_required'; }
  }
  return outcomes;
}
