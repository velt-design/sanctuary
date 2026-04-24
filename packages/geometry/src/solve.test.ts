import { describe, expect, it } from "vitest";
import {
  solveAssembly3D,
  type GeometryConfig,
  type HouseAttachmentStrategy,
  type Polygon3,
} from "@sp/geometry";
import {
  dotProduct,
  lineLength,
  normalizeVector,
  subtractPoints,
} from "./math3d";
import { parseAssemblyMemberProfile } from "./profiles";

function buildMonoRoofCovering(
  input: {
    dimensions: GeometryConfig["dimensions"];
    roof: GeometryConfig["roof"];
    connection: GeometryConfig["connection"];
    structural: GeometryConfig["structural"];
  },
  overrides: Partial<GeometryConfig["roofCovering"]> = {},
): GeometryConfig["roofCovering"] {
  const referenceProfile =
    input.connection.type === "freestanding"
      ? (input.structural.profiles.supportBeam ??
        input.structural.profiles.ledger)
      : (input.structural.profiles.ledger ??
        input.structural.profiles.supportBeam);
  const supportBeamProfile = input.structural.profiles.supportBeam;
  const gutterProfile = input.structural.profiles.gutter;
  const supportBeamWidthMm = supportBeamProfile?.widthMm ?? 50;
  const referenceWidthMm = referenceProfile?.widthMm ?? 50;
  const gutterWidthMm = gutterProfile?.widthMm ?? 100;
  const referenceDepthMm = referenceProfile?.depthMm ?? 100;
  const gutterDepthMm = gutterProfile?.depthMm ?? 150;
  const houseAllowanceMm =
    overrides.houseAllowanceMm ??
    (input.roof.fallDirection === "negativeY"
      ? gutterWidthMm
      : referenceWidthMm);
  const farAllowanceMm =
    overrides.farAllowanceMm ??
    (input.roof.fallDirection === "negativeY"
      ? supportBeamWidthMm
      : input.structural.drainage.integratedGutterBeam
        ? gutterWidthMm
        : input.structural.drainage.gutterAssemblyMode === "separate"
          ? supportBeamWidthMm + gutterWidthMm
          : supportBeamWidthMm);
  const houseUndersideMm =
    input.structural.heights.referenceUndersideMm ??
    input.structural.heights.houseUndersideMm ??
    2400;
  const outerUndersideMm = input.structural.heights.outerUndersideMm ?? 2137;
  const startBearingY = referenceWidthMm;
  const endBearingY = Math.max(
    input.dimensions.projectionMm - gutterWidthMm,
    startBearingY,
  );
  const houseTopMm = houseUndersideMm + referenceDepthMm;
  const outerTopMm = outerUndersideMm + gutterDepthMm;
  const fallRunMm = endBearingY - startBearingY;
  const fallRiseMm = outerTopMm - houseTopMm;
  const fallLengthMm = Math.sqrt(
    fallRunMm * fallRunMm + fallRiseMm * fallRiseMm,
  );
  const fallDirectionSign = input.roof.fallDirection === "negativeY" ? -1 : 1;
  const normalizedFallY =
    fallLengthMm > 0 ? (fallDirectionSign * fallRunMm) / fallLengthMm : 0;
  const normalizedFallZ =
    fallLengthMm > 0
      ? (input.roof.fallDirection === "negativeY"
          ? houseTopMm - outerTopMm
          : outerTopMm - houseTopMm) / fallLengthMm
      : 0;
  const coverHouseY = startBearingY - normalizedFallY * houseAllowanceMm;
  const coverHouseZ = houseTopMm - normalizedFallZ * houseAllowanceMm;
  const coverFarY = endBearingY + normalizedFallY * farAllowanceMm;
  const coverFarZ = outerTopMm + normalizedFallZ * farAllowanceMm;
  const effectiveRunMm =
    overrides.effectiveRunMm ??
    Math.max(
      input.dimensions.projectionMm - houseAllowanceMm - farAllowanceMm,
      0,
    );
  const panelDownslopeMm = Math.round(
    Math.sqrt((coverFarY - coverHouseY) ** 2 + (coverFarZ - coverHouseZ) ** 2),
  );
  const structuralDownslopeMm = Math.round(
    Math.sqrt(
      (endBearingY - startBearingY) ** 2 + (outerTopMm - houseTopMm) ** 2,
    ),
  );
  const joinerRunsTotal =
    overrides.joinerRunsTotal ?? input.structural.framing.rafterCount ?? 11;
  const acrylicRequiredDownslopeMm =
    overrides.acrylicRequiredDownslopeMm ?? structuralDownslopeMm + 20;
  return {
    kind: "acrylic",
    effectiveRunMm,
    acrylicRequiredDownslopeMm,
    joinerPieceLengthMm:
      overrides.joinerPieceLengthMm ?? acrylicRequiredDownslopeMm,
    joinerRunsTotal,
    houseAllowanceMm,
    farAllowanceMm,
    acrylicAreaMm2:
      overrides.acrylicAreaMm2 ?? input.dimensions.lengthMm * panelDownslopeMm,
  };
}

