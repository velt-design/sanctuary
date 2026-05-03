import { describe, expect, it } from 'vitest';
import { listParityCriticalSanctuaryGeometryWorkbenchFixtures } from './sanctuaryWorkbenchFixtures';
import { buildWorkbenchFixturePricingReadiness } from './workbenchFixturePricingReadiness';

describe('workbench fixture pricing readiness', () => {
  it('reports eligible workbench-solved readiness for every parity-critical fixture', () => {
    const fixtures = listParityCriticalSanctuaryGeometryWorkbenchFixtures();

    expect(fixtures.map((fixture) => fixture.slug)).toEqual([
      'mono-standard',
      'gable-standard',
      'box-standard',
      'gable-u-hipped-screenshot',
      'mono-join-screenshot',
    ]);

    for (const fixture of fixtures) {
      const readiness = buildWorkbenchFixturePricingReadiness(fixture, {
        projectId: 'fixture-roof',
      });

      expect(readiness.source, fixture.slug).toBe('workbench_solved');
      expect(readiness.trustStatus, fixture.slug).toBe('ready');
      expect(readiness.readiness, fixture.slug).toBe('eligible');
      expect(readiness.blockingGateCodes, fixture.slug).toEqual([]);
      expect(readiness.quantityTakeoffSource, fixture.slug).toBe('solved_geometry_spine');
      expect(readiness.parity.pergolasCompared, fixture.slug).toBeGreaterThan(0);
      expect(readiness.parity.modulesCompared, fixture.slug).toBeGreaterThan(0);
      expect(readiness.parity.blockingDifferences, fixture.slug).toBe(0);
      expect(readiness.readinessReport.eligibleToEnable, fixture.slug).toBe(true);
    }
  });
});
