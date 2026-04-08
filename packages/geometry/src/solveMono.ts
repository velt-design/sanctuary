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
  RoofPlane3D,
  Vector3,
} from './contracts';
import { crossProduct, lineDirection, magnitude, normalizeVector, planeFromOriginAxes, scaleVector } from './math3d';
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

function requireProfile(profile: AssemblyMemberProfile | null, label: string): AssemblyMemberProfile | null {
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

function resolveMonoStructuralInput(config: GeometryConfig): MonoStructuralInput | SolveAssembly3DResult {
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
  const lengthMm = config.dimensions.lengthMm;
  const projectionMm = config.dimensions.projectionMm;
  const outline = [
    point(0, 0, 0),
    point(lengthMm, 0, 0),
    point(lengthMm, projectionMm, 0),
    point(0, projectionMm, 0),
  ];

  const referenceBeamLength = lengthMm;
  const outerBeamLength = lengthMm;
  const houseBeamTopMm = input.referenceUndersideMm + input.referenceBeamProfile.depthMm;
  const outerGutterTopMm = input.outerUndersideMm + input.gutterProfile.depthMm;
  const houseBeamCenterlineZ = input.referenceUndersideMm + input.referenceBeamProfile.depthMm / 2;
  const outerBeamCenterlineZ = input.outerUndersideMm + input.supportBeamProfile.depthMm / 2;
  const outerGutterCenterlineZ = input.outerUndersideMm + input.gutterProfile.depthMm / 2;

  const startBearingY = input.referenceBeamProfile.widthMm;
  const endBearingY = projectionMm - input.gutterProfile.widthMm;
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

  const rafterCenterOffset = scaleVector(roofNormal, -input.rafterProfile.depthMm / 2);
  const rafterXPositions = equalSpacingPositions(lengthMm, input.rafterCount);
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
      point(0, 0, houseBeamCenterlineZ),
      point(referenceBeamLength, 0, houseBeamCenterlineZ),
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
      point(0, 0, houseBeamCenterlineZ),
      point(referenceBeamLength, 0, houseBeamCenterlineZ),
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
    point(0, projectionMm, outerBeamCenterlineZ),
    point(outerBeamLength, projectionMm, outerBeamCenterlineZ),
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
    point(0, projectionMm, outerGutterCenterlineZ),
    point(lengthMm, projectionMm, outerGutterCenterlineZ),
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
    },
  });

  const totalPostCount = config.supports.postCount;
  if (totalPostCount === null || totalPostCount === undefined || totalPostCount < 2) {
    return fail('insufficient_input', 'Mono solver requires a standard post count.');
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
      return fail('insufficient_input', 'Freestanding mono standard layout requires an even post count of at least 4.');
    }
    const postsPerLine = totalPostCount / 2;
    generatePosts('house-post', 0, houseBeamCenterlineZ, postsPerLine);
    generatePosts('outer-post', projectionMm, outerBeamCenterlineZ, postsPerLine);
  } else {
    generatePosts('outer-post', projectionMm, outerBeamCenterlineZ, totalPostCount);
  }

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
    supportConditions,
    quantityHooks,
    semantics: {
      connectionType: config.connection.type,
      roofType: 'mono',
      structuralZones: config.connection.type === 'freestanding' ? ['roof_field', 'support_line_reference', 'support_line_outer'] : ['roof_field', 'support_line_outer'],
    },
  });
}
