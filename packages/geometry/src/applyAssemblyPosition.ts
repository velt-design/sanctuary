import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberEndCutPlane,
  AssemblyPosition,
  DatumFrame3,
  GeometryConfig,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  RoofCladdingPanel3D,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from './contracts';

type AssemblyDatum = GeometryConfig['datum'];

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
 * The house reference geometry on `assembly.house` is **not** transformed: the
 * house already lives in world coords (built by `buildHouseReferenceGeometry`
 * around the configured house footprint), and is shared across pergolas.
 *
 * The transform is rotation around `+Z` by `position.rotationDeg` followed by
 * translation by `position.origin`. Calling with `position == null` is a
 * no-op — assemblies pass through unchanged.
 */
export function applyAssemblyPosition3D(
  assembly: Assembly3D,
  position: AssemblyPosition | null,
): Assembly3D {
  if (!position) return assembly;
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
  const transformMember = (member: AssemblyMember3D): AssemblyMember3D => ({
    ...member,
    centerline: transformLine(member.centerline),
    localFrame: transformDatumFrame(member.localFrame),
    endCuts: member.endCuts
      ? member.endCuts.map((cut) => ({ ...cut, plane: transformEndCutPlane(cut.plane) }))
      : member.endCuts,
  });
  const transformRoofPlane = (plane: RoofPlane3D): RoofPlane3D => ({
    ...plane,
    boundary: transformPolygon(plane.boundary),
    plane: transformPlane(plane.plane),
    fallVector: transformVector(plane.fallVector),
  });
  const transformRoofCladding = (panel: RoofCladdingPanel3D): RoofCladdingPanel3D => ({
    ...panel,
    boundary: transformPolygon(panel.boundary),
    plane: transformPlane(panel.plane),
  });
  const transformRoofFlashing = (flashing: RoofFlashing3D): RoofFlashing3D => ({
    ...flashing,
    wings: flashing.wings.map((wing) => ({
      ...wing,
      boundary: transformPolygon(wing.boundary),
      plane: transformPlane(wing.plane),
    })),
  });

  return {
    ...assembly,
    datum: transformAssemblyDatum(assembly.datum),
    outline: transformPolygon(assembly.outline),
    attachmentEdge: assembly.attachmentEdge ? transformLine(assembly.attachmentEdge) : null,
    members: assembly.members.map(transformMember),
    roofPlanes: assembly.roofPlanes.map(transformRoofPlane),
    roofCladdingPanels: assembly.roofCladdingPanels.map(transformRoofCladding),
    roofFlashings: assembly.roofFlashings ? assembly.roofFlashings.map(transformRoofFlashing) : assembly.roofFlashings,
    // `house` is intentionally NOT transformed — the house already lives in
    // world coords and is shared across pergolas in the same project.
  };
}
