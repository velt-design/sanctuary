import type {
  Assembly3D,
  AssemblyMemberEndCut,
  AssemblyMember3D,
  AssemblyMemberProfile,
  DatumFrame3,
  GeometryConfig,
  Line3,
  Plane3,
  Point3,
  RoofCladdingPanel3D,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from "./contracts";
import {
  crossProduct,
  dotProduct,
  lineDirection,
  lineLength,
  magnitude,
  normalizeVector,
  planeFromOriginAxes,
  polygonArea,
  scaleVector,
} from "./math3d";
import {
  parseAssemblyMemberProfile,
  resolveAssemblyMemberProfileAnchors,
} from "./profiles";
import { buildHouseReferenceGeometry } from "./houseModel";
import type {
  SolveAssembly3DErrorCode,
  SolveAssembly3DResult,
} from "./solve.types";

type SolveAssembly3DFailure = Extract<SolveAssembly3DResult, { ok: false }>;

function ok(value: Assembly3D): SolveAssembly3DResult {
  return { ok: true, value };
}

function fail(
  code: SolveAssembly3DErrorCode,
  error: string,
): SolveAssembly3DFailure {
  return { ok: false, code, error };
}

function point(x: number, y: number, z: number): Point3 {
  return { x, y, z };
}

function line(start: Point3, end: Point3): Line3 {
  return { start, end };
}

function addPointVector(origin: Point3, vector: Vector3): Point3 {
  return {
    x: origin.x + vector.x,
    y: origin.y + vector.y,
    z: origin.z + vector.z,
  };
}

function pointAlongDirectionToY(
  origin: Point3,
  direction: Vector3,
  targetY: number,
): Point3 {
  if (Math.abs(direction.y) <= 1e-6) return origin;
  return addPointVector(
    origin,
    scaleVector(direction, (targetY - origin.y) / direction.y),
  );
}

function frameFromAxes(
  origin: Point3,
  xAxis: Vector3,
  yAxis: Vector3,
): DatumFrame3 {
  const normalizedX = normalizeVector(xAxis);
  const normalizedY = normalizeVector(yAxis);
  const normalizedZ = normalizeVector(crossProduct(normalizedX, normalizedY));
  return {
    origin,
    xAxis: normalizedX,
    yAxis: normalizedY,
    zAxis: normalizedZ,
  };
}

function frameFromXAxisZAxis(
  origin: Point3,
  xAxis: Vector3,
  zAxis: Vector3,
): DatumFrame3 {
  const normalizedX = normalizeVector(xAxis);
  const normalizedZ = normalizeVector(zAxis);
  const normalizedY = normalizeVector(crossProduct(normalizedZ, normalizedX));
  return {
    origin,
    xAxis: normalizedX,
    yAxis: normalizedY,
    zAxis: normalizeVector(crossProduct(normalizedX, normalizedY)),
  };
}

function frameForVerticalMember(origin: Point3): DatumFrame3 {
  return frameFromAxes(origin, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 });
}

function frameForHorizontalX(origin: Point3): DatumFrame3 {
  return frameFromXAxisZAxis(
    origin,
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  );
}

function frameForRafter(memberLine: Line3, roofNormal: Vector3): DatumFrame3 {
  return frameFromXAxisZAxis(
    memberLine.start,
    lineDirection(memberLine),
    roofNormal,
  );
}

function frameForJoiner(memberLine: Line3, roofNormal: Vector3): DatumFrame3 {
  return frameFromXAxisZAxis(
    memberLine.start,
    lineDirection(memberLine),
    roofNormal,
  );
}

function equalSpacingPositions(lengthMm: number, count: number): number[] {
  if (count < 2) return [0, lengthMm];
  const spacingMm = lengthMm / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) =>
    Math.round(spacingMm * index),
  );
}

function requireProfile(
  profile: AssemblyMemberProfile | null,
): AssemblyMemberProfile | null {
  if (profile && profile.widthMm > 0 && profile.depthMm > 0) {
    return profile;
  }
  return null;
}

