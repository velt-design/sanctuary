import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberProfile,
  DatumFrame3,
  GeometryConfig,
  Line3,
  Point3,
  RoofPlane3D,
  Vector3,
} from './contracts';
import { crossProduct, lineDirection, lineLength, magnitude, normalizeVector, planeFromOriginAxes } from './math3d';
import { buildHouseReferenceGeometry } from './houseModel';
import { resolveAssemblyMemberProfileAnchors } from './profiles';
import type { SolveAssembly3DErrorCode, SolveAssembly3DResult } from './solve.types';

type SolveAssembly3DFailure = Extract<SolveAssembly3DResult, { ok: false }>;

type HipCornerStructuralInput = {
  referenceUndersideMm: number;
  outerUndersideMm: number;
  referenceBeamProfile: AssemblyMemberProfile;
  supportBeamProfile: AssemblyMemberProfile;
  gutterProfile: AssemblyMemberProfile;
  rafterProfile: AssemblyMemberProfile;
  postProfile: AssemblyMemberProfile;
  rafterSpacingMm: number;
};

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

function profileFaceZ(profile: AssemblyMemberProfile, face: 'undersideZ' | 'topsideZ' | 'roofBearingFaceZ'): number {
  return resolveAssemblyMemberProfileAnchors(profile)[face];
}

function resolveHipCornerStructuralInput(config: GeometryConfig): HipCornerStructuralInput | SolveAssembly3DFailure {
  if (config.roof.boxPerimeterEnabled) {
    return fail('unsupported_variant', 'Hip-corner geometry does not support box perimeter mode.');
  }
  if (config.roof.overhangMm > 0) {
    return fail('unsupported_variant', 'Hip-corner geometry does not yet support overhang geometry.');
  }
  if (config.supports.postMode !== 'standard' || (config.supports.postPositions?.length ?? 0) > 0) {
    return fail('unsupported_variant', 'Hip-corner geometry only supports the standard post layout.');
  }
  if (config.structural.drainage.gutterAssemblyMode === 'separate') {
    return fail('unsupported_variant', 'Hip-corner geometry does not yet support separate-gutter layouts.');
  }
  if (config.dimensions.lengthBMm === null || config.dimensions.projectionBMm === null) {
    return fail('insufficient_input', 'Hip-corner geometry requires length B and projection B.');
  }

  const referenceUndersideMm = config.structural.heights.referenceUndersideMm ?? config.structural.heights.houseUndersideMm;
  if (referenceUndersideMm === null || referenceUndersideMm === undefined) {
    return fail('insufficient_input', 'Hip-corner geometry requires a reference underside height.');
  }
  if (config.structural.heights.outerUndersideMm === null || config.structural.heights.outerUndersideMm === undefined) {
    return fail('insufficient_input', 'Hip-corner geometry requires an outer underside height.');
  }

  const referenceBeamProfile =
    config.connection.type === 'freestanding'
      ? requireProfile(config.structural.profiles.supportBeam)
      : requireProfile(config.structural.profiles.ledger);
  if (!referenceBeamProfile) {
    return fail('insufficient_input', 'Hip-corner geometry requires a reference beam profile.');
  }

  const supportBeamProfile = requireProfile(config.structural.profiles.supportBeam);
  const gutterProfile = requireProfile(config.structural.profiles.gutter);
  const rafterProfile = requireProfile(config.structural.profiles.rafter);
  const postProfile = requireProfile(config.structural.profiles.post);
  if (!supportBeamProfile || !gutterProfile || !rafterProfile || !postProfile) {
    return fail('insufficient_input', 'Hip-corner geometry requires support beam, gutter, rafter, and post profiles.');
  }

  const rafterSpacingMm = config.structural.framing.rafterSpacingMm;
  if (rafterSpacingMm === null || rafterSpacingMm === undefined || rafterSpacingMm <= 0) {
    return fail('insufficient_input', 'Hip-corner geometry requires rafter spacing.');
  }

  return {
    referenceUndersideMm,
    outerUndersideMm: config.structural.heights.outerUndersideMm,
    referenceBeamProfile,
    supportBeamProfile,
    gutterProfile,
    rafterProfile,
    postProfile,
    rafterSpacingMm,
  };
}

