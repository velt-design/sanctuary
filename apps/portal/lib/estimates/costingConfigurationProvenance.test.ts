import { describe, expect, it } from 'vitest';
import { buildEstimateDbPayload } from './persistence';

describe('estimate costing configuration provenance', () => {
  it('persists the immutable published version alongside the frozen output snapshot', () => {
    const versionId = '11111111-1111-4111-8111-111111111111';
    const costingControl = {
      schemaVersion: 'costing-provenance.v1',
      source: 'published',
      versionId,
      versionNumber: 7,
      contentHash: 'a'.repeat(64),
      baseManifestVersion: 'v1.7',
    };

    const payload = buildEstimateDbPayload({
      inputs: { schemaVersion: 'v2' },
      outputs: { totals: { cost_ex_gst: 100, cost_inc_gst: 115 } },
      configVersions: { manifest: 'manifest.json', costingControl },
    });

    expect(payload.costing_config_version_id).toBe(versionId);
    expect(payload.outputs).toEqual(expect.objectContaining({
      configVersions: expect.objectContaining({ costingControl }),
    }));
  });

  it('keeps legacy snapshot provenance without inventing a version foreign key', () => {
    const costingControl = {
      schemaVersion: 'costing-provenance.v1',
      source: 'legacy-overrides',
      versionId: null,
      versionNumber: null,
      contentHash: 'b'.repeat(64),
      baseManifestVersion: 'v1.7',
      configSnapshot: { schemaVersion: 'costing-control.v1' },
    };

    const payload = buildEstimateDbPayload({
      inputs: {},
      outputs: {},
      configVersions: { costingControl },
    });

    expect(payload.costing_config_version_id).toBeNull();
    expect(payload.outputs).toEqual(expect.objectContaining({
      configVersions: expect.objectContaining({ costingControl }),
    }));
  });
});
