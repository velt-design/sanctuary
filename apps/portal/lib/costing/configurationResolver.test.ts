import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyCostingControlConfigV1,
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
} from '@sp/costing';
import { hashCostingControlConfig } from './configurationShared';

const getCostingConfigWithOverrides = vi.fn();

vi.mock('./overrides', () => ({ getCostingConfigWithOverrides }));

function versionRow(config = snapshotCostingControlConfigV1(loadCostingConfigV1())) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    version_number: 4,
    name: 'Published supplier update',
    purpose: 'Keep supported supplier rates current.',
    status: 'published',
    schema_version: config.schemaVersion,
    base_manifest_version: config.baseManifestVersion,
    based_on_version_id: null,
    config_json: config,
    content_hash: hashCostingControlConfig(config),
    created_at: '2026-07-23T00:00:00.000Z',
    created_by_email: 'admin@example.com',
    updated_at: '2026-07-23T01:00:00.000Z',
    updated_by_email: 'admin@example.com',
    published_at: '2026-07-23T01:00:00.000Z',
    published_by_email: 'admin@example.com',
    publish_note: 'Updated crew rate.',
    publication_diff: [],
    publication_impact: [],
  };
}

function clientFor(input: {
  publication?: { data: unknown; error: unknown };
  version?: { data: unknown; error: unknown };
}): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      const result = table === 'costing_configuration_publication'
        ? input.publication
        : input.version;
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.maybeSingle = vi.fn(async () => result);
      builder.single = vi.fn(async () => result);
      return builder;
    }),
  } as unknown as SupabaseClient;
}

describe('published costing configuration resolver', () => {
  beforeEach(() => {
    getCostingConfigWithOverrides.mockReset();
  });

  it('applies the current immutable version and returns exact provenance', async () => {
    const config = snapshotCostingControlConfigV1(loadCostingConfigV1());
    config.labour.crewHourRateExGst = 91;
    const row = versionRow(config);
    const client = clientFor({
      publication: { data: { current_version_id: row.id }, error: null },
      version: { data: row, error: null },
    });
    const { resolvePublishedCostingConfiguration } = await import('./configurationResolver');

    const resolved = await resolvePublishedCostingConfiguration(client);

    expect(resolved.config.installActions.basis.crew_hour_rate_ex_gst).toBe(91);
    expect(resolved.provenance).toEqual({
      schemaVersion: 'costing-provenance.v1',
      source: 'published',
      versionId: row.id,
      versionNumber: 4,
      contentHash: row.content_hash,
      baseManifestVersion: config.baseManifestVersion,
    });
    expect(getCostingConfigWithOverrides).not.toHaveBeenCalled();
  });

  it('preserves legacy effective behaviour before the first publish and snapshots it', async () => {
    const base = loadCostingConfigV1();
    const legacy = applyCostingControlConfigV1(base, {
      ...snapshotCostingControlConfigV1(base),
      labour: {
        ...snapshotCostingControlConfigV1(base).labour,
        crewHourRateExGst: 82,
      },
    });
    getCostingConfigWithOverrides.mockResolvedValue({ config: legacy, overrides: {} });
    const client = clientFor({
      publication: { data: null, error: null },
      version: { data: null, error: null },
    });
    const { resolvePublishedCostingConfiguration, resolveHistoricalCostingConfiguration } = await import('./configurationResolver');

    const resolved = await resolvePublishedCostingConfiguration(client);

    expect(resolved.provenance.source).toBe('legacy-overrides');
    if (resolved.provenance.source !== 'legacy-overrides') return;
    expect(resolved.provenance.configSnapshot.labour.crewHourRateExGst).toBe(82);
    expect((await resolveHistoricalCostingConfiguration(resolved.provenance, client))
      .installActions.basis.crew_hour_rate_ex_gst).toBe(82);
  });

  it('fails closed when a published row does not match its recorded hash', async () => {
    const row = versionRow();
    row.content_hash = '0'.repeat(64);
    const client = clientFor({
      publication: { data: { current_version_id: row.id }, error: null },
      version: { data: row, error: null },
    });
    const { resolvePublishedCostingConfiguration } = await import('./configurationResolver');

    await expect(resolvePublishedCostingConfiguration(client)).rejects.toThrow('failed its content hash check');
  });
});
