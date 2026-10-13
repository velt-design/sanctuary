import 'server-only';
import { metaSalesConfig } from './config';
import { metaSaleStore } from './store';
import { runMetaSales } from './worker';
import { openMetaCredential } from '../metaCredentials/runtime';
export async function metaSalesRuntime(signal: AbortSignal) {
  if (process.env.SANCTUARY_META_SALES_VAULT_ENABLED === 'true') {
    if (process.env.SANCTUARY_META_SALES_ENABLED !== 'true') throw new Error('Meta sales disabled');
    const lease = await openMetaCredential('sales', signal);
    try { return await runMetaSales({ lane: 'sales', signal, credential: { token: lease.token, datasetId: lease.config.identity.targetId },
      credentialCheck: lease.check, store: metaSaleStore({ actorId: lease.config.identity.actorId, binding: lease.config.binding }, signal) }); }
    finally { await lease.finish(); }
  }
  const config = metaSalesConfig();
  return runMetaSales({ lane: 'sales', credential: config, signal, store: metaSaleStore(config, signal) });
}