export function solveHipCornerAssembly3D(config: GeometryConfig): SolveAssembly3DResult {
  const structural = resolveHipCornerStructuralInput(config);
  if ('code' in structural) {
    return structural;
  }

  const input = structural;
  const lengthAMm = config.dimensions.lengthMm;
  const spanAMm = config.dimensions.projectionMm;
  const lengthBMm = config.dimensions.lengthBMm ?? 0;
  const spanBMm = config.dimensions.projectionBMm ?? 0;
  const totalSpanMm = spanAMm + spanBMm;
  const outerBUndersideMm =
    input.referenceUndersideMm +
    ((input.outerUndersideMm - input.referenceUndersideMm) / Math.max(spanAMm, 1)) * totalSpanMm;
  const referenceTopRawMm = input.referenceUndersideMm + input.referenceBeamProfile.depthMm;
  const outerATopRawMm = input.outerUndersideMm + input.supportBeamProfile.depthMm;
  const outerBTopRawMm = outerBUndersideMm + input.supportBeamProfile.depthMm;
  const deltaATopMm = Math.max(1, Math.abs(referenceTopRawMm - outerATopRawMm));
  const deltaBTopMm = Math.max(1, Math.abs(outerATopRawMm - outerBTopRawMm));
  const referenceTopMm =
    config.roof.fallDirection === 'negativeY'
      ? Math.min(referenceTopRawMm, outerATopRawMm)
      : Math.max(referenceTopRawMm, outerATopRawMm);
  const outerATopMm =
    config.roof.fallDirection === 'negativeY'
      ? referenceTopMm + deltaATopMm
      : referenceTopMm - deltaATopMm;
  const outerBTopMm =
    config.roof.fallDirection === 'negativeY'
      ? outerATopMm + deltaBTopMm
      : outerATopMm - deltaBTopMm;
  const outerAResolvedUndersideMm = outerATopMm - input.supportBeamProfile.depthMm;
  const outerBResolvedUndersideMm = outerBTopMm - input.supportBeamProfile.depthMm;
  const fallVectorA =
    config.roof.fallDirection === 'negativeY'
      ? normalizeVector({ x: 0, y: -spanAMm, z: referenceTopMm - outerATopMm })
      : normalizeVector({ x: 0, y: spanAMm, z: outerATopMm - referenceTopMm });
  const fallVectorB =
    config.roof.fallDirection === 'negativeY'
      ? normalizeVector({ x: 0, y: -spanBMm, z: outerATopMm - outerBTopMm })
      : normalizeVector({ x: 0, y: spanBMm, z: outerBTopMm - outerATopMm });

  const outline = [
    point(0, 0, 0),
    point(lengthAMm, 0, 0),
    point(lengthAMm, spanAMm, 0),
    point(lengthBMm, spanAMm, 0),
    point(lengthBMm, totalSpanMm, 0),
    point(0, totalSpanMm, 0),
  ];

  const roofPlaneA = planeFromOriginAxes(
    point(0, 0, referenceTopMm),
    { x: lengthAMm, y: 0, z: 0 },
    { x: 0, y: spanAMm, z: outerATopMm - referenceTopMm },
  );
  const roofPlaneB = planeFromOriginAxes(
    point(0, spanAMm, outerATopMm),
    { x: lengthBMm, y: 0, z: 0 },
    { x: 0, y: spanBMm, z: outerBTopMm - outerATopMm },
  );
  const roofNormalA = normalizeVector(roofPlaneA.normal);
  const roofNormalB = normalizeVector(roofPlaneB.normal);
  if (magnitude(roofNormalA) === 0 || magnitude(roofNormalB) === 0) {
    return fail('insufficient_input', 'Hip-corner geometry could not resolve roof normals.');
  }

  const memberCenterlineZ = (undersideMm: number, profile: AssemblyMemberProfile) =>
    undersideMm - profileFaceZ(profile, 'undersideZ');

  const members: AssemblyMember3D[] = [];
  const supportConditions: Assembly3D['supportConditions'] = [];
  const attachmentEdge =
    config.connection.type === 'freestanding'
      ? null
      : line(
          point(0, 0, input.referenceUndersideMm),
          point(lengthAMm, 0, input.referenceUndersideMm),
        );

  const referenceBeamLine = line(
    point(0, 0, memberCenterlineZ(input.referenceUndersideMm, input.referenceBeamProfile)),
    point(lengthAMm, 0, memberCenterlineZ(input.referenceUndersideMm, input.referenceBeamProfile)),
  );
  if (config.connection.type === 'freestanding') {
    members.push({
      id: 'house-beam',
      role: 'beam',
      centerline: referenceBeamLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(referenceBeamLine.start),
      metadata: { position: 'reference', wing: 'A' },
    });
  } else {
    members.push({
      id: 'ledger',
      role: 'ledger',
      centerline: referenceBeamLine,
      profile: input.referenceBeamProfile,
      localFrame: frameForHorizontalX(referenceBeamLine.start),
      metadata: { position: 'reference', wing: 'A' },
    });
    supportConditions.push({
      type: 'house_connection',
      memberId: 'ledger',
      metadata: { connectionType: config.connection.type },
    });
  }

  const outerBeamALine = line(
    point(0, spanAMm, memberCenterlineZ(outerAResolvedUndersideMm, input.supportBeamProfile)),
    point(lengthAMm, spanAMm, memberCenterlineZ(outerAResolvedUndersideMm, input.supportBeamProfile)),
  );
  const outerGutterALine = line(
    point(0, spanAMm, memberCenterlineZ(outerAResolvedUndersideMm, input.gutterProfile)),
    point(lengthAMm, spanAMm, memberCenterlineZ(outerAResolvedUndersideMm, input.gutterProfile)),
  );
  const outerBeamBLine = line(
    point(0, totalSpanMm, memberCenterlineZ(outerBResolvedUndersideMm, input.supportBeamProfile)),
    point(lengthBMm, totalSpanMm, memberCenterlineZ(outerBResolvedUndersideMm, input.supportBeamProfile)),
  );
  const outerGutterBLine = line(
    point(0, totalSpanMm, memberCenterlineZ(outerBResolvedUndersideMm, input.gutterProfile)),
    point(lengthBMm, totalSpanMm, memberCenterlineZ(outerBResolvedUndersideMm, input.gutterProfile)),
  );

  for (const [id, memberLine, profile, wing] of [
    ['outer-beam-a', outerBeamALine, input.supportBeamProfile, 'A'],
    ['outer-gutter-a', outerGutterALine, input.gutterProfile, 'A'],
    ['outer-beam-b', outerBeamBLine, input.supportBeamProfile, 'B'],
    ['outer-gutter-b', outerGutterBLine, input.gutterProfile, 'B'],
  ] as const) {
    members.push({
      id,
      role: id.includes('gutter') ? 'gutter' : 'beam',
      centerline: memberLine,
      profile,
      localFrame: frameForHorizontalX(memberLine.start),
      metadata: { wing, position: id.includes('gutter') ? 'outer-gutter' : 'outer-beam' },
    });
  }

  const generatePosts = (prefix: string, y: number, topZ: number, lengthMm: number, minCount = 2) => {
    const spacingCount = Math.max(2, Math.round(lengthMm / input.rafterSpacingMm) + 1);
    const positions = equalSpacingPositions(lengthMm, Math.max(minCount, Math.min(spacingCount, 4)));
    for (let index = 0; index < positions.length; index += 1) {
      const x = positions[index]!;
      const memberId = `${prefix}-${index + 1}`;
      const memberLine = line(point(x, y, 0), point(x, y, topZ));
      members.push({
        id: memberId,
        role: 'post',
        centerline: memberLine,
        profile: input.postProfile,
        localFrame: frameForVerticalMember(memberLine.start),
        metadata: {
          index: index + 1,
          position: prefix,
          wing: prefix.endsWith('a') ? 'A' : prefix.endsWith('b') ? 'B' : 'A',
        },
      });
      if (config.supports.postConnectionType) {
        supportConditions.push({
          type: 'post_connection',
          memberId,
          metadata: { postConnectionType: config.supports.postConnectionType },
        });
      }
      if (config.supports.groundCondition) {
        supportConditions.push({
          type: 'ground',
          memberId,
          metadata: { groundCondition: config.supports.groundCondition },
        });
      }
    }
  };

  if (config.connection.type === 'freestanding') {
    generatePosts('reference-post-a', 0, input.referenceUndersideMm, lengthAMm);
  }
  generatePosts('outer-post-a', spanAMm, outerAResolvedUndersideMm, lengthAMm);
  generatePosts('outer-post-b', totalSpanMm, outerBResolvedUndersideMm, lengthBMm);

  const createRafters = (wing: 'A' | 'B', lengthMm: number, startY: number, endY: number, startZ: number, endZ: number, roofNormal: Vector3) => {
    const count = Math.max(2, Math.round(lengthMm / input.rafterSpacingMm) + 1);
    const positions = equalSpacingPositions(lengthMm, count);
    return positions.map((x, index) => {
      const memberLine = line(point(x, startY, startZ), point(x, endY, endZ));
      return {
        id: `${wing.toLowerCase()}-rafter-${index + 1}`,
        role: 'rafter' as const,
        centerline: memberLine,
        profile: input.rafterProfile,
        localFrame: frameForRafter(memberLine, roofNormal),
        metadata: {
          index: index + 1,
          wing,
        },
      };
    });
  };

  members.push(
    ...createRafters('A', lengthAMm, 0, spanAMm, referenceTopMm, outerATopMm, roofNormalA),
    ...createRafters('B', lengthBMm, spanAMm, totalSpanMm, outerATopMm, outerBTopMm, roofNormalB),
  );

  const roofPlanes: RoofPlane3D[] = [
    {
      id: 'hip-corner-roof-a',
      boundary: [
        point(0, 0, referenceTopMm),
        point(lengthAMm, 0, referenceTopMm),
        point(lengthAMm, spanAMm, outerATopMm),
        point(0, spanAMm, outerATopMm),
      ],
      plane: roofPlaneA,
      fallVector: fallVectorA,
      metadata: { wing: 'A', pitchDeg: config.dimensions.roofPitchDeg },
    },
    {
      id: 'hip-corner-roof-b',
      boundary: [
        point(0, spanAMm, outerATopMm),
        point(lengthBMm, spanAMm, outerATopMm),
        point(lengthBMm, totalSpanMm, outerBTopMm),
        point(0, totalSpanMm, outerBTopMm),
      ],
      plane: roofPlaneB,
      fallVector: fallVectorB,
      metadata: { wing: 'B', pitchDeg: config.dimensions.roofPitchDeg },
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
    {
      key: 'support_beams.total_length_mm',
      quantity: Math.round(lineLength(outerBeamALine) + lineLength(outerBeamBLine)),
      unit: 'mm',
    },
    {
      key: 'gutters.total_length_mm',
      quantity: Math.round(lineLength(outerGutterALine) + lineLength(outerGutterBLine)),
      unit: 'mm',
    },
    {
      key: 'roof_planes.count',
      quantity: roofPlanes.length,
      unit: 'count',
    },
  ];
  if (config.connection.type !== 'freestanding') {
    quantityHooks.push({
      key: 'ledger.length_mm',
      quantity: Math.round(lineLength(referenceBeamLine)),
      unit: 'mm',
    });
  }

  return ok({
    family: 'hip_corner',
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
    roofCladdingPanels: [],
    supportConditions,
    quantityHooks,
    semantics: {
      connectionType: config.connection.type,
      roofType: 'hip_corner',
      structuralZones:
        config.connection.type === 'freestanding'
          ? ['roof_field_a', 'roof_field_b', 'support_line_reference', 'support_line_outer_a', 'support_line_outer_b']
          : ['roof_field_a', 'roof_field_b', 'support_line_outer_a', 'support_line_outer_b'],
      primaryDimensionsMm: {
        length: lengthAMm,
        projection: spanAMm,
      },
      secondaryDimensionsMm: {
        length: lengthBMm,
        projection: spanBMm,
      },
    },
  });
}
