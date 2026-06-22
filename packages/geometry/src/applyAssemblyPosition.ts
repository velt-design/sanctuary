import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberEndCutPlane,
  AssemblyPosition,
  DatumFrame3,
  GeometryConfig,
  HouseAttachmentTarget3D,
  HouseAttachmentZone3D,
  HouseDeck3D,
  HouseEaveGeometry3D,
  HouseEnvelopeSolids3D,
  HouseLinearSolid3D,
  HouseModel3D,
  HouseReferenceGeometry,
  HouseRoofEave3D,
  HouseRoofFeature3D,
  HouseSurfaceSolid3D,
  HouseWallSegment3D,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  RenderMesh3D,
  RoofCladdingPanel3D,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from './contracts';

type AssemblyDatum = GeometryConfig['datum'];

type TransformContext = {
  transformPoint: (p: Point3) => Point3;
  transformVector: (v: Vector3) => Vector3;
  transformPolygon: (poly: Polygon3) => Polygon3;
  transformLine: (line: Line3) => Line3;
  transformPlane: (plane: Plane3) => Plane3;
  transformDatumFrame: (datum: DatumFrame3) => DatumFrame3;
  transformAssemblyDatum: (datum: AssemblyDatum) => AssemblyDatum;
  transformEndCutPlane: (plane: AssemblyMemberEndCutPlane) => AssemblyMemberEndCutPlane;
};

