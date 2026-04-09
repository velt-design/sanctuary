import { describe, expect, it } from 'vitest';
import { buildSectionViewModel, solveAssembly3D } from '@sp/geometry';
import { getGeometryFixtureCase } from './fixtures';

function requireSupportedFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture || fixture.kind !== 'supported') {
    throw new Error(`Missing supported fixture: ${id}`);
  }
  return fixture;
}

describe('buildSectionViewModel', () => {
  it('produces stable projected output for mono, gable, and box fixtures', () => {
    const fixtureIds = ['mono_attached_soffit_away_standard', 'gable_attached_standard', 'box_attached_standard'] as const;

    for (const fixtureId of fixtureIds) {
      const fixture = requireSupportedFixture(fixtureId);
      const solved = solveAssembly3D(fixture.config);
      if (!solved.ok) {
        throw new Error(solved.error);
      }

      const section = buildSectionViewModel(solved.value);
      expect(section.metrics.spanMm, fixtureId).toBe(fixture.config.dimensions.projectionMm);
      expect(section.sliceXMm, fixtureId).toBe(fixture.config.dimensions.lengthMm / 2);
      expect(section.extents.maxHeightMm, fixtureId).toBeGreaterThan(0);
    }
  });

  it('matches eave and ridge heights from solved geometry', () => {
    const monoFixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const mono = solveAssembly3D(monoFixture.config);
    if (!mono.ok) throw new Error(mono.error);
    const monoSection = buildSectionViewModel(mono.value);
    expect(monoSection.metrics.leftEdgeHeightMm).toBe(2400);
    expect(monoSection.metrics.rightEdgeHeightMm).toBe(2137);
    expect(monoSection.metrics.ridgeHeightMm).toBeNull();

    const gableFixture = requireSupportedFixture('gable_attached_standard');
    const gable = solveAssembly3D(gableFixture.config);
    if (!gable.ok) throw new Error(gable.error);
    const gableSection = buildSectionViewModel(gable.value);
    expect(gableSection.metrics.leftEdgeHeightMm).toBe(2700);
    expect(gableSection.metrics.rightEdgeHeightMm).toBe(2700);
    expect(gableSection.metrics.ridgeHeightMm).toBeGreaterThan(2700);
  });

  it('preserves fall semantics for mono and box sections', () => {
    const monoFixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const mono = solveAssembly3D(monoFixture.config);
    if (!mono.ok) throw new Error(mono.error);
    const monoSection = buildSectionViewModel(mono.value);
    expect(monoSection.anchors.pitch?.fallDirection).toBe('negativeY');

    const boxFixture = requireSupportedFixture('box_attached_standard');
    const box = solveAssembly3D(boxFixture.config);
    if (!box.ok) throw new Error(box.error);
    const boxSection = buildSectionViewModel(box.value);
    expect(boxSection.metrics.boxRiseMm).toBeGreaterThan(0);
    expect(boxSection.sectionKind).toBe('mono');
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

    expect(buildSectionViewModel(reordered)).toEqual(buildSectionViewModel(solved.value));
  });
});
