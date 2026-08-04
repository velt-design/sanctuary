import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
} from '@sp/costing';
import { hashCostingControlConfigV1 } from '@sp/costing/server';
import {
  PublishedCostingConfigurationUnavailableError,
  getPublishedCostingConfiguration,
} from './publishedCostingConfiguration.server';

function clientFor(input: {
  publication: { data: unknown; error: unknown };
  version: { data: unknown; error: unknown };
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

describe('marketing published costing resolver', () => {
  it('returns the exact active published version with provenance', async () => {
    const control = snapshotCostingControlConfigV1(loadCostingConfigV1());
    control.labour.crewHourRateExGst = 94;
    const client = clientFor({
      publication: { data: { current_version_id: 'version-8' }, error: null },
      version: {
        data: {
          id: 'version-8',
          version_number: 8,
          status: 'published',
          config_json: control,
          content_hash: hashCostingControlConfigV1(control),
          base_manifest_version: control.baseManifestVersion,
        },
        error: null,
      },
    });

    const resolved = await getPublishedCostingConfiguration(client);

    expect(resolved.config.installActions.basis.crew_hour_rate_ex_gst).toBe(94);
    expect(resolved.provenance.versionNumber).toBe(8);
    expect(resolved.provenance.versionId).toBe('version-8');
  });

  it.each([
    ['missing publication', { data: null, error: null }, { data: null, error: null }],
    ['publication read error', { data: null, error: { message: 'private detail' } }, { data: null, error: null }],
    ['missing version', { data: { current_version_id: 'missing' }, error: null }, { data: null, error: { message: 'missing' } }],
  ])('fails closed for %s', async (_label, publication, version) => {
    await expect(getPublishedCostingConfiguration(clientFor({ publication, version })))
      .rejects.toBeInstanceOf(PublishedCostingConfigurationUnavailableError);
  });
});
