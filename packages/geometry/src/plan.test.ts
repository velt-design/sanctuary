import { describe, expect, it } from 'vitest';
import { solveAssembly3D, type GeometryConfig, type HouseAttachmentStrategy, type Polygon3 } from '@sp/geometry';
import { buildPlanViewModel } from './plan';
import { getGeometryFixtureCase } from './fixtures';

function requireSupportedFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture || fixture.kind !== 'supported') {
    throw new Error(`Missing supported fixture: ${id}`);
  }
  return fixture;
}

function buildPlanFromFixture(id: string) {
  const fixture = requireSupportedFixture(id);
  const solved = solveAssembly3D(fixture.config);
  if (!solved.ok) {
    throw new Error(solved.error);
  }
  return buildPlanViewModel(solved.value);
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

function makeFrontHouseFootprint(input: { offsetX: number; width: number; facadeY: number; depth: number }): Polygon3 {
  return [
    { x: input.offsetX, y: input.facadeY + input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY + input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY, z: 0 },
    { x: input.offsetX, y: input.facadeY, z: 0 },
  ];
}

function makeLeftHouseFootprint(input: { offsetY: number; width: number; facadeX: number; depth: number }): Polygon3 {
  return [
    { x: input.facadeX - input.depth, y: input.offsetY, z: 0 },
    { x: input.facadeX - input.depth, y: input.offsetY + input.width, z: 0 },
    { x: input.facadeX, y: input.offsetY + input.width, z: 0 },
    { x: input.facadeX, y: input.offsetY, z: 0 },
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
      wallHeightMm: next.structural.heights.referenceUndersideMm ?? 2400,
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

function buildPlanFromHouseFixture(id: string) {
  const fixture = requireSupportedFixture(id);
  const solved = solveAssembly3D(withHouseModel(fixture.config));
  if (!solved.ok) {
    throw new Error(solved.error);
  }
  return buildPlanViewModel(solved.value);
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

  it('projects semantic house model context while preserving legacy house references', () => {
    const plan = buildPlanFromHouseFixture('mono_attached_soffit_away_standard');

    expect(plan.house.footprint).not.toBeNull();
    expect(plan.house.roofEdgeLine).not.toBeNull();
    expect(plan.house.wallReferenceLine).not.toBeNull();
    expect(plan.house.surfaces?.map((surface) => surface.kind)).toEqual(
      expect.arrayContaining(['footprint', 'roof', 'soffit', 'fascia']),
    );
    expect(plan.house.lines?.map((line) => line.kind)).toEqual(
      expect.arrayContaining(['wall_segment', 'roof_feature', 'gutter', 'attachment_target']),
    );
  });

  it('projects fascia-under-gutter attachment zones in plan view', () => {
    const plan = buildPlanFromHouseFixture('mono_attached_fascia_toward_standard');

    expect(plan.house.surfaces?.some((surface) => surface.kind === 'attachment_zone')).toBe(true);
    expect(plan.house.lines?.some((line) => line.kind === 'attachment_target')).toBe(true);
  });

  it('projects semantic attachment targets onto moved house facades in plan view', () => {
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

    const plan = buildPlanViewModel(solved.value);
    const attachmentTarget = plan.house.lines?.find((line) => line.kind === 'attachment_target');

    expect(plan.attachmentEdge).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 6000, y: 0 },
    });
    expect(attachmentTarget?.line).toEqual({
      start: { x: 0, y: -400 },
      end: { x: 6000, y: -400 },
    });
  });

  it('projects joined roof features for recessed house footprints in plan view', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solved = solveAssembly3D(withHouseModel(fixture.config, { footprint: makeRecessedHouseFootprint() }));
    if (!solved.ok) {
      throw new Error(solved.error);
    }

    const plan = buildPlanViewModel(solved.value);
    const roofSurfaces = plan.house.surfaces?.filter((surface) => surface.kind === 'roof') ?? [];
    const roofFeatures = plan.house.lines?.filter((line) => line.kind === 'roof_feature') ?? [];

    expect(solved.value.house.model?.metadata?.roofGeometry).toBe('rectilinear_joined_hipped');
    expect(solved.value.house.model?.metadata?.roofFacetMergeMode).toBe('source_edge_envelope');
    expect(solved.value.house.model?.roofPlanes.every((plane) => !plane.id.includes('house-roof-wing'))).toBe(true);
    expect(roofSurfaces.length).toBeGreaterThan(0);
    expect(roofSurfaces.every((surface) => !surface.id.includes('house-roof-wing'))).toBe(true);
    expect(roofFeatures.map((feature) => feature.metadata?.kind)).toEqual(expect.arrayContaining(['ridge', 'hip', 'valley']));
    expect(roofFeatures.every((feature) => feature.metadata?.roofGeometry === 'rectilinear_joined_hipped')).toBe(true);
    expect(solved.value.house.model?.metadata?.roofFallbackFeatureCount).toBe(0);
    expect(roofFeatures.every((feature) => feature.metadata?.roofFeatureSource === 'facet_adjacency')).toBe(true);
  });

  it('projects semantic house overlays onto front-side house context in plan view', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const config: GeometryConfig = {
      ...fixture.config,
      connection: {
        ...fixture.config.connection,
        attachmentSide: 'front',
      },
    };
    const solved = solveAssembly3D(
      withHouseModel(config, {
        footprint: makeFrontHouseFootprint({
          offsetX: -1000,
          width: 8000,
          facadeY: 3400,
          depth: 2000,
        }),
      }),
    );
    if (!solved.ok) {
      throw new Error(solved.error);
    }

    const plan = buildPlanViewModel(solved.value);
    const attachmentTarget = plan.house.lines?.find((line) => line.kind === 'attachment_target');
    const footprintSurface = plan.house.surfaces?.find((surface) => surface.kind === 'footprint');

    expect(plan.attachmentEdge).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 6000, y: 0 },
    });
    expect(attachmentTarget?.line).toEqual({
      start: { x: 0, y: 3400 },
      end: { x: 6000, y: 3400 },
    });
    expect(Math.max(...(footprintSurface?.boundary.map((point) => point.y) ?? []))).toBe(5400);
  });

  it('projects semantic house overlays onto side attachment house context in plan view', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const config: GeometryConfig = {
      ...fixture.config,
      connection: {
        ...fixture.config.connection,
        attachmentSide: 'left',
      },
    };
    const solved = solveAssembly3D(
      withHouseModel(config, {
        footprint: makeLeftHouseFootprint({
          offsetY: 500,
          width: 2000,
          facadeX: -300,
          depth: 1200,
        }),
      }),
    );
    if (!solved.ok) {
      throw new Error(solved.error);
    }

    const plan = buildPlanViewModel(solved.value);
    const attachmentTarget = plan.house.lines?.find((line) => line.kind === 'attachment_target');
    const footprintSurface = plan.house.surfaces?.find((surface) => surface.kind === 'footprint');

    expect(attachmentTarget?.line).toEqual({
      start: { x: -300, y: 500 },
      end: { x: -300, y: 2500 },
    });
    expect(Math.min(...(footprintSurface?.boundary.map((point) => point.x) ?? []))).toBe(-1500);
  });

  it('omits semantic house objects for freestanding plan views', () => {
    const plan = buildPlanFromFixture('mono_freestanding_standard');

    expect(plan.house.footprint).toBeNull();
    expect(plan.house.surfaces).toEqual([]);
    expect(plan.house.lines).toEqual([]);
  });
});
