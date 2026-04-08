import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberProfile,
  DatumFrame3,
  GeometryConfig,
  HouseReferenceGeometry,
  Line3,
  Plane3,
  Point3,
  RoofPlane3D,
  Vector3,
} from './contracts';
import {
  crossProduct,
  lineDirection,
  lineLength,
  magnitude,
  normalizeVector,
  planeFromOriginAxes,
  scaleVector,
} from './math3d';
import type { SolveAssembly3DErrorCode, SolveAssembly3DResult } from './solve.types';

function ok(value: Assembly3D): SolveAssembly3DResult {
  return { ok: true, value };
}

function fail(code: SolveAssembly3DErrorCode, error: string): SolveAssembly3DResult {
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

function frameForVerticalMember(origin: Point3): DatumFrame3 {
  return frameFromAxes(origin, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 });
}

function frameForHorizontalX(origin: Point3): DatumFrame3 {
  return frameFromAxes(origin, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
}

function frameForRafter(memberLine: Line3, roofNormal: Vector3): DatumFrame3 {
  return frameFromAxes(memberLine.start, lineDirection(memberLine), roofNormal);
}

function equalSpacingPositions(lengthMm: number, count: number): number[] {
  if (count < 2) return [0, lengthMm];
  const spacingMm = lengthMm / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => Math.round(spacingMm * index));
}