function clonePolygon(points: { x: number; y: number }[] | null | undefined) {
  if (!points) return null;
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function mirrorProfileAcrossLocalY(
  profile: AssemblyMemberProfile,
): AssemblyMemberProfile {
  const anchors = resolveAssemblyMemberProfileAnchors(profile);
  return {
    ...profile,
    sectionOutline:
      clonePolygon(profile.sectionOutline)?.map((point) => ({
        x: -point.x,
        y: point.y,
      })) ?? null,
    sectionVoids:
      profile.sectionVoids?.map((voidBoundary) =>
        voidBoundary.map((point) => ({ x: -point.x, y: point.y })),
      ) ?? null,
    anchors: {
      undersideZ: anchors.undersideZ,
      topsideZ: anchors.topsideZ,
      backFaceY: -anchors.backFaceY,
      frontFaceY: -anchors.frontFaceY,
      roofBearingFaceY: -anchors.roofBearingFaceY,
      roofBearingFaceZ: anchors.roofBearingFaceZ,
    },
  };
}

function profileFaceY(
  profile: AssemblyMemberProfile,
  face: "backFaceY" | "frontFaceY" | "roofBearingFaceY",
): number {
  return resolveAssemblyMemberProfileAnchors(profile)[face];
}

function profileFaceZ(
  profile: AssemblyMemberProfile,
  face: "undersideZ" | "topsideZ" | "roofBearingFaceZ",
): number {
  return resolveAssemblyMemberProfileAnchors(profile)[face];
}

function rafterTailEndCut(
  end: AssemblyMemberEndCut["end"],
  normal: Vector3,
  pointOnPlane: Point3,
  preClipExtensionMm: number,
): AssemblyMemberEndCut {
  const normalizedNormal = normalizeVector(normal);
  return {
    end,
    plane: {
      normal: normalizedNormal,
      offsetMm: dotProduct(normalizedNormal, pointOnPlane),
      keepSide: "negative",
    },
    preClipExtensionMm,
  };
}

const GABLE_GUTTER_BODY_INSET_MM = 3;
const GABLE_GUTTER_END_CAP_MM = 3;
const GABLE_GUTTER_END_CAP_WIDTH_MM = 100;
const GABLE_GUTTER_END_CAP_DEPTH_MM = 150;
const GABLE_ACRYLIC_PANEL_THICKNESS_MM = 6;
const GABLE_ACRYLIC_GUTTER_EMBED_MM = 15;
const GABLE_RIDGE_FLASHING_GIRTH_MM = 300;
const GABLE_RIDGE_FLASHING_WING_MM = 150;
const GABLE_RIDGE_FLASHING_THICKNESS_MM = 1;

type GableAcrylicRoofHalfInput = {
  slope: "house" | "outer";
  roofPlane: Plane3;
  roofNormal: Vector3;
  eavePointOnRoofPlane: Point3;
  ridgePointOnRoofPlane: Point3;
  eaveExtensionMm: number;
  eaveTermination: "gutter" | "house_allowance";
  joinerProfile: AssemblyMemberProfile;
  rafterXPositions: number[];
  roofFallVector: Vector3;
  ridgeHalfMm: number;
};

type GableAcrylicRoofHalfOutput = {
  joiners: AssemblyMember3D[];
  panels: RoofCladdingPanel3D[];
};

function buildGableAcrylicRoofHalf(
  input: GableAcrylicRoofHalfInput,
): GableAcrylicRoofHalfOutput {
  const runVector = lineDirection(
    line(input.eavePointOnRoofPlane, input.ridgePointOnRoofPlane),
  );
  const panelMidPlaneOffsetMm = input.joinerProfile.depthMm / 2;
  const joinerOffset = scaleVector(input.roofNormal, panelMidPlaneOffsetMm);
  const panelMidPlaneOrigin = addPointVector(
    input.roofPlane.origin,
    joinerOffset,
  );
  const coverEavePointOnRoofPlane = addPointVector(
    input.eavePointOnRoofPlane,
    scaleVector(runVector, -input.eaveExtensionMm),
  );
  const coverRidgePointOnRoofPlane = input.ridgePointOnRoofPlane;
  const coverEavePoint = addPointVector(
    coverEavePointOnRoofPlane,
    joinerOffset,
  );
  const coverRidgePoint = addPointVector(
    coverRidgePointOnRoofPlane,
    joinerOffset,
  );
  const coveringLineLengthMm = lineLength(
    line(coverEavePoint, coverRidgePoint),
  );
  const joinerRidgePreClipExtensionMm = Math.max(
    input.joinerProfile.widthMm,
    input.joinerProfile.depthMm,
  );
  const joinerRidgeEndCut = rafterTailEndCut(
    "end",
    input.slope === "house" ? { x: 0, y: 1, z: 0 } : { x: 0, y: -1, z: 0 },
    input.ridgePointOnRoofPlane,
    joinerRidgePreClipExtensionMm,
  );

  const joiners: AssemblyMember3D[] = input.rafterXPositions.map((x, index) => {
    const memberLine = line(
      point(x, coverEavePoint.y, coverEavePoint.z),
      point(x, coverRidgePoint.y, coverRidgePoint.z),
    );
    return {
      id: `${input.slope}-joiner-${index + 1}`,
      role: "joiner",
      centerline: memberLine,
      profile: input.joinerProfile,
      localFrame: frameForJoiner(memberLine, input.roofNormal),
      endCuts: [joinerRidgeEndCut],
      metadata: {
        index: index + 1,
        slope: input.slope,
        runLengthMm: Math.round(lineLength(memberLine)),
        targetRunLengthMm: Math.round(coveringLineLengthMm),
      },
    };
  });

  const panels: RoofCladdingPanel3D[] = [];
  for (let index = 0; index < input.rafterXPositions.length - 1; index += 1) {
    const leftX = input.rafterXPositions[index]!;
    const rightX = input.rafterXPositions[index + 1]!;
    if (rightX <= leftX) {
      continue;
    }

    const boundary = [
      point(leftX, coverEavePoint.y, coverEavePoint.z),
      point(rightX, coverEavePoint.y, coverEavePoint.z),
      point(rightX, coverRidgePoint.y, coverRidgePoint.z),
      point(leftX, coverRidgePoint.y, coverRidgePoint.z),
    ];
    const panelGeometryAreaMm2 = Math.round(polygonArea(boundary));
    panels.push({
      id: `${input.slope}-acrylic-panel-${index + 1}`,
      material: "acrylic",
      boundary,
      thicknessMm: GABLE_ACRYLIC_PANEL_THICKNESS_MM,
      plane: planeFromOriginAxes(
        panelMidPlaneOrigin,
        input.roofPlane.xAxis,
        input.roofPlane.yAxis,
      ),
      metadata: {
        index: index + 1,
        slope: input.slope,
        areaMm2: panelGeometryAreaMm2,
        bayWidthMm: Math.round(rightX - leftX),
        downslopeLengthMm: Math.round(coveringLineLengthMm),
        gutterEmbedMm:
          input.eaveTermination === "gutter"
            ? Math.round(input.eaveExtensionMm)
            : 0,
        houseAllowanceMm:
          input.eaveTermination === "house_allowance"
            ? Math.round(input.eaveExtensionMm)
            : 0,
        panelMidPlaneOffsetMm: Math.round(panelMidPlaneOffsetMm),
        ridgeHalfMm: Math.round(input.ridgeHalfMm),
        eaveTermination: input.eaveTermination,
        roofFallVectorY: Math.round(input.roofFallVector.y * 1_000) / 1_000,
      },
    });
  }

  return { joiners, panels };
}

type GableStructuralInput = {
  eaveUndersideMm: number;
  ridgePositionMm: number;
  referenceBeamProfile: AssemblyMemberProfile;
  supportBeamProfile: AssemblyMemberProfile;
  gutterProfile: AssemblyMemberProfile;
  ridgeProfile: AssemblyMemberProfile;
  rafterProfile: AssemblyMemberProfile;
  postProfile: AssemblyMemberProfile;
  tieBeamProfile: AssemblyMemberProfile | null;
  strutProfile: AssemblyMemberProfile | null;
  rafterCount: number;
  endFramesMode: "none" | "outer_end_only" | "both_ends";
  houseEaveGutterMode: "house" | "our";
  outerEaveGutterMode: "house" | "our";
};

function resolveGableStructuralInput(
  config: GeometryConfig,
): GableStructuralInput | SolveAssembly3DFailure {
  if (config.roof.overhangMm > 0) {
    return fail(
      "unsupported_variant",
      "Gable solver does not yet support overhang geometry.",
    );
  }
  if (
    config.supports.postMode !== "standard" ||
    (config.supports.postPositions?.length ?? 0) > 0
  ) {
    return fail(
      "unsupported_variant",
      "Gable solver only supports the standard post layout.",
    );
  }
  if (config.structural.drainage.gutterAssemblyMode === "separate") {
    return fail(
      "unsupported_variant",
      "Gable solver does not yet support separate-gutter gable variants.",
    );
  }
  const endFramesMode = config.gable.endFramesMode ?? "none";
  const isSupportedEndFrameMode =
    endFramesMode === "none" ||
    (config.connection.type === "freestanding"
      ? endFramesMode === "both_ends"
      : endFramesMode === "outer_end_only" || endFramesMode === "both_ends");
  if (!isSupportedEndFrameMode) {
    return fail(
      "unsupported_variant",
      "Gable solver supports outer/both end frames for attached gable and both-ends for freestanding gable.",
    );
  }

  const expectedHouseMode =
    config.connection.type === "freestanding" ? "our" : "house";
  if (
    config.gable.houseEaveGutterMode !== expectedHouseMode ||
    config.gable.outerEaveGutterMode !== "our"
  ) {
    return fail(
      "unsupported_variant",
      "Gable solver only supports the standard baseline eave gutter configuration.",
    );
  }

  const houseUndersideMm =
    config.structural.heights.houseUndersideMm ??
    config.structural.heights.referenceUndersideMm;
  const outerUndersideMm =
    config.structural.heights.outerUndersideMm ??
    config.structural.heights.referenceUndersideMm;
  const eaveUndersideMm =
    houseUndersideMm ??
    outerUndersideMm ??
    config.structural.heights.referenceUndersideMm;
  if (eaveUndersideMm === null || eaveUndersideMm === undefined) {
    return fail(
      "insufficient_input",
      "Gable solver requires an eave underside height.",
    );
  }
  if (
    houseUndersideMm !== null &&
    houseUndersideMm !== undefined &&
    outerUndersideMm !== null &&
    outerUndersideMm !== undefined &&
    houseUndersideMm !== outerUndersideMm
  ) {
    return fail(
      "unsupported_variant",
      "Gable solver currently requires symmetrical eave underside heights.",
    );
  }

  const referenceBeamProfile =
    config.connection.type === "freestanding"
      ? requireProfile(config.structural.profiles.supportBeam)
      : requireProfile(config.structural.profiles.ledger);
  if (!referenceBeamProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires the house-side eave support profile.",
    );
  }

  const supportBeamProfile = requireProfile(
    config.structural.profiles.supportBeam,
  );
  if (!supportBeamProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires the outer eave support profile.",
    );
  }

  const gutterProfile = requireProfile(config.structural.profiles.gutter);
  if (!gutterProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires the gutter profile.",
    );
  }

  const ridgeProfile = requireProfile(config.structural.profiles.ridge);
  if (!ridgeProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires the ridge profile.",
    );
  }

  const rafterProfile = requireProfile(config.structural.profiles.rafter);
  if (!rafterProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires the rafter profile.",
    );
  }

  const postProfile = requireProfile(config.structural.profiles.post);
  if (!postProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires the post profile.",
    );
  }

  const tieBeamProfile = config.structural.profiles.tieBeam ?? null;
  const strutProfile = config.structural.profiles.strut ?? null;
  if (endFramesMode !== "none" && !tieBeamProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires a tie beam profile for gable end frames.",
    );
  }
  if (endFramesMode !== "none" && !strutProfile) {
    return fail(
      "insufficient_input",
      "Gable solver requires a king-post strut profile for gable end frames.",
    );
  }

  const rafterCount = config.structural.framing.rafterCount;
  if (rafterCount === null || rafterCount === undefined || rafterCount < 2) {
    return fail("insufficient_input", "Gable solver requires a rafter count.");
  }
  if (
    config.structural.framing.rafterSpacingMm === null ||
    config.structural.framing.rafterSpacingMm === undefined ||
    config.structural.framing.rafterSpacingMm <= 0
  ) {
    return fail("insufficient_input", "Gable solver requires rafter spacing.");
  }

  const ridgePositionMm = config.gable.ridgePositionMm;
  if (
    ridgePositionMm === null ||
    ridgePositionMm === undefined ||
    ridgePositionMm <= 0 ||
    ridgePositionMm >= config.dimensions.projectionMm
  ) {
    return fail(
      "insufficient_input",
      "Gable solver requires a centered ridge position within the roof span.",
    );
  }
  if (ridgePositionMm !== config.dimensions.projectionMm / 2) {
    return fail(
      "unsupported_variant",
      "Gable solver currently requires a centered ridge.",
    );
  }

  return {
    eaveUndersideMm,
    ridgePositionMm,
    referenceBeamProfile,
    supportBeamProfile,
    gutterProfile,
    ridgeProfile,
    rafterProfile,
    postProfile,
    tieBeamProfile,
    strutProfile,
    rafterCount,
    endFramesMode,
    houseEaveGutterMode: config.gable.houseEaveGutterMode as "house" | "our",
    outerEaveGutterMode: config.gable.outerEaveGutterMode as "house" | "our",
  };
}

