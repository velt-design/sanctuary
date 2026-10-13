import 'server-only';
import { metaSalesConfig } from './config';
import { metaSaleStore } from './store';
import { runMetaSales } from './worker';
export async function metaSalesRuntime(signal: AbortSignal) {
  const config = metaSalesConfig();
  return runMetaSales({ lane: 'sales', credential: config, signal, store: metaSaleStore(config, signal) });
}
