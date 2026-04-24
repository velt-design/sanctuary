import { describe, expect, it } from 'vitest';
import { buildSectionViewModel, solveAssembly3D, type GeometryConfig, type HouseAttachmentStrategy, type Polygon3 } from '@sp/geometry';
import { getGeometryFixtureCase } from './fixtures';

function requireSupportedFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture || fixture.kind !== 'supported') {
    throw new Error(`Missing supported fixture: ${id}`);
  }
  return fixture;
}

function buildSectionFromFixture(id: string) {
  const fixture = requireSupportedFixture(id);
  const solved = solveAssembly3D(fixture.config);
  if (!solved.ok) {
    throw new Error(solved.error);
  }
  return buildSectionViewModel(solved.value);
}

function houseStrategyFromConnection(connectionType: GeometryConfig['connection']['type']): HouseAttachmentStrategy {
  if (connectionType === 'soffit') return 'soffit_brackets';
  if (connectionType === 'fascia') return 'fascia_under_gutter';
  if (connectionType === 'wall') return 'facade_ledger';
  return 'none';
}

function makePlacedHouseFootprint(input: { offsetX: number; width: number; facadeY: number; depth: number }): Polygon3 {
  return [
    { x: input.offsetX, y: input.facadeY - input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY - input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY, z: 0 },
    { x: input.offsetX, y: input.facadeY, z: 0 },
  ];
}

function makeRecessedHouseFootprint(): Polygon3 {
  return [
    { x: -1000, y: -2600, z: 0 },
    { x: 7000, y: -2600, z: 0 },
    { x: 7000, y: -400, z: 0 },
    { x: -1000, y: -400, z: 0 },
    { x: -1000, y: -1400, z: 0 },
    { x: -2000, y: -1400, z: 0 },
    { x: -2000, y: -2600, z: 0 },
  ];
}

function withHouseModel(config: GeometryConfig, input: { footprint?: Polygon3 } = {}): GeometryConfig {
  const next = structuredClone(config);
  const footprint: Polygon3 =
    input.footprint ?? [
      { x: 0, y: -1800, z: 0 },
      { x: next.dimensions.lengthMm, y: -1800, z: 0 },
      { x: next.dimensions.lengthMm, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
  const strategy = houseStrategyFromConnection(next.connection.type);
  next.houseContext = {
    ...next.houseContext,
    footprint,
    attachmentStrategy: strategy,
    model: {
      footprint,
      storeyMode: 'single_storey',
      wallConstruction: 'timber_frame',
      roofForm: 'hipped',
      eaveHeightMm: next.structural.heights.referenceUndersideMm ?? 2400,
      wallHeightMm: (next.structural.heights.referenceUndersideMm ?? 2400) + 600,
      roofPitchDeg: 25,
      attachmentStrategy: strategy,
      eave: {
        soffitDepthMm: 450,
        fasciaHeightMm: 180,
        gutterWidthMm: 125,
        gutterDepthMm: 90,
        gutterProjectionMm: 125,
        eaveOverhangMm: 450,
      },
    },
  };
  return next;
}

function buildSectionFromHouseFixture(id: string) {
  const fixture = requireSupportedFixture(id);
  const solved = solveAssembly3D(withHouseModel(fixture.config));
  if (!solved.ok) {
    throw new Error(solved.error);
  }
  return buildSectionViewModel(solved.value);
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

  it('projects semantic house model context into section slices', () => {
    const section = buildSectionFromHouseFixture('mono_attached_soffit_away_standard');

    expect(section.house.referenceLine).not.toBeNull();
    expect(section.house.surfaces?.map((surface) => surface.kind)).toEqual(
      expect.arrayContaining(['wall', 'roof', 'soffit', 'fascia']),
    );
    expect(section.house.lines?.map((line) => line.kind)).toEqual(
      expect.arrayContaining(['house_reference', 'roof_feature', 'gutter', 'attachment_target']),
    );
    expect(section.extents.minProjectionMm).toBeLessThan(0);
    expect(section.extents.maxHeightMm).toBeGreaterThanOrEqual(section.metrics.leftEdgeHeightMm ?? 0);
  });

  it('projects fascia-under-gutter attachment zone sections', () => {
    const section = buildSectionFromHouseFixture('mono_attached_fascia_toward_standard');

    expect(section.house.surfaces?.some((surface) => surface.kind === 'attachment_zone')).toBe(true);
    expect(section.house.lines?.some((line) => line.kind === 'attachment_target')).toBe(true);
  });

  it('projects semantic attachment targets onto moved house facades in section view', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solved = solveAssembly3D(
      withHouseModel(fixture.config, {
        footprint: makePlacedHouseFootprint({
          offsetX: -1000,
          width: 8000,
          facadeY: -400,
          depth: 2000,
        }),
      }),
    );
    if (!solved.ok) {
      throw new Error(solved.error);
    }

    const section = buildSectionViewModel(solved.value);
    const attachmentTarget = section.house.lines?.find((line) => line.kind === 'attachment_target');

    expect(solved.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2400 },
      end: { x: 6000, y: 0, z: 2400 },
    });
    expect(attachmentTarget?.line).toEqual({
      start: { x: -400, y: 2400 },
      end: { x: -400, y: 2400 },
    });
  });

  it('projects joined recessed house roofs into section view', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solved = solveAssembly3D(withHouseModel(fixture.config, { footprint: makeRecessedHouseFootprint() }));
    if (!solved.ok) {
      throw new Error(solved.error);
    }

    const section = buildSectionViewModel(solved.value);
    const roofSurfaces = section.house.surfaces?.filter((surface) => surface.kind === 'roof') ?? [];
    const roofFeatures = section.house.lines?.filter((line) => line.kind === 'roof_feature') ?? [];

    expect(solved.value.house.model?.metadata?.roofGeometry).toBe('rectilinear_joined_hipped');
    expect(solved.value.house.model?.metadata?.roofFacetMergeMode).toBe('active_rectilinear_wavefront');
    expect(solved.value.house.model?.metadata?.roofFallbackFeatureCount).toBe(0);
    expect(solved.value.house.model?.roofPlanes.every((plane) => !plane.id.includes('house-roof-wing'))).toBe(true);
    expect(roofSurfaces.length).toBeGreaterThan(0);
    expect(roofSurfaces.every((surface) => !surface.id.includes('house-roof-wing'))).toBe(true);
    expect(roofFeatures.some((feature) => feature.metadata?.roofGeometry === 'rectilinear_joined_hipped')).toBe(true);
    expect(roofFeatures.every((feature) => feature.metadata?.roofFeatureSource === 'facet_adjacency')).toBe(true);
  });

  it('omits semantic house objects for freestanding section views', () => {
    const section = buildSectionFromFixture('mono_freestanding_standard');

    expect(section.house.referenceLine).toBeNull();
    expect(section.house.surfaces).toEqual([]);
    expect(section.house.lines).toEqual([]);
  });
});
