// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ single: vi.fn(), range: vi.fn() }));
vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseBrowser: () => ({ from: () => ({ select: () => ({
    eq: () => ({ single: database.single }),
    order: () => ({ range: database.range }),
  }) }) }),
  supabaseHostFromUrl: () => 'local-test',
  supabaseRuntimeUrl: () => 'http://localhost',
  supabaseRestUrl: () => 'http://localhost/rest/v1/estimates',
}));

const id = 'est_10000000-0000-4000-8000-000000000001';
function row(inputs: unknown) {
  return { id: id.slice(4), project_id: '10000000-0000-4000-8000-000000000002',
    created_at: '2026-10-20T00:00:00Z', inputs, outputs: {} };
}

beforeEach(() => {
  vi.resetModules();
  database.single.mockReset();
  database.range.mockReset();
});
afterEach(() => vi.doUnmock('@/lib/types/calculator'));

describe('estimate duplication loading boundary', () => {
  it('preserves an existing V2 design without modifying its selections', async () => {
    const inputs = { schemaVersion: 'v2', modules: [{ lengthM: '6.5', projectionM: '3.2' }] };
    database.single.mockResolvedValue({ data: row(inputs), error: null });
    const { duplicateEstimateToDraft } = await import('./duplicateEstimateCommand');
    expect(await duplicateEstimateToDraft(id)).toBe(inputs);
  });

  it('uses the existing legacy migration when duplication needs it', async () => {
    database.single.mockResolvedValue({ data: row({ projectName: 'Legacy source', pergolaStyle: 'pitched',
      houseConnectionType: 'none', lengthM: '7', projectionM: '3', roofMaterial: 'acrylic' }), error: null });
    const { duplicateEstimateToDraft } = await import('./duplicateEstimateCommand');
    expect(await duplicateEstimateToDraft(id)).toMatchObject({ schemaVersion: 'v2', projectName: 'Legacy source',
      modules: [{ pergolaStyle: 'pitched', lengthM: '7', projectionM: '3', roofMaterial: 'acrylic' }] });
  });

  it('retains the unsupported input refusal', async () => {
    database.single.mockResolvedValue({ data: row({ schemaVersion: 'future' }), error: null });
    const { duplicateEstimateToDraft } = await import('./duplicateEstimateCommand');
    await expect(duplicateEstimateToDraft(id)).rejects.toThrow('Estimate inputs are not compatible with this calculator version.');
  });

  it('keeps listing independent of duplication and propagates migration failure', async () => {
    const migrate = vi.fn(() => { throw new Error('Calculator migration failed'); });
    const migrationLoad = vi.fn(() => ({
      isCalculatorInputsV2: () => false,
      isLegacyCalculatorInputsV1: () => true,
      migrateLegacyCalculatorInputsToV2: migrate,
    }));
    vi.doMock('@/lib/types/calculator', migrationLoad);
    database.range.mockResolvedValue({ data: [row({ schemaVersion: 'v2', modules: [] })], error: null });
    database.single.mockResolvedValue({ data: row({ schemaVersion: 'v2', modules: [] }), error: null });
    const repository = await import('./estimatesRepo');
    expect(repository).not.toHaveProperty('duplicateEstimateToDraft');
    const { listAllEstimates } = repository;
    expect(await listAllEstimates()).toHaveLength(1);
    expect(migrationLoad).not.toHaveBeenCalled();
    const { duplicateEstimateToDraft } = await import('./duplicateEstimateCommand');
    await expect(duplicateEstimateToDraft(id)).rejects.toThrow('Calculator migration failed');
    expect(migrationLoad).toHaveBeenCalledOnce();
    expect(migrate).toHaveBeenCalledOnce();
  });

  it('preserves a missing-source error without classifying or migrating inputs', async () => {
    const v2 = vi.fn(), legacy = vi.fn(), migrate = vi.fn();
    vi.doMock('@/lib/types/calculator', () => ({
      isCalculatorInputsV2: v2,
      isLegacyCalculatorInputsV1: legacy,
      migrateLegacyCalculatorInputsToV2: migrate,
    }));
    database.single.mockResolvedValue({ data: null, error: null });
    const { duplicateEstimateToDraft } = await import('./duplicateEstimateCommand');
    await expect(duplicateEstimateToDraft(id)).rejects.toThrow('Estimate not found');
    expect(v2).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
    expect(migrate).not.toHaveBeenCalled();
  });
});
