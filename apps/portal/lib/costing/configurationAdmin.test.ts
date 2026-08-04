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
    name: 'Supplier rate update',
    purpose: 'Update supported rates for August.',
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
    name: version.name,
    purpose: version.purpose,
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

function draftRow(version: ReturnType<typeof draftVersion>, updatedAt = version.updatedAt) {
  return {
    id: version.id,
    version_number: version.versionNumber,
    name: version.name,
    purpose: version.purpose,
    status: 'draft',
    schema_version: version.schemaVersion,
    base_manifest_version: version.baseManifestVersion,
    based_on_version_id: version.basedOnVersionId,
    config_json: version.config,
    content_hash: version.contentHash,
    created_at: version.createdAt,
    created_by_email: version.createdByEmail,
    updated_at: updatedAt,
    updated_by_email: version.updatedByEmail,
    published_at: null,
    published_by_email: null,
    publish_note: null,
    publication_diff: null,
    publication_impact: null,
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

  it('allows the first published version to freeze active legacy pricing unchanged', async () => {
    const activeConfig = loadCostingConfigV1();
    const draft = {
      ...draftVersion(),
      config: snapshotCostingControlConfigV1(activeConfig),
    };
    draft.contentHash = hashCostingControlConfig(draft.config);
    getCostingConfigurationVersionById.mockResolvedValue(draft);
    const rpc = vi.fn(async () => ({ data: publishedRow(draft), error: null }));
    const { publishCostingConfigurationDraft } = await import('./configurationAdmin');

    await publishCostingConfigurationDraft(
      { rpc } as unknown as SupabaseClient,
      draft.id,
      draft.contentHash,
      null,
      'Freeze current portal pricing as Version 1.',
    );

    expect(rpc).toHaveBeenCalledWith('publish_costing_configuration_version', expect.objectContaining({
      p_expected_current_version_id: null,
      p_publication_diff: [],
    }));
  });

  it('still rejects an unchanged draft after a version has been published', async () => {
    const activeConfig = loadCostingConfigV1();
    const draft = {
      ...draftVersion(),
      config: snapshotCostingControlConfigV1(activeConfig),
    };
    draft.contentHash = hashCostingControlConfig(draft.config);
    getCostingConfigurationVersionById.mockResolvedValue(draft);
    resolvePublishedCostingConfiguration.mockResolvedValue({
      config: activeConfig,
      provenance: {
        schemaVersion: 'costing-provenance.v1',
        source: 'published',
        versionId: '22222222-2222-4222-8222-222222222222',
        versionNumber: 1,
        contentHash: '1'.repeat(64),
        baseManifestVersion: 'v1.7',
      },
    });
    const rpc = vi.fn();
    const { publishCostingConfigurationDraft } = await import('./configurationAdmin');

    await expect(publishCostingConfigurationDraft(
      { rpc } as unknown as SupabaseClient,
      draft.id,
      draft.contentHash,
      '22222222-2222-4222-8222-222222222222',
      'No pricing changes.',
    )).rejects.toThrow('no changes');
    expect(rpc).not.toHaveBeenCalled();
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

  it('persists bounded draft identity when cloning a source version', async () => {
    const source = draftVersion();
    getCostingConfigurationVersionById.mockResolvedValue(source);
    const insert = vi.fn();
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.insert = insert.mockImplementation(() => builder);
    builder.select = vi.fn(() => builder);
    builder.single = vi.fn(async () => ({
      data: draftRow({
        ...source,
        name: 'Copy of supplier update',
        purpose: 'Check the previous supplier assumptions.',
      }),
      error: null,
    }));
    const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
    const { createCostingConfigurationDraft } = await import('./configurationAdmin');

    await createCostingConfigurationDraft(
      client,
      { id: 'admin-1', email: 'admin@example.com' },
      source.id,
      {
        name: '  Copy of supplier update ',
        purpose: ' Check the previous supplier assumptions. ',
      },
    );

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Copy of supplier update',
      purpose: 'Check the previous supplier assumptions.',
      based_on_version_id: source.id,
    }));
  });

  it('protects metadata-only saves with the expected update timestamp', async () => {
    const draft = draftVersion();
    const update = vi.fn();
    const eq = vi.fn();
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.update = update.mockImplementation(() => builder);
    builder.eq = eq.mockImplementation(() => builder);
    builder.select = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => ({
      data: draftRow({
        ...draft,
        name: 'Clearer supplier update',
        purpose: 'Clarify the intended August change.',
      }, '2026-07-23T02:00:00.000Z'),
      error: null,
    }));
    const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
    const { saveCostingConfigurationDraft } = await import('./configurationAdmin');

    await saveCostingConfigurationDraft(
      client,
      { id: 'admin-1', email: 'admin@example.com' },
      draft.id,
      draft.contentHash,
      draft.updatedAt,
      draft.config,
      {
        name: 'Clearer supplier update',
        purpose: 'Clarify the intended August change.',
      },
    );

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Clearer supplier update',
      purpose: 'Clarify the intended August change.',
    }));
    expect(eq).toHaveBeenCalledWith('updated_at', draft.updatedAt);
  });
});
