import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
} from '@sp/costing';
import { hashCostingControlConfig } from './configurationShared';

const getCostingConfigurationVersionById = vi.fn();
const resolvePublishedCostingConfiguration = vi.fn();

vi.mock('./configurationResolver', () => ({
  getCostingConfigurationVersionById,
  resolvePublishedCostingConfiguration,
}));

function draftVersion() {
  const config = snapshotCostingControlConfigV1(loadCostingConfigV1());
  config.labour.crewHourRateExGst += 8;
  return {
    id: '11111111-1111-4111-8111-111111111111',
    versionNumber: 2,
    status: 'draft' as const,
    schemaVersion: config.schemaVersion,
    baseManifestVersion: config.baseManifestVersion,
    basedOnVersionId: null,
    config,
    contentHash: hashCostingControlConfig(config),
    createdAt: '2026-07-23T00:00:00.000Z',
    createdByEmail: 'admin@example.com',
    updatedAt: '2026-07-23T00:00:00.000Z',
    updatedByEmail: 'admin@example.com',
    publishedAt: null,
    publishedByEmail: null,
    publishNote: null,
    publicationDiff: null,
    publicationImpact: null,
  };
}

function publishedRow(version: ReturnType<typeof draftVersion>) {
  return {
    id: version.id,
    version_number: version.versionNumber,
    status: 'published',
    schema_version: version.schemaVersion,
    base_manifest_version: version.baseManifestVersion,
    based_on_version_id: null,
    config_json: version.config,
    content_hash: version.contentHash,
    created_at: version.createdAt,
    created_by_email: version.createdByEmail,
    updated_at: '2026-07-23T01:00:00.000Z',
    updated_by_email: 'admin@example.com',
    published_at: '2026-07-23T01:00:00.000Z',
    published_by_email: 'admin@example.com',
    publish_note: 'Reviewed impacts.',
    publication_diff: [],
    publication_impact: [],
  };
}

describe('costing configuration admin publication', () => {
  beforeEach(() => {
    getCostingConfigurationVersionById.mockReset();
    resolvePublishedCostingConfiguration.mockReset();
    resolvePublishedCostingConfiguration.mockResolvedValue({
      config: loadCostingConfigV1(),
      provenance: {
        schemaVersion: 'costing-provenance.v1',
        source: 'legacy-overrides',
        versionId: null,
        versionNumber: null,
        contentHash: '0'.repeat(64),
        baseManifestVersion: 'v1.7',
        configSnapshot: snapshotCostingControlConfigV1(loadCostingConfigV1()),
      },
    });
  });

  it('recomputes diff and representative impact immediately before the atomic RPC', async () => {
    const draft = draftVersion();
    getCostingConfigurationVersionById.mockResolvedValue(draft);
    const rpc = vi.fn(async (_name, args) => ({
      data: publishedRow(draft),
      error: null,
      args,
    }));
    const client = { rpc } as unknown as SupabaseClient;
    const { publishCostingConfigurationDraft } = await import('./configurationAdmin');

    await publishCostingConfigurationDraft(
      client,
      draft.id,
      draft.contentHash,
      null,
      'Reviewed impacts.',
    );

    expect(rpc).toHaveBeenCalledWith('publish_costing_configuration_version', expect.objectContaining({
      p_version_id: draft.id,
      p_expected_current_version_id: null,
      p_expected_content_hash: draft.contentHash,
      p_publish_note: 'Reviewed impacts.',
      p_publication_diff: expect.arrayContaining([
        expect.objectContaining({ path: 'labour.crewHourRateExGst' }),
      ]),
      p_publication_impact: expect.arrayContaining([
        expect.objectContaining({ id: 'standard-pitched-acrylic' }),
      ]),
    }));
  });

  it('returns the package-owned active snapshot needed for clear draft comparisons and resets', async () => {
    const draft = draftVersion();
    const activeConfig = loadCostingConfigV1();
    const activeSnapshot = snapshotCostingControlConfigV1(activeConfig);
    getCostingConfigurationVersionById.mockResolvedValue(draft);
    resolvePublishedCostingConfiguration.mockResolvedValue({
      config: activeConfig,
      provenance: {
        schemaVersion: 'costing-provenance.v1',
        source: 'legacy-overrides',
        versionId: null,
        versionNumber: null,
        contentHash: '0'.repeat(64),
        baseManifestVersion: 'v1.7',
        configSnapshot: activeSnapshot,
      },
    });
    const { getCostingConfigurationEditor } = await import('./configurationAdmin');

    const editor = await getCostingConfigurationEditor({} as SupabaseClient, draft.id);

    expect(editor.comparison?.baselineConfig).toEqual(activeSnapshot);
    expect(editor.comparison?.diff).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'labour.crewHourRateExGst',
        before: activeSnapshot.labour.crewHourRateExGst,
        after: draft.config.labour.crewHourRateExGst,
      }),
    ]));
  });

  it('refuses to publish a stale hash before calling the database', async () => {
    const draft = draftVersion();
    getCostingConfigurationVersionById.mockResolvedValue(draft);
    const rpc = vi.fn();
    const { publishCostingConfigurationDraft } = await import('./configurationAdmin');

    await expect(publishCostingConfigurationDraft(
      { rpc } as unknown as SupabaseClient,
      draft.id,
      'f'.repeat(64),
      null,
      'Reviewed impacts.',
    )).rejects.toThrow('draft changed');
    expect(rpc).not.toHaveBeenCalled();
  });
});
