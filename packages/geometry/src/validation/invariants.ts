import type { Assembly3D, GeometryConfig, GeometryValidationInvariant, QuantityHook } from '../contracts';
import { dotProduct, lineLength, magnitude, normalizeVector, polygonArea, subtractPoints } from '../math3d';

const MM_TOLERANCE = 1;

function pass(key: string, message: string): GeometryValidationInvariant {
  return { key, status: 'pass', message };
}

function fail(key: string, message: string): GeometryValidationInvariant {
  return { key, status: 'fail', message };
}

function approxEqual(a: number, b: number, tolerance = MM_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

function recomputeQuantityHooks(assembly: Assembly3D): QuantityHook[] {
  const members = assembly.members;
  const posts = members.filter((member) => member.role === 'post');
  const rafters = members.filter((member) => member.role === 'rafter');
  const beams = members.filter((member) => member.role === 'beam');
  const gutters = members.filter((member) => member.role === 'gutter');
  const quantityHooks: QuantityHook[] = [
    { key: 'posts.count', quantity: posts.length, unit: 'count' },
    {
      key: 'posts.total_length_mm',
      quantity: Math.round(posts.reduce((sum, member) => sum + lineLength(member.centerline), 0)),
      unit: 'mm',
    },
    { key: 'rafters.count', quantity: rafters.length, unit: 'count' },
    {
      key: 'rafters.total_length_mm',
      quantity: Math.round(rafters.reduce((sum, member) => sum + lineLength(member.centerline), 0)),
      unit: 'mm',
    },
  ];

  if (assembly.family === 'mono') {
    quantityHooks.push({
      key: 'support_beam.length_mm',
      quantity: Math.round(beams.reduce((sum, member) => sum + lineLength(member.centerline), 0)),
      unit: 'mm',
    });
    if (assembly.members.some((member) => member.id === 'ledger')) {
      const ledger = assembly.members.find((member) => member.id === 'ledger')!;
      quantityHooks.push({
        key: 'ledger.length_mm',
        quantity: Math.round(lineLength(ledger.centerline)),
        unit: 'mm',
      });
    }
    const gutter = gutters[0];
    if (gutter) {
      quantityHooks.push({
        key: 'gutter.length_mm',
        quantity: Math.round(lineLength(gutter.centerline)),
        unit: 'mm',
      });
    }
  } else if (assembly.family === 'gable') {
    const ridge = assembly.members.find((member) => member.role === 'ridge');
    const houseSupport = assembly.members.find((member) => member.id === 'ledger' || member.id === 'house-beam');
    const outerSupport = assembly.members.find((member) => member.id === 'outer-beam');
    const houseGutter = assembly.members.find((member) => member.id === 'house-gutter');
    const outerGutter = assembly.members.find((member) => member.id === 'outer-gutter');
    if (ridge) {
      quantityHooks.push({
        key: 'ridge.length_mm',
        quantity: Math.round(lineLength(ridge.centerline)),
        unit: 'mm',
      });
    }
    if (houseSupport) {
      quantityHooks.push({
        key: 'house_eave_support.length_mm',
        quantity: Math.round(lineLength(houseSupport.centerline)),
        unit: 'mm',
      });
    }
    if (outerSupport) {
      quantityHooks.push({
        key: 'outer_eave_support.length_mm',
        quantity: Math.round(lineLength(outerSupport.centerline)),
        unit: 'mm',
      });
    }
    if (houseGutter) {
      quantityHooks.push({
        key: 'house_gutter.length_mm',
        quantity: Math.round(lineLength(houseGutter.centerline)),
        unit: 'mm',
      });
    }
    if (outerGutter) {
      quantityHooks.push({
        key: 'outer_gutter.length_mm',
        quantity: Math.round(lineLength(outerGutter.centerline)),
        unit: 'mm',
      });
    }
    quantityHooks.push({
      key: 'roof_planes.count',
      quantity: assembly.roofPlanes.length,
      unit: 'count',
    });
  } else if (assembly.family === 'box') {
    const ledger = assembly.members.find((member) => member.id === 'ledger');
    const outerGutter = assembly.members.find((member) => member.id === 'outer-gutter');
    if (ledger) {
      quantityHooks.push({
        key: 'ledger.length_mm',
        quantity: Math.round(lineLength(ledger.centerline)),
        unit: 'mm',
      });
    }
    if (outerGutter) {
      quantityHooks.push({
        key: 'outer_gutter.length_mm',
        quantity: Math.round(lineLength(outerGutter.centerline)),
        unit: 'mm',
      });
    }
    quantityHooks.push({
      key: 'box_perimeter_beams.total_length_mm',
      quantity: Math.round(beams.reduce((sum, member) => sum + lineLength(member.centerline), 0)),
      unit: 'mm',
    });
    quantityHooks.push({
      key: 'roof_planes.count',
      quantity: assembly.roofPlanes.length,
      unit: 'count',
    });
  }

  return quantityHooks.sort((a, b) => a.key.localeCompare(b.key));
}

function validateOutline(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  const allGrounded = assembly.outline.every((point) => approxEqual(point.z, 0));
  const minX = Math.min(...assembly.outline.map((point) => point.x));
  const maxX = Math.max(...assembly.outline.map((point) => point.x));
  const minY = Math.min(...assembly.outline.map((point) => point.y));
  const maxY = Math.max(...assembly.outline.map((point) => point.y));
  return [
    allGrounded
      ? pass('outline.ground_plane', 'Outline lies on the ground plane.')
      : fail('outline.ground_plane', 'Outline must lie on the ground plane.'),
    approxEqual(minX, 0) &&
    approxEqual(maxX, config.dimensions.lengthMm) &&
    approxEqual(minY, 0) &&
    approxEqual(maxY, config.dimensions.projectionMm)
      ? pass('outline.dimensions', 'Outline matches the normalized plan dimensions.')
      : fail('outline.dimensions', 'Outline dimensions do not match the normalized plan dimensions.'),
  ];
}

function validateAttachmentEdge(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  const shouldHaveEdge = config.connection.type !== 'freestanding';
  if (!shouldHaveEdge) {
    return [
      assembly.attachmentEdge === null
        ? pass('attachment_edge.presence', 'Freestanding assembly omits the attachment edge.')
        : fail('attachment_edge.presence', 'Freestanding assembly must not include an attachment edge.'),
    ];
  }

  if (!assembly.attachmentEdge) {
    return [fail('attachment_edge.presence', 'Attached assembly requires an attachment edge.')];
  }

  const edge = assembly.attachmentEdge;
  const validGeometry =
    approxEqual(edge.start.y, 0) &&
    approxEqual(edge.end.y, 0) &&
    approxEqual(edge.start.x, 0) &&
    approxEqual(edge.end.x, config.dimensions.lengthMm);

  return [
    pass('attachment_edge.presence', 'Attached assembly includes an attachment edge.'),
    validGeometry
      ? pass('attachment_edge.dimensions', 'Attachment edge spans the normalized house edge.')
      : fail('attachment_edge.dimensions', 'Attachment edge does not span the normalized house edge.'),
  ];
}

function validateMembers(assembly: Assembly3D): GeometryValidationInvariant[] {
  const posts = assembly.members.filter((member) => member.role === 'post');
  const profilesPositive = assembly.members.every((member) => member.profile.widthMm > 0 && member.profile.depthMm > 0);
  const nonNegativeHeights = assembly.members.every(
    (member) => member.centerline.start.z >= -MM_TOLERANCE && member.centerline.end.z >= -MM_TOLERANCE,
  );
  const frameConsistent = assembly.members.every((member) => {
    const memberDirection = normalizeVector(subtractPoints(member.centerline.end, member.centerline.start));
    const xAxis = normalizeVector(member.localFrame.xAxis);
    const yAxis = normalizeVector(member.localFrame.yAxis);
    const zAxis = normalizeVector(member.localFrame.zAxis);
    return (
      Math.abs(dotProduct(memberDirection, xAxis)) >= 0.999 &&
      approxEqual(magnitude(xAxis), 1, 0.001) &&
      approxEqual(magnitude(yAxis), 1, 0.001) &&
      approxEqual(magnitude(zAxis), 1, 0.001) &&
      Math.abs(dotProduct(xAxis, yAxis)) <= 0.001 &&
      Math.abs(dotProduct(xAxis, zAxis)) <= 0.001 &&
      Math.abs(dotProduct(yAxis, zAxis)) <= 0.001
    );
  });
  const verticalPosts = posts.every(
    (member) =>
      approxEqual(member.centerline.start.x, member.centerline.end.x) &&
      approxEqual(member.centerline.start.y, member.centerline.end.y) &&
      member.centerline.end.z > member.centerline.start.z,
  );
  return [
    profilesPositive
      ? pass('member_profiles.positive', 'All member profiles are positive.')
      : fail('member_profiles.positive', 'Assembly contains a non-positive member profile.'),
    nonNegativeHeights
      ? pass('members.heights.nonnegative', 'All member endpoints are on or above ground level.')
      : fail('members.heights.nonnegative', 'Assembly contains member endpoints below ground level.'),
    frameConsistent
      ? pass('member_frames.consistency', 'All member frames are orthonormal and aligned to member runs.')
      : fail('member_frames.consistency', 'Assembly contains a member frame that is not aligned to its centerline or is not orthonormal.'),
    verticalPosts
      ? pass('posts.vertical', 'All posts are vertical.')
      : fail('posts.vertical', 'Assembly contains non-vertical posts.'),
  ];
}

function validateSupportConditions(assembly: Assembly3D): GeometryValidationInvariant {
  const postIds = new Set(assembly.members.filter((member) => member.role === 'post').map((member) => member.id));
  const coveredPostIds = new Set(
    assembly.supportConditions
      .filter((condition) => condition.type === 'post_connection')
      .map((condition) => condition.memberId),
  );
  const allCovered = Array.from(postIds).every((postId) => coveredPostIds.has(postId));
  return allCovered
    ? pass('support_conditions.coverage', 'Every post has a support condition.')
    : fail('support_conditions.coverage', 'Each post requires a post_connection support condition.');
}

function validateRoofPlanes(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  const nonDegenerate = assembly.roofPlanes.every(
    (roofPlane) => magnitude(roofPlane.plane.normal) > 0.000001 && magnitude(roofPlane.fallVector) > 0.000001,
  );
  const planeConsistent = assembly.roofPlanes.every((roofPlane) =>
    roofPlane.boundary.every((point) => Math.abs(dotProduct(subtractPoints(point, roofPlane.plane.origin), roofPlane.plane.normal)) <= MM_TOLERANCE),
  );

  let fallOkay = false;
  if (config.family === 'gable') {
    fallOkay =
      assembly.roofPlanes.length === 2 &&
      assembly.roofPlanes.some((roofPlane) => roofPlane.fallVector.y < 0 && roofPlane.fallVector.z < 0) &&
      assembly.roofPlanes.some((roofPlane) => roofPlane.fallVector.y > 0 && roofPlane.fallVector.z < 0);
  } else if (config.roof.fallDirection === 'positiveY') {
    fallOkay = assembly.roofPlanes.every((roofPlane) => roofPlane.fallVector.y > 0 && roofPlane.fallVector.z < 0);
  } else if (config.roof.fallDirection === 'negativeY') {
    fallOkay = assembly.roofPlanes.every((roofPlane) => roofPlane.fallVector.y < 0 && roofPlane.fallVector.z < 0);
  }

  return [
    nonDegenerate
      ? pass('roof_planes.non_degenerate', 'Roof planes have valid normals and fall vectors.')
      : fail('roof_planes.non_degenerate', 'Roof planes must have non-degenerate normals and fall vectors.'),
    planeConsistent
      ? pass('roof_planes.consistency', 'Roof-plane boundaries lie on their planes.')
      : fail('roof_planes.consistency', 'Roof-plane boundaries do not lie on their planes.'),
    fallOkay
      ? pass('roof_planes.fall', 'Roof-plane fall directions match the normalized config.')
      : fail('roof_planes.fall', 'Roof-plane fall directions do not match the normalized config.'),
  ];
}

function validateQuantityHooks(assembly: Assembly3D): GeometryValidationInvariant {
  const actual = [...assembly.quantityHooks].sort((a, b) => a.key.localeCompare(b.key));
  const expected = recomputeQuantityHooks(assembly);
  const sameLength = actual.length === expected.length;
  const exactMatch =
    sameLength &&
    actual.every(
      (hook, index) =>
        hook.key === expected[index]?.key &&
        hook.unit === expected[index]?.unit &&
        approxEqual(hook.quantity, expected[index]?.quantity ?? Number.NaN),
    );
  return exactMatch
    ? pass('quantity_hooks.consistency', 'Quantity hooks recompute from the assembly.')
    : fail('quantity_hooks.consistency', 'Quantity hooks do not recompute from the assembly.');
}

function validateMono(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  const posts = assembly.members.filter((member) => member.role === 'post');
  const hasLedger = assembly.members.some((member) => member.id === 'ledger');
  const roofPlaneCountOk = assembly.roofPlanes.length === 1;
  const layoutOk =
    config.connection.type === 'freestanding'
      ? !hasLedger &&
        posts.some((member) => approxEqual(member.centerline.start.y, 0)) &&
        posts.some((member) => approxEqual(member.centerline.start.y, config.dimensions.projectionMm))
      : hasLedger && posts.every((member) => approxEqual(member.centerline.start.y, config.dimensions.projectionMm));

  return [
    roofPlaneCountOk
      ? pass('roof_planes.count', 'Mono assembly has one roof plane.')
      : fail('roof_planes.count', 'Mono assembly must have exactly one roof plane.'),
    layoutOk
      ? pass('mono.member_layout', 'Mono support layout matches the supported standard form.')
      : fail('mono.member_layout', 'Mono support layout does not match the supported standard form.'),
  ];
}

function hasMonoAcrylicCoveringInputs(config: GeometryConfig): boolean {
  return (
    config.roof.material === 'acrylic' &&
    config.roofCovering.kind === 'acrylic' &&
    config.roofCovering.effectiveRunMm !== null &&
    config.roofCovering.acrylicRequiredDownslopeMm !== null &&
    config.roofCovering.joinerPieceLengthMm !== null &&
    config.roofCovering.joinerRunsTotal !== null &&
    config.roofCovering.houseAllowanceMm !== null &&
    config.roofCovering.farAllowanceMm !== null &&
    config.roofCovering.acrylicAreaMm2 !== null
  );
}

function validateMonoAcrylic(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  if (config.roof.material !== 'acrylic') {
    return [];
  }

  const coveringInputsReady = hasMonoAcrylicCoveringInputs(config);
  if (!coveringInputsReady) {
    return [
      fail(
        'mono_acrylic.covering_inputs',
        'Mono acrylic roof-pack geometry requires costing-derived covering inputs.',
      ),
      pass('mono_acrylic.joiner_count', 'Joiner count skipped because covering inputs are missing.'),
      pass('mono_acrylic.panel_count', 'Panel count skipped because covering inputs are missing.'),
      pass('mono_acrylic.joiner_length', 'Joiner length skipped because covering inputs are missing.'),
      pass('mono_acrylic.panel_area', 'Panel area skipped because covering inputs are missing.'),
      pass('mono_acrylic.covering_alignment', 'Covering alignment skipped because covering inputs are missing.'),
    ];
  }

  const joiners = assembly.members.filter((member) => member.role === 'joiner');
  const panels = assembly.roofCladdingPanels;
  const roofPlane = assembly.roofPlanes.find((candidate) => candidate.id === 'mono-roof') ?? assembly.roofPlanes[0];
  const expectedJoinerCount = config.roofCovering.joinerRunsTotal ?? 0;
  const expectedPanelCount = Math.max((config.structural.framing.rafterCount ?? 0) - 1, 0);
  const expectedJoinerLengthMm = config.roofCovering.joinerPieceLengthMm ?? 0;
  const expectedPanelAreaMm2 = config.roofCovering.acrylicAreaMm2 ?? 0;

  const joinerCountOk =
    joiners.length === expectedJoinerCount &&
    joiners.length === (config.structural.framing.rafterCount ?? Number.NaN);
  const panelCountOk = panels.length === expectedPanelCount;
  const joinerLengthOk = joiners.every((joiner) => approxEqual(lineLength(joiner.centerline), expectedJoinerLengthMm, 3));
  const panelAreaOk = approxEqual(
    Math.round(panels.reduce((sum, panel) => sum + polygonArea(panel.boundary), 0)),
    Math.round(expectedPanelAreaMm2),
    10_000,
  );

  const roofNormal = roofPlane ? normalizeVector(roofPlane.plane.normal) : { x: 0, y: 0, z: 0 };
  const roofFall = roofPlane ? normalizeVector(roofPlane.fallVector) : { x: 0, y: 0, z: 0 };
  const panelAlignmentOk =
    Boolean(roofPlane) &&
    panels.every((panel) =>
      panel.boundary.every(
        (point) =>
          Math.abs(dotProduct(subtractPoints(point, roofPlane!.plane.origin), roofPlane!.plane.normal)) <= MM_TOLERANCE,
      ),
    );
  const joinerAlignmentOk =
    Boolean(roofPlane) &&
    joiners.every((joiner) => {
      const planeOffset = joiner.profile.depthMm / 2;
      const startOffset = dotProduct(subtractPoints(joiner.centerline.start, roofPlane!.plane.origin), roofNormal);
      const endOffset = dotProduct(subtractPoints(joiner.centerline.end, roofPlane!.plane.origin), roofNormal);
      const joinerDirection = normalizeVector(subtractPoints(joiner.centerline.end, joiner.centerline.start));
      return (
        approxEqual(startOffset, planeOffset, 3) &&
        approxEqual(endOffset, planeOffset, 3) &&
        Math.abs(dotProduct(joinerDirection, roofFall)) >= 0.999
      );
    });

  return [
    pass('mono_acrylic.covering_inputs', 'Mono acrylic covering inputs are present.'),
    joinerCountOk
      ? pass('mono_acrylic.joiner_count', 'Mono acrylic joiner count matches the covering and framing inputs.')
      : fail('mono_acrylic.joiner_count', 'Mono acrylic joiner count does not match the covering and framing inputs.'),
    panelCountOk
      ? pass('mono_acrylic.panel_count', 'Mono acrylic panel count matches the framed bay count.')
      : fail('mono_acrylic.panel_count', 'Mono acrylic panel count does not match the framed bay count.'),
    joinerLengthOk
      ? pass('mono_acrylic.joiner_length', 'Mono acrylic joiner run lengths match the costing-derived cut length.')
      : fail('mono_acrylic.joiner_length', 'Mono acrylic joiner run lengths do not match the costing-derived cut length.'),
    panelAreaOk
      ? pass('mono_acrylic.panel_area', 'Mono acrylic panel area matches the costing-derived acrylic area.')
      : fail('mono_acrylic.panel_area', 'Mono acrylic panel area does not match the costing-derived acrylic area.'),
    panelAlignmentOk && joinerAlignmentOk
      ? pass('mono_acrylic.covering_alignment', 'Mono acrylic panels and joiners align with the structural mono roof plane.')
      : fail('mono_acrylic.covering_alignment', 'Mono acrylic panels and joiners do not align with the structural mono roof plane.'),
  ];
}

function validateGable(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  const roofPlaneCountOk = assembly.roofPlanes.length === 2;
  const ridgeCountOk = assembly.members.filter((member) => member.role === 'ridge').length === 1;
  const houseRafters = assembly.members.filter(
    (member) => member.role === 'rafter' && member.metadata?.slope === 'house',
  );
  const outerRafters = assembly.members.filter(
    (member) => member.role === 'rafter' && member.metadata?.slope === 'outer',
  );
  const rafterPairsOk =
    houseRafters.length === (config.structural.framing.rafterCount ?? 0) &&
    outerRafters.length === (config.structural.framing.rafterCount ?? 0) &&
    houseRafters.every((member, index) => member.metadata?.index === outerRafters[index]?.metadata?.index);

  const houseSupport = assembly.members.find((member) => member.id === 'ledger' || member.id === 'house-beam');
  const outerSupport = assembly.members.find((member) => member.id === 'outer-beam');
  const houseUnderside = houseSupport ? houseSupport.centerline.start.z - houseSupport.profile.depthMm / 2 : null;
  const outerUnderside = outerSupport ? outerSupport.centerline.start.z - outerSupport.profile.depthMm / 2 : null;
  const symmetricalOk =
    houseUnderside !== null && outerUnderside !== null && approxEqual(houseUnderside, outerUnderside);

  return [
    roofPlaneCountOk
      ? pass('roof_planes.count', 'Gable assembly has two roof planes.')
      : fail('roof_planes.count', 'Gable assembly must have exactly two roof planes.'),
    ridgeCountOk
      ? pass('gable.ridge_count', 'Gable assembly has exactly one ridge.')
      : fail('gable.ridge_count', 'Gable assembly must contain exactly one ridge.'),
    rafterPairsOk
      ? pass('gable.rafter_pairs', 'Gable rafters are paired across each frame line.')
      : fail('gable.rafter_pairs', 'Gable assembly requires paired house and outer rafters for each frame line.'),
    symmetricalOk
      ? pass('gable.symmetrical_eaves', 'Gable eave support heights remain symmetrical.')
      : fail('gable.symmetrical_eaves', 'Gable eave support heights must remain symmetrical.'),
  ];
}

function validateBox(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  const roofPlaneCountOk = assembly.roofPlanes.length === 1;
  const beamIds = new Set(assembly.members.filter((member) => member.role === 'beam').map((member) => member.id));
  const memberLayoutOk =
    assembly.members.some((member) => member.id === 'ledger') &&
    assembly.members.some((member) => member.id === 'outer-gutter') &&
    beamIds.has('outer-box-beam') &&
    beamIds.has('left-box-beam') &&
    beamIds.has('right-box-beam') &&
    beamIds.size === 3;
  const postsFarLineOnly = assembly.members
    .filter((member) => member.role === 'post')
    .every((member) => approxEqual(member.centerline.start.y, config.dimensions.projectionMm));
  const roofPlane = assembly.roofPlanes[0];
  const expectedMinY = config.box.houseSetbackMm ?? Number.NaN;
  const expectedMaxY = config.dimensions.projectionMm - (config.box.outerSetbackMm ?? 0);
  const insetBoundaryOk =
    Boolean(roofPlane) &&
    approxEqual(Math.min(...roofPlane!.boundary.map((point) => point.y)), expectedMinY) &&
    approxEqual(Math.max(...roofPlane!.boundary.map((point) => point.y)), expectedMaxY);

  return [
    roofPlaneCountOk
      ? pass('roof_planes.count', 'Box assembly has one inset roof plane.')
      : fail('roof_planes.count', 'Box assembly must have exactly one inset roof plane.'),
    config.connection.type !== 'freestanding' && assembly.attachmentEdge !== null
      ? pass('box.attached_only', 'Box assembly stays on the attached baseline path.')
      : fail('box.attached_only', 'Box assembly currently supports attached layouts only.'),
    memberLayoutOk
      ? pass('box.member_layout', 'Box perimeter members match the supported baseline set.')
      : fail('box.member_layout', 'Box assembly is missing required perimeter members.'),
    postsFarLineOnly
      ? pass('box.post_layout', 'Box posts exist only on the far support line.')
      : fail('box.post_layout', 'Box posts must exist only on the far support line.'),
    insetBoundaryOk
      ? pass('box.inset_roof_boundary', 'Box roof field matches the standard house and far setbacks.')
      : fail('box.inset_roof_boundary', 'Box roof field does not match the standard house and far setbacks.'),
  ];
}

export function runGeometryInvariants(config: GeometryConfig, assembly: Assembly3D): GeometryValidationInvariant[] {
  const invariants: GeometryValidationInvariant[] = [
    ...validateOutline(config, assembly),
    ...validateAttachmentEdge(config, assembly),
    ...validateMembers(assembly),
    validateSupportConditions(assembly),
    ...validateRoofPlanes(config, assembly),
    validateQuantityHooks(assembly),
  ];

  if (assembly.family === 'mono') {
    invariants.push(...validateMono(config, assembly));
    invariants.push(...validateMonoAcrylic(config, assembly));
  } else if (assembly.family === 'gable') {
    invariants.push(...validateGable(config, assembly));
  } else if (assembly.family === 'box') {
    invariants.push(...validateBox(config, assembly));
  }

  return invariants;
}
