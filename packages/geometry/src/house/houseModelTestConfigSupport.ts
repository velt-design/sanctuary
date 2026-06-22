// Shared house-model test helpers split by responsibility.
import type {
  AttachmentSide,
  GeometryConfig,
  HouseAttachmentStrategy,
  HouseFootprintPreset,
  HouseRoofForm,
  Polygon3,
} from "../contracts";
import { buildHouseFootprintPolygon } from "../footprints";
import { buildHouseModel3D } from "../houseModel";
import { deriveHouseGableTerminalEnds } from "../houseRoofCapabilities";

export type HouseModel = NonNullable<ReturnType<typeof buildHouseModel3D>>;

export function makeFootprint(widthMm = 6000, depthMm = 1800): Polygon3 {
  return [
    { x: 0, y: -depthMm, z: 0 },
    { x: widthMm, y: -depthMm, z: 0 },
    { x: widthMm, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
}

export function makePresetFootprint(preset: "wrap_left" | "wrap_right"): Polygon3 {
  return buildHouseFootprintPolygon({
    pergolaWidthMm: 6000,
    pergolaDepthMm: 1800,
    preset,
    attachmentSide: "rear",
  });
}

export const HOUSE_FOOTPRINT_PRESETS: readonly HouseFootprintPreset[] = [
  "straight",
  "l_left",
  "l_right",
  "recess_left",
  "recess_right",
  "u_shape",
  "wrap_left",
  "wrap_right",
];

export const HOUSE_ROOF_FORMS: readonly HouseRoofForm[] = ["flat", "mono", "hipped"];
export const ATTACHMENT_SIDES: readonly AttachmentSide[] = [
  "rear",
  "front",
  "left",
  "right",
];

export function makeConfig(
  input: {
    footprint?: Polygon3;
    connectionType?: GeometryConfig["connection"]["type"];
    attachmentSide?: GeometryConfig["connection"]["attachmentSide"];
    strategy?: HouseAttachmentStrategy;
    roofForm?: NonNullable<GeometryConfig["houseContext"]["model"]>["roofForm"];
    roofPrimaryFallDirection?: NonNullable<
      GeometryConfig["houseContext"]["model"]
    >["roofPrimaryFallDirection"];
    roofRidgeAxis?: NonNullable<
      GeometryConfig["houseContext"]["model"]
    >["roofRidgeAxis"];
    openGableEndIds?: NonNullable<
      GeometryConfig["houseContext"]["model"]
    >["openGableEndIds"];
    eaveHeightMm?: number;
    wallHeightMm?: number;
    roofPitchDeg?: number;
    fasciaHeightMm?: number;
    gutterWidthMm?: number;
    gutterProjectionMm?: number;
    eaveOverhangMm?: number;
  } = {},
): GeometryConfig {
  const footprint = input.footprint ?? makeFootprint();
  const strategy = input.strategy ?? "soffit_brackets";
  const eaveHeightMm = input.eaveHeightMm ?? 2400;
  const wallHeightMm = input.wallHeightMm ?? eaveHeightMm;

  return {
    projectId: "project_house",
    estimateId: "estimate_house",
    designRequestId: null,
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
      houseEdgeGutterMode: null,
      farEdgeGutterMode: null,
      houseSetbackMm: null,
      outerSetbackMm: null,
      effectiveRunMm: null,
      riseMm: null,
      maxFallMm: null,
    },
    connection: {
      type: input.connectionType ?? "soffit",
      attachmentSide: input.attachmentSide ?? "rear",
    },
    supports: {
      postMode: "standard",
      postCount: 2,
      postCutHeightMm: 2400,
      footingType: "slab",
      postConnectionType: "slab_anchors",
      groundCondition: "easy",
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: eaveHeightMm,
        outerUndersideMm: 2137,
        referenceUndersideMm: eaveHeightMm,
      },
      profiles: {
        post: { shape: "rectangular", widthMm: 90, depthMm: 90 },
        rafter: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        ledger: { shape: "rectangular", widthMm: 50, depthMm: 100 },
        supportBeam: { shape: "rectangular", widthMm: 50, depthMm: 150 },
        gutter: { shape: "rectangular", widthMm: 100, depthMm: 100 },
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
      footprint,
      attachmentStrategy: strategy,
      model: {
        footprint,
        storeyMode: "single_storey",
        wallConstruction: "timber_frame",
        roofForm: input.roofForm ?? "hipped",
        eaveHeightMm,
        wallHeightMm,
        roofPitchDeg: input.roofPitchDeg ?? 25,
        roofPrimaryFallDirection:
          input.roofPrimaryFallDirection ?? "positive_y",
        roofRidgeAxis: input.roofRidgeAxis ?? "x",
        openGableEndIds: input.openGableEndIds ?? null,
        attachmentStrategy: strategy,
        eave: {
          soffitDepthMm: 450,
          fasciaHeightMm: input.fasciaHeightMm ?? 180,
          gutterWidthMm: input.gutterWidthMm ?? 125,
          gutterDepthMm: 90,
          gutterProjectionMm: input.gutterProjectionMm ?? 125,
          eaveOverhangMm: input.eaveOverhangMm ?? 450,
        },
      },
    },
  };
}

export function allTerminalEndIdsForHippedConfig(
  footprint: Polygon3,
  ridgeAxis: "x" | "y" = "x",
): string[] {
  return deriveHouseGableTerminalEnds({ footprint, ridgeAxis }).map(
    (end) => end.id,
  );
}

export function makePlacedFootprint(input: {
  offsetX: number;
  width: number;
  facadeY?: number;
  depth?: number;
}): Polygon3 {
  const facadeY = input.facadeY ?? 0;
  const depth = input.depth ?? 1800;
  return [
    { x: input.offsetX, y: facadeY - depth, z: 0 },
    { x: input.offsetX + input.width, y: facadeY - depth, z: 0 },
    { x: input.offsetX + input.width, y: facadeY, z: 0 },
    { x: input.offsetX, y: facadeY, z: 0 },
  ];
}

export function makeFrontFootprint(input: {
  offsetX?: number;
  width?: number;
  facadeY: number;
  depth?: number;
}): Polygon3 {
  const offsetX = input.offsetX ?? 0;
  const width = input.width ?? 6000;
  const depth = input.depth ?? 1800;
  return [
    { x: offsetX, y: input.facadeY + depth, z: 0 },
    { x: offsetX + width, y: input.facadeY + depth, z: 0 },
    { x: offsetX + width, y: input.facadeY, z: 0 },
    { x: offsetX, y: input.facadeY, z: 0 },
  ];
}

export function makeLeftFootprint(input: {
  offsetY?: number;
  width?: number;
  facadeX: number;
  depth?: number;
}): Polygon3 {
  const offsetY = input.offsetY ?? 0;
  const width = input.width ?? 3000;
  const depth = input.depth ?? 1800;
  return [
    { x: input.facadeX - depth, y: offsetY, z: 0 },
    { x: input.facadeX - depth, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY, z: 0 },
  ];
}

export function makeRightFootprint(input: {
  offsetY?: number;
  width?: number;
  facadeX: number;
  depth?: number;
}): Polygon3 {
  const offsetY = input.offsetY ?? 0;
  const width = input.width ?? 3000;
  const depth = input.depth ?? 1800;
  return [
    { x: input.facadeX + depth, y: offsetY, z: 0 },
    { x: input.facadeX + depth, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY, z: 0 },
  ];
}

export function makeAttachmentEdge(z = 2400) {
  return {
    start: { x: 0, y: 0, z },
    end: { x: 6000, y: 0, z },
  };
}
