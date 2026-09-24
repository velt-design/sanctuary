import 'server-only';
import { z } from 'zod';
import { loadPraxisConnectorConfig } from '../../praxis/server';
import { metaControlConfig } from './config';
import { metaStore } from './store';
import { parseMetaSnapshot } from './snapshot';
import { metaCoverage, type MetaEvidence } from '../../marketingPerformance/dataSources';

const dependencies = { source: loadPraxisConnectorConfig, control: metaControlConfig, store: metaStore };

/** Reuses the active source's saved-report read; never refreshes a provider or extends retention. */
export async function readStaffMeta(signal: AbortSignal, deps = dependencies): Promise<MetaEvidence> {
  const source = deps.source(), control = deps.control();
  const raw = await deps.store(control, source)('read', null, signal);
  signal.throwIfAborted();
  if (JSON.stringify(deps.control()) !== JSON.stringify(control) || JSON.stringify(deps.source()) !== JSON.stringify(source))
    throw new Error('Source configuration changed.');
  const checkedAt = new Date().toISOString();
  if (z.object({ status: z.literal('missing') }).strict().safeParse(raw).success) return { status: 'missing', checkedAt };
  const { saved, report } = parseMetaSnapshot(raw);
  const evidence: Extract<MetaEvidence, { status: 'available' }> = { status: 'available', checkedAt, accountId: control.account,
    expiresAt: new Date(saved.expiresAt).toISOString(), report };
  metaCoverage(evidence); // Reject repeated campaign IDs before returning any totals.
  return evidence;
}
