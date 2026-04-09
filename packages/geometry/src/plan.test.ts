import { describe, expect, it } from 'vitest';
import { buildPlanViewModel, solveAssembly3D } from '@sp/geometry';
import { getGeometryFixtureCase } from './fixtures';

function requireSupportedFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture || fixture.kind !== 'supported') {
    throw new Error(`Missing supported fixture: ${id}`);
  }
  return fixture;
}

describe('buildPlanViewModel', () => {
  it('produces stable projected output for mono, gable, and box fixtures', () => {
    const fixtureIds = ['mono_attached_soffit_away_standard', 'gable_attached_standard', 'box_attached_standard'] as const;

    for (const fixtureId of fixtureIds) {
      const fixture = requireSupportedFixture(fixtureId);
      const solved = solveAssembly3D(fixture.config);
      if (!solved.ok) {
        throw new Error(solved.error);
      }

      const plan = buildPlanViewModel(solved.value);
      expect(plan.extents.lengthMm, fixtureId).toBe(fixture.config.dimensions.lengthMm);
      expect(plan.extents.projectionMm, fixtureId).toBe(fixture.config.dimensions.projectionMm);
      expect(plan.outline.every((point) => point.x >= 0 && point.y >= 0), fixtureId).toBe(true);
    }
  });

  it('matches projected attachment-edge presence to connection type', () => {
    const attachedFixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const attached = solveAssembly3D(attachedFixture.config);
    if (!attached.ok) {
      throw new Error(attached.error);
    }

    const freestandingFixture = requireSupportedFixture('mono_freestanding_standard');
    const freestanding = solveAssembly3D(freestandingFixture.config);
    if (!freestanding.ok) {
      throw new Error(freestanding.error);
    }

    expect(buildPlanViewModel(attached.value).attachmentEdge).not.toBeNull();
    expect(buildPlanViewModel(freestanding.value).attachmentEdge).toBeNull();
  });

  it('remains deterministic regardless of source member ordering', () => {
    const fixture = requireSupportedFixture('gable_freestanding_standard');
    const solved = solveAssembly3D(fixture.config);
    if (!solved.ok) {
      throw new Error(solved.error);
    }

    const reordered = structuredClone(solved.value);
    reordered.members.reverse();
    reordered.roofPlanes.reverse();
    reordered.roofCladdingPanels.reverse();

    expect(buildPlanViewModel(reordered)).toEqual(buildPlanViewModel(solved.value));
  });

  it('projects fall semantics from roof planes', () => {
    const monoFixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const mono = solveAssembly3D(monoFixture.config);
    if (!mono.ok) {
      throw new Error(mono.error);
    }

    const gableFixture = requireSupportedFixture('gable_attached_standard');
    const gable = solveAssembly3D(gableFixture.config);
    if (!gable.ok) {
      throw new Error(gable.error);
    }

    expect(buildPlanViewModel(mono.value).anchors.fall?.direction.y).toBeGreaterThan(0);
    expect(buildPlanViewModel(gable.value).anchors.fall?.dual).toBe(true);
  });
});
