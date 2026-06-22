import type {
  AssemblyPosition,
  AttachmentSide,
  ConnectionType,
  GeometryConfig,
  HouseModelConfig,
  Line3,
  Polygon3,
  RawHouseInput,
} from "./contracts";
import {
  buildHouseModelConfig,
  resolveHouseAttachmentStrategy,
} from "./normalize";

type HouseModel3DPergolaAttachment = {
  connectionType: Exclude<ConnectionType, "freestanding">;
  attachmentSide: AttachmentSide;
  attachmentEdge: Line3 | null;
  /** Datum frame the pergola contributes; used to derive the wall plane. */
  datum: GeometryConfig["datum"];
  /**
   * Pergola dimensions used by `buildSemanticHouseAttachmentEdge` to size
   * the host attachment edge.
   */
  pergolaLengthMm: number;
  pergolaProjectionMm: number;
};

export type HouseModel3DRawHouseInput = {
  rawHouse: RawHouseInput;
  /** Resolved world-space footprint polygon (mm). */
  footprint: Polygon3 | null;
  /** Optional house-level world position; passed through to the model. */
  housePosition?: AssemblyPosition | null;
  /** Soffit depth used for attachment-zone geometry; passed through verbatim. */
  soffitDepthMm?: number | null;
  /** Eave-height fallback heights from `structural.heights`. */
  houseUndersideMm?: number | null;
  referenceUndersideMm?: number | null;
  outerUndersideMm?: number | null;
  /**
   * Pergola-relationship context. `null` => freestanding house (no pergola
   * attaches; `attachmentTarget` will be `{ kind: 'none' }`).
   */
  pergolaAttachment: HouseModel3DPergolaAttachment | null;
};

type HouseModel3DGeometryConfigInput = {
  houseId: string;
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
  houseModelConfig: HouseModelConfig | null;
};

/**
 * Build the minimum `GeometryConfig` that `buildHouseModel3D` reads from a
 * `RawHouseInput`. This is the package-side input boundary for project
 * house render diagnostics: callers can inspect exactly which raw-house
 * fields cross into the model builder without going through portal render
 * code or legacy module state.
 */
export function buildHouseModel3DGeometryConfigInputFromRawHouseInput(
  input: HouseModel3DRawHouseInput,
): HouseModel3DGeometryConfigInput {
  const {
    rawHouse,
    footprint,
    housePosition = null,
    soffitDepthMm = null,
    houseUndersideMm = null,
    referenceUndersideMm = null,
    outerUndersideMm = null,
    pergolaAttachment,
  } = input;

  const connectionType: ConnectionType =
    pergolaAttachment?.connectionType ?? "freestanding";
  const attachmentSide: AttachmentSide =
    pergolaAttachment?.attachmentSide ?? "rear";
  const attachmentStrategy =
    connectionType === "freestanding"
      ? "none"
      : resolveHouseAttachmentStrategy(
          rawHouse.attachmentStrategy ?? null,
          connectionType,
        );

  const houseModelConfig: HouseModelConfig | null = buildHouseModelConfig({
    rawHouseContext: rawHouse,
    footprint,
    attachmentStrategy,
    houseUndersideMm,
    referenceUndersideMm,
  });

  const partialConfig: Pick<
    GeometryConfig,
    "connection" | "houseContext" | "structural" | "datum" | "dimensions"
  > = {
    connection: {
      type: connectionType,
      attachmentSide,
    },
    datum: pergolaAttachment?.datum ?? FREESTANDING_DATUM_STUB,
    dimensions: {
      lengthMm: pergolaAttachment?.pergolaLengthMm ?? 0,
      projectionMm: pergolaAttachment?.pergolaProjectionMm ?? 0,
      roofPitchDeg: 0,
    },
    houseContext: {
      footprint,
      footprintMode: null,
      footprintPolygon: null,
      position: housePosition,
      soffitDepthMm,
      model: houseModelConfig,
      attachmentStrategy: rawHouse.attachmentStrategy ?? null,
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
    },
    structural: {
      heights: {
        houseUndersideMm,
        outerUndersideMm,
        referenceUndersideMm,
      },
      profiles: {
        post: null,
        rafter: null,
        ledger: null,
        supportBeam: null,
        gutter: null,
        ridge: null,
        boxPerimeter: null,
      },
      framing: { rafterCount: null, rafterSpacingMm: null },
      drainage: {
        gutterType: null,
        gutterAssemblyMode: null,
        integratedGutterBeam: null,
        hasOurGutter: null,
      },
    },
  };

  return {
    houseId: rawHouse.houseId,
    config: partialConfig as GeometryConfig,
    attachmentEdge: pergolaAttachment?.attachmentEdge ?? null,
    houseModelConfig,
  };
}

const FREESTANDING_DATUM_STUB: GeometryConfig["datum"] = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  zAxis: { x: 0, y: 0, z: 1 },
  attachmentEdgeStart: { x: 0, y: 0, z: 0 },
  attachmentEdgeEnd: { x: 0, y: 0, z: 0 },
};
