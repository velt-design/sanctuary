import * as THREE from "three";
import type {
  Point3,
  ViewerSceneHouseLinearSolidObject,
  ViewerSceneMemberPrismObject,
  ViewerSceneObject,
} from "@sp/geometry";
import { isRenderableLine } from "../scene";
import { vectorFromPoint } from "./lineBuilders";
import { normalizeNonZeroVector } from "./polygonGeometries";

/**
 * Member placement, profile extrusion and end-cut clipping geometry.
 */

const CLIP_EPSILON_MM = 1e-5;

export function buildLinearSolidPlacement(object: ViewerSceneHouseLinearSolidObject): {
  matrix: THREE.Matrix4;
  lengthMm: number;
  profileWidthMm: number;
  profileDepthMm: number;
} | null {
  if (!isRenderableLine(object.centerline)) return null;
  if (
    !Number.isFinite(object.profileWidthMm) ||
    !Number.isFinite(object.profileDepthMm) ||
    object.profileWidthMm <= 0 ||
    object.profileDepthMm <= 0
  ) {
    return null;
  }

  const start = vectorFromPoint(object.centerline.start);
  const end = vectorFromPoint(object.centerline.end);
  const center = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const lengthMm = direction.length();
  if (!Number.isFinite(lengthMm) || lengthMm <= 0.001) return null;

  const xAxis = normalizeNonZeroVector(direction);
  const rawYAxis = normalizeNonZeroVector(vectorFromPoint(object.localFrame.yAxis));
  const rawZAxis = normalizeNonZeroVector(vectorFromPoint(object.localFrame.zAxis));
  const rawFrameXAxis = normalizeNonZeroVector(vectorFromPoint(object.localFrame.xAxis));
  if (!xAxis || !rawYAxis || !rawZAxis || !rawFrameXAxis) return null;

  let yAxis = rawYAxis
    .clone()
    .addScaledVector(xAxis, -rawYAxis.dot(xAxis));
  if (yAxis.lengthSq() <= 1e-12) {
    yAxis = new THREE.Vector3().crossVectors(rawZAxis, xAxis);
  }
  if (yAxis.lengthSq() <= 1e-12) return null;
  yAxis.normalize();

  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  if (zAxis.lengthSq() <= 1e-12) return null;
  zAxis.normalize();
  if (zAxis.dot(rawZAxis) < 0) {
    yAxis.negate();
    zAxis.negate();
  }

  if (
    Math.abs(xAxis.dot(yAxis)) > 0.001 ||
    Math.abs(xAxis.dot(zAxis)) > 0.001 ||
    Math.abs(yAxis.dot(zAxis)) > 0.001
  ) {
    return null;
  }

  const matrix = new THREE.Matrix4();
  matrix.makeBasis(xAxis, yAxis, zAxis);
  matrix.setPosition(center.x, center.y, center.z);
  return {
    matrix,
    lengthMm,
    profileWidthMm: Math.max(object.profileWidthMm, 1),
    profileDepthMm: Math.max(object.profileDepthMm, 1),
  };
}