function requireProfile(profile: AssemblyMemberProfile | null): AssemblyMemberProfile | null {
  if (profile && profile.widthMm > 0 && profile.depthMm > 0) {
    return profile;
  }
  return null;
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

type GableStructuralInput = {
  eaveUndersideMm: number;
  ridgePositionMm: number;
  referenceBeamProfile: AssemblyMemberProfile;
  supportBeamProfile: AssemblyMemberProfile;
  gutterProfile: AssemblyMemberProfile;
  ridgeProfile: AssemblyMemberProfile;
  rafterProfile: AssemblyMemberProfile;
  postProfile: AssemblyMemberProfile;
  rafterCount: number;
  houseEaveGutterMode: 'house' | 'our';
  outerEaveGutterMode: 'house' | 'our';
};

function resolveGableStructuralInput(config: GeometryConfig): GableStructuralInput | SolveAssembly3DResult {
  if (config.roof.overhangMm > 0) {
    return fail('unsupported_variant', 'Gable solver does not yet support overhang geometry.');
  }
  if (config.supports.postMode !== 'standard' || (config.supports.postPositions?.length ?? 0) > 0) {
    return fail('unsupported_variant', 'Gable solver only supports the standard post layout.');
  }
  if (config.structural.drainage.gutterAssemblyMode === 'separate') {
    return fail('unsupported_variant', 'Gable solver does not yet support separate-gutter gable variants.');
  }
  if (config.gable.endFramesMode !== 'none') {
    return fail('unsupported_variant', 'Gable solver does not yet support gable end frames.');
  }

  const expectedHouseMode = config.connection.type === 'freestanding' ? 'our' : 'house';
  if (config.gable.houseEaveGutterMode !== expectedHouseMode || config.gable.outerEaveGutterMode !== 'our') {
    return fail('unsupported_variant', 'Gable solver only supports the standard baseline eave gutter configuration.');
  }

  const houseUndersideMm = config.structural.heights.houseUndersideMm ?? config.structural.heights.referenceUndersideMm;
  const outerUndersideMm = config.structural.heights.outerUndersideMm ?? config.structural.heights.referenceUndersideMm;
  const eaveUndersideMm = houseUndersideMm ?? outerUndersideMm ?? config.structural.heights.referenceUndersideMm;
  if (eaveUndersideMm === null || eaveUndersideMm === undefined) {
    return fail('insufficient_input', 'Gable solver requires an eave underside height.');
  }
  if (
    houseUndersideMm !== null &&
    houseUndersideMm !== undefined &&
    outerUndersideMm !== null &&
    outerUndersideMm !== undefined &&
    houseUndersideMm !== outerUndersideMm
  ) {
    return fail('unsupported_variant', 'Gable solver currently requires symmetrical eave underside heights.');
  }

  const referenceBeamProfile =
    config.connection.type === 'freestanding'
      ? requireProfile(config.structural.profiles.supportBeam)
      : requireProfile(config.structural.profiles.ledger);
  if (!referenceBeamProfile) {
    return fail('insufficient_input', 'Gable solver requires the house-side eave support profile.');
  }

  const supportBeamProfile = requireProfile(config.structural.profiles.supportBeam);
  if (!supportBeamProfile) {
    return fail('insufficient_input', 'Gable solver requires the outer eave support profile.');
  }

  const gutterProfile = requireProfile(config.structural.profiles.gutter);
  if (!gutterProfile) {
    return fail('insufficient_input', 'Gable solver requires the gutter profile.');
  }

  const ridgeProfile = requireProfile(config.structural.profiles.ridge);
  if (!ridgeProfile) {
    return fail('insufficient_input', 'Gable solver requires the ridge profile.');
  }

  const rafterProfile = requireProfile(config.structural.profiles.rafter);
  if (!rafterProfile) {
    return fail('insufficient_input', 'Gable solver requires the rafter profile.');
  }

  const postProfile = requireProfile(config.structural.profiles.post);
  if (!postProfile) {
    return fail('insufficient_input', 'Gable solver requires the post profile.');
  }

  const rafterCount = config.structural.framing.rafterCount;
  if (rafterCount === null || rafterCount === undefined || rafterCount < 2) {
    return fail('insufficient_input', 'Gable solver requires a rafter count.');
  }
  if (
    config.structural.framing.rafterSpacingMm === null ||
    config.structural.framing.rafterSpacingMm === undefined ||
    config.structural.framing.rafterSpacingMm <= 0
  ) {
    return fail('insufficient_input', 'Gable solver requires rafter spacing.');
  }

  const ridgePositionMm = config.gable.ridgePositionMm;
  if (ridgePositionMm === null || ridgePositionMm === undefined || ridgePositionMm <= 0 || ridgePositionMm >= config.dimensions.projectionMm) {
    return fail('insufficient_input', 'Gable solver requires a centered ridge position within the roof span.');
  }
  if (ridgePositionMm !== config.dimensions.projectionMm / 2) {
    return fail('unsupported_variant', 'Gable solver currently requires a centered ridge.');
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
    rafterCount,
    houseEaveGutterMode: config.gable.houseEaveGutterMode as 'house' | 'our',
    outerEaveGutterMode: config.gable.outerEaveGutterMode as 'house' | 'our',
  };
}

export function solveGableAssembly3D(config: GeometryConfig): SolveAssembly3DResult {
  const structural = resolveGableStructuralInput(config);
  if ('code' in structural) {
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

  const houseSupportCenterlineZ = input.eaveUndersideMm + input.referenceBeamProfile.depthMm / 2;
  const outerSupportCenterlineZ = input.eaveUndersideMm + input.supportBeamProfile.depthMm / 2;
  const houseGutterCenterlineZ = input.eaveUndersideMm + input.gutterProfile.depthMm / 2;
  const outerGutterCenterlineZ = input.eaveUndersideMm + input.gutterProfile.depthMm / 2;
  const ridgeCenterlineZ =
    Math.max(
      input.eaveUndersideMm + input.referenceBeamProfile.depthMm,
      input.eaveUndersideMm + input.supportBeamProfile.depthMm,
      input.houseEaveGutterMode === 'our' ? input.eaveUndersideMm + input.gutterProfile.depthMm : 0,
      input.outerEaveGutterMode === 'our' ? input.eaveUndersideMm + input.gutterProfile.depthMm : 0,
    ) +
    Math.tan((config.dimensions.roofPitchDeg * Math.PI) / 180) * ridgeY -
    input.ridgeProfile.depthMm / 2;

  const houseEaveTopMm = Math.max(
    input.eaveUndersideMm + input.referenceBeamProfile.depthMm,
    input.houseEaveGutterMode === 'our' ? input.eaveUndersideMm + input.gutterProfile.depthMm : 0,
    ridgeCenterlineZ + input.ridgeProfile.depthMm / 2 - Math.tan((config.dimensions.roofPitchDeg * Math.PI) / 180) * ridgeY,
  );
  const outerEaveTopMm = Math.max(
    input.eaveUndersideMm + input.supportBeamProfile.depthMm,
    input.outerEaveGutterMode === 'our' ? input.eaveUndersideMm + input.gutterProfile.depthMm : 0,
    ridgeCenterlineZ + input.ridgeProfile.depthMm / 2 - Math.tan((config.dimensions.roofPitchDeg * Math.PI) / 180) * (projectionMm - ridgeY),
  );
  const ridgeTopMm = ridgeCenterlineZ + input.ridgeProfile.depthMm / 2;

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
    return fail('insufficient_input', 'Gable solver could not resolve roof normals.');
  }

  const houseBearingY = input.houseEaveGutterMode === 'our' ? input.gutterProfile.widthMm : input.referenceBeamProfile.widthMm;
  const outerBearingY = projectionMm - (input.outerEaveGutterMode === 'our' ? input.gutterProfile.widthMm : input.supportBeamProfile.widthMm);
  if (houseBearingY >= ridgeY || outerBearingY <= ridgeY) {
    return fail('insufficient_input', 'Gable solver requires positive rafter bearing length between the eaves and ridge.');
  }

  const houseRafterCenterOffset = scaleVector(houseRoofNormal, -input.rafterProfile.depthMm / 2);
  const outerRafterCenterOffset = scaleVector(outerRoofNormal, -input.rafterProfile.depthMm / 2);
  const rafterXPositions = equalSpacingPositions(lengthMm, input.rafterCount);

  const houseRafters: AssemblyMember3D[] = rafterXPositions.map((x, index) => {
    const memberLine = line(
      addPointVector(point(x, houseBearingY, houseEaveTopMm), houseRafterCenterOffset),
      addPointVector(point(x, ridgeY, ridgeTopMm), houseRafterCenterOffset),
    );
    return {
      id: `house-rafter-${index + 1}`,
      role: 'rafter',
      centerline: memberLine,
      profile: input.rafterProfile,
      localFrame: frameForRafter(memberLine, houseRoofNormal),
      metadata: {
        index: index + 1,
        slope: 'house',
      },
    };
  });

  const outerRafters: AssemblyMember3D[] = rafterXPositions.map((x, index) => {
    const memberLine = line(
      addPointVector(point(x, ridgeY, ridgeTopMm), outerRafterCenterOffset),
      addPointVector(point(x, outerBearingY, outerEaveTopMm), outerRafterCenterOffset),
    );
    return {
      id: `outer-rafter-${index + 1}`,
      role: 'rafter',
      centerline: memberLine,
      profile: input.rafterProfile,
      localFrame: frameForRafter(memberLine, outerRoofNormal),
      metadata: {
        index: index + 1,
        slope: 'outer',
      },
    };
  });

  const members: AssemblyMember3D[] = [];
  const supportConditions: Assembly3D['supportConditions'] = [];

  const attachmentEdge =
    config.connection.type === 'freestanding'
      ? null
      : line(point(0, 0, input.eaveUndersideMm), point(lengthMm, 0, input.eaveUndersideMm));

  if (config.connection.type !== 'freestanding') {
    const ledgerLine = line(
      point(0, 0, houseSupportCenterlineZ),
      point(lengthMm, 0, houseSupportCenterlineZ),
    );
    members.push({
      id: 'ledger',
      role: 'ledger',
      centerline: ledgerLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(ledgerLine.start),
      metadata: {
        position: 'house-eave',
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
      point(0, 0, houseSupportCenterlineZ),
      point(lengthMm, 0, houseSupportCenterlineZ),
    );
    members.push({
      id: 'house-beam',
      role: 'beam',
      centerline: houseBeamLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(houseBeamLine.start),
      metadata: {
        position: 'house-eave',
      },
    });

    const houseGutterLine = line(
      point(0, 0, houseGutterCenterlineZ),
      point(lengthMm, 0, houseGutterCenterlineZ),
    );
    members.push({
      id: 'house-gutter',
      role: 'gutter',
      centerline: houseGutterLine,
      profile: input.gutterProfile,
      localFrame: frameForHorizontalX(houseGutterLine.start),
      metadata: {
        position: 'house-eave',
        gutterType: config.structural.drainage.gutterType,
        hasOurGutter: config.structural.drainage.hasOurGutter,
      },
    });
  }

  const outerBeamLine = line(
    point(0, projectionMm, outerSupportCenterlineZ),
    point(lengthMm, projectionMm, outerSupportCenterlineZ),
  );
  members.push({
    id: 'outer-beam',
    role: 'beam',
    centerline: outerBeamLine,
    profile: input.supportBeamProfile,
    localFrame: frameForHorizontalX(outerBeamLine.start),
    metadata: {
      position: 'outer-eave',
    },
  });

  const outerGutterLine = line(
    point(0, projectionMm, outerGutterCenterlineZ),
    point(lengthMm, projectionMm, outerGutterCenterlineZ),
  );
  members.push({
    id: 'outer-gutter',
    role: 'gutter',
    centerline: outerGutterLine,
    profile: input.gutterProfile,
    localFrame: frameForHorizontalX(outerGutterLine.start),
    metadata: {
      position: 'outer-eave',
      gutterType: config.structural.drainage.gutterType,
      hasOurGutter: config.structural.drainage.hasOurGutter,
    },
  });

  const ridgeLine = line(
    point(0, ridgeY, ridgeCenterlineZ),
    point(lengthMm, ridgeY, ridgeCenterlineZ),
  );
  members.push({
    id: 'ridge',
    role: 'ridge',
    centerline: ridgeLine,
    profile: input.ridgeProfile,
    localFrame: frameForHorizontalX(ridgeLine.start),
  });

  const totalPostCount = config.supports.postCount;
  if (totalPostCount === null || totalPostCount === undefined || totalPostCount < 2) {
    return fail('insufficient_input', 'Gable solver requires a standard post count.');
  }

  const generatePosts = (prefix: string, y: number, topZ: number, count: number) => {
    const xPositions = equalSpacingPositions(lengthMm, count);
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
      supportConditions.push({
        type: 'post_connection',
        memberId,
        metadata: {
          postConnectionType: config.supports.postConnectionType,
        },
      });
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
    if (totalPostCount < 4 || totalPostCount % 2 !== 0) {
      return fail('insufficient_input', 'Freestanding gable standard layout requires an even post count of at least 4.');
    }
    const postsPerLine = totalPostCount / 2;
    generatePosts('house-post', 0, houseSupportCenterlineZ, postsPerLine);
    generatePosts('outer-post', projectionMm, outerSupportCenterlineZ, postsPerLine);
  } else {
    generatePosts('outer-post', projectionMm, outerSupportCenterlineZ, totalPostCount);
  }

  members.push(...houseRafters, ...outerRafters);

  const roofPlanes: RoofPlane3D[] = [
    {
      id: 'gable-house-roof',
      boundary: [
        point(0, 0, houseEaveTopMm),
        point(lengthMm, 0, houseEaveTopMm),
        point(lengthMm, ridgeY, ridgeTopMm),
        point(0, ridgeY, ridgeTopMm),
      ],
      plane: houseRoofPlane,
      fallVector: normalizeVector({ x: 0, y: -ridgeY, z: houseEaveTopMm - ridgeTopMm }),
      metadata: {
        pitchDeg: config.dimensions.roofPitchDeg,
        slope: 'house',
      },
    },
    {
      id: 'gable-outer-roof',
      boundary: [
        point(0, ridgeY, ridgeTopMm),
        point(lengthMm, ridgeY, ridgeTopMm),
        point(lengthMm, projectionMm, outerEaveTopMm),
        point(0, projectionMm, outerEaveTopMm),
      ],
      plane: outerRoofPlane,
      fallVector: normalizeVector({ x: 0, y: projectionMm - ridgeY, z: outerEaveTopMm - ridgeTopMm }),
      metadata: {
        pitchDeg: config.dimensions.roofPitchDeg,
        slope: 'outer',
      },
    },
  ];

  const postMembers = members.filter((member) => member.role === 'post');
  const rafterMembers = members.filter((member) => member.role === 'rafter');
  const quantityHooks: Assembly3D['quantityHooks'] = [
    { key: 'posts.count', quantity: postMembers.length, unit: 'count' },
    {
      key: 'posts.total_length_mm',
      quantity: Math.round(postMembers.reduce((sum, member) => sum + lineLength(member.centerline), 0)),
      unit: 'mm',
    },
    { key: 'rafters.count', quantity: rafterMembers.length, unit: 'count' },
    {
      key: 'rafters.total_length_mm',
      quantity: Math.round(rafterMembers.reduce((sum, member) => sum + lineLength(member.centerline), 0)),
      unit: 'mm',
    },
    { key: 'ridge.length_mm', quantity: Math.round(lineLength(ridgeLine)), unit: 'mm' },
    { key: 'house_eave_support.length_mm', quantity: lengthMm, unit: 'mm' },
    { key: 'outer_eave_support.length_mm', quantity: lengthMm, unit: 'mm' },
    { key: 'outer_gutter.length_mm', quantity: Math.round(lineLength(outerGutterLine)), unit: 'mm' },
    { key: 'roof_planes.count', quantity: roofPlanes.length, unit: 'count' },
  ];
  if (config.connection.type === 'freestanding') {
    quantityHooks.push({
      key: 'house_gutter.length_mm',
      quantity: lengthMm,
      unit: 'mm',
    });
  }

  return ok({
    family: 'gable',
    datum: config.datum,
    outline,
    attachmentEdge,
    house: buildHouseReferenceGeometry({ config, attachmentEdge }),
    members,
    roofPlanes,
    supportConditions,
    quantityHooks,
    semantics: {
      connectionType: config.connection.type,
      roofType: 'gable',
      structuralZones:
        config.connection.type === 'freestanding'
          ? ['roof_field_house', 'roof_field_outer', 'ridge_line', 'support_line_house', 'support_line_outer']
          : ['roof_field_house', 'roof_field_outer', 'ridge_line', 'support_line_outer'],
    },
  });
}
