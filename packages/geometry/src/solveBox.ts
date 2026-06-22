import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberProfile,
  BoxGutterMode,
  DatumFrame3,
  GeometryConfig,
  Line3,
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
import { buildHouseReferenceGeometry } from './houseModel';
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

function frameForSlopedHorizontalMember(memberLine: Line3): DatumFrame3 {
  return frameFromXAxisZAxis(memberLine.start, lineDirection(memberLine), { x: 0, y: 0, z: 1 });
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

type BoxStructuralInput = {
  houseUndersideMm: number;
  outerUndersideMm: number;
  ledgerProfile: AssemblyMemberProfile;
  boxPerimeterProfile: AssemblyMemberProfile;
  gutterProfile: AssemblyMemberProfile;
  rafterProfile: AssemblyMemberProfile;
  postProfile: AssemblyMemberProfile;
  rafterCount: number;
  houseSetbackMm: number;
  outerSetbackMm: number;
  effectiveRunMm: number;
  riseMm: number;
  maxFallMm: number;
  roofClearanceAboveRafterMm: number;
  houseEdgeGutterMode: BoxGutterMode;
  farEdgeGutterMode: BoxGutterMode;
};

function resolveBoxStructuralInput(config: GeometryConfig): BoxStructuralInput | SolveAssembly3DFailure {
  if (config.connection.type === 'freestanding') {
    return fail('unsupported_variant', 'Box solver currently supports attached box-perimeter layouts only.');
  }
  if (config.roof.overhangMm > 0) {
    return fail('unsupported_variant', 'Box solver does not yet support overhang geometry.');
  }
  if (config.supports.postMode !== 'standard' || (config.supports.postPositions?.length ?? 0) > 0) {
    return fail('unsupported_variant', 'Box solver only supports the standard post layout.');
  }
  if (config.structural.drainage.gutterAssemblyMode === 'separate') {
    return fail('unsupported_variant', 'Box solver does not yet support separate-gutter box variants.');
  }
  if (!config.roof.boxPerimeterEnabled) {
    return fail('unsupported_variant', 'Box solver requires box-perimeter roof mode.');
  }
  if (config.box.houseEdgeGutterMode !== 'house' || config.box.farEdgeGutterMode !== 'our') {
    return fail('unsupported_variant', 'Box solver only supports the standard baseline box gutter configuration.');
  }

  const houseUndersideMm = config.structural.heights.houseUndersideMm ?? config.structural.heights.referenceUndersideMm;
  if (houseUndersideMm === null || houseUndersideMm === undefined) {
    return fail('insufficient_input', 'Box solver requires a house-side underside height.');
  }
  if (config.structural.heights.outerUndersideMm === null || config.structural.heights.outerUndersideMm === undefined) {
    return fail('insufficient_input', 'Box solver requires an outer underside height.');
  }

  const ledgerProfile = requireProfile(config.structural.profiles.ledger);
  if (!ledgerProfile) {
    return fail('insufficient_input', 'Box solver requires the ledger profile.');
  }

  const boxPerimeterProfile = requireProfile(config.structural.profiles.boxPerimeter);
  if (!boxPerimeterProfile) {
    return fail('insufficient_input', 'Box solver requires the box perimeter beam profile.');
  }

  const gutterProfile = requireProfile(config.structural.profiles.gutter);
  if (!gutterProfile) {
    return fail('insufficient_input', 'Box solver requires the gutter profile.');
  }

  const rafterProfile = requireProfile(config.structural.profiles.rafter);
  if (!rafterProfile) {
    return fail('insufficient_input', 'Box solver requires the rafter profile.');
  }

  const postProfile = requireProfile(config.structural.profiles.post);
  if (!postProfile) {
    return fail('insufficient_input', 'Box solver requires the post profile.');
  }

  const rafterCount = config.structural.framing.rafterCount;
  if (rafterCount === null || rafterCount === undefined || rafterCount < 2) {
    return fail('insufficient_input', 'Box solver requires a rafter count.');
  }
  if (
    config.structural.framing.rafterSpacingMm === null ||
    config.structural.framing.rafterSpacingMm === undefined ||
    config.structural.framing.rafterSpacingMm <= 0
  ) {
    return fail('insufficient_input', 'Box solver requires rafter spacing.');
  }

  const houseSetbackMm = config.box.houseSetbackMm;
  const outerSetbackMm = config.box.outerSetbackMm;
  const effectiveRunMm = config.box.effectiveRunMm;
  const riseMm = config.box.riseMm;
  const maxFallMm = config.box.maxFallMm;
  if (
    houseSetbackMm === null ||
    houseSetbackMm === undefined ||
    outerSetbackMm === null ||
    outerSetbackMm === undefined ||
    effectiveRunMm === null ||
    effectiveRunMm === undefined ||
    riseMm === null ||
    riseMm === undefined ||
    maxFallMm === null ||
    maxFallMm === undefined
  ) {
    return fail('insufficient_input', 'Box solver requires derived effective run, rise, and max fall inputs.');
  }
  if (effectiveRunMm <= 0 || riseMm <= 0 || maxFallMm <= 0) {
    return fail('insufficient_input', 'Box solver requires positive effective run, rise, and max fall values.');
  }
  if (config.dimensions.projectionMm - houseSetbackMm - outerSetbackMm !== effectiveRunMm) {
    return fail('unsupported_variant', 'Box solver currently requires the standard attached box setbacks.');
  }

  const roofClearanceAboveRafterMm = boxPerimeterProfile.depthMm - rafterProfile.depthMm - maxFallMm;
  if (roofClearanceAboveRafterMm < 0) {
    return fail('insufficient_input', 'Box solver requires box beam depth to accommodate rafter depth and max fall.');
  }

  return {
    houseUndersideMm,
    outerUndersideMm: config.structural.heights.outerUndersideMm,
    ledgerProfile,
    boxPerimeterProfile,
    gutterProfile,
    rafterProfile,
    postProfile,
    rafterCount,
    houseSetbackMm,
    outerSetbackMm,
    effectiveRunMm,
    riseMm,
    maxFallMm,
    roofClearanceAboveRafterMm,
    houseEdgeGutterMode: config.box.houseEdgeGutterMode,
    farEdgeGutterMode: config.box.farEdgeGutterMode,
  };
}

export function solveBoxAssembly3D(config: GeometryConfig): SolveAssembly3DResult {
  const structural = resolveBoxStructuralInput(config);
  if ('code' in structural) {
    return structural;
  }

  if (config.roof.fallDirection !== 'positiveY' && config.roof.fallDirection !== 'negativeY') {
    return fail('unsupported_variant', 'Box solver requires a single-direction fall.');
  }

  const input = structural;
  const lengthMm = config.dimensions.lengthMm;
  const projectionMm = config.dimensions.projectionMm;
  const outline = [
    point(0, 0, 0),
    point(lengthMm, 0, 0),
    point(lengthMm, projectionMm, 0),
    point(0, projectionMm, 0),
  ];

  const farBeamTopMm = input.outerUndersideMm + input.boxPerimeterProfile.depthMm;
  const farBeamCenterlineZ = input.outerUndersideMm + input.boxPerimeterProfile.depthMm / 2;
  const outerGutterCenterlineZ = input.outerUndersideMm + input.gutterProfile.depthMm / 2;
  const ledgerCenterlineZ = input.houseUndersideMm + input.ledgerProfile.depthMm / 2;
  const slopePerMm = input.riseMm / input.effectiveRunMm;
  const slopeSign = config.roof.fallDirection === 'positiveY' ? 1 : -1;

  const boxBeamTopAtY = (y: number) => farBeamTopMm + slopeSign * (projectionMm - y) * slopePerMm;
  const roofTopAtY = (y: number) => boxBeamTopAtY(y) - input.roofClearanceAboveRafterMm;
  const boxBeamCenterlineAtY = (y: number) => boxBeamTopAtY(y) - input.boxPerimeterProfile.depthMm / 2;

  const houseInsetY = input.houseSetbackMm;
  const farInsetY = projectionMm - input.outerSetbackMm;
  if (farInsetY <= houseInsetY) {
    return fail('insufficient_input', 'Box solver requires a positive inset roof field run.');
  }

  const houseInsetTopMm = roofTopAtY(houseInsetY);
  const farInsetTopMm = roofTopAtY(farInsetY);

  const roofPlane = planeFromOriginAxes(
    point(0, houseInsetY, houseInsetTopMm),
    { x: lengthMm, y: 0, z: 0 },
    { x: 0, y: farInsetY - houseInsetY, z: farInsetTopMm - houseInsetTopMm },
  );
  const roofNormal = normalizeVector(roofPlane.normal);
  if (magnitude(roofNormal) === 0) {
    return fail('insufficient_input', 'Box solver could not resolve a roof normal.');
  }

  const roofBoundary = [
    point(0, houseInsetY, houseInsetTopMm),
    point(lengthMm, houseInsetY, houseInsetTopMm),
    point(lengthMm, farInsetY, farInsetTopMm),
    point(0, farInsetY, farInsetTopMm),
  ];
  const fallVector =
    config.roof.fallDirection === 'positiveY'
      ? normalizeVector({ x: 0, y: input.effectiveRunMm, z: -input.riseMm })
      : normalizeVector({ x: 0, y: -input.effectiveRunMm, z: -input.riseMm });

  const rafterCenterOffset = scaleVector(roofNormal, -input.rafterProfile.depthMm / 2);
  const rafterXPositions = equalSpacingPositions(lengthMm, input.rafterCount);
  const rafters: AssemblyMember3D[] = rafterXPositions.map((x, index) => {
    const memberLine = line(
      addPointVector(point(x, houseInsetY, houseInsetTopMm), rafterCenterOffset),
      addPointVector(point(x, farInsetY, farInsetTopMm), rafterCenterOffset),
    );
    return {
      id: `box-rafter-${index + 1}`,
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

  const attachmentEdge = line(
    point(0, 0, input.houseUndersideMm),
    point(lengthMm, 0, input.houseUndersideMm),
  );

  const ledgerLine = line(
    point(0, 0, ledgerCenterlineZ),
    point(lengthMm, 0, ledgerCenterlineZ),
  );
  members.push({
    id: 'ledger',
    role: 'ledger',
    centerline: ledgerLine,
    profile: input.ledgerProfile,
    localFrame: frameForHorizontalX(ledgerLine.start),
    metadata: {
      position: 'house-edge',
      houseEdgeGutterMode: input.houseEdgeGutterMode,
    },
  });
  supportConditions.push({
    type: 'house_connection',
    memberId: 'ledger',
    metadata: {
      connectionType: config.connection.type,
    },
  });

  const outerBeamLine = line(
    point(0, projectionMm, farBeamCenterlineZ),
    point(lengthMm, projectionMm, farBeamCenterlineZ),
  );
  members.push({
    id: 'outer-box-beam',
    role: 'beam',
    centerline: outerBeamLine,
    profile: input.boxPerimeterProfile,
    localFrame: frameForHorizontalX(outerBeamLine.start),
    metadata: {
      position: 'far-edge',
      beamRole: 'box_perimeter',
    },
  });

  const leftSideBeamLine = line(
    point(0, 0, boxBeamCenterlineAtY(0)),
    point(0, projectionMm, boxBeamCenterlineAtY(projectionMm)),
  );
  const rightSideBeamLine = line(
    point(lengthMm, 0, boxBeamCenterlineAtY(0)),
    point(lengthMm, projectionMm, boxBeamCenterlineAtY(projectionMm)),
  );
  for (const [memberId, memberLine] of [
    ['left-box-beam', leftSideBeamLine],
    ['right-box-beam', rightSideBeamLine],
  ] as const) {
    members.push({
      id: memberId,
      role: 'beam',
      centerline: memberLine,
      profile: input.boxPerimeterProfile,
      localFrame: frameForSlopedHorizontalMember(memberLine),
      metadata: {
        beamRole: 'box_perimeter',
      },
    });
  }

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
      position: 'far-edge',
      gutterType: config.structural.drainage.gutterType,
      hasOurGutter: config.structural.drainage.hasOurGutter,
      farEdgeGutterMode: input.farEdgeGutterMode,
    },
  });

  const totalPostCount = config.supports.postCount;
  if (totalPostCount === null || totalPostCount === undefined || totalPostCount < 2) {
    return fail('insufficient_input', 'Box solver requires a standard post count.');
  }

  const xPositions = equalSpacingPositions(lengthMm, totalPostCount);
  for (let index = 0; index < xPositions.length; index += 1) {
    const x = xPositions[index]!;
    const memberLine = line(point(x, projectionMm, 0), point(x, projectionMm, farBeamCenterlineZ));
    const memberId = `outer-post-${index + 1}`;
    members.push({
      id: memberId,
      role: 'post',
      centerline: memberLine,
      profile: input.postProfile,
      localFrame: frameForVerticalMember(memberLine.start),
      metadata: {
        position: 'outer-post',
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

  members.push(...rafters);

  const roofPlanes: RoofPlane3D[] = [
    {
      id: 'box-roof',
      boundary: roofBoundary,
      plane: roofPlane,
      fallVector,
      metadata: {
        pitchDeg: config.dimensions.roofPitchDeg,
        effectiveRunMm: input.effectiveRunMm,
        riseMm: input.riseMm,
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
    { key: 'ledger.length_mm', quantity: Math.round(lineLength(ledgerLine)), unit: 'mm' },
    { key: 'outer_gutter.length_mm', quantity: Math.round(lineLength(gutterLine)), unit: 'mm' },
    {
      key: 'box_perimeter_beams.total_length_mm',
      quantity: Math.round(lineLength(outerBeamLine) + lineLength(leftSideBeamLine) + lineLength(rightSideBeamLine)),
      unit: 'mm',
    },
    { key: 'roof_planes.count', quantity: roofPlanes.length, unit: 'count' },
  ];

  return ok({
    family: 'box',
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
      roofType: 'box',
      structuralZones: ['roof_field_inset', 'support_line_outer', 'box_perimeter'],
    },
  });
}