function buildTransformContext(position: AssemblyPosition): TransformContext {
  const radians = (position.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const tx = position.origin.x;
  const ty = position.origin.y;

  const transformPoint = (p: Point3): Point3 => ({
    x: cos * p.x - sin * p.y + tx,
    y: sin * p.x + cos * p.y + ty,
    z: p.z,
  });
  const transformVector = (v: Vector3): Vector3 => ({
    x: cos * v.x - sin * v.y,
    y: sin * v.x + cos * v.y,
    z: v.z,
  });
  const transformPolygon = (poly: Polygon3): Polygon3 => poly.map(transformPoint);
  const transformLine = (line: Line3): Line3 => ({
    start: transformPoint(line.start),
    end: transformPoint(line.end),
  });
  const transformPlane = (plane: Plane3): Plane3 => ({
    origin: transformPoint(plane.origin),
    xAxis: transformVector(plane.xAxis),
    yAxis: transformVector(plane.yAxis),
    normal: transformVector(plane.normal),
  });
  const transformDatumFrame = (datum: DatumFrame3): DatumFrame3 => ({
    origin: transformPoint(datum.origin),
    xAxis: transformVector(datum.xAxis),
    yAxis: transformVector(datum.yAxis),
    zAxis: transformVector(datum.zAxis),
  });
  const transformAssemblyDatum = (datum: AssemblyDatum): AssemblyDatum => ({
    origin: transformPoint(datum.origin),
    xAxis: transformVector(datum.xAxis),
    yAxis: transformVector(datum.yAxis),
    zAxis: transformVector(datum.zAxis),
    attachmentEdgeStart: transformPoint(datum.attachmentEdgeStart),
    attachmentEdgeEnd: transformPoint(datum.attachmentEdgeEnd),
  });
  // End-cut planes are stored as a half-space `{ normal, offsetMm, keepSide }`,
  // not as a `Plane3` with an origin. Rotation rotates the normal; translation
  // shifts `offsetMm` by the projection of the translation onto the new normal.
  const transformEndCutPlane = (plane: AssemblyMemberEndCutPlane): AssemblyMemberEndCutPlane => {
    const rotatedNormal = transformVector(plane.normal);
    const offsetShift = rotatedNormal.x * tx + rotatedNormal.y * ty;
    return {
      normal: rotatedNormal,
      offsetMm: plane.offsetMm + offsetShift,
      keepSide: plane.keepSide,
    };
  };

  return {
    transformPoint,
    transformVector,
    transformPolygon,
    transformLine,
    transformPlane,
    transformDatumFrame,
    transformAssemblyDatum,
    transformEndCutPlane,
  };
}

function transformMember(member: AssemblyMember3D, ctx: TransformContext): AssemblyMember3D {
  return {
    ...member,
    centerline: ctx.transformLine(member.centerline),
    localFrame: ctx.transformDatumFrame(member.localFrame),
    endCuts: member.endCuts
      ? member.endCuts.map((cut) => ({ ...cut, plane: ctx.transformEndCutPlane(cut.plane) }))
      : member.endCuts,
  };
}

function transformRoofPlane(plane: RoofPlane3D, ctx: TransformContext): RoofPlane3D {
  return {
    ...plane,
    boundary: ctx.transformPolygon(plane.boundary),
    plane: ctx.transformPlane(plane.plane),
    fallVector: ctx.transformVector(plane.fallVector),
  };
}

function transformRoofCladding(panel: RoofCladdingPanel3D, ctx: TransformContext): RoofCladdingPanel3D {
  return {
    ...panel,
    boundary: ctx.transformPolygon(panel.boundary),
    plane: ctx.transformPlane(panel.plane),
  };
}

function transformRoofFlashing(flashing: RoofFlashing3D, ctx: TransformContext): RoofFlashing3D {
  return {
    ...flashing,
    wings: flashing.wings.map((wing) => ({
      ...wing,
      boundary: ctx.transformPolygon(wing.boundary),
      plane: ctx.transformPlane(wing.plane),
    })),
  };
}

function transformRenderMesh(mesh: RenderMesh3D, ctx: TransformContext): RenderMesh3D {
  return {
    vertices: mesh.vertices.map(ctx.transformPoint),
    faces: mesh.faces,
  };
}

function transformHouseWallSegment(
  segment: HouseWallSegment3D,
  ctx: TransformContext,
): HouseWallSegment3D {
  return {
    ...segment,
    line: ctx.transformLine(segment.line),
    plane: ctx.transformPlane(segment.plane),
    boundary: ctx.transformPolygon(segment.boundary),
  };
}

function transformHouseRoofFeature(
  feature: HouseRoofFeature3D,
  ctx: TransformContext,
): HouseRoofFeature3D {
  return { ...feature, line: ctx.transformLine(feature.line) };
}

function transformHouseRoofEave(
  eave: HouseRoofEave3D,
  ctx: TransformContext,
): HouseRoofEave3D {
  return { ...eave, eaveLine: ctx.transformLine(eave.eaveLine) };
}

function transformHouseSurfaceSolid(
  solid: HouseSurfaceSolid3D,
  ctx: TransformContext,
): HouseSurfaceSolid3D {
  return {
    ...solid,
    boundary: ctx.transformPolygon(solid.boundary),
    plane: ctx.transformPlane(solid.plane),
    renderMesh: solid.renderMesh ? transformRenderMesh(solid.renderMesh, ctx) : solid.renderMesh,
  };
}

function transformHouseLinearSolid(
  solid: HouseLinearSolid3D,
  ctx: TransformContext,
): HouseLinearSolid3D {
  return {
    ...solid,
    centerline: ctx.transformLine(solid.centerline),
    localFrame: ctx.transformDatumFrame(solid.localFrame),
    renderMesh: solid.renderMesh ? transformRenderMesh(solid.renderMesh, ctx) : solid.renderMesh,
  };
}

function transformHouseEnvelopeSolids(
  solids: HouseEnvelopeSolids3D,
  ctx: TransformContext,
): HouseEnvelopeSolids3D {
  return {
    surfaceSolids: solids.surfaceSolids.map((s) => transformHouseSurfaceSolid(s, ctx)),
    linearSolids: solids.linearSolids.map((s) => transformHouseLinearSolid(s, ctx)),
  };
}

function transformHouseDeck(deck: HouseDeck3D, ctx: TransformContext): HouseDeck3D {
  return {
    ...deck,
    boundary: ctx.transformPolygon(deck.boundary),
    plane: ctx.transformPlane(deck.plane),
  };
}

function transformHouseEaveGeometry(
  eave: HouseEaveGeometry3D,
  ctx: TransformContext,
): HouseEaveGeometry3D {
  return {
    ...eave,
    soffitPolygons: eave.soffitPolygons ? eave.soffitPolygons.map(ctx.transformPolygon) : eave.soffitPolygons,
    fasciaPolygons: eave.fasciaPolygons ? eave.fasciaPolygons.map(ctx.transformPolygon) : eave.fasciaPolygons,
    gutterLines: eave.gutterLines ? eave.gutterLines.map(ctx.transformLine) : eave.gutterLines,
    gutterBoundaries: eave.gutterBoundaries ? eave.gutterBoundaries.map(ctx.transformPolygon) : eave.gutterBoundaries,
  };
}

function transformHouseAttachmentZone(
  zone: HouseAttachmentZone3D,
  ctx: TransformContext,
): HouseAttachmentZone3D {
  return {
    ...zone,
    plane: ctx.transformPlane(zone.plane),
    boundary: zone.boundary ? ctx.transformPolygon(zone.boundary) : zone.boundary,
    safeLine: zone.safeLine ? ctx.transformLine(zone.safeLine) : zone.safeLine,
  };
}

function transformHouseAttachmentTarget(
  target: HouseAttachmentTarget3D,
  ctx: TransformContext,
): HouseAttachmentTarget3D {
  return {
    ...target,
    line: target.line ? ctx.transformLine(target.line) : target.line,
    plane: target.plane ? ctx.transformPlane(target.plane) : target.plane,
    zone: target.zone ? transformHouseAttachmentZone(target.zone, ctx) : target.zone,
  };
}

function transformHouseModel(model: HouseModel3D, ctx: TransformContext): HouseModel3D {
  return {
    ...model,
    footprint: ctx.transformPolygon(model.footprint),
    wallSegments: model.wallSegments.map((s) => transformHouseWallSegment(s, ctx)),
    roofPlanes: model.roofPlanes.map((p) => transformRoofPlane(p, ctx)),
    roofFeatures: model.roofFeatures
      ? model.roofFeatures.map((f) => transformHouseRoofFeature(f, ctx))
      : model.roofFeatures,
    roofFlashings: model.roofFlashings
      ? model.roofFlashings.map((f) => transformRoofFlashing(f, ctx))
      : model.roofFlashings,
    decks: model.decks ? model.decks.map((d) => transformHouseDeck(d, ctx)) : model.decks,
    // `openings` carry no 3D coords (just dimensions + wall references), no transform needed.
    solids: model.solids ? transformHouseEnvelopeSolids(model.solids, ctx) : model.solids,
    eave: transformHouseEaveGeometry(model.eave, ctx),
    roofEaves: model.roofEaves ? model.roofEaves.map((e) => transformHouseRoofEave(e, ctx)) : model.roofEaves,
    attachmentTarget: model.attachmentTarget
      ? transformHouseAttachmentTarget(model.attachmentTarget, ctx)
      : model.attachmentTarget,
  };
}

/**
 * Apply an `AssemblyPosition` to a standalone `HouseReferenceGeometry`
 * (rotation around +Z then translation by `origin`). Returns a new
 * geometry in world coords with `position` cleared so downstream
 * `applyAssemblyPosition3D` calls don't double-apply.
 *
 * Used by multi-form workbench rendering (PR8c): each additional house
 * form has its own `AssemblyPosition` derived from the draft's transform.
 * The form's house geometry is built in local coords via
 * `buildHouseReferenceGeometry` / `buildHouseModel3DFromRawHouseInput`,
 * then placed at world coords via this function. Pergola-attached forms
 * still go through `applyAssemblyPosition3D` -- this helper exists for
 * the standalone case where there's no surrounding `Assembly3D`.
 */
export function applyHouseReferencePosition(
  house: HouseReferenceGeometry,
  position: AssemblyPosition,
): HouseReferenceGeometry {
  return transformHouseReference(house, buildTransformContext(position));
}

function transformHouseReference(
  house: HouseReferenceGeometry,
  ctx: TransformContext,
): HouseReferenceGeometry {
  return {
    ...house,
    wallPlane: house.wallPlane ? ctx.transformPlane(house.wallPlane) : house.wallPlane,
    fasciaLine: house.fasciaLine ? ctx.transformLine(house.fasciaLine) : house.fasciaLine,
    roofEdgeLine: house.roofEdgeLine ? ctx.transformLine(house.roofEdgeLine) : house.roofEdgeLine,
    footprint: house.footprint ? ctx.transformPolygon(house.footprint) : house.footprint,
    model: house.model ? transformHouseModel(house.model, ctx) : house.model,
    attachmentTarget: house.attachmentTarget
      ? transformHouseAttachmentTarget(house.attachmentTarget, ctx)
      : house.attachmentTarget,
    // Position has been consumed by the transform — clear so that subsequent
    // calls to `applyAssemblyPosition3D` don't double-apply.
    position: null,
  };
}

/**
 * Decouple a solved assembly from world-origin local coords.
 *
 * Solvers (`solveMono`, `solveBox`, `solveGable`, etc.) emit pergola geometry
 * (`outline`, `members`, `roofPlanes`, ...) in **pergola-local coords** —
 * `(0, 0)` is the bottom-left of the pergola in the local frame, regardless of
 * where the pergola sits in the world. The legacy single-pergola convention
 * was "world = local because datum is identity"; multi-pergola breaks that
 * because each pergola needs its own world position.
 *
 * `applyAssemblyPosition3D` is the single boundary that applies a pergola's
 * `AssemblyPosition` to every local-coord field on `Assembly3D`. After the
 * transform, the assembly is in world coords; downstream consumers (top
 * projection, viewer scene, cost engine quantity hooks, etc.) don't need to
 * know about `position` — they read world coords directly.
 *
 * The house has its own independent transform (milestone 12 of the spatial-
 * entities migration). When `assembly.house.position` is non-null, the house
 * geometry is in **house-local coords** and gets translated to world here as
 * part of the same boundary pass — the pergola and the house each get their
 * own position applied. When `assembly.house.position` is null, the house is
 * already in world coords (legacy: built from a pre-translated footprint in
 * `normalize.ts`) and the house transform is skipped.
 *
 * Each transform is rotation around `+Z` followed by translation by `origin`.
 * Calling with `position == null` AND `assembly.house.position == null` is a
 * no-op — assemblies pass through unchanged.
 */
export function applyAssemblyPosition3D(
  assembly: Assembly3D,
  position: AssemblyPosition | null,
): Assembly3D {
  const housePosition = assembly.house.position ?? null;
  if (!position && !housePosition) return assembly;

  let result = assembly;

  if (position) {
    const ctx = buildTransformContext(position);
    result = {
      ...result,
      datum: ctx.transformAssemblyDatum(result.datum),
      outline: ctx.transformPolygon(result.outline),
      attachmentEdge: result.attachmentEdge ? ctx.transformLine(result.attachmentEdge) : null,
      members: result.members.map((m) => transformMember(m, ctx)),
      roofPlanes: result.roofPlanes.map((p) => transformRoofPlane(p, ctx)),
      roofCladdingPanels: result.roofCladdingPanels.map((p) => transformRoofCladding(p, ctx)),
      roofFlashings: result.roofFlashings
        ? result.roofFlashings.map((f) => transformRoofFlashing(f, ctx))
        : result.roofFlashings,
      // `house` is intentionally NOT transformed by the pergola position —
      // it has its own independent `position` handled below.
    };
  }

  if (housePosition) {
    const ctx = buildTransformContext(housePosition);
    result = { ...result, house: transformHouseReference(result.house, ctx) };
  }

  return result;
}