export function buildProfileExtrusionGeometry(
  profile: ViewerSceneMemberPrismObject["profile"],
  lengthMm: number,
  options?: { includeVoids?: boolean },
): THREE.BufferGeometry {
  const outline = profile.sectionOutline ?? [];
  if (outline.length < 3) {
    return new THREE.BoxGeometry(
      Math.max(lengthMm, 1),
      profile.widthMm,
      profile.depthMm,
    );
  }

  const shape = new THREE.Shape(
    outline.map((point) => new THREE.Vector2(point.x, point.y)),
  );
  if (options?.includeVoids ?? true) {
    for (const voidBoundary of profile.sectionVoids ?? []) {
      if (voidBoundary.length < 3) continue;
      shape.holes.push(
        new THREE.Path(
          voidBoundary.map((point) => new THREE.Vector2(point.x, point.y)),
        ),
      );
    }
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(lengthMm, 1),
    steps: 1,
    bevelEnabled: false,
  });
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getX(index);
    const z = position.getY(index);
    const x = position.getZ(index) - Math.max(lengthMm, 1) / 2;
    position.setXYZ(index, x, y, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildRectangularCapGeometry(
  lengthMm: number,
  widthMm: number,
  depthMm: number,
): THREE.BufferGeometry {
  return new THREE.BoxGeometry(
    Math.max(lengthMm, 1),
    Math.max(widthMm, 1),
    Math.max(depthMm, 1),
  );
}

type LocalClipPlane = {
  normal: THREE.Vector3;
  offsetMm: number;
  keepSide: "negative" | "positive";
};

function signedDistanceToClipPlane(
  point: THREE.Vector3,
  plane: LocalClipPlane,
): number {
  return plane.normal.dot(point) - plane.offsetMm;
}

function pointIsInsideClipPlane(
  point: THREE.Vector3,
  plane: LocalClipPlane,
): boolean {
  const distance = signedDistanceToClipPlane(point, plane);
  return plane.keepSide === "negative"
    ? distance <= CLIP_EPSILON_MM
    : distance >= -CLIP_EPSILON_MM;
}

function clipFaceToPlane(
  face: THREE.Vector3[],
  plane: LocalClipPlane,
): { face: THREE.Vector3[]; intersections: THREE.Vector3[] } {
  if (face.length < 3) {
    return { face: [], intersections: [] };
  }

  const clipped: THREE.Vector3[] = [];
  const intersections: THREE.Vector3[] = [];
  for (let index = 0; index < face.length; index += 1) {
    const current = face[index]!;
    const next = face[(index + 1) % face.length]!;
    const currentInside = pointIsInsideClipPlane(current, plane);
    const nextInside = pointIsInsideClipPlane(next, plane);

    if (currentInside && nextInside) {
      clipped.push(next.clone());
      continue;
    }

    const currentDistance = signedDistanceToClipPlane(current, plane);
    const nextDistance = signedDistanceToClipPlane(next, plane);
    const denominator = currentDistance - nextDistance;
    const intersection =
      Math.abs(denominator) > CLIP_EPSILON_MM
        ? current.clone().lerp(next, currentDistance / denominator)
        : current.clone();

    if (currentInside && !nextInside) {
      clipped.push(intersection);
      intersections.push(intersection.clone());
    } else if (!currentInside && nextInside) {
      clipped.push(intersection.clone(), next.clone());
      intersections.push(intersection);
    }
  }

  return { face: clipped, intersections };
}

function dedupeClipPoints(points: THREE.Vector3[]): THREE.Vector3[] {
  const unique: THREE.Vector3[] = [];
  for (const point of points) {
    if (!unique.some((candidate) => candidate.distanceTo(point) <= 1e-4)) {
      unique.push(point);
    }
  }
  return unique;
}

function sortCapFacePoints(
  points: THREE.Vector3[],
  plane: LocalClipPlane,
): THREE.Vector3[] {
  const center = points
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / points.length);
  const normal = plane.normal.clone().normalize();
  const reference =
    Math.abs(normal.x) < 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const uAxis = reference
    .sub(normal.clone().multiplyScalar(reference.dot(normal)))
    .normalize();
  const vAxis = normal.clone().cross(uAxis).normalize();
  const sorted = [...points].sort((a, b) => {
    const aDelta = a.clone().sub(center);
    const bDelta = b.clone().sub(center);
    return (
      Math.atan2(aDelta.dot(vAxis), aDelta.dot(uAxis)) -
      Math.atan2(bDelta.dot(vAxis), bDelta.dot(uAxis))
    );
  });

  return plane.keepSide === "negative" ? sorted : sorted.reverse();
}

function localClipPlaneFromEndCut(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
  xAxis: THREE.Vector3,
  endCut: NonNullable<ViewerSceneMemberPrismObject["endCuts"]>[number],
): LocalClipPlane | null {
  const worldNormal = new THREE.Vector3(
    endCut.plane.normal.x,
    endCut.plane.normal.y,
    endCut.plane.normal.z,
  ).normalize();
  const yAxis = new THREE.Vector3(
    object.localFrame.yAxis.x,
    object.localFrame.yAxis.y,
    object.localFrame.yAxis.z,
  ).normalize();
  const zAxis = new THREE.Vector3(
    object.localFrame.zAxis.x,
    object.localFrame.zAxis.y,
    object.localFrame.zAxis.z,
  ).normalize();
  const localNormal = new THREE.Vector3(
    worldNormal.dot(xAxis),
    worldNormal.dot(yAxis),
    worldNormal.dot(zAxis),
  );
  const localNormalLength = localNormal.length();
  if (localNormalLength <= CLIP_EPSILON_MM) {
    return null;
  }
  const midpointVector = new THREE.Vector3(midpoint.x, midpoint.y, midpoint.z);
  const localOffsetMm = endCut.plane.offsetMm - worldNormal.dot(midpointVector);
  return {
    normal: localNormal.multiplyScalar(1 / localNormalLength),
    offsetMm: localOffsetMm / localNormalLength,
    keepSide: endCut.plane.keepSide,
  };
}

