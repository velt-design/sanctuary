import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabaseServiceRole: {} }));

import { buildEstimateDbPayload } from './persistence';
import { buildVersionLabelMap, extractVersionNumber, mapEstimateMeta } from './server';

describe('estimate version identity', () => {
  it.each([null, {}, { schemaVersion: 'future' }])('keeps owned Studio navigation even for unsupported saved content: %j', (studio) => {
    const meta = mapEstimateMeta({ id: 'one', project_id: 'project', outputs: { studio_authored: studio } }, 'V3');
    expect(meta.designKind).toBe('studio');
    expect(meta).not.toHaveProperty('outputs');
    expect(mapEstimateMeta({ id: 'two', outputs: {} }, 'V1').designKind).toBe('calculator');
  });
  it('keeps the list version through a save when a legacy row column has a stale default', () => {
    const existing = { id: 'estimate-two', version: 1, inputs: {}, outputs: { version: 2 }, created_at: '2026-10-01' };
    const before = buildVersionLabelMap([{ id: existing.id, outputs: existing.outputs }]);
    const saved = buildEstimateDbPayload({
      inputs: { lengthM: '6.1' }, outputs: {}, version: extractVersionNumber(existing),
    });
    const reopened = { ...existing, ...saved };
    expect(before.get(existing.id)).toBe('V2');
    expect((saved.outputs as Record<string, unknown>).version).toBe(2);
    expect(buildVersionLabelMap([reopened]).get(existing.id)).toBe('V2');
    expect(existing.outputs.version).toBe(2);
  });

  it('retains top-level-only legacy versions and ignores invalid snapshot values', () => {
    expect(extractVersionNumber({ version: 4 })).toBe(4);
    expect(extractVersionNumber({ version: 4, outputs: { version: -1 } })).toBe(4);
    expect(extractVersionNumber({ outputs: { version: 0 } })).toBeNull();
  });
});