export function solveGableAssembly3D(
  config: GeometryConfig,
): SolveAssembly3DResult {
  const structural = resolveGableStructuralInput(config);
  if ("code" in structural) {
    return structural;
  }

  const input = structural;
  const lengthMm = config.dimensions.lengthMm;
  const projectionMm = config.dimensions.projectionMm;
  const ridgeY = input.ridgePositionMm;
  const outline = [
    point(0, 0, 0),
    point(lengthMm, 0, 0),
    point(lengthMm, projectionMm, 0),
    point(0, projectionMm, 0),
  ];

  const houseGutterProfile =
    input.houseEaveGutterMode === "our"
      ? mirrorProfileAcrossLocalY(input.gutterProfile)
      : input.gutterProfile;
  const outerGutterProfile = input.gutterProfile;
  const pitchTan = Math.tan((config.dimensions.roofPitchDeg * Math.PI) / 180);
  const referenceBeamBackFaceY = profileFaceY(
    input.referenceBeamProfile,
    "backFaceY",
  );
  const referenceBeamFrontFaceY = profileFaceY(
    input.referenceBeamProfile,
    "frontFaceY",
  );
  const referenceBeamRoofBearingFaceY = profileFaceY(
    input.referenceBeamProfile,
    "roofBearingFaceY",
  );
  const referenceBeamUndersideZ = profileFaceZ(
    input.referenceBeamProfile,
    "undersideZ",
  );
  const referenceBeamTopsideZ = profileFaceZ(
    input.referenceBeamProfile,
    "topsideZ",
  );
  const referenceBeamRoofBearingFaceZ = profileFaceZ(
    input.referenceBeamProfile,
    "roofBearingFaceZ",
  );
  const supportBeamFrontFaceY = profileFaceY(
    input.supportBeamProfile,
    "frontFaceY",
  );
  const supportBeamRoofBearingFaceY = profileFaceY(
    input.supportBeamProfile,
    "roofBearingFaceY",
  );
  const supportBeamUndersideZ = profileFaceZ(
    input.supportBeamProfile,
    "undersideZ",
  );
  const supportBeamTopsideZ = profileFaceZ(
    input.supportBeamProfile,
    "topsideZ",
  );
  const supportBeamRoofBearingFaceZ = profileFaceZ(
    input.supportBeamProfile,
    "roofBearingFaceZ",
  );
  const houseGutterBackFaceY = profileFaceY(houseGutterProfile, "backFaceY");
  const houseGutterFrontFaceY = profileFaceY(houseGutterProfile, "frontFaceY");
  const houseGutterUndersideZ = profileFaceZ(houseGutterProfile, "undersideZ");
  const houseGutterTopsideZ = profileFaceZ(houseGutterProfile, "topsideZ");
  const houseGutterRoofBearingFaceY = profileFaceY(
    houseGutterProfile,
    "roofBearingFaceY",
  );
  const houseGutterRoofBearingFaceZ = profileFaceZ(
    houseGutterProfile,
    "roofBearingFaceZ",
  );
  const outerGutterBackFaceY = profileFaceY(outerGutterProfile, "backFaceY");
  const outerGutterFrontFaceY = profileFaceY(outerGutterProfile, "frontFaceY");
  const outerGutterUndersideZ = profileFaceZ(outerGutterProfile, "undersideZ");
  const outerGutterTopsideZ = profileFaceZ(outerGutterProfile, "topsideZ");
  const outerGutterRoofBearingFaceY = profileFaceY(
    outerGutterProfile,
    "roofBearingFaceY",
  );
  const outerGutterRoofBearingFaceZ = profileFaceZ(
    outerGutterProfile,
    "roofBearingFaceZ",
  );

  const totalPostCount = config.supports.postCount;
  if (
    totalPostCount === null ||
    totalPostCount === undefined ||
    totalPostCount < 2
  ) {
    return fail(
      "insufficient_input",
      "Gable solver requires a standard post count.",
    );
  }
  if (
    config.connection.type === "freestanding" &&
    (totalPostCount < 4 || totalPostCount % 2 !== 0)
  ) {
    return fail(
      "insufficient_input",
      "Freestanding gable standard layout requires an even post count of at least 4.",
    );
  }

  const housePostCount =
    config.connection.type === "freestanding" ? totalPostCount / 2 : 0;
  const outerPostCount =
    config.connection.type === "freestanding"
      ? totalPostCount / 2
      : totalPostCount;
  const housePostXPositions =
    config.connection.type === "freestanding"
      ? equalSpacingPositions(lengthMm, housePostCount)
      : [];
  const outerPostXPositions = equalSpacingPositions(lengthMm, outerPostCount);
  const postHalfWidthMm = input.postProfile.widthMm / 2;
  const housePostLeftOutsideFaceX =
    (housePostXPositions[0] ?? 0) - postHalfWidthMm;
  const housePostRightOutsideFaceX =
    (housePostXPositions[housePostXPositions.length - 1] ?? lengthMm) +
    postHalfWidthMm;
  const outerPostLeftOutsideFaceX =
    (outerPostXPositions[0] ?? 0) - postHalfWidthMm;
  const outerPostRightOutsideFaceX =
    (outerPostXPositions[outerPostXPositions.length - 1] ?? lengthMm) +
    postHalfWidthMm;

  const houseGutterCenterlineY =
    input.houseEaveGutterMode === "our" ? -houseGutterFrontFaceY : 0;
  const outerGutterCenterlineY = projectionMm - outerGutterFrontFaceY;
  const houseSupportCenterlineY =
    config.connection.type === "freestanding"
      ? houseGutterCenterlineY + houseGutterBackFaceY - referenceBeamFrontFaceY
      : -referenceBeamBackFaceY;
  const outerSupportCenterlineY =
    outerGutterCenterlineY + outerGutterBackFaceY - supportBeamFrontFaceY;

  const houseSupportCenterlineZ =
    input.eaveUndersideMm - referenceBeamUndersideZ;
  const outerSupportCenterlineZ = input.eaveUndersideMm - supportBeamUndersideZ;
  const houseGutterCenterlineZ = input.eaveUndersideMm - houseGutterUndersideZ;
  const outerGutterCenterlineZ = input.eaveUndersideMm - outerGutterUndersideZ;

  const houseStructuralTopMm = Math.max(
    houseSupportCenterlineZ + referenceBeamTopsideZ,
    input.houseEaveGutterMode === "our"
      ? houseGutterCenterlineZ + houseGutterTopsideZ
      : 0,
  );
  const outerStructuralTopMm = Math.max(
    outerSupportCenterlineZ + supportBeamTopsideZ,
    input.outerEaveGutterMode === "our"
      ? outerGutterCenterlineZ + outerGutterTopsideZ
      : 0,
  );
  const houseBearingY =
    input.houseEaveGutterMode === "our"
      ? houseGutterCenterlineY + houseGutterRoofBearingFaceY
      : houseSupportCenterlineY + referenceBeamRoofBearingFaceY;
  const outerBearingY =
    input.outerEaveGutterMode === "our"
      ? outerGutterCenterlineY + outerGutterRoofBearingFaceY
      : outerSupportCenterlineY + supportBeamRoofBearingFaceY;
  const houseBearingTopMm =
    input.houseEaveGutterMode === "our"
      ? houseGutterCenterlineZ + houseGutterRoofBearingFaceZ
      : houseSupportCenterlineZ + referenceBeamRoofBearingFaceZ;
  const outerBearingTopMm =
    input.outerEaveGutterMode === "our"
      ? outerGutterCenterlineZ + outerGutterRoofBearingFaceZ
      : outerSupportCenterlineZ + supportBeamRoofBearingFaceZ;

  const ridgeTopMm = Math.max(
    houseBearingTopMm + pitchTan * (ridgeY - houseBearingY),
    outerBearingTopMm + pitchTan * (outerBearingY - ridgeY),
  );
  const ridgeCenterlineZ = ridgeTopMm - input.ridgeProfile.depthMm / 2;

  const houseEaveTopMm = Math.max(
    houseStructuralTopMm,
    ridgeTopMm - pitchTan * ridgeY,
  );
  const outerEaveTopMm = Math.max(
    outerStructuralTopMm,
    ridgeTopMm - pitchTan * (projectionMm - ridgeY),
  );

  const houseRoofPlane = planeFromOriginAxes(
    point(0, 0, houseEaveTopMm),
    { x: lengthMm, y: 0, z: 0 },
    { x: 0, y: ridgeY, z: ridgeTopMm - houseEaveTopMm },
  );
  const outerRoofPlane = planeFromOriginAxes(
    point(0, ridgeY, ridgeTopMm),
    { x: lengthMm, y: 0, z: 0 },
    { x: 0, y: projectionMm - ridgeY, z: outerEaveTopMm - ridgeTopMm },
  );

  const houseRoofNormal = normalizeVector(houseRoofPlane.normal);
  const outerRoofNormal = normalizeVector(outerRoofPlane.normal);
  if (magnitude(houseRoofNormal) === 0 || magnitude(outerRoofNormal) === 0) {
    return fail(
      "insufficient_input",
      "Gable solver could not resolve roof normals.",
    );
  }

  if (houseBearingY >= ridgeY || outerBearingY <= ridgeY) {
    return fail(
      "insufficient_input",
      "Gable solver requires positive rafter bearing length between the eaves and ridge.",
    );
  }

  const houseBearingZ =
    houseEaveTopMm + ((ridgeTopMm - houseEaveTopMm) * houseBearingY) / ridgeY;
  const outerBearingZ =
    ridgeTopMm +
    ((outerEaveTopMm - ridgeTopMm) * (outerBearingY - ridgeY)) /
      (projectionMm - ridgeY);
  const ridgeHalfMm = input.ridgeProfile.widthMm / 2;
  const houseRidgeBearingY = ridgeY - ridgeHalfMm;
  const outerRidgeBearingY = ridgeY + ridgeHalfMm;
  const houseRidgeBearingZ =
    houseEaveTopMm +
    ((ridgeTopMm - houseEaveTopMm) * houseRidgeBearingY) / ridgeY;
  const outerRidgeBearingZ =
    ridgeTopMm +
    ((outerEaveTopMm - ridgeTopMm) * (outerRidgeBearingY - ridgeY)) /
      (projectionMm - ridgeY);
  const houseRafterCenterOffset = scaleVector(
    houseRoofNormal,
    -input.rafterProfile.depthMm / 2,
  );
  const outerRafterCenterOffset = scaleVector(
    outerRoofNormal,
    -input.rafterProfile.depthMm / 2,
  );
  const rafterTailPreClipExtensionMm = Math.max(
    input.rafterProfile.widthMm,
    input.rafterProfile.depthMm,
  );
  const houseGutterInsideClipY = houseGutterCenterlineY + houseGutterBackFaceY;
  const outerGutterInsideClipY = outerGutterCenterlineY + outerGutterBackFaceY;
  const rafterXPositions = equalSpacingPositions(lengthMm, input.rafterCount);
  const ridgeRunStartX =
    (rafterXPositions[0] ?? 0) - input.rafterProfile.widthMm / 2;
  const ridgeRunEndX =
    (rafterXPositions[rafterXPositions.length - 1] ?? lengthMm) +
    input.rafterProfile.widthMm / 2;

  const houseRafters: AssemblyMember3D[] = rafterXPositions.map((x, index) => {
    const bearingLine = line(
      addPointVector(
        point(x, houseBearingY, houseBearingZ),
        houseRafterCenterOffset,
      ),
      addPointVector(
        point(x, houseRidgeBearingY, houseRidgeBearingZ),
        houseRafterCenterOffset,
      ),
    );
    const memberLine =
      input.houseEaveGutterMode === "our"
        ? line(
            pointAlongDirectionToY(
              bearingLine.start,
              lineDirection(bearingLine),
              houseGutterInsideClipY,
            ),
            bearingLine.end,
          )
        : bearingLine;
    const endCuts: AssemblyMemberEndCut[] =
      input.houseEaveGutterMode === "our"
        ? [
            rafterTailEndCut(
              "start",
              { x: 0, y: -1, z: 0 },
              point(x, houseGutterInsideClipY, 0),
              rafterTailPreClipExtensionMm,
            ),
          ]
        : [];
    endCuts.push(
      rafterTailEndCut(
        "end",
        { x: 0, y: 1, z: 0 },
        point(x, houseRidgeBearingY, 0),
        rafterTailPreClipExtensionMm,
      ),
    );
    return {
      id: `house-rafter-${index + 1}`,
      role: "rafter",
      centerline: memberLine,
      profile: input.rafterProfile,
      localFrame: frameForRafter(memberLine, houseRoofNormal),
      endCuts,
      metadata: {
        index: index + 1,
        slope: "house",
      },
    };
  });

  const outerRafters: AssemblyMember3D[] = rafterXPositions.map((x, index) => {
    const bearingLine = line(
      addPointVector(
        point(x, outerRidgeBearingY, outerRidgeBearingZ),
        outerRafterCenterOffset,
      ),
      addPointVector(
        point(x, outerBearingY, outerBearingZ),
        outerRafterCenterOffset,
      ),
    );
    const memberLine =
      input.outerEaveGutterMode === "our"
        ? line(
            bearingLine.start,
            pointAlongDirectionToY(
              bearingLine.end,
              lineDirection(bearingLine),
              outerGutterInsideClipY,
            ),
          )
        : bearingLine;
    const endCuts: AssemblyMemberEndCut[] = [
      rafterTailEndCut(
        "start",
        { x: 0, y: -1, z: 0 },
        point(x, outerRidgeBearingY, 0),
        rafterTailPreClipExtensionMm,
      ),
    ];
    if (input.outerEaveGutterMode === "our") {
      endCuts.push(
        rafterTailEndCut(
          "end",
          { x: 0, y: 1, z: 0 },
          point(x, outerGutterInsideClipY, 0),
          rafterTailPreClipExtensionMm,
        ),
      );
    }
    return {
      id: `outer-rafter-${index + 1}`,
      role: "rafter",
      centerline: memberLine,
      profile: input.rafterProfile,
      localFrame: frameForRafter(memberLine, outerRoofNormal),
      endCuts,
      metadata: {
        index: index + 1,
        slope: "outer",
      },
    };
  });

  const members: AssemblyMember3D[] = [];
  const supportConditions: Assembly3D["supportConditions"] = [];

  const attachmentEdge =
    config.connection.type === "freestanding"
      ? null
      : line(
          point(0, 0, input.eaveUndersideMm),
          point(lengthMm, 0, input.eaveUndersideMm),
        );

  if (config.connection.type !== "freestanding") {
    const ledgerLine = line(
      point(0, 0, houseSupportCenterlineZ),
      point(lengthMm, 0, houseSupportCenterlineZ),
    );
    members.push({
      id: "ledger",
      role: "ledger",
      centerline: ledgerLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(ledgerLine.start),
      metadata: {
        position: "house-eave",
      },
    });
    supportConditions.push({
      type: "house_connection",
      memberId: "ledger",
      metadata: {
        connectionType: config.connection.type,
      },
    });
  } else {
    const houseBeamLine = line(
      point(0, houseSupportCenterlineY, houseSupportCenterlineZ),
      point(lengthMm, houseSupportCenterlineY, houseSupportCenterlineZ),
    );
    members.push({
      id: "house-beam",
      role: "beam",
      centerline: houseBeamLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(houseBeamLine.start),
      metadata: {
        position: "house-eave",
      },
    });

    const houseGutterLine = line(
      point(
        housePostLeftOutsideFaceX,
        houseGutterCenterlineY,
        houseGutterCenterlineZ,
      ),
      point(
        housePostRightOutsideFaceX,
        houseGutterCenterlineY,
        houseGutterCenterlineZ,
      ),
    );
    members.push({
      id: "house-gutter",
      role: "gutter",
      centerline: houseGutterLine,
      profile: houseGutterProfile,
      localFrame: frameForHorizontalX(houseGutterLine.start),
      metadata: {
        position: "house-eave",
        gutterType: config.structural.drainage.gutterType,
        hasOurGutter: config.structural.drainage.hasOurGutter,
        bodyInsetStartMm: GABLE_GUTTER_BODY_INSET_MM,
        bodyInsetEndMm: GABLE_GUTTER_BODY_INSET_MM,
        endCapStartMm: GABLE_GUTTER_END_CAP_MM,
        endCapEndMm: GABLE_GUTTER_END_CAP_MM,
        endCapWidthMm: GABLE_GUTTER_END_CAP_WIDTH_MM,
        endCapDepthMm: GABLE_GUTTER_END_CAP_DEPTH_MM,
      },
    });
  }

  const outerBeamLine = line(
    point(0, outerSupportCenterlineY, outerSupportCenterlineZ),
    point(lengthMm, outerSupportCenterlineY, outerSupportCenterlineZ),
  );
  members.push({
    id: "outer-beam",
    role: "beam",
    centerline: outerBeamLine,
    profile: input.supportBeamProfile,
    localFrame: frameForHorizontalX(outerBeamLine.start),
    metadata: {
      position: "outer-eave",
    },
  });

  const outerGutterLine = line(
    point(
      outerPostLeftOutsideFaceX,
      outerGutterCenterlineY,
      outerGutterCenterlineZ,
    ),
    point(
      outerPostRightOutsideFaceX,
      outerGutterCenterlineY,
      outerGutterCenterlineZ,
    ),
  );
  members.push({
    id: "outer-gutter",
    role: "gutter",
    centerline: outerGutterLine,
    profile: outerGutterProfile,
    localFrame: frameForHorizontalX(outerGutterLine.start),
    metadata: {
      position: "outer-eave",
      gutterType: config.structural.drainage.gutterType,
      hasOurGutter: config.structural.drainage.hasOurGutter,
      bodyInsetStartMm: GABLE_GUTTER_BODY_INSET_MM,
      bodyInsetEndMm: GABLE_GUTTER_BODY_INSET_MM,
      endCapStartMm: GABLE_GUTTER_END_CAP_MM,
      endCapEndMm: GABLE_GUTTER_END_CAP_MM,
      endCapWidthMm: GABLE_GUTTER_END_CAP_WIDTH_MM,
      endCapDepthMm: GABLE_GUTTER_END_CAP_DEPTH_MM,
    },
  });

  const ridgeLine = line(
    point(ridgeRunStartX, ridgeY, ridgeCenterlineZ),
    point(ridgeRunEndX, ridgeY, ridgeCenterlineZ),
  );
  members.push({
    id: "ridge",
    role: "ridge",
    centerline: ridgeLine,
    profile: input.ridgeProfile,
    localFrame: frameForHorizontalX(ridgeLine.start),
  });

  const addEndFrame = (endId: "inner-end" | "outer-end", x: number) => {
    if (!input.tieBeamProfile || !input.strutProfile) return;

    const tieCenterlineZ =
      input.eaveUndersideMm - profileFaceZ(input.tieBeamProfile, "undersideZ");
    const tieLine = line(
      point(x, houseBearingY, tieCenterlineZ),
      point(x, outerBearingY, tieCenterlineZ),
    );
    members.push({
      id: `${endId}-tie-beam`,
      role: "beam",
      centerline: tieLine,
      profile: input.tieBeamProfile,
      localFrame: frameFromXAxisZAxis(
        tieLine.start,
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ),
      metadata: {
        position: endId,
        frameRole: "tie_beam",
      },
    });

    const ridgeUndersideZ = ridgeCenterlineZ - input.ridgeProfile.depthMm / 2;
    const strutLine = line(
      point(x, ridgeY, tieCenterlineZ),
      point(x, ridgeY, ridgeUndersideZ),
    );
    if (strutLine.end.z <= strutLine.start.z) return;

    members.push({
      id: `${endId}-king-post-strut`,
      role: "brace",
      centerline: strutLine,
      profile: input.strutProfile,
      localFrame: frameForVerticalMember(strutLine.start),
      metadata: {
        position: endId,
        frameRole: "king_post_strut",
      },
    });
    supportConditions.push({
      type: "bracing",
      memberId: `${endId}-king-post-strut`,
      metadata: {
        tieBeamId: `${endId}-tie-beam`,
        ridgeMemberId: "ridge",
      },
    });
  };

  if (input.endFramesMode === "outer_end_only") {
    addEndFrame("outer-end", lengthMm);
  } else if (input.endFramesMode === "both_ends") {
    addEndFrame("inner-end", 0);
    addEndFrame("outer-end", lengthMm);
  }

  const generatePosts = (
    prefix: string,
    y: number,
    topZ: number,
    count: number,
  ) => {
    const xPositions = equalSpacingPositions(lengthMm, count);
    for (let index = 0; index < xPositions.length; index += 1) {
      const x = xPositions[index]!;
      const memberLine = line(point(x, y, 0), point(x, y, topZ));
      const memberId = `${prefix}-${index + 1}`;
      members.push({
        id: memberId,
        role: "post",
        centerline: memberLine,
        profile: input.postProfile,
        localFrame: frameForVerticalMember(memberLine.start),
        metadata: {
          position: prefix,
          index: index + 1,
        },
      });
      if (config.supports.postConnectionType) {
        supportConditions.push({
          type: "post_connection",
          memberId,
          metadata: {
            postConnectionType: config.supports.postConnectionType,
          },
        });
      }
      if (config.supports.groundCondition) {
        supportConditions.push({
          type: "ground",
          memberId,
          metadata: {
            groundCondition: config.supports.groundCondition,
          },
        });
      }
    }
  };

  if (config.connection.type === "freestanding") {
    const postsPerLine = totalPostCount / 2;
    generatePosts(
      "house-post",
      houseGutterCenterlineY,
      input.eaveUndersideMm,
      postsPerLine,
    );
    generatePosts(
      "outer-post",
      outerGutterCenterlineY,
      input.eaveUndersideMm,
      postsPerLine,
    );
  } else {
    generatePosts(
      "outer-post",
      outerGutterCenterlineY,
      input.eaveUndersideMm,
      totalPostCount,
    );
  }

  const roofPlanes: RoofPlane3D[] = [
    {
      id: "gable-house-roof",
      boundary: [
        point(0, 0, houseEaveTopMm),
        point(lengthMm, 0, houseEaveTopMm),
        point(lengthMm, ridgeY, ridgeTopMm),
        point(0, ridgeY, ridgeTopMm),
      ],
      plane: houseRoofPlane,
      fallVector: normalizeVector({
        x: 0,
        y: -ridgeY,
        z: houseEaveTopMm - ridgeTopMm,
      }),
      metadata: {
        pitchDeg: config.dimensions.roofPitchDeg,
        slope: "house",
      },
    },
    {
      id: "gable-outer-roof",
      boundary: [
        point(0, ridgeY, ridgeTopMm),
        point(lengthMm, ridgeY, ridgeTopMm),
        point(lengthMm, projectionMm, outerEaveTopMm),
        point(0, projectionMm, outerEaveTopMm),
      ],
      plane: outerRoofPlane,
      fallVector: normalizeVector({
        x: 0,
        y: projectionMm - ridgeY,
        z: outerEaveTopMm - ridgeTopMm,
      }),
      metadata: {
        pitchDeg: config.dimensions.roofPitchDeg,
        slope: "outer",
      },
    },
  ];

  const roofCladdingPanels: RoofCladdingPanel3D[] = [];
  const roofFlashings: RoofFlashing3D[] = [];
  const joiners: AssemblyMember3D[] = [];
  if (config.roof.material === "acrylic") {
    const gableAcrylicJoinerProfile = parseAssemblyMemberProfile("sp_joiners");
    if (!gableAcrylicJoinerProfile) {
      return fail(
        "insufficient_input",
        "Gable acrylic solver requires the SP joiners profile.",
      );
    }

    const flashingSurfaceOffsetMm =
      gableAcrylicJoinerProfile.depthMm / 2 +
      GABLE_ACRYLIC_PANEL_THICKNESS_MM / 2 +
      GABLE_RIDGE_FLASHING_THICKNESS_MM / 2;
    const flashingApexStart = point(
      ridgeRunStartX,
      ridgeY,
      ridgeTopMm + flashingSurfaceOffsetMm,
    );
    const flashingApexEnd = point(
      ridgeRunEndX,
      ridgeY,
      ridgeTopMm + flashingSurfaceOffsetMm,
    );
    const houseWingStart = addPointVector(
      flashingApexStart,
      scaleVector(roofPlanes[0]!.fallVector, GABLE_RIDGE_FLASHING_WING_MM),
    );
    const houseWingEnd = addPointVector(
      flashingApexEnd,
      scaleVector(roofPlanes[0]!.fallVector, GABLE_RIDGE_FLASHING_WING_MM),
    );
    const outerWingStart = addPointVector(
      flashingApexStart,
      scaleVector(roofPlanes[1]!.fallVector, GABLE_RIDGE_FLASHING_WING_MM),
    );
    const outerWingEnd = addPointVector(
      flashingApexEnd,
      scaleVector(roofPlanes[1]!.fallVector, GABLE_RIDGE_FLASHING_WING_MM),
    );
    roofFlashings.push({
      id: "ridge-flashing",
      thicknessMm: GABLE_RIDGE_FLASHING_THICKNESS_MM,
      wings: [
        {
          id: "ridge-flashing-house-wing",
          boundary: [
            flashingApexStart,
            flashingApexEnd,
            houseWingEnd,
            houseWingStart,
          ],
          plane: planeFromOriginAxes(
            flashingApexStart,
            { x: 1, y: 0, z: 0 },
            roofPlanes[0]!.fallVector,
          ),
        },
        {
          id: "ridge-flashing-outer-wing",
          boundary: [
            flashingApexStart,
            outerWingStart,
            outerWingEnd,
            flashingApexEnd,
          ],
          plane: planeFromOriginAxes(
            flashingApexStart,
            { x: 1, y: 0, z: 0 },
            roofPlanes[1]!.fallVector,
          ),
        },
      ],
      metadata: {
        position: "ridge",
        girthMm: GABLE_RIDGE_FLASHING_GIRTH_MM,
        wingLengthMm: GABLE_RIDGE_FLASHING_WING_MM,
        thicknessMm: GABLE_RIDGE_FLASHING_THICKNESS_MM,
        runLengthMm: Math.round(lineLength(ridgeLine)),
        surfaceOffsetMm: Math.round(flashingSurfaceOffsetMm),
      },
    });

    const attachedHouseAllowanceMm =
      config.roofCovering.houseAllowanceMm ??
      input.referenceBeamProfile.widthMm;
    const houseRoofPack = buildGableAcrylicRoofHalf({
      slope: "house",
      roofPlane: houseRoofPlane,
      roofNormal: houseRoofNormal,
      eavePointOnRoofPlane: point(0, houseBearingY, houseBearingZ),
      ridgePointOnRoofPlane: point(0, houseRidgeBearingY, houseRidgeBearingZ),
      eaveExtensionMm:
        input.houseEaveGutterMode === "our"
          ? GABLE_ACRYLIC_GUTTER_EMBED_MM
          : attachedHouseAllowanceMm,
      eaveTermination:
        input.houseEaveGutterMode === "our" ? "gutter" : "house_allowance",
      joinerProfile: gableAcrylicJoinerProfile,
      rafterXPositions,
      roofFallVector: roofPlanes[0]!.fallVector,
      ridgeHalfMm,
    });
    const outerRoofPack = buildGableAcrylicRoofHalf({
      slope: "outer",
      roofPlane: outerRoofPlane,
      roofNormal: outerRoofNormal,
      eavePointOnRoofPlane: point(0, outerBearingY, outerBearingZ),
      ridgePointOnRoofPlane: point(0, outerRidgeBearingY, outerRidgeBearingZ),
      eaveExtensionMm: GABLE_ACRYLIC_GUTTER_EMBED_MM,
      eaveTermination: "gutter",
      joinerProfile: gableAcrylicJoinerProfile,
      rafterXPositions,
      roofFallVector: roofPlanes[1]!.fallVector,
      ridgeHalfMm,
    });

    joiners.push(...houseRoofPack.joiners, ...outerRoofPack.joiners);
    roofCladdingPanels.push(...houseRoofPack.panels, ...outerRoofPack.panels);
  }

  members.push(...joiners, ...houseRafters, ...outerRafters);

  const postMembers = members.filter((member) => member.role === "post");
  const rafterMembers = members.filter((member) => member.role === "rafter");
  const tieBeamMembers = members.filter(
    (member) => member.metadata?.frameRole === "tie_beam",
  );
  const kingPostStrutMembers = members.filter(
    (member) => member.metadata?.frameRole === "king_post_strut",
  );
  const quantityHooks: Assembly3D["quantityHooks"] = [
    { key: "posts.count", quantity: postMembers.length, unit: "count" },
    {
      key: "posts.total_length_mm",
      quantity: Math.round(
        postMembers.reduce(
          (sum, member) => sum + lineLength(member.centerline),
          0,
        ),
      ),
      unit: "mm",
    },
    { key: "rafters.count", quantity: rafterMembers.length, unit: "count" },
    {
      key: "rafters.total_length_mm",
      quantity: Math.round(
        rafterMembers.reduce(
          (sum, member) => sum + lineLength(member.centerline),
          0,
        ),
      ),
      unit: "mm",
    },
    {
      key: "ridge.length_mm",
      quantity: Math.round(lineLength(ridgeLine)),
      unit: "mm",
    },
    { key: "house_eave_support.length_mm", quantity: lengthMm, unit: "mm" },
    { key: "outer_eave_support.length_mm", quantity: lengthMm, unit: "mm" },
    {
      key: "outer_gutter.length_mm",
      quantity: Math.round(lineLength(outerGutterLine)),
      unit: "mm",
    },
    {
      key: "gable_end_frames.count",
      quantity: tieBeamMembers.length,
      unit: "count",
    },
    {
      key: "tie_beams.total_length_mm",
      quantity: Math.round(
        tieBeamMembers.reduce(
          (sum, member) => sum + lineLength(member.centerline),
          0,
        ),
      ),
      unit: "mm",
    },
    {
      key: "kingpost_struts.total_length_mm",
      quantity: Math.round(
        kingPostStrutMembers.reduce(
          (sum, member) => sum + lineLength(member.centerline),
          0,
        ),
      ),
      unit: "mm",
    },
    { key: "roof_planes.count", quantity: roofPlanes.length, unit: "count" },
  ];
  if (config.connection.type === "freestanding") {
    quantityHooks.push({
      key: "house_gutter.length_mm",
      quantity: Math.round(
        lineLength(
          members.find((member) => member.id === "house-gutter")!.centerline,
        ),
      ),
      unit: "mm",
    });
  }

  return ok({
    family: "gable",
    datum: config.datum,
    outline,
    attachmentEdge,
    house: buildHouseReferenceGeometry({
      houseId: config.houseContext.houseId ?? 'host-house',
      config,
      attachmentEdge,
    }),
    members,
    roofPlanes,
    roofCladdingPanels,
    roofFlashings,
    supportConditions,
    quantityHooks,
    semantics: {
      connectionType: config.connection.type,
      roofType: "gable",
      structuralZones:
        config.connection.type === "freestanding"
          ? [
              "roof_field_house",
              "roof_field_outer",
              "ridge_line",
              "support_line_house",
              "support_line_outer",
            ]
          : [
              "roof_field_house",
              "roof_field_outer",
              "ridge_line",
              "support_line_outer",
            ],
    },
  });
}