function clipFacesToEndCuts(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
  xAxis: THREE.Vector3,
  faces: THREE.Vector3[][],
): THREE.Vector3[][] {
  const endCuts = object.endCuts ?? [];
  const clipPlanes = endCuts
    .map((cut) => localClipPlaneFromEndCut(object, midpoint, xAxis, cut))
    .filter((plane): plane is LocalClipPlane => plane !== null);
  let clippedFaces = faces;

  for (const plane of clipPlanes) {
    const nextFaces: THREE.Vector3[][] = [];
    const capPoints: THREE.Vector3[] = [];
    for (const face of clippedFaces) {
      const clipped = clipFaceToPlane(face, plane);
      if (clipped.face.length >= 3) {
        nextFaces.push(clipped.face);
      }
      capPoints.push(...clipped.intersections);
    }
    const capFace = dedupeClipPoints(capPoints);
    if (capFace.length >= 3) {
      nextFaces.push(sortCapFacePoints(capFace, plane));
    }
    clippedFaces = nextFaces;
  }

  return clippedFaces;
}

function geometryFromFaces(faces: THREE.Vector3[][]): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const face of faces) {
    for (let index = 1; index < face.length - 1; index += 1) {
      const a = face[0]!;
      const b = face[index]!;
      const c = face[index + 1]!;
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function memberLocalXAxis(
  object: ViewerSceneMemberPrismObject,
): THREE.Vector3 {
  return new THREE.Vector3(
    object.centerline.end.x - object.centerline.start.x,
    object.centerline.end.y - object.centerline.start.y,
    object.centerline.end.z - object.centerline.start.z,
  ).normalize();
}

function endCutExtensions(
  object: ViewerSceneMemberPrismObject,
): { startExtensionMm: number; endExtensionMm: number } {
  const endCuts = object.endCuts ?? [];
  return {
    startExtensionMm: Math.max(
      0,
      ...endCuts
        .filter((cut) => cut.end === "start")
        .map((cut) => cut.preClipExtensionMm),
    ),
    endExtensionMm: Math.max(
      0,
      ...endCuts
        .filter((cut) => cut.end === "end")
        .map((cut) => cut.preClipExtensionMm),
    ),
  };
}

export function buildClippedBoxGeometry(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
): THREE.BufferGeometry | null {
  const endCuts = object.endCuts ?? [];
  if (endCuts.length === 0) {
    return null;
  }

  const xAxis = memberLocalXAxis(object);
  const { startExtensionMm, endExtensionMm } = endCutExtensions(object);
  const halfLength = Math.max(object.lengthMm, 1) / 2;
  const halfWidth = Math.max(object.profile.widthMm, 1) / 2;
  const halfDepth = Math.max(object.profile.depthMm, 1) / 2;
  const x0 = -halfLength - startExtensionMm;
  const x1 = halfLength + endExtensionMm;
  const y0 = -halfWidth;
  const y1 = halfWidth;
  const z0 = -halfDepth;
  const z1 = halfDepth;
  const faces: THREE.Vector3[][] = [
    [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x0, y1, z0),
      new THREE.Vector3(x0, y1, z1),
      new THREE.Vector3(x0, y0, z1),
    ],
    [
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x1, y0, z1),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x1, y1, z0),
    ],
    [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x1, y1, z0),
      new THREE.Vector3(x0, y1, z0),
    ],
    [
      new THREE.Vector3(x0, y0, z1),
      new THREE.Vector3(x0, y1, z1),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x1, y0, z1),
    ],
    [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x0, y0, z1),
      new THREE.Vector3(x1, y0, z1),
      new THREE.Vector3(x1, y0, z0),
    ],
    [
      new THREE.Vector3(x0, y1, z0),
      new THREE.Vector3(x1, y1, z0),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x0, y1, z1),
    ],
  ];

  return geometryFromFaces(clipFacesToEndCuts(object, midpoint, xAxis, faces));
}

export function buildClippedProfileExtrusionGeometry(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
): THREE.BufferGeometry | null {
  const endCuts = object.endCuts ?? [];
  const outline = object.profile.sectionOutline ?? [];
  if (
    endCuts.length === 0 ||
    outline.length < 3 ||
    (object.profile.sectionVoids?.length ?? 0) > 0
  ) {
    return null;
  }

  const xAxis = memberLocalXAxis(object);
  const { startExtensionMm, endExtensionMm } = endCutExtensions(object);
  const halfLength = Math.max(object.lengthMm, 1) / 2;
  const x0 = -halfLength - startExtensionMm;
  const x1 = halfLength + endExtensionMm;
  const startFace = outline
    .map((point) => new THREE.Vector3(x0, point.x, point.y))
    .reverse();
  const endFace = outline.map((point) => new THREE.Vector3(x1, point.x, point.y));
  const faces: THREE.Vector3[][] = [startFace, endFace];

  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    faces.push([
      new THREE.Vector3(x0, current.x, current.y),
      new THREE.Vector3(x1, current.x, current.y),
      new THREE.Vector3(x1, next.x, next.y),
      new THREE.Vector3(x0, next.x, next.y),
    ]);
  }

  return geometryFromFaces(clipFacesToEndCuts(object, midpoint, xAxis, faces));
}

export function numericMetadataValue(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}
