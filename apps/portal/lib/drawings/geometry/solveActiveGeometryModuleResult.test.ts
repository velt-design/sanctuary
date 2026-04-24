import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { resolveCalculatorInputsFromSnapshot } from '@/lib/estimates/drawingEdits';
import { solveActiveGeometryModuleResult } from './solveActiveGeometryModuleResult';

function requireFixture(slug: 'mono-standard' | 'gable-standard' | 'box-standard') {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) {
    throw new Error(`Missing fixture ${slug}`);
  }
  return fixture;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('solveActiveGeometryModuleResult', () => {
  it.each(['mono-standard', 'gable-standard', 'box-standard'] as const)(
    'solves %s geometry directly from current module inputs without using the fetch wrapper',
    (slug) => {
      const fixture = requireFixture(slug);
      const calculatorInputs = resolveCalculatorInputsFromSnapshot(fixture.snapshot);
      if (!calculatorInputs) {
        throw new Error('Expected calculator inputs from fixture snapshot.');
      }

      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = solveActiveGeometryModuleResult({
        calculatorInputs,
        moduleIndex: 0,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.moduleResult.derived.length_m).toBeGreaterThan(0);
      expect(result.moduleResult.derived.rafter_count).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('uses current draft-like module inputs instead of stale snapshot values', () => {
    const fixture = requireFixture('mono-standard');
    const calculatorInputs = resolveCalculatorInputsFromSnapshot(fixture.snapshot);
    if (!calculatorInputs) {
      throw new Error('Expected calculator inputs from fixture snapshot.');
    }

    calculatorInputs.modules[0]!.lengthM = '6.4';
    calculatorInputs.modules[0]!.roofPitchDeg = '10';

    const result = solveActiveGeometryModuleResult({
      calculatorInputs,
      moduleIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.moduleResult.derived.length_m).toBe(6.4);
    expect(result.moduleResult.derived.roof_pitch_deg_used).toBe(10);
  });

  it('returns an error when the selected module is unavailable', () => {
    const fixture = requireFixture('mono-standard');
    const calculatorInputs = resolveCalculatorInputsFromSnapshot(fixture.snapshot);
    if (!calculatorInputs) {
      throw new Error('Expected calculator inputs from fixture snapshot.');
    }

    const result = solveActiveGeometryModuleResult({
      calculatorInputs,
      moduleIndex: 99,
    });

    expect(result).toEqual({
      ok: false,
      message: 'The selected module is not available for local 3D geometry preview.',
    });
  });
});