function makeMonoConfig(
  overrides: Partial<GeometryConfig> = {},
): GeometryConfig {
  const spGutterProfile = parseAssemblyMemberProfile("SP Gutter");
  if (!spGutterProfile) {
    throw new Error("Expected SP Gutter profile definition.");
  }
  const base: GeometryConfig = {
    projectId: "proj_mono",
    estimateId: "est_mono",
    designRequestId: "dpr_mono",
    family: "mono",
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: 6000, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 6000,
      projectionMm: 3000,
      roofPitchDeg: 5,
    },
    roof: {
      material: "acrylic",
      mode: null,
      fallDirection: "positiveY",
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    roofCovering: {
      kind: "acrylic",
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    box: {
      houseEdgeGutterMode: null,
      farEdgeGutterMode: null,
      houseSetbackMm: null,
      outerSetbackMm: null,
      effectiveRunMm: null,
      riseMm: null,
      maxFallMm: null,
    },
    connection: {
      type: "soffit",
      attachmentSide: "rear",
    },
    supports: {
      postMode: "standard",
      postCount: 2,
      postPositions: undefined,
      postCutHeightMm: 2400,
      footingType: "slab",
      postConnectionType: "slab_anchors",
      groundCondition: "easy",
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: 2400,
        outerUndersideMm: 2137,
        referenceUndersideMm: 2400,
      },
      profiles: {
        post: { shape: "rectangular", widthMm: 90, depthMm: 90 },
        rafter: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        ledger: { shape: "rectangular", widthMm: 50, depthMm: 100 },
        supportBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        gutter: spGutterProfile,
        ridge: null,
        boxPerimeter: null,
      },
      framing: {
        rafterCount: 11,
        rafterSpacingMm: 600,
      },
      drainage: {
        gutterType: "sp_gutter",
        gutterAssemblyMode: "integrated",
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint: null,
    },
  };

  const mergedBase = {
    ...base,
    ...overrides,
    datum: { ...base.datum, ...overrides.datum },
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    gable: { ...base.gable, ...overrides.gable },
    box: { ...base.box, ...overrides.box },
    connection: { ...base.connection, ...overrides.connection },
    supports: { ...base.supports, ...overrides.supports },
    structural: {
      heights: { ...base.structural.heights, ...overrides.structural?.heights },
      profiles: {
        ...base.structural.profiles,
        ...overrides.structural?.profiles,
      },
      framing: { ...base.structural.framing, ...overrides.structural?.framing },
      drainage: {
        ...base.structural.drainage,
        ...overrides.structural?.drainage,
      },
    },
    houseContext: { ...base.houseContext, ...overrides.houseContext },
  };

  return {
    ...mergedBase,
    roofCovering:
      mergedBase.roof.material === "acrylic"
        ? {
            ...buildMonoRoofCovering(
              {
                dimensions: mergedBase.dimensions,
                roof: mergedBase.roof,
                connection: mergedBase.connection,
                structural: mergedBase.structural,
              },
              overrides.roofCovering,
            ),
            ...overrides.roofCovering,
          }
        : { ...base.roofCovering, ...overrides.roofCovering },
  };
}

function makeGableConfig(
  overrides: Partial<GeometryConfig> = {},
): GeometryConfig {
  const spGutterProfile = parseAssemblyMemberProfile("SP Gutter");
  if (!spGutterProfile) {
    throw new Error("Expected SP Gutter profile definition.");
  }
  const base = makeMonoConfig({
    projectId: "proj_gable",
    estimateId: "est_gable",
    designRequestId: "dpr_gable",
    family: "gable",
    datum: {
      attachmentEdgeEnd: { x: 6500, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 6500,
      projectionMm: 4000,
      roofPitchDeg: 25,
    },
    roof: {
      material: "timber",
      mode: "symmetrical",
      fallDirection: "dual",
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    roofCovering: {
      kind: null,
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: 2000,
      endFramesMode: "none",
      houseEaveGutterMode: "house",
      outerEaveGutterMode: "our",
    },
    connection: {
      type: "soffit",
      attachmentSide: "rear",
    },
    supports: {
      postMode: "standard",
      postCount: 3,
      postPositions: undefined,
      postCutHeightMm: 2700,
      footingType: "slab",
      postConnectionType: "slab_anchors",
      groundCondition: "easy",
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: 2700,
        outerUndersideMm: 2700,
        referenceUndersideMm: 2700,
      },
      profiles: {
        post: { shape: "rectangular", widthMm: 90, depthMm: 90 },
        rafter: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        ledger: { shape: "rectangular", widthMm: 50, depthMm: 100 },
        supportBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        gutter: spGutterProfile,
        ridge: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        tieBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        strut: { shape: "rectangular", widthMm: 50, depthMm: 50 },
      },
      framing: {
        rafterCount: 12,
        rafterSpacingMm: 590,
      },
      drainage: {
        gutterType: "sp_gutter",
        gutterAssemblyMode: "integrated",
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint: null,
    },
  });

  return {
    ...base,
    ...overrides,
    datum: { ...base.datum, ...overrides.datum },
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    roofCovering: { ...base.roofCovering, ...overrides.roofCovering },
    gable: { ...base.gable, ...overrides.gable },
    box: { ...base.box, ...overrides.box },
    connection: { ...base.connection, ...overrides.connection },
    supports: { ...base.supports, ...overrides.supports },
    structural: {
      heights: { ...base.structural.heights, ...overrides.structural?.heights },
      profiles: {
        ...base.structural.profiles,
        ...overrides.structural?.profiles,
      },
      framing: { ...base.structural.framing, ...overrides.structural?.framing },
      drainage: {
        ...base.structural.drainage,
        ...overrides.structural?.drainage,
      },
    },
    houseContext: { ...base.houseContext, ...overrides.houseContext },
  };
}

function makeBoxConfig(
  overrides: Partial<GeometryConfig> = {},
): GeometryConfig {
  const base = makeMonoConfig({
    projectId: "proj_box",
    estimateId: "est_box",
    designRequestId: "dpr_box",
    family: "box",
    datum: {
      attachmentEdgeEnd: { x: 5500, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 5500,
      projectionMm: 3500,
      roofPitchDeg: 3,
    },
    roof: {
      material: "timber",
      mode: "box_perimeter",
      fallDirection: "positiveY",
      boxPerimeterEnabled: true,
      overhangMm: 0,
    },
    roofCovering: {
      kind: null,
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    box: {
      houseEdgeGutterMode: "house",
      farEdgeGutterMode: "our",
      houseSetbackMm: 150,
      outerSetbackMm: 50,
      effectiveRunMm: 3300,
      riseMm: 173,
      maxFallMm: 200,
    },
    connection: {
      type: "soffit",
      attachmentSide: "rear",
    },
    supports: {
      postMode: "standard",
      postCount: 3,
      postPositions: undefined,
      postCutHeightMm: 2500,
      footingType: "slab",
      postConnectionType: "slab_anchors",
      groundCondition: "easy",
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: 2500,
        outerUndersideMm: 2500,
        referenceUndersideMm: 2500,
      },
      profiles: {
        post: { shape: "rectangular", widthMm: 90, depthMm: 90 },
        rafter: { shape: "rectangular", widthMm: 50, depthMm: 80 },
        ledger: { shape: "rectangular", widthMm: 50, depthMm: 100 },
        supportBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        gutter: { shape: "rectangular", widthMm: 100, depthMm: 100 },
        ridge: null,
        boxPerimeter: { shape: "rectangular", widthMm: 50, depthMm: 300 },
      },
      framing: {
        rafterCount: 10,
        rafterSpacingMm: 550,
      },
      drainage: {
        gutterType: "box_gutter_100x100x3",
        gutterAssemblyMode: "integrated",
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint: null,
    },
  });

  return {
    ...base,
    ...overrides,
    datum: { ...base.datum, ...overrides.datum },
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    roofCovering: { ...base.roofCovering, ...overrides.roofCovering },
    gable: { ...base.gable, ...overrides.gable },
    box: { ...base.box, ...overrides.box },
    connection: { ...base.connection, ...overrides.connection },
    supports: { ...base.supports, ...overrides.supports },
    structural: {
      heights: { ...base.structural.heights, ...overrides.structural?.heights },
      profiles: {
        ...base.structural.profiles,
        ...overrides.structural?.profiles,
      },
      framing: { ...base.structural.framing, ...overrides.structural?.framing },
      drainage: {
        ...base.structural.drainage,
        ...overrides.structural?.drainage,
      },
    },
    houseContext: { ...base.houseContext, ...overrides.houseContext },
  };
}

function makeHouseFootprint(lengthMm: number, depthMm = 1800): Polygon3 {
  return [
    { x: 0, y: -depthMm, z: 0 },
    { x: lengthMm, y: -depthMm, z: 0 },
    { x: lengthMm, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
}

function makeSolverHouseContext(input: {
  lengthMm: number;
  eaveHeightMm: number;
  strategy?: HouseAttachmentStrategy;
}): GeometryConfig["houseContext"] {
  const footprint = makeHouseFootprint(input.lengthMm);
  const strategy = input.strategy ?? "soffit_brackets";

  return {
    wallLine: null,
    fasciaLine: null,
    roofEdgeLine: null,
    soffitDepthMm: 450,
    footprint,
    attachmentStrategy: strategy,
    model: {
      footprint,
      storeyMode: "single_storey",
      wallConstruction: "timber_frame",
      roofForm: "hipped",
      eaveHeightMm: input.eaveHeightMm,
      wallHeightMm: input.eaveHeightMm,
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
}

describe("solveAssembly3D", () => {
  it("builds a complete attached mono assembly", () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2400 },
      end: { x: 6000, y: 0, z: 2400 },
    });
    expect(result.value.members.map((member) => member.role)).toEqual(
      expect.arrayContaining(["ledger", "beam", "gutter", "post", "rafter"]),
    );
    expect(
      result.value.members.filter((member) => member.role === "post"),
    ).toHaveLength(2);
    expect(result.value.roofPlanes).toHaveLength(1);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: "posts.count", quantity: 2, unit: "count" },
        { key: "support_beam.length_mm", quantity: 6000, unit: "mm" },
        { key: "gutter.length_mm", quantity: 6090, unit: "mm" },
        { key: "ledger.length_mm", quantity: 6000, unit: "mm" },
      ]),
    );
  });

  it("threads semantic house model geometry into attached solver outputs", () => {
    const mono = solveAssembly3D(
      makeMonoConfig({
        houseContext: makeSolverHouseContext({
          lengthMm: 6000,
          eaveHeightMm: 2400,
          strategy: "soffit_brackets",
        }),
      }),
    );
    const gable = solveAssembly3D(
      makeGableConfig({
        houseContext: makeSolverHouseContext({
          lengthMm: 6500,
          eaveHeightMm: 2700,
          strategy: "facade_ledger",
        }),
      }),
    );
    const box = solveAssembly3D(
      makeBoxConfig({
        houseContext: makeSolverHouseContext({
          lengthMm: 5500,
          eaveHeightMm: 2500,
          strategy: "fascia_under_gutter",
        }),
      }),
    );

    expect(mono.ok).toBe(true);
    expect(gable.ok).toBe(true);
    expect(box.ok).toBe(true);
    if (!mono.ok || !gable.ok || !box.ok) return;

    expect(mono.value.roofPlanes).toHaveLength(1);
    expect(gable.value.roofPlanes).toHaveLength(2);
    expect(box.value.roofPlanes).toHaveLength(1);
    expect(mono.value.house.model?.wallSegments).toHaveLength(4);
    expect(gable.value.house.model?.roofPlanes).toHaveLength(4);
    expect(box.value.house.model?.eave.gutterLines).toHaveLength(4);
    expect(mono.value.house.attachmentTarget?.kind).toBe("line");
    expect(gable.value.house.attachmentTarget?.kind).toBe("plane");
    expect(box.value.house.attachmentTarget?.kind).toBe("zone");
    expect(mono.value.members.filter((member) => member.role === "post")).toHaveLength(2);
    expect(gable.value.members.filter((member) => member.role === "post")).toHaveLength(3);
    expect(box.value.members.filter((member) => member.role === "post")).toHaveLength(3);
    expect(mono.value.quantityHooks).toEqual(
      expect.arrayContaining([{ key: "ledger.length_mm", quantity: 6000, unit: "mm" }]),
    );
    expect(gable.value.quantityHooks).toEqual(
      expect.arrayContaining([{ key: "ridge.length_mm", quantity: 6550, unit: "mm" }]),
    );
    expect(box.value.quantityHooks).toEqual(
      expect.arrayContaining([{ key: "ledger.length_mm", quantity: 5500, unit: "mm" }]),
    );
  });

  it("builds a freestanding mono assembly with no ledger or attachment edge", () => {
    const result = solveAssembly3D(
      makeMonoConfig({
        connection: {
          type: "freestanding",
          attachmentSide: "rear",
        },
        supports: {
          postCount: 4,
        },
        houseContext: makeSolverHouseContext({
          lengthMm: 6000,
          eaveHeightMm: 2400,
          strategy: "soffit_brackets",
        }),
        structural: {
          heights: {
            houseUndersideMm: 2400,
            outerUndersideMm: 2137,
            referenceUndersideMm: 2400,
          },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toBeNull();
    expect(result.value.house.model).toBeNull();
    expect(result.value.house.attachmentTarget).toBeNull();
    expect(
      result.value.members.some((member) => member.role === "ledger"),
    ).toBe(false);
    expect(
      result.value.members.filter((member) => member.role === "beam"),
    ).toHaveLength(2);
    expect(
      result.value.members.filter((member) => member.role === "post"),
    ).toHaveLength(4);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: "posts.count", quantity: 4, unit: "count" },
        { key: "support_beam.length_mm", quantity: 12000, unit: "mm" },
      ]),
    );
  });

  it("produces opposite fall vectors for away-from-house and toward-house mono", () => {
    const away = solveAssembly3D(makeMonoConfig());
    const toward = solveAssembly3D(
      makeMonoConfig({
        roof: {
          fallDirection: "negativeY",
        },
        structural: {
          heights: {
            houseUndersideMm: 2137,
            outerUndersideMm: 2400,
            referenceUndersideMm: 2137,
          },
        },
      }),
    );

    expect(away.ok).toBe(true);
    expect(toward.ok).toBe(true);
    if (!away.ok || !toward.ok) return;

    expect(away.value.roofPlanes[0]?.fallVector.y).toBeGreaterThan(0);
    expect(away.value.roofPlanes[0]?.fallVector.z).toBeLessThan(0);
    expect(toward.value.roofPlanes[0]?.fallVector.y).toBeLessThan(0);
    expect(toward.value.roofPlanes[0]?.fallVector.z).toBeLessThan(0);
  });

  it("places member centerlines and roof plane heights from underside and profile inputs", () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ledger = result.value.members.find(
      (member) => member.id === "ledger",
    );
    const outerBeam = result.value.members.find(
      (member) => member.id === "outer-beam",
    );
    const outerGutter = result.value.members.find(
      (member) => member.id === "outer-gutter",
    );
    const outerPost = result.value.members.find(
      (member) => member.id === "outer-post-1",
    );
    const finalOuterPost = result.value.members.find(
      (member) => member.id === "outer-post-2",
    );
    const roofPlane = result.value.roofPlanes[0];

    expect(ledger?.centerline.start.y).toBe(25);
    expect(ledger?.centerline.start.z).toBe(2450);
    expect(outerBeam?.centerline.start.y).toBe(2875);
    expect(outerBeam?.centerline.start.z).toBe(2212);
    expect(outerBeam?.centerline.start.x).toBe(0);
    expect(outerBeam?.centerline.end.x).toBe(6000);
    expect(outerGutter?.centerline.start.y).toBe(2950);
    expect(outerGutter?.centerline.start.z).toBeCloseTo(2212.284312, 6);
    expect(outerGutter?.centerline.start.x).toBe(-45);
    expect(outerGutter?.centerline.end.x).toBe(6045);
    expect(outerPost?.centerline.start.y).toBe(2950);
    expect(outerPost?.centerline.start.x).toBe(0);
    expect(outerPost?.centerline.end.z).toBe(2137);
    expect(finalOuterPost?.centerline.start.x).toBe(6000);
    expect(roofPlane?.boundary[0]?.z).toBe(2500);
    expect(roofPlane?.boundary[2]?.y).toBeCloseTo(2925.996797, 6);
    expect(roofPlane?.boundary[2]?.z).toBeCloseTo(2285.294198, 6);
  });

  it("positions the mono outer beam behind the gutter while keeping the gutter centerline over the posts", () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const outerBeam = result.value.members.find(
      (member) => member.id === "outer-beam",
    );
    const outerGutter = result.value.members.find(
      (member) => member.id === "outer-gutter",
    );
    const outerPost = result.value.members.find(
      (member) => member.id === "outer-post-1",
    );

    if (!outerBeam || !outerGutter || !outerPost) {
      throw new Error("Expected mono outer beam, gutter, and post.");
    }

    expect(outerBeam.centerline.start.y).toBeLessThan(
      outerGutter.centerline.start.y,
    );
    expect(outerBeam.centerline.start.y).not.toBe(
      outerGutter.centerline.start.y,
    );
    expect(outerPost.centerline.start.y).toBe(outerGutter.centerline.start.y);
    expect(outerPost.centerline.start.y).not.toBe(outerBeam.centerline.start.y);
    expect(outerGutter.centerline.start.x).toBe(
      outerPost.centerline.start.x - outerPost.profile.widthMm / 2,
    );
    expect(outerGutter.centerline.end.x).toBe(6045);
    expect(outerGutter.centerline.end.x - outerGutter.centerline.start.x).toBe(
      6090,
    );
    expect(outerPost.centerline.end.z).toBe(2137);
    expect(
      outerGutter.centerline.start.z - outerPost.centerline.end.z,
    ).toBeCloseTo(75.284312, 6);
    expect(outerGutter.profile.profileKey).toBe("sp_gutter");
    expect(outerGutter.profile.sectionOutline?.length).toBeGreaterThanOrEqual(
      3,
    );
    expect(outerGutter.metadata).toMatchObject({
      bodyInsetStartMm: 3,
      bodyInsetEndMm: 3,
      endCapStartMm: 3,
      endCapEndMm: 3,
      endCapWidthMm: 100,
      endCapDepthMm: 150,
    });
  });

  it("uses explicit SP gutter install anchors instead of generic half-width defaults", () => {
    const gutterProfile = parseAssemblyMemberProfile("SP Gutter");

    expect(gutterProfile?.profileKey).toBe("sp_gutter");
    expect(gutterProfile?.sectionOutline?.length).toBeGreaterThanOrEqual(3);
    expect(gutterProfile?.anchors).toEqual({
      undersideZ: -75.284312,
      topsideZ: 75.284312,
      backFaceY: -50,
      frontFaceY: 50,
      roofBearingFaceY: -24.003203,
      roofBearingFaceZ: 73.009886,
    });
  });

  it("keeps mono rafters on edge and horizontal members with vertical depth axes", () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rafter = result.value.members.find(
      (member) => member.id === "rafter-1",
    );
    const ledger = result.value.members.find(
      (member) => member.id === "ledger",
    );
    const outerBeam = result.value.members.find(
      (member) => member.id === "outer-beam",
    );
    const joiner = result.value.members.find(
      (member) => member.id === "joiner-1",
    );

    expect(rafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(rafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.y).toBeCloseTo(0.074447, 5);
    expect(rafter?.localFrame.zAxis.z).toBeCloseTo(0.997225, 5);

    expect(ledger?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(ledger?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(outerBeam?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(outerBeam?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(joiner?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(joiner?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(joiner?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(joiner?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(joiner?.localFrame.zAxis.y).toBeCloseTo(0.074447, 5);
    expect(joiner?.localFrame.zAxis.z).toBeCloseTo(0.997225, 5);
    expect(joiner?.profile.profileKey).toBe("sp_joiners");
    expect(joiner?.profile.shape).toBe("custom");
    expect(joiner?.profile.widthMm).toBe(50);
    expect(joiner?.profile.depthMm).toBe(16);
    expect(joiner?.profile.sectionOutline).toHaveLength(20);
  });

  it("solves mono acrylic panels as 6 mm slabs centered on the joiner plane with 15 mm gutter embed", () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const roofPlane = result.value.roofPlanes.find(
      (member) => member.id === "mono-roof",
    );
    const joiner = result.value.members.find(
      (member) => member.id === "joiner-1",
    );
    const panel = result.value.roofCladdingPanels.find(
      (member) => member.id === "acrylic-panel-1",
    );

    if (!roofPlane || !joiner || !panel) {
      throw new Error("Expected mono roof plane, joiner, and acrylic panel.");
    }

    const roofNormal = normalizeVector(roofPlane.plane.normal);
    const roofFall = normalizeVector(roofPlane.fallVector);
    const panelPlaneOffset = dotProduct(
      subtractPoints(panel.plane.origin, roofPlane.plane.origin),
      roofNormal,
    );
    const structuralFarPointOnPanelPlane = {
      x: roofPlane.boundary[3]!.x + roofNormal.x * (joiner.profile.depthMm / 2),
      y: roofPlane.boundary[3]!.y + roofNormal.y * (joiner.profile.depthMm / 2),
      z: roofPlane.boundary[3]!.z + roofNormal.z * (joiner.profile.depthMm / 2),
    };
    const farEmbedMm = dotProduct(
      subtractPoints(panel.boundary[3]!, structuralFarPointOnPanelPlane),
      roofFall,
    );

    expect(panel.thicknessMm).toBe(6);
    expect(panel.material).toBe("acrylic");
    expect(panelPlaneOffset).toBeCloseTo(joiner.profile.depthMm / 2, 6);
    expect(farEmbedMm).toBeCloseTo(15, 6);
    expect(
      lineLength({ start: panel.boundary[0]!, end: panel.boundary[3]! }),
    ).toBeCloseTo(Number(panel.metadata?.downslopeLengthMm ?? 0), 1);
    expect(panel.metadata).toMatchObject({
      gutterEmbedMm: 15,
      panelMidPlaneOffsetMm: joiner.profile.depthMm / 2,
    });
  });

  it("keeps mono acrylic house allowance and gutter embed correct when the roof falls back toward the house", () => {
    const result = solveAssembly3D(
      makeMonoConfig({
        connection: {
          type: "fascia",
          attachmentSide: "rear",
        },
        roof: {
          fallDirection: "negativeY",
        },
        structural: {
          heights: {
            houseUndersideMm: 2137,
            outerUndersideMm: 2400,
            referenceUndersideMm: 2137,
          },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const roofPlane = result.value.roofPlanes.find(
      (member) => member.id === "mono-roof",
    );
    const joiner = result.value.members.find(
      (member) => member.id === "joiner-1",
    );
    const panel = result.value.roofCladdingPanels.find(
      (member) => member.id === "acrylic-panel-1",
    );

    if (!roofPlane || !joiner || !panel) {
      throw new Error(
        "Expected fascia-toward mono roof plane, joiner, and acrylic panel.",
      );
    }

    const roofNormal = normalizeVector(roofPlane.plane.normal);
    const roofRun = normalizeVector({
      x: roofPlane.boundary[3]!.x - roofPlane.boundary[0]!.x,
      y: roofPlane.boundary[3]!.y - roofPlane.boundary[0]!.y,
      z: roofPlane.boundary[3]!.z - roofPlane.boundary[0]!.z,
    });
    const structuralHousePointOnPanelPlane = {
      x: roofPlane.boundary[0]!.x + roofNormal.x * (joiner.profile.depthMm / 2),
      y: roofPlane.boundary[0]!.y + roofNormal.y * (joiner.profile.depthMm / 2),
      z: roofPlane.boundary[0]!.z + roofNormal.z * (joiner.profile.depthMm / 2),
    };
    const structuralFarPointOnPanelPlane = {
      x: roofPlane.boundary[3]!.x + roofNormal.x * (joiner.profile.depthMm / 2),
      y: roofPlane.boundary[3]!.y + roofNormal.y * (joiner.profile.depthMm / 2),
      z: roofPlane.boundary[3]!.z + roofNormal.z * (joiner.profile.depthMm / 2),
    };
    const houseAllowanceMm = dotProduct(
      subtractPoints(structuralHousePointOnPanelPlane, panel.boundary[0]!),
      roofRun,
    );
    const farEmbedMm = dotProduct(
      subtractPoints(panel.boundary[3]!, structuralFarPointOnPanelPlane),
      roofRun,
    );

    expect(panel.thicknessMm).toBe(6);
    expect(houseAllowanceMm).toBeCloseTo(100, 6);
    expect(farEmbedMm).toBeCloseTo(15, 6);
    expect(panel.metadata).toMatchObject({
      gutterEmbedMm: 15,
      houseAllowanceMm: 100,
      panelMidPlaneOffsetMm: joiner.profile.depthMm / 2,
    });
  });

  it("keeps post layout deterministic for 2, 3, and 4 attached posts", () => {
    const twoPosts = solveAssembly3D(
      makeMonoConfig({ supports: { postCount: 2 } }),
    );
    const threePosts = solveAssembly3D(
      makeMonoConfig({ supports: { postCount: 3 } }),
    );
    const fourPosts = solveAssembly3D(
      makeMonoConfig({ supports: { postCount: 4 } }),
    );

    expect(twoPosts.ok).toBe(true);
    expect(threePosts.ok).toBe(true);
    expect(fourPosts.ok).toBe(true);
    if (!twoPosts.ok || !threePosts.ok || !fourPosts.ok) return;

    expect(
      twoPosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 6000]);
    expect(
      threePosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 3000, 6000]);
    expect(
      fourPosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 2000, 4000, 6000]);
  });

  it("builds a complete attached gable assembly", () => {
    const result = solveAssembly3D(makeGableConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2700 },
      end: { x: 6500, y: 0, z: 2700 },
    });
    expect(
      result.value.members.some((member) => member.id === "house-gutter"),
    ).toBe(false);
    expect(
      result.value.members.some((member) => member.id === "house-beam"),
    ).toBe(false);
    expect(result.value.roofPlanes).toHaveLength(2);
    expect(
      result.value.members.filter((member) => member.role === "ridge"),
    ).toHaveLength(1);
    expect(
      result.value.members.filter((member) => member.role === "post"),
    ).toHaveLength(3);
    expect(
      result.value.members.filter((member) => member.role === "rafter"),
    ).toHaveLength(24);
    const outerGutter = result.value.members.find(
      (member) => member.id === "outer-gutter",
    );
    const outerBeam = result.value.members.find(
      (member) => member.id === "outer-beam",
    );
    const ridge = result.value.members.find((member) => member.id === "ridge");
    const outerPosts = result.value.members.filter((member) =>
      member.id.startsWith("outer-post"),
    );
    expect(outerGutter?.profile.profileKey).toBe("sp_gutter");
    expect(outerGutter?.centerline.start.x).toBe(-45);
    expect(outerGutter?.centerline.end.x).toBe(6545);
    expect(ridge?.centerline.start.x).toBe(-25);
    expect(ridge?.centerline.end.x).toBe(6525);
    expect(outerGutter?.centerline.start.y).toBe(3950);
    expect(
      outerPosts.every(
        (member) =>
          member.centerline.start.y === outerGutter?.centerline.start.y,
      ),
    ).toBe(true);
    expect(outerBeam?.centerline.start.y).toBeLessThan(
      outerGutter?.centerline.start.y ?? 0,
    );
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: "ridge.length_mm", quantity: 6550, unit: "mm" },
        { key: "house_eave_support.length_mm", quantity: 6500, unit: "mm" },
        { key: "outer_eave_support.length_mm", quantity: 6500, unit: "mm" },
        { key: "outer_gutter.length_mm", quantity: 6590, unit: "mm" },
      ]),
    );
  });

  it("builds a complete freestanding gable assembly", () => {
    const result = solveAssembly3D(
      makeGableConfig({
        connection: {
          type: "freestanding",
          attachmentSide: "rear",
        },
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: "none",
          houseEaveGutterMode: "our",
          outerEaveGutterMode: "our",
        },
        supports: {
          postCount: 4,
        },
        houseContext: makeSolverHouseContext({
          lengthMm: 6500,
          eaveHeightMm: 2700,
          strategy: "facade_ledger",
        }),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toBeNull();
    expect(result.value.house.model).toBeNull();
    expect(result.value.house.attachmentTarget).toBeNull();
    expect(result.value.members.some((member) => member.id === "ledger")).toBe(
      false,
    );
    expect(
      result.value.members.filter((member) => member.role === "beam"),
    ).toHaveLength(2);
    expect(
      result.value.members.filter((member) => member.role === "gutter"),
    ).toHaveLength(2);
    expect(
      result.value.members.filter((member) => member.role === "post"),
    ).toHaveLength(4);
    const houseGutter = result.value.members.find(
      (member) => member.id === "house-gutter",
    );
    const houseBeam = result.value.members.find(
      (member) => member.id === "house-beam",
    );
    const outerGutter = result.value.members.find(
      (member) => member.id === "outer-gutter",
    );
    const outerBeam = result.value.members.find(
      (member) => member.id === "outer-beam",
    );
    const housePosts = result.value.members.filter((member) =>
      member.id.startsWith("house-post"),
    );
    const outerPosts = result.value.members.filter((member) =>
      member.id.startsWith("outer-post"),
    );
    const houseRafter = result.value.members.find(
      (member) => member.id === "house-rafter-1",
    );
    const outerRafter = result.value.members.find(
      (member) => member.id === "outer-rafter-1",
    );
    const ridge = result.value.members.find((member) => member.id === "ridge");
    expect(houseGutter?.profile.profileKey).toBe("sp_gutter");
    expect(outerGutter?.profile.profileKey).toBe("sp_gutter");
    expect(houseGutter?.centerline.start.x).toBe(-45);
    expect(houseGutter?.centerline.end.x).toBe(6545);
    expect(outerGutter?.centerline.start.x).toBe(-45);
    expect(outerGutter?.centerline.end.x).toBe(6545);
    expect(ridge?.centerline.start.x).toBe(-25);
    expect(ridge?.centerline.end.x).toBe(6525);
    expect(
      housePosts.every(
        (member) =>
          member.centerline.start.y === houseGutter?.centerline.start.y,
      ),
    ).toBe(true);
    expect(
      outerPosts.every(
        (member) =>
          member.centerline.start.y === outerGutter?.centerline.start.y,
      ),
    ).toBe(true);
    expect(
      (houseBeam?.centerline.start.y ?? 0) >
        (houseGutter?.centerline.start.y ?? 0),
    ).toBe(true);
    expect(
      (outerBeam?.centerline.start.y ?? 0) <
        (outerGutter?.centerline.start.y ?? 0),
    ).toBe(true);
    const houseGutterInsideY =
      (houseGutter?.centerline.start.y ?? 0) +
      (houseGutter?.profile.anchors?.backFaceY ?? 0);
    const outerGutterInsideY =
      (outerGutter?.centerline.start.y ?? 0) +
      (outerGutter?.profile.anchors?.backFaceY ?? 0);
    const houseRidgeBearingY =
      (ridge?.centerline.start.y ?? 0) - (ridge?.profile.widthMm ?? 0) / 2;
    const outerRidgeBearingY =
      (ridge?.centerline.start.y ?? 0) + (ridge?.profile.widthMm ?? 0) / 2;
    expect(houseRafter?.centerline.start.y).toBeCloseTo(houseGutterInsideY, 6);
    expect(outerRafter?.centerline.end.y).toBeCloseTo(outerGutterInsideY, 6);
    expect(houseRafter?.endCuts).toEqual(
      expect.arrayContaining([
        {
          end: "start",
          plane: {
            normal: { x: 0, y: -1, z: 0 },
            offsetMm: houseGutterInsideY === 0 ? 0 : -houseGutterInsideY,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
        {
          end: "end",
          plane: {
            normal: { x: 0, y: 1, z: 0 },
            offsetMm: houseRidgeBearingY,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
      ]),
    );
    expect(outerRafter?.endCuts).toEqual(
      expect.arrayContaining([
        {
          end: "start",
          plane: {
            normal: { x: 0, y: -1, z: 0 },
            offsetMm: -outerRidgeBearingY,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
        {
          end: "end",
          plane: {
            normal: { x: 0, y: 1, z: 0 },
            offsetMm: outerGutterInsideY,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
      ]),
    );
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: "ridge.length_mm", quantity: 6550, unit: "mm" },
        { key: "house_gutter.length_mm", quantity: 6590, unit: "mm" },
        { key: "outer_gutter.length_mm", quantity: 6590, unit: "mm" },
        { key: "posts.count", quantity: 4, unit: "count" },
      ]),
    );
  });

  it("builds a real attached gable acrylic roof-pack on both roof halves", () => {
    const result = solveAssembly3D(
      makeGableConfig({
        roof: {
          material: "acrylic",
        },
        roofCovering: {
          kind: "acrylic",
          houseAllowanceMm: 50,
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const houseJoiners = result.value.members.filter(
      (member) =>
        member.role === "joiner" && member.metadata?.slope === "house",
    );
    const outerJoiners = result.value.members.filter(
      (member) =>
        member.role === "joiner" && member.metadata?.slope === "outer",
    );
    const housePanels = result.value.roofCladdingPanels.filter(
      (panel) => panel.metadata?.slope === "house",
    );
    const outerPanels = result.value.roofCladdingPanels.filter(
      (panel) => panel.metadata?.slope === "outer",
    );
    const houseRoof = result.value.roofPlanes.find(
      (plane) => plane.id === "gable-house-roof",
    );
    const outerRoof = result.value.roofPlanes.find(
      (plane) => plane.id === "gable-outer-roof",
    );
    const firstHousePanel = housePanels[0];
    const firstOuterPanel = outerPanels[0];
    const firstHouseJoiner = houseJoiners[0];
    const firstOuterJoiner = outerJoiners[0];
    const ridgeFlashing = result.value.roofFlashings?.find(
      (flashing) => flashing.id === "ridge-flashing",
    );

    expect(houseJoiners).toHaveLength(12);
    expect(outerJoiners).toHaveLength(12);
    expect(housePanels).toHaveLength(11);
    expect(outerPanels).toHaveLength(11);
    expect(firstHouseJoiner?.id).toBe("house-joiner-1");
    expect(firstOuterJoiner?.id).toBe("outer-joiner-1");
    expect(firstHouseJoiner?.profile.profileKey).toBe("sp_joiners");
    expect(firstOuterJoiner?.profile.profileKey).toBe("sp_joiners");
    expect(firstHouseJoiner?.endCuts).toEqual([
      {
        end: "end",
        plane: {
          normal: { x: 0, y: 1, z: 0 },
          offsetMm: 1975,
          keepSide: "negative",
        },
        preClipExtensionMm: 50,
      },
    ]);
    expect(firstOuterJoiner?.endCuts).toEqual([
      {
        end: "end",
        plane: {
          normal: { x: 0, y: -1, z: 0 },
          offsetMm: -2025,
          keepSide: "negative",
        },
        preClipExtensionMm: 50,
      },
    ]);
    expect(firstHousePanel?.id).toBe("house-acrylic-panel-1");
    expect(firstOuterPanel?.id).toBe("outer-acrylic-panel-1");
    expect(firstHousePanel?.thicknessMm).toBe(6);
    expect(firstOuterPanel?.thicknessMm).toBe(6);
    expect(firstHousePanel?.metadata).toMatchObject({
      slope: "house",
      gutterEmbedMm: 0,
      houseAllowanceMm: 50,
      ridgeHalfMm: 25,
    });
    expect(firstOuterPanel?.metadata).toMatchObject({
      slope: "outer",
      gutterEmbedMm: 15,
      houseAllowanceMm: 0,
      ridgeHalfMm: 25,
    });
    expect(firstHousePanel?.boundary[2]?.y).toBeLessThan(2000);
    expect(firstOuterPanel?.boundary[2]?.y).toBeGreaterThan(2000);
    expect(firstHouseJoiner?.centerline.end.y).toBe(
      firstHousePanel?.boundary[2]?.y,
    );
    expect(firstOuterJoiner?.centerline.end.y).toBe(
      firstOuterPanel?.boundary[2]?.y,
    );
    expect(firstHousePanel?.plane.origin.z).not.toBe(houseRoof?.plane.origin.z);
    expect(firstOuterPanel?.plane.origin.z).not.toBe(outerRoof?.plane.origin.z);
    expect(ridgeFlashing).toMatchObject({
      id: "ridge-flashing",
      thicknessMm: 1,
      metadata: {
        position: "ridge",
        girthMm: 300,
        wingLengthMm: 150,
        thicknessMm: 1,
        runLengthMm: 6550,
      },
    });
    expect(ridgeFlashing?.wings).toHaveLength(2);
    expect(ridgeFlashing?.wings[0]?.boundary[0]?.x).toBe(-25);
    expect(ridgeFlashing?.wings[0]?.boundary[1]?.x).toBe(6525);
  });

  it("builds a freestanding gable acrylic roof-pack with gutter embed on both eaves", () => {
    const result = solveAssembly3D(
      makeGableConfig({
        roof: {
          material: "acrylic",
        },
        roofCovering: {
          kind: "acrylic",
        },
        connection: {
          type: "freestanding",
          attachmentSide: "rear",
        },
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: "none",
          houseEaveGutterMode: "our",
          outerEaveGutterMode: "our",
        },
        supports: {
          postCount: 4,
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const housePanels = result.value.roofCladdingPanels.filter(
      (panel) => panel.metadata?.slope === "house",
    );
    const outerPanels = result.value.roofCladdingPanels.filter(
      (panel) => panel.metadata?.slope === "outer",
    );
    const housePanel = housePanels[0];
    const outerPanel = outerPanels[0];

    expect(housePanels).toHaveLength(11);
    expect(outerPanels).toHaveLength(11);
    expect(housePanel?.metadata).toMatchObject({
      gutterEmbedMm: 15,
      houseAllowanceMm: 0,
    });
    expect(outerPanel?.metadata).toMatchObject({
      gutterEmbedMm: 15,
      houseAllowanceMm: 0,
    });
    expect(housePanel?.boundary[0]?.y).toBeLessThan(
      housePanel?.boundary[2]?.y ?? Number.NaN,
    );
    expect(outerPanel?.boundary[0]?.y).toBeGreaterThan(
      outerPanel?.boundary[2]?.y ?? Number.NaN,
    );
  });

  it("derives gable ridge height and opposing fall directions from pitch and half-span geometry", () => {
    const result = solveAssembly3D(makeGableConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ridge = result.value.members.find((member) => member.id === "ridge");
    expect(ridge?.centerline.start.y).toBe(2000);
    expect(Math.round(ridge?.centerline.start.z ?? 0)).toBe(3671);
    expect(result.value.roofPlanes[0]?.fallVector.y).toBeLessThan(0);
    expect(result.value.roofPlanes[1]?.fallVector.y).toBeGreaterThan(0);
  });

  it("keeps gable rafters on edge and eave members with vertical depth axes", () => {
    const result = solveAssembly3D(makeGableConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const houseRafter = result.value.members.find(
      (member) => member.id === "house-rafter-1",
    );
    const outerRafter = result.value.members.find(
      (member) => member.id === "outer-rafter-1",
    );
    const ridge = result.value.members.find((member) => member.id === "ridge");
    const outerGutter = result.value.members.find(
      (member) => member.id === "outer-gutter",
    );

    const houseRidgeBearingY =
      (houseRafter?.centerline.end.y ?? 0) +
      (houseRafter?.localFrame.zAxis.y ?? 0) * 75;
    const outerRidgeBearingY =
      (outerRafter?.centerline.start.y ?? 0) +
      (outerRafter?.localFrame.zAxis.y ?? 0) * 75;
    expect(houseRidgeBearingY).toBeCloseTo(1975, 6);
    expect(outerRidgeBearingY).toBeCloseTo(2025, 6);
    expect(houseRidgeBearingY).toBeLessThan(
      ridge?.centerline.start.y ?? Number.NaN,
    );
    expect(outerRidgeBearingY).toBeGreaterThan(
      ridge?.centerline.start.y ?? Number.NaN,
    );

    expect(houseRafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(houseRafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(houseRafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(houseRafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(houseRafter?.localFrame.zAxis.y).toBeCloseTo(-0.422618, 6);
    expect(houseRafter?.localFrame.zAxis.z).toBeCloseTo(0.906308, 6);

    expect(outerRafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(outerRafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(outerRafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(outerRafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(outerRafter?.localFrame.zAxis.y).toBeCloseTo(0.408783, 6);
    expect(outerRafter?.localFrame.zAxis.z).toBeCloseTo(0.912632, 6);

    expect(ridge?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(ridge?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(outerGutter?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(outerGutter?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    const outerGutterInsideY =
      (outerGutter?.centerline.start.y ?? 0) +
      (outerGutter?.profile.anchors?.backFaceY ?? 0);
    expect(houseRafter?.endCuts).toEqual([
      {
        end: "end",
        plane: {
          normal: { x: 0, y: 1, z: 0 },
          offsetMm: 1975,
          keepSide: "negative",
        },
        preClipExtensionMm: 150,
      },
    ]);
    expect(outerRafter?.centerline.end.y).toBeCloseTo(outerGutterInsideY, 6);
    expect(outerRafter?.endCuts).toEqual(
      expect.arrayContaining([
        {
          end: "start",
          plane: {
            normal: { x: 0, y: -1, z: 0 },
            offsetMm: -2025,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
        {
          end: "end",
          plane: {
            normal: { x: 0, y: 1, z: 0 },
            offsetMm: outerGutterInsideY,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
      ]),
    );
  });

  it("adds an outer tie beam and king-post strut for attached gable end frames", () => {
    const result = solveAssembly3D(
      makeGableConfig({
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: "outer_end_only",
          houseEaveGutterMode: "house",
          outerEaveGutterMode: "our",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const tieBeam = result.value.members.find(
      (member) => member.id === "outer-end-tie-beam",
    );
    const strut = result.value.members.find(
      (member) => member.id === "outer-end-king-post-strut",
    );
    expect(tieBeam?.role).toBe("beam");
    expect(tieBeam?.centerline.start.x).toBe(6500);
    expect(tieBeam?.centerline.end.x).toBe(6500);
    expect(tieBeam?.centerline.start.y).toBeLessThan(2000);
    expect(tieBeam?.centerline.end.y).toBeGreaterThan(2000);
    expect(strut?.role).toBe("brace");
    expect(strut?.centerline.start.x).toBe(6500);
    expect(strut?.centerline.start.y).toBe(2000);
    expect(strut?.centerline.end.z).toBeGreaterThan(
      strut?.centerline.start.z ?? Number.NaN,
    );
    expect(
      result.value.quantityHooks.find(
        (hook) => hook.key === "gable_end_frames.count",
      )?.quantity,
    ).toBe(1);
  });

  it("adds tie beams and king-post struts at both ends for attached gable end frames", () => {
    const result = solveAssembly3D(
      makeGableConfig({
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: "both_ends",
          houseEaveGutterMode: "house",
          outerEaveGutterMode: "our",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.members.find((member) => member.id === "inner-end-tie-beam")
        ?.role,
    ).toBe("beam");
    expect(
      result.value.members.find((member) => member.id === "outer-end-tie-beam")
        ?.role,
    ).toBe("beam");
    expect(
      result.value.members.find(
        (member) => member.id === "inner-end-king-post-strut",
      )?.role,
    ).toBe("brace");
    expect(
      result.value.members.find(
        (member) => member.id === "outer-end-king-post-strut",
      )?.role,
    ).toBe("brace");
    expect(
      result.value.quantityHooks.find(
        (hook) => hook.key === "gable_end_frames.count",
      )?.quantity,
    ).toBe(2);
  });

  it("adds tie beams and king-post struts at both ends for freestanding gable end frames", () => {
    const result = solveAssembly3D(
      makeGableConfig({
        connection: {
          type: "freestanding",
          attachmentSide: "rear",
        },
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: "both_ends",
          houseEaveGutterMode: "our",
          outerEaveGutterMode: "our",
        },
        supports: {
          postCount: 4,
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.members.find((member) => member.id === "inner-end-tie-beam")
        ?.role,
    ).toBe("beam");
    expect(
      result.value.members.find((member) => member.id === "outer-end-tie-beam")
        ?.role,
    ).toBe("beam");
    expect(
      result.value.members.find(
        (member) => member.id === "inner-end-king-post-strut",
      )?.role,
    ).toBe("brace");
    expect(
      result.value.members.find(
        (member) => member.id === "outer-end-king-post-strut",
      )?.role,
    ).toBe("brace");
    expect(
      result.value.quantityHooks.find(
        (hook) => hook.key === "gable_end_frames.count",
      )?.quantity,
    ).toBe(2);
  });

  it("keeps gable post layout deterministic for 2, 3, and 4 standard support positions", () => {
    const twoPosts = solveAssembly3D(
      makeGableConfig({ supports: { postCount: 2 } }),
    );
    const threePosts = solveAssembly3D(
      makeGableConfig({ supports: { postCount: 3 } }),
    );
    const fourPosts = solveAssembly3D(
      makeGableConfig({
        connection: {
          type: "freestanding",
          attachmentSide: "rear",
        },
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: "none",
          houseEaveGutterMode: "our",
          outerEaveGutterMode: "our",
        },
        supports: {
          postCount: 4,
        },
      }),
    );

    expect(twoPosts.ok).toBe(true);
    expect(threePosts.ok).toBe(true);
    expect(fourPosts.ok).toBe(true);
    if (!twoPosts.ok || !threePosts.ok || !fourPosts.ok) return;

    expect(
      twoPosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 6500]);
    expect(
      threePosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 3250, 6500]);
    expect(
      fourPosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 6500, 0, 6500]);
  });

  it("builds a complete attached standard box assembly", () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2500 },
      end: { x: 5500, y: 0, z: 2500 },
    });
    expect(result.value.roofPlanes).toHaveLength(1);
    expect(
      result.value.members.find((member) => member.id === "ledger")?.role,
    ).toBe("ledger");
    expect(
      result.value.members.find((member) => member.id === "outer-gutter")?.role,
    ).toBe("gutter");
    expect(
      result.value.members.find((member) => member.id === "outer-box-beam")
        ?.role,
    ).toBe("beam");
    expect(
      result.value.members.find((member) => member.id === "left-box-beam")
        ?.role,
    ).toBe("beam");
    expect(
      result.value.members.find((member) => member.id === "right-box-beam")
        ?.role,
    ).toBe("beam");
    expect(
      result.value.members.filter((member) => member.role === "post"),
    ).toHaveLength(3);
    expect(
      result.value.members.filter((member) => member.role === "rafter"),
    ).toHaveLength(10);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: "ledger.length_mm", quantity: 5500, unit: "mm" },
        { key: "outer_gutter.length_mm", quantity: 5500, unit: "mm" },
        { key: "roof_planes.count", quantity: 1, unit: "count" },
      ]),
    );
  });

  it("keeps the box roof field inset to the standard house and far setbacks", () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const roofPlane = result.value.roofPlanes[0];
    expect(roofPlane?.boundary[0]?.y).toBe(150);
    expect(roofPlane?.boundary[2]?.y).toBe(3450);
  });

  it("matches the box roof fall to the derived rise and effective run", () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const roofPlane = result.value.roofPlanes[0];
    expect(roofPlane?.fallVector.y).toBeGreaterThan(0);
    expect(roofPlane?.fallVector.z).toBeLessThan(0);
    expect(
      Math.round(
        (roofPlane?.boundary[0]?.z ?? 0) - (roofPlane?.boundary[2]?.z ?? 0),
      ),
    ).toBe(173);
  });

  it("keeps box rafters on edge and perimeter members with vertical depth axes", () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rafter = result.value.members.find(
      (member) => member.id === "box-rafter-1",
    );
    const ledger = result.value.members.find(
      (member) => member.id === "ledger",
    );
    const sideBeam = result.value.members.find(
      (member) => member.id === "left-box-beam",
    );
    const outerBeam = result.value.members.find(
      (member) => member.id === "outer-box-beam",
    );

    expect(rafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(rafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.y).toBeCloseTo(0.052352, 6);
    expect(rafter?.localFrame.zAxis.z).toBeCloseTo(0.998629, 6);

    expect(ledger?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(ledger?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(sideBeam?.localFrame.yAxis).toEqual({
      x: -1,
      y: 0,
      z: 0,
    });
    expect(sideBeam?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(sideBeam?.localFrame.zAxis.y).toBeCloseTo(0.052352, 6);
    expect(sideBeam?.localFrame.zAxis.z).toBeCloseTo(0.998629, 6);

    expect(outerBeam?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(outerBeam?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });
  });

  it("keeps box post layout deterministic for 2, 3, and 4 standard support positions", () => {
    const twoPosts = solveAssembly3D(
      makeBoxConfig({ supports: { postCount: 2 } }),
    );
    const threePosts = solveAssembly3D(
      makeBoxConfig({ supports: { postCount: 3 } }),
    );
    const fourPosts = solveAssembly3D(
      makeBoxConfig({ supports: { postCount: 4 } }),
    );

    expect(twoPosts.ok).toBe(true);
    expect(threePosts.ok).toBe(true);
    expect(fourPosts.ok).toBe(true);
    if (!twoPosts.ok || !threePosts.ok || !fourPosts.ok) return;

    expect(
      twoPosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 5500]);
    expect(
      threePosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 2750, 5500]);
    expect(
      fourPosts.value.members
        .filter((member) => member.role === "post")
        .map((member) => member.centerline.start.x),
    ).toEqual([0, 1833, 3667, 5500]);
  });

  it("rejects unsupported mono variants", () => {
    expect(
      solveAssembly3D(makeMonoConfig({ roof: { overhangMm: 250 } })),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error: "Mono solver does not yet support overhang geometry.",
    });
    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            drainage: {
              gutterAssemblyMode: "separate",
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error: "Mono solver does not yet support separate-gutter mono variants.",
    });
    expect(
      solveAssembly3D(
        makeMonoConfig({
          supports: {
            postMode: "custom",
            postPositions: [
              { x: 1000, y: 3000, z: 0 },
              { x: 5000, y: 3000, z: 0 },
            ],
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error: "Mono solver only supports the standard post layout.",
    });
  });

  it("rejects unsupported gable variants", () => {
    expect(
      solveAssembly3D(
        makeGableConfig({
          connection: {
            type: "freestanding",
            attachmentSide: "rear",
          },
          gable: {
            ridgePositionMm: 2000,
            endFramesMode: "outer_end_only",
            houseEaveGutterMode: "our",
            outerEaveGutterMode: "our",
          },
          supports: {
            postCount: 4,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error:
        "Gable solver supports outer/both end frames for attached gable and both-ends for freestanding gable.",
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          gable: {
            ridgePositionMm: 2000,
            endFramesMode: "none",
            houseEaveGutterMode: "our",
            outerEaveGutterMode: "our",
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error:
        "Gable solver only supports the standard baseline eave gutter configuration.",
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          roof: {
            overhangMm: 200,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error: "Gable solver does not yet support overhang geometry.",
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          structural: {
            drainage: {
              gutterAssemblyMode: "separate",
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error:
        "Gable solver does not yet support separate-gutter gable variants.",
    });
  });

  it("rejects unsupported box variants", () => {
    expect(
      solveAssembly3D(
        makeBoxConfig({
          connection: {
            type: "freestanding",
            attachmentSide: "rear",
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error:
        "Box solver currently supports attached box-perimeter layouts only.",
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          box: {
            houseEdgeGutterMode: "our",
            farEdgeGutterMode: "our",
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error:
        "Box solver only supports the standard baseline box gutter configuration.",
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          roof: {
            overhangMm: 150,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error: "Box solver does not yet support overhang geometry.",
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          structural: {
            drainage: {
              gutterAssemblyMode: "separate",
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error: "Box solver does not yet support separate-gutter box variants.",
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          supports: {
            postMode: "custom",
            postPositions: [
              { x: 1000, y: 3500, z: 0 },
              { x: 4500, y: 3500, z: 0 },
            ],
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "unsupported_variant",
      error: "Box solver only supports the standard post layout.",
    });
  });

  it("rejects insufficient structural input", () => {
    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            heights: {
              houseUndersideMm: 2400,
              outerUndersideMm: null,
              referenceUndersideMm: 2400,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "insufficient_input",
      error: "Mono solver requires an outer underside height.",
    });

    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            profiles: {
              post: { shape: "rectangular", widthMm: 90, depthMm: 90 },
              rafter: null,
              ledger: { shape: "rectangular", widthMm: 50, depthMm: 100 },
              supportBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
              gutter: { shape: "rectangular", widthMm: 100, depthMm: 150 },
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "insufficient_input",
      error: "Mono solver requires the rafter profile.",
    });

    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            framing: {
              rafterCount: null,
              rafterSpacingMm: 600,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "insufficient_input",
      error: "Mono solver requires a rafter count.",
    });
  });

  it("rejects insufficient gable structural input", () => {
    expect(
      solveAssembly3D(
        makeGableConfig({
          structural: {
            profiles: {
              post: { shape: "rectangular", widthMm: 90, depthMm: 90 },
              rafter: { shape: "rectangular", widthMm: 50, depthMm: 150 },
              ledger: { shape: "rectangular", widthMm: 50, depthMm: 100 },
              supportBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
              gutter: { shape: "rectangular", widthMm: 100, depthMm: 150 },
              ridge: null,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "insufficient_input",
      error: "Gable solver requires the ridge profile.",
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          structural: {
            framing: {
              rafterCount: null,
              rafterSpacingMm: 590,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "insufficient_input",
      error: "Gable solver requires a rafter count.",
    });
  });

  it("rejects insufficient box structural input", () => {
    expect(
      solveAssembly3D(
        makeBoxConfig({
          structural: {
            profiles: {
              post: { shape: "rectangular", widthMm: 90, depthMm: 90 },
              rafter: { shape: "rectangular", widthMm: 50, depthMm: 80 },
              ledger: { shape: "rectangular", widthMm: 50, depthMm: 100 },
              supportBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
              gutter: { shape: "rectangular", widthMm: 100, depthMm: 100 },
              ridge: null,
              boxPerimeter: null,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "insufficient_input",
      error: "Box solver requires the box perimeter beam profile.",
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          box: {
            houseEdgeGutterMode: "house",
            farEdgeGutterMode: "our",
            houseSetbackMm: 150,
            outerSetbackMm: 50,
            effectiveRunMm: null,
            riseMm: 173,
            maxFallMm: 200,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: "insufficient_input",
      error:
        "Box solver requires derived effective run, rise, and max fall inputs.",
    });
  });
});
