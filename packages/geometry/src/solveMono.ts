import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberProfile,
  ConnectionType,
  DatumFrame3,
  GeometryConfig,
  HouseReferenceGeometry,
  Line3,
  Plane3,
  Point3,
  RoofCladdingPanel3D,
  RoofPlane3D,
  Vector3,
} from './contracts';
import { crossProduct, lineDirection, lineLength, magnitude, normalizeVector, planeFromOriginAxes, polygonArea, scaleVector } from './math3d';
import { parseAssemblyMemberProfile, resolveAssemblyMemberProfileAnchors } from './profiles';
import type { SolveAssembly3DErrorCode, SolveAssembly3DResult } from './solve.types';

type SolveAssembly3DFailure = Extract<SolveAssembly3DResult, { ok: false }>;

function ok(value: Assembly3D): SolveAssembly3DResult {
  return { ok: true, value };
}

function fail(code: SolveAssembly3DErrorCode, error: string): SolveAssembly3DFailure {
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

function frameFromAxes(origin: Point3, xAxis: Vector3, yAxis: Vector3): DatumFrame3 {
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

function frameFromXAxisZAxis(origin: Point3, xAxis: Vector3, zAxis: Vector3): DatumFrame3 {
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
  return frameFromXAxisZAxis(origin, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
}

function frameForRafter(memberLine: Line3, roofNormal: Vector3): DatumFrame3 {
  return frameFromXAxisZAxis(memberLine.start, lineDirection(memberLine), roofNormal);
}

function frameForJoiner(memberLine: Line3, roofNormal: Vector3): DatumFrame3 {
  return frameFromXAxisZAxis(memberLine.start, lineDirection(memberLine), roofNormal);
}

function equalSpacingPositions(lengthMm: number, count: number): number[] {
  if (count < 2) return [0, lengthMm];
  const spacingMm = lengthMm / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => Math.round(spacingMm * index));
}

function requireProfile(profile: AssemblyMemberProfile | null, label: string): AssemblyMemberProfile | null {
  if (profile && profile.widthMm > 0 && profile.depthMm > 0) {
    return profile;
  }
  return null;
}

function profileFaceY(profile: AssemblyMemberProfile, face: 'backFaceY' | 'frontFaceY' | 'roofBearingFaceY'): number {
  return resolveAssemblyMemberProfileAnchors(profile)[face];
}

function profileFaceZ(profile: AssemblyMemberProfile, face: 'undersideZ' | 'topsideZ' | 'roofBearingFaceZ'): number {
  return resolveAssemblyMemberProfileAnchors(profile)[face];
}

function buildHouseReferenceGeometry(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseReferenceGeometry {
  if (input.config.connection.type === 'freestanding') {
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
      footprint: input.config.houseContext.footprint ?? null,
    };
  }

  const wallPlane: Plane3 = planeFromOriginAxes(
    input.config.datum.origin,
    input.config.datum.xAxis,
    input.config.datum.zAxis,
  );

  return {
    wallPlane: {
      ...wallPlane,
      normal: { x: 0, y: -1, z: 0 },
    },
    fasciaLine: input.config.connection.type === 'fascia' ? input.attachmentEdge : null,
    roofEdgeLine: input.attachmentEdge,
    soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
    footprint: input.config.houseContext.footprint ?? null,
  };
}

type MonoStructuralInput = {
  referenceUndersideMm: number;
  outerUndersideMm: number;
  referenceBeamProfile: AssemblyMemberProfile;
  supportBeamProfile: AssemblyMemberProfile;
  gutterProfile: AssemblyMemberProfile;
  rafterProfile: AssemblyMemberProfile;
  postProfile: AssemblyMemberProfile;
  rafterCount: number;
};

type MonoAcrylicCoveringInput = {
  effectiveRunMm: number;
  acrylicRequiredDownslopeMm: number;
  joinerPieceLengthMm: number;
  joinerRunsTotal: number;
  houseAllowanceMm: number;
  farAllowanceMm: number;
  acrylicAreaMm2: number;
};

const MONO_GUTTER_BODY_INSET_MM = 3;
const MONO_GUTTER_END_CAP_MM = 3;
const MONO_GUTTER_END_CAP_WIDTH_MM = 100;
const MONO_GUTTER_END_CAP_DEPTH_MM = 150;
const MONO_ACRYLIC_PANEL_THICKNESS_MM = 6;
const MONO_ACRYLIC_GUTTER_EMBED_MM = 15;

function resolveMonoStructuralInput(config: GeometryConfig): MonoStructuralInput | SolveAssembly3DFailure {
  const referenceUndersideMm = config.structural.heights.referenceUndersideMm ?? config.structural.heights.houseUndersideMm;
  if (referenceUndersideMm === null || referenceUndersideMm === undefined) {
    return fail('insufficient_input', 'Mono solver requires a reference underside height.');
  }
  if (config.structural.heights.outerUndersideMm === null || config.structural.heights.outerUndersideMm === undefined) {
    return fail('insufficient_input', 'Mono solver requires an outer underside height.');
  }

  const referenceBeamProfile =
    config.connection.type === 'freestanding'
      ? requireProfile(config.structural.profiles.supportBeam, 'house-side beam')
      : requireProfile(config.structural.profiles.ledger, 'ledger');
  if (!referenceBeamProfile) {
    return fail('insufficient_input', 'Mono solver requires the reference-edge beam profile.');
  }

  const supportBeamProfile = requireProfile(config.structural.profiles.supportBeam, 'support beam');
  if (!supportBeamProfile) {
    return fail('insufficient_input', 'Mono solver requires the support beam profile.');
  }

  const gutterProfile = requireProfile(config.structural.profiles.gutter, 'gutter');
  if (!gutterProfile) {
    return fail('insufficient_input', 'Mono solver requires the gutter profile.');
  }

  const rafterProfile = requireProfile(config.structural.profiles.rafter, 'rafter');
  if (!rafterProfile) {
    return fail('insufficient_input', 'Mono solver requires the rafter profile.');
  }

  const postProfile = requireProfile(config.structural.profiles.post, 'post');
  if (!postProfile) {
    return fail('insufficient_input', 'Mono solver requires the post profile.');
  }

  const rafterCount = config.structural.framing.rafterCount;
  if (rafterCount === null || rafterCount === undefined || rafterCount < 2) {
    return fail('insufficient_input', 'Mono solver requires a rafter count.');
  }
  if (config.structural.framing.rafterSpacingMm === null || config.structural.framing.rafterSpacingMm === undefined || config.structural.framing.rafterSpacingMm <= 0) {
    return fail('insufficient_input', 'Mono solver requires rafter spacing.');
  }

  return {
    referenceUndersideMm,
    outerUndersideMm: config.structural.heights.outerUndersideMm,
    referenceBeamProfile,
    supportBeamProfile,
    gutterProfile,
    rafterProfile,
    postProfile,
    rafterCount,
  };
}

function resolveMonoAcrylicCoveringInput(config: GeometryConfig): MonoAcrylicCoveringInput | null {
  if (config.roof.material !== 'acrylic' || config.roofCovering.kind !== 'acrylic') {
    return null;
  }

  const {
    effectiveRunMm,
    acrylicRequiredDownslopeMm,
    joinerPieceLengthMm,
    joinerRunsTotal,
    houseAllowanceMm,
    farAllowanceMm,
    acrylicAreaMm2,
  } = config.roofCovering;

  if (
    effectiveRunMm === null ||
    acrylicRequiredDownslopeMm === null ||
    joinerPieceLengthMm === null ||
    joinerRunsTotal === null ||
    houseAllowanceMm === null ||
    farAllowanceMm === null ||
    acrylicAreaMm2 === null
  ) {
    return null;
  }

  return {
    effectiveRunMm,
    acrylicRequiredDownslopeMm,
    joinerPieceLengthMm,
    joinerRunsTotal,
    houseAllowanceMm,
    farAllowanceMm,
    acrylicAreaMm2,
  };
}

export function solveMonoAssembly3D(config: GeometryConfig): SolveAssembly3DResult {
  if (config.roof.overhangMm > 0) {
    return fail('unsupported_variant', 'Mono solver does not yet support overhang geometry.');
  }
  if (config.supports.postMode !== 'standard' || (config.supports.postPositions?.length ?? 0) > 0) {
    return fail('unsupported_variant', 'Mono solver only supports the standard post layout.');
  }
  if (config.structural.drainage.gutterAssemblyMode === 'separate') {
    return fail('unsupported_variant', 'Mono solver does not yet support separate-gutter mono variants.');
  }

  const structural = resolveMonoStructuralInput(config);
  if ('code' in structural) {
    return structural;
  }

  const input = structural as MonoStructuralInput;
  const totalPostCount = config.supports.postCount;
  if (totalPostCount === null || totalPostCount === undefined || totalPostCount < 2) {
    return fail('insufficient_input', 'Mono solver requires a standard post count.');
  }
  if (config.connection.type === 'freestanding' && (totalPostCount < 4 || totalPostCount % 2 !== 0)) {
    return fail('insufficient_input', 'Freestanding mono standard layout requires an even post count of at least 4.');
  }

  const lengthMm = config.dimensions.lengthMm;
  const projectionMm = config.dimensions.projectionMm;
  const referenceBeamBackFaceY = profileFaceY(input.referenceBeamProfile, 'backFaceY');
  const referenceBeamRoofBearingFaceY = profileFaceY(input.referenceBeamProfile, 'roofBearingFaceY');
  const referenceBeamUndersideZ = profileFaceZ(input.referenceBeamProfile, 'undersideZ');
  const referenceBeamRoofBearingFaceZ = profileFaceZ(input.referenceBeamProfile, 'roofBearingFaceZ');
  const supportBeamFrontFaceY = profileFaceY(input.supportBeamProfile, 'frontFaceY');
  const supportBeamUndersideZ = profileFaceZ(input.supportBeamProfile, 'undersideZ');
  const gutterBackFaceY = profileFaceY(input.gutterProfile, 'backFaceY');
  const gutterFrontFaceY = profileFaceY(input.gutterProfile, 'frontFaceY');
  const gutterUndersideZ = profileFaceZ(input.gutterProfile, 'undersideZ');
  const gutterRoofBearingFaceY = profileFaceY(input.gutterProfile, 'roofBearingFaceY');
  const gutterRoofBearingFaceZ = profileFaceZ(input.gutterProfile, 'roofBearingFaceZ');
  const rafterTopsideZ = profileFaceZ(input.rafterProfile, 'topsideZ');

  const outline = [
    point(0, 0, 0),
    point(lengthMm, 0, 0),
    point(lengthMm, projectionMm, 0),
    point(0, projectionMm, 0),
  ];

  const referenceBeamLength = lengthMm;
  const outerBeamLength = lengthMm;
  const referenceBeamCenterlineY = -referenceBeamBackFaceY;
  const houseBeamCenterlineZ = input.referenceUndersideMm - referenceBeamUndersideZ;
  const outerGutterCenterlineY = projectionMm - gutterFrontFaceY;
  const outerGutterCenterlineZ = input.outerUndersideMm - gutterUndersideZ;
  const outerBeamCenterlineY = outerGutterCenterlineY + gutterBackFaceY - supportBeamFrontFaceY;
  const outerBeamCenterlineZ = input.outerUndersideMm - supportBeamUndersideZ;
  const outerPostCount = config.connection.type === 'freestanding' ? totalPostCount / 2 : totalPostCount;
  const outerPostXPositions = equalSpacingPositions(lengthMm, outerPostCount);
  const outerPostHalfWidthMm = input.postProfile.widthMm / 2;
  const outerPostLeftOutsideFaceX = (outerPostXPositions[0] ?? 0) - outerPostHalfWidthMm;
  const outerPostRightOutsideFaceX = (outerPostXPositions[outerPostXPositions.length - 1] ?? lengthMm) + outerPostHalfWidthMm;
  const houseBeamTopMm = houseBeamCenterlineZ + referenceBeamRoofBearingFaceZ;
  const outerGutterTopMm = outerGutterCenterlineZ + gutterRoofBearingFaceZ;

  const startBearingY = referenceBeamCenterlineY + referenceBeamRoofBearingFaceY;
  const endBearingY = outerGutterCenterlineY + gutterRoofBearingFaceY;
  if (endBearingY <= startBearingY) {
    return fail('insufficient_input', 'Mono solver requires positive rafter bearing length between the reference beam and gutter.');
  }

  const roofTopStart = point(0, startBearingY, houseBeamTopMm);
  const roofTopEnd = point(0, endBearingY, outerGutterTopMm);
  const roofPlane = planeFromOriginAxes(
    roofTopStart,
    { x: lengthMm, y: 0, z: 0 },
    { x: 0, y: endBearingY - startBearingY, z: outerGutterTopMm - houseBeamTopMm },
  );
  const roofNormal = normalizeVector(roofPlane.normal);
  if (magnitude(roofNormal) === 0) {
    return fail('insufficient_input', 'Mono solver could not resolve a roof normal.');
  }

  const roofTopBoundary = [
    point(0, startBearingY, houseBeamTopMm),
    point(lengthMm, startBearingY, houseBeamTopMm),
    point(lengthMm, endBearingY, outerGutterTopMm),
    point(0, endBearingY, outerGutterTopMm),
  ];
  const roofRunVector = lineDirection(line(roofTopStart, roofTopEnd));

  const fallVector = config.roof.fallDirection === 'negativeY'
    ? normalizeVector({
        x: 0,
        y: -(endBearingY - startBearingY),
        z: houseBeamTopMm - outerGutterTopMm,
      })
    : normalizeVector({
        x: 0,
        y: endBearingY - startBearingY,
        z: outerGutterTopMm - houseBeamTopMm,
      });
  const rafterXPositions = equalSpacingPositions(lengthMm, input.rafterCount);

  const monoAcrylicCovering = resolveMonoAcrylicCoveringInput(config);
  const roofCladdingPanels: RoofCladdingPanel3D[] = [];
  const joiners: AssemblyMember3D[] = [];
  if (monoAcrylicCovering) {
    const monoAcrylicJoinerProfile = parseAssemblyMemberProfile('sp_joiners');
    if (!monoAcrylicJoinerProfile) {
      return fail('insufficient_input', 'Mono solver requires the SP joiners profile.');
    }
    const panelMidPlaneOffsetMm = monoAcrylicJoinerProfile.depthMm / 2;
    const joinerOffset = scaleVector(roofNormal, panelMidPlaneOffsetMm);
    const panelMidPlaneOrigin = addPointVector(roofPlane.origin, joinerOffset);
    const coverHousePointOnRoofPlane = addPointVector(
      point(0, startBearingY, houseBeamTopMm),
      scaleVector(roofRunVector, -monoAcrylicCovering.houseAllowanceMm),
    );
    const coverFarPointOnRoofPlane = addPointVector(
      point(0, endBearingY, outerGutterTopMm),
      scaleVector(roofRunVector, MONO_ACRYLIC_GUTTER_EMBED_MM),
    );
    const coverStartPoint = addPointVector(coverHousePointOnRoofPlane, joinerOffset);
    const coverEndPoint = addPointVector(coverFarPointOnRoofPlane, joinerOffset);
    const coveringLineLengthMm = lineLength(line(coverStartPoint, coverEndPoint));
    const structuralJoinerStart = point(0, startBearingY, houseBeamTopMm);
    const structuralJoinerEnd = point(0, endBearingY, outerGutterTopMm);
    const structuralJoinerLine = line(structuralJoinerStart, structuralJoinerEnd);
    const structuralJoinerDirection = lineDirection(structuralJoinerLine);
    const joinerHalfExtraMm = (monoAcrylicCovering.joinerPieceLengthMm - lineLength(structuralJoinerLine)) / 2;
    for (let index = 0; index < rafterXPositions.length; index += 1) {
      const x = rafterXPositions[index]!;
      const joinerStartOnPlane = addPointVector(
        point(x, structuralJoinerStart.y, structuralJoinerStart.z),
        scaleVector(structuralJoinerDirection, -joinerHalfExtraMm),
      );
      const joinerEndOnPlane = addPointVector(
        point(x, structuralJoinerEnd.y, structuralJoinerEnd.z),
        scaleVector(structuralJoinerDirection, joinerHalfExtraMm),
      );
      const memberLine = line(
        addPointVector(joinerStartOnPlane, joinerOffset),
        addPointVector(joinerEndOnPlane, joinerOffset),
      );
      joiners.push({
        id: `joiner-${index + 1}`,
        role: 'joiner',
        centerline: memberLine,
        profile: monoAcrylicJoinerProfile,
        localFrame: frameForJoiner(memberLine, roofNormal),
        metadata: {
          index: index + 1,
          runLengthMm: Math.round(lineLength(memberLine)),
          targetRunLengthMm: Math.round(monoAcrylicCovering.joinerPieceLengthMm),
        },
      });
    }

    for (let index = 0; index < rafterXPositions.length - 1; index += 1) {
      const leftX = rafterXPositions[index]!;
      const rightX = rafterXPositions[index + 1]!;
      if (rightX <= leftX) {
        continue;
      }

      const boundary = [
        point(leftX, coverStartPoint.y, coverStartPoint.z),
        point(rightX, coverStartPoint.y, coverStartPoint.z),
        point(rightX, coverEndPoint.y, coverEndPoint.z),
        point(leftX, coverEndPoint.y, coverEndPoint.z),
      ];
      const panelGeometryAreaMm2 = Math.round(polygonArea(boundary));
      roofCladdingPanels.push({
        id: `acrylic-panel-${index + 1}`,
        material: 'acrylic',
        boundary,
        thicknessMm: MONO_ACRYLIC_PANEL_THICKNESS_MM,
        plane: planeFromOriginAxes(panelMidPlaneOrigin, roofPlane.xAxis, roofPlane.yAxis),
        metadata: {
          index: index + 1,
          areaMm2: panelGeometryAreaMm2,
          bayWidthMm: Math.round(rightX - leftX),
          downslopeLengthMm: Math.round(coveringLineLengthMm),
          gutterEmbedMm: MONO_ACRYLIC_GUTTER_EMBED_MM,
          houseAllowanceMm: Math.round(monoAcrylicCovering.houseAllowanceMm),
          panelMidPlaneOffsetMm: Math.round(panelMidPlaneOffsetMm),
        },
      });
    }
  }

  const rafterCenterOffset = scaleVector(roofNormal, -rafterTopsideZ);
  const rafters: AssemblyMember3D[] = rafterXPositions.map((x, index) => {
    const memberLine = line(
      addPointVector(point(x, startBearingY, houseBeamTopMm), rafterCenterOffset),
      addPointVector(point(x, endBearingY, outerGutterTopMm), rafterCenterOffset),
    );
    return {
      id: `rafter-${index + 1}`,
      role: 'rafter',
      centerline: memberLine,
      profile: input.rafterProfile,
      localFrame: frameForRafter(memberLine, roofNormal),
      metadata: {
        index: index + 1,
      },
    };
  });

  const members: AssemblyMember3D[] = [];
  const supportConditions: Assembly3D['supportConditions'] = [];

  const attachmentEdge =
    config.connection.type === 'freestanding'
      ? null
      : line(
          point(0, 0, input.referenceUndersideMm),
          point(lengthMm, 0, input.referenceUndersideMm),
        );

  if (config.connection.type !== 'freestanding') {
    const ledgerLine = line(
      point(0, referenceBeamCenterlineY, houseBeamCenterlineZ),
      point(referenceBeamLength, referenceBeamCenterlineY, houseBeamCenterlineZ),
    );
    members.push({
      id: 'ledger',
      role: 'ledger',
      centerline: ledgerLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(ledgerLine.start),
      metadata: {
        position: 'reference',
      },
    });
    supportConditions.push({
      type: 'house_connection',
      memberId: 'ledger',
      metadata: {
        connectionType: config.connection.type,
      },
    });
  } else {
    const houseBeamLine = line(
      point(0, referenceBeamCenterlineY, houseBeamCenterlineZ),
      point(referenceBeamLength, referenceBeamCenterlineY, houseBeamCenterlineZ),
    );
    members.push({
      id: 'house-beam',
      role: 'beam',
      centerline: houseBeamLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(houseBeamLine.start),
      metadata: {
        position: 'reference',
      },
    });
  }

  const outerBeamLine = line(
    point(0, outerBeamCenterlineY, outerBeamCenterlineZ),
    point(outerBeamLength, outerBeamCenterlineY, outerBeamCenterlineZ),
  );
  members.push({
    id: 'outer-beam',
    role: 'beam',
    centerline: outerBeamLine,
    profile: input.supportBeamProfile,
    localFrame: frameForHorizontalX(outerBeamLine.start),
    metadata: {
      position: 'outer',
    },
  });

  const gutterLine = line(
    point(outerPostLeftOutsideFaceX, outerGutterCenterlineY, outerGutterCenterlineZ),
    point(outerPostRightOutsideFaceX, outerGutterCenterlineY, outerGutterCenterlineZ),
  );
  members.push({
    id: 'outer-gutter',
    role: 'gutter',
    centerline: gutterLine,
    profile: input.gutterProfile,
    localFrame: frameForHorizontalX(gutterLine.start),
    metadata: {
      gutterType: config.structural.drainage.gutterType,
      hasOurGutter: config.structural.drainage.hasOurGutter,
      bodyInsetStartMm: MONO_GUTTER_BODY_INSET_MM,
      bodyInsetEndMm: MONO_GUTTER_BODY_INSET_MM,
      endCapStartMm: MONO_GUTTER_END_CAP_MM,
      endCapEndMm: MONO_GUTTER_END_CAP_MM,
      endCapWidthMm: MONO_GUTTER_END_CAP_WIDTH_MM,
      endCapDepthMm: MONO_GUTTER_END_CAP_DEPTH_MM,
    },
  });

  const generatePosts = (prefix: string, y: number, topZ: number, xPositions: number[]) => {
    for (let index = 0; index < xPositions.length; index += 1) {
      const x = xPositions[index]!;
      const memberLine = line(point(x, y, 0), point(x, y, topZ));
      const memberId = `${prefix}-${index + 1}`;
      members.push({
        id: memberId,
        role: 'post',
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
          type: 'post_connection',
          memberId,
          metadata: {
            postConnectionType: config.supports.postConnectionType,
          },
        });
      }
      if (config.supports.groundCondition) {
        supportConditions.push({
          type: 'ground',
          memberId,
          metadata: {
            groundCondition: config.supports.groundCondition,
          },
        });
      }
    }
  };

  if (config.connection.type === 'freestanding') {
    const postsPerLine = totalPostCount / 2;
    const housePostXPositions = equalSpacingPositions(lengthMm, postsPerLine);
    generatePosts('house-post', referenceBeamCenterlineY, input.referenceUndersideMm, housePostXPositions);
    generatePosts('outer-post', outerGutterCenterlineY, input.outerUndersideMm, outerPostXPositions);
  } else {
    generatePosts('outer-post', outerGutterCenterlineY, input.outerUndersideMm, outerPostXPositions);
  }

  members.push(...joiners);
  members.push(...rafters);

  const roofPlanes: RoofPlane3D[] = [
    {
      id: 'mono-roof',
      boundary: roofTopBoundary,
      plane: roofPlane,
      fallVector,
      metadata: {
        pitchDeg: config.dimensions.roofPitchDeg,
        connectionType: config.connection.type,
      },
    },
  ];

  const quantityHooks: Assembly3D['quantityHooks'] = [
    { key: 'posts.count', quantity: members.filter((member) => member.role === 'post').length, unit: 'count' },
    {
      key: 'posts.total_length_mm',
      quantity: members.filter((member) => member.role === 'post').reduce((sum, member) => sum + Math.round(member.centerline.end.z - member.centerline.start.z), 0),
      unit: 'mm',
    },
    { key: 'rafters.count', quantity: rafters.length, unit: 'count' },
    {
      key: 'rafters.total_length_mm',
      quantity: Math.round(rafters.reduce((sum, member) => {
        const dx = member.centerline.end.x - member.centerline.start.x;
        const dy = member.centerline.end.y - member.centerline.start.y;
        const dz = member.centerline.end.z - member.centerline.start.z;
        return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }, 0)),
      unit: 'mm',
    },
    {
      key: 'support_beam.length_mm',
      quantity: members.filter((member) => member.role === 'beam').reduce((sum, member) => sum + Math.round(member.centerline.end.x - member.centerline.start.x), 0),
      unit: 'mm',
    },
    {
      key: 'gutter.length_mm',
      quantity: Math.round(gutterLine.end.x - gutterLine.start.x),
      unit: 'mm',
    },
  ];
  if (config.connection.type !== 'freestanding') {
    quantityHooks.push({
      key: 'ledger.length_mm',
      quantity: Math.round(referenceBeamLength),
      unit: 'mm',
    });
  }

  return ok({
    family: 'mono',
    datum: config.datum,
    outline,
    attachmentEdge,
    house: buildHouseReferenceGeometry({ config, attachmentEdge }),
    members,
    roofPlanes,
    roofCladdingPanels,
    supportConditions,
    quantityHooks,
    semantics: {
      connectionType: config.connection.type,
      roofType: 'mono',
      structuralZones:
        config.connection.type === 'freestanding'
          ? roofCladdingPanels.length > 0
            ? ['roof_field', 'roof_covering', 'support_line_reference', 'support_line_outer']
            : ['roof_field', 'support_line_reference', 'support_line_outer']
          : roofCladdingPanels.length > 0
            ? ['roof_field', 'roof_covering', 'support_line_outer']
            : ['roof_field', 'support_line_outer'],
    },
  });
}
