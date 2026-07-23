import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { makeDefaultCalculatorInputs } from '@/app/staff/calculator/calculatorInputs';
import { hashCostingControlConfig } from './configurationShared';

const getCostingConfigurationVersionById = vi.fn();
const resolvePublishedCostingConfiguration = vi.fn();

vi.mock('./configurationResolver', () => ({
  getCostingConfigurationVersionById,
  resolvePublishedCostingConfiguration,
}));

describe('real estimate costing preview', () => {
  beforeEach(() => {
    getCostingConfigurationVersionById.mockReset();
    resolvePublishedCostingConfiguration.mockReset();
  });

  it('uses frozen calculator inputs and performs no estimate mutation', async () => {
    const config = snapshotCostingControlConfigV1(loadCostingConfigV1());
    config.labour.crewHourRateExGst += 5;
    const contentHash = hashCostingControlConfig(config);
    getCostingConfigurationVersionById.mockResolvedValue({
      id: 'draft-1',
      status: 'draft',
      config,
      contentHash,
    });
    resolvePublishedCostingConfiguration.mockResolvedValue({
      config: loadCostingConfigV1(),
      provenance: { versionId: null },
    });
    const estimateRow = {
      id: 'estimate-1',
      project_id: 'project-1',
      version: 3,
      status: 'draft',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
      inputs: makeDefaultCalculatorInputs(),
      outputs: {
        configVersions: {
          costingControl: {
            source: 'published',
            versionId: 'published-1',
            versionNumber: 2,
            contentHash: 'f'.repeat(64),
          },
        },
      },
      costing_config_version_id: 'published-1',
    };
    const estimateBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    estimateBuilder.select = vi.fn(() => estimateBuilder);
    estimateBuilder.eq = vi.fn(() => estimateBuilder);
    estimateBuilder.maybeSingle = vi.fn(async () => ({ data: estimateRow, error: null }));
    const projectBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    projectBuilder.select = vi.fn(() => projectBuilder);
    projectBuilder.in = vi.fn(async () => ({
      data: [{ id: 'project-1', name: 'Patricia Branch', quote_ref: 'Q-1042', site_address: 'Albany' }],
      error: null,
    }));
    const from = vi.fn((table: string) => table === 'estimates' ? estimateBuilder : projectBuilder);
    const { previewCostingDraftAgainstEstimate } = await import('./configurationEstimatePreview');

    const preview = await previewCostingDraftAgainstEstimate(
      { from } as unknown as SupabaseClient,
      'draft-1',
      'estimate-1',
      contentHash,
    );

    expect(preview.estimate.projectName).toBe('Patricia Branch');
    expect(preview.estimate.savedProvenance?.versionId).toBe('published-1');
    expect(preview.impact.label).toContain('estimate v3');
    expect(preview.impact.afterInstallExGst).toBeGreaterThan(preview.impact.beforeInstallExGst);
    expect(from).toHaveBeenCalledTimes(2);
    expect(estimateBuilder).not.toHaveProperty('update');
  });

  it('rejects a stale draft before reading an estimate', async () => {
    getCostingConfigurationVersionById.mockResolvedValue({
      id: 'draft-1',
      status: 'draft',
      config: snapshotCostingControlConfigV1(loadCostingConfigV1()),
      contentHash: 'a'.repeat(64),
    });
    resolvePublishedCostingConfiguration.mockResolvedValue({
      config: loadCostingConfigV1(),
      provenance: { versionId: null },
    });
    const from = vi.fn();
    const { previewCostingDraftAgainstEstimate } = await import('./configurationEstimatePreview');
    await expect(previewCostingDraftAgainstEstimate(
      { from } as unknown as SupabaseClient,
      'draft-1',
      'estimate-1',
      'b'.repeat(64),
    )).rejects.toThrow('draft changed');
    expect(from).not.toHaveBeenCalled();
  });
});
