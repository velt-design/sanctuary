import type {
  GeometryMetadata,
  HouseRoofFeature3D,
  HouseRoofFeatureKind,
  Point3,
  Polygon3,
  RoofPlane3D,
} from "../contracts";
import { classifyVertex } from "../straightSkeleton/bisector";
import { computeOrthogonalStraightSkeletonOffset as computeOrthogonalStraightSkeleton } from "../straightSkeleton/offsetSolve";
import type { OffsetSkeletonError as StraightSkeletonError } from "../straightSkeleton/offsetSolve";
import type { OrthogonalPolygon, StraightSkeleton } from "../straightSkeleton/types";
import { line, point } from "./_internal";
import { buildRoofPlane } from "./roofPlane";

/**
 * PR-SS-3 (2026-06-20): roof translator. Turns the pure
 * straight-skeleton graph (PR-SS-2) into roof facets + ridge/valley/hip
 * features at a given pitch + eave height. One coherent hipped roof for
 * any rectilinear footprint — the unified-topology output the
 * composition vision calls for.
 *
 * Construction:
 *
 *  - Node height = eaveHeightMm + node.time × tan(pitch). Eave nodes
 *    (the polygon corners, time 0) sit at eave height.
 *  - One slope facet per polygon edge (eave). The facet boundary is
 *    found by tracing the planar subdivision face on the interior side
 *    of that eave (an angular DCEL-style walk over skeleton nodes +
 *    eave segments). This uses only the graph geometry — NOT the
 *    skeleton's left/right edge labels — so it is robust at multi-reflex
 *    convergences (+, H) where a clean label partition is hard to keep.
 *  - Features: a skeleton edge incident to a reflex polygon corner is
 *    a valley; one incident to a convex polygon corner is a hip; one
 *    between two interior nodes is a ridge.
 *
 * Scope (deliberately): every eave produces one slope facet — fully
 * hipped. Open-gable / Dutch-hip terminal caps (where an eave becomes
 * a vertical gable wall and produces no slope facet) are NOT handled
 * here; they are composite-perimeter work (later PR). No cladding /
 * flashing / solids, no QA call, no wiring into composeRoofFromComposition
 * (that is PR-SS-4).
 *
 * Correctness guard: the translator verifies the facets partition the
 * footprint (their plan areas sum to the footprint area). Shapes whose
 * skeleton SS-2 does not yet fully resolve — the 4-way central
 * convergence of a + or H — fail this guard and return a typed error
 * rather than a silently-wrong roof (graceful fallback). Rect / L / T /
 * U solve cleanly today; closing the +/H central convergence is a named
 * SS-2 follow-up that must land before PR-SS-4 unquarantines those
 * corpus fixtures.
 */

type SkeletonRoofTranslateError =
  | { code: "face_not_closed"; reason: string }
  | { code: "facets_do_not_partition"; reason: string };

type BuildSkeletonRoofResult =
  | {
      ok: true;
      roofPlanes: RoofPlane3D[];
      roofFeatures: HouseRoofFeature3D[];
      metadata: GeometryMetadata;
    }
  | { ok: false; error: StraightSkeletonError | SkeletonRoofTranslateError };

export function buildSkeletonRoof(input: {
  polygon: OrthogonalPolygon;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): BuildSkeletonRoofResult {
  const skeletonResult = computeOrthogonalStraightSkeleton(input.polygon);
  if (!skeletonResult.ok) {
    return { ok: false, error: skeletonResult.error };
  }
  const skeleton = skeletonResult.skeleton;
  const n = skeleton.polygonEdgeCount;
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);

  // Lift every skeleton node to 3D: z rises with wavefront time.
  const node3: Point3[] = skeleton.nodes.map((node) =>
    point(
      node.position.x,
      node.position.y,
      input.eaveHeightMm + node.time * pitchRisePerRun,
    ),
  );

  // Which polygon corners are reflex (their incident skeleton edge is a
  // valley). Polygon corners are skeleton nodes 0..n-1.
  const reflexCorner = new Set<number>();
  for (let i = 0; i < n; i += 1) {
    if (classifyVertex(input.polygon, i) === "reflex") reflexCorner.add(i);
  }

  // Adjacency over the planar subdivision: skeleton edges + every eave
  // segment (corner i → corner i+1). Used by the angular face walk.
  const adjacency = buildAdjacency(skeleton, n);

  const roofPlanes: RoofPlane3D[] = [];
  for (let edgeId = 0; edgeId < n; edgeId += 1) {
    // The roof facet sits on the interior side of the eave. For a CCW
    // polygon the interior is on the left of the directed eave
    // (corner edgeId → corner edgeId+1), so trace the face on its left.
    const boundaryNodes = traceFaceOnLeft(
      edgeId,
      (edgeId + 1) % n,
      adjacency,
      skeleton,
    );
    if (!boundaryNodes) {
      return {
        ok: false,
        error: {
          code: "face_not_closed",
          reason: `facet for polygon edge ${edgeId} did not form a closed cycle`,
        },
      };
    }
    roofPlanes.push(buildFacetPlane(edgeId, boundaryNodes, node3, input));
  }

  const roofFeatures: HouseRoofFeature3D[] = [];
  skeleton.edges.forEach((edge, index) => {
    const kind = classifyFeature(edge.fromNodeIndex, edge.toNodeIndex, n, reflexCorner);
    roofFeatures.push({
      id: `house-roof-skeleton-${kind}-${index + 1}`,
      kind,
      line: line(node3[edge.fromNodeIndex]!, node3[edge.toNodeIndex]!),
      metadata: { roofForm: "hipped" },
    });
  });

  // Self-guard: the facets must partition the footprint exactly (their
  // plan areas sum to the footprint area). If the underlying skeleton
  // left a convergence unresolved (e.g. the 4-way centre of a + or H —
  // a known SS-2 limitation), facets overlap and the sum overshoots.
  // Return a typed error so the orchestrator falls back rather than
  // emitting wrong geometry — never ship a silently-bad roof.
  const footprintArea = footprintAreaMm2(input.polygon);
  const facetAreaSum = roofPlanes.reduce(
    (sum, plane) => sum + Math.abs(planAreaMm2(plane.boundary)),
    0,
  );
  const areaTolerance = Math.max(1, footprintArea * 1e-6);
  if (Math.abs(facetAreaSum - footprintArea) > areaTolerance) {
    return {
      ok: false,
      error: {
        code: "facets_do_not_partition",
        reason: `facet plan areas (${facetAreaSum}) do not sum to footprint area (${footprintArea}) — skeleton convergence unresolved`,
      },
    };
  }

  const valleyCount = roofFeatures.filter((f) => f.kind === "valley").length;
  return {
    ok: true,
    roofPlanes,
    roofFeatures,
    metadata: {
      roofGeometry: "composition_skeleton",
      roofTopologySolver: "orthogonal_straight_skeleton",
      roofFacetCount: roofPlanes.length,
      roofValleyCount: valleyCount,
    },
  };
}

/**
 * Adjacency of the planar subdivision: every skeleton edge plus every
 * eave segment (polygon corner i → corner i+1). Undirected; neighbours
 * deduped (a node pair joined by both a skeleton edge and an eave is
 * still one undirected edge).
 */
function buildAdjacency(skeleton: StraightSkeleton, n: number): Map<number, Set<number>> {
  const adjacency = new Map<number, Set<number>>();
  const add = (a: number, b: number): void => {
    if (a === b) return;
    (adjacency.get(a) ?? adjacency.set(a, new Set()).get(a)!).add(b);
    (adjacency.get(b) ?? adjacency.set(b, new Set()).get(b)!).add(a);
  };
  for (const edge of skeleton.edges) add(edge.fromNodeIndex, edge.toNodeIndex);
  for (let i = 0; i < n; i += 1) add(i, (i + 1) % n);
  return adjacency;
}

/**
 * Trace the planar-subdivision face lying on the LEFT of the directed
 * edge `startU → startV`, by the standard "next edge clockwise" rule:
 * arriving at a vertex from `prev`, the next boundary edge is the
 * neighbour whose outgoing angle is the largest one strictly less than
 * the back-angle (angle toward `prev`), wrapping to the global maximum
 * when none is smaller. Returns the ordered node-index loop, or null if
 * it fails to close (defensive — degenerate geometry).
 */
function traceFaceOnLeft(
  startU: number,
  startV: number,
  adjacency: Map<number, Set<number>>,
  skeleton: StraightSkeleton,
): number[] | null {
  const pos = (i: number) => skeleton.nodes[i]!.position;
  const boundary: number[] = [startU];
  let prev = startU;
  let current = startV;
  const maxSteps = adjacency.size * 2 + 4;
  let steps = 0;
  while (current !== startU) {
    boundary.push(current);
    const cur = pos(current);
    const p = pos(prev);
    const back = Math.atan2(p.y - cur.y, p.x - cur.x);
    const neighbours = adjacency.get(current);
    if (!neighbours) return null;
    let chosen = -1;
    let chosenAngle = Number.NEGATIVE_INFINITY;
    let globalMax = -1;
    let globalMaxAngle = Number.NEGATIVE_INFINITY;
    for (const w of neighbours) {
      if (w === current) continue;
      const wp = pos(w);
      const ang = Math.atan2(wp.y - cur.y, wp.x - cur.x);
      if (ang > globalMaxAngle) {
        globalMaxAngle = ang;
        globalMax = w;
      }
      // Largest angle strictly less than `back` (epsilon guards the
      // back-edge itself from being re-selected on equality).
      if (ang < back - 1e-9 && ang > chosenAngle) {
        chosenAngle = ang;
        chosen = w;
      }
    }
    const next = chosen >= 0 ? chosen : globalMax;
    if (next < 0) return null;
    prev = current;
    current = next;
    steps += 1;
    if (steps > maxSteps) return null;
  }
  return boundary;
}

function buildFacetPlane(
  edgeId: number,
  boundaryNodes: number[],
  node3: Point3[],
  input: { eaveHeightMm: number; roofPitchDeg: number; polygon: OrthogonalPolygon },
): RoofPlane3D {
  let boundary: Polygon3 = boundaryNodes.map((idx) => node3[idx]!);
  // Orient CCW in plan view (matches the rectangular builder's facets
  // so downstream normal/area conventions agree).
  if (signedAreaXY(boundary) < 0) boundary = [...boundary].reverse();

  // High point = boundary vertex of greatest z (the ridge/apex side);
  // low point = midpoint of the eave segment.
  let highPoint = boundary[0]!;
  for (const p of boundary) if (p.z > highPoint.z) highPoint = p;
  const cornerA = input.polygon[edgeId]!;
  const cornerB = input.polygon[(edgeId + 1) % input.polygon.length]!;
  const lowPoint = point(
    (cornerA.x + cornerB.x) / 2,
    (cornerA.y + cornerB.y) / 2,
    input.eaveHeightMm,
  );

  // Ridge axis (informational metadata): a horizontal eave drains in y
  // (ridge runs along x) and vice versa.
  const ridgeAxis: "x" | "y" = cornerA.y === cornerB.y ? "x" : "y";

  return buildRoofPlane({
    id: `house-roof-skeleton-eave-${edgeId}`,
    boundary,
    highPoint,
    lowPoint,
    ridgeAxis,
    pitchDeg: input.roofPitchDeg,
  });
}

function classifyFeature(
  fromNode: number,
  toNode: number,
  n: number,
  reflexCorner: Set<number>,
): HouseRoofFeatureKind {
  const fromCorner = fromNode < n;
  const toCorner = toNode < n;
  if (reflexCorner.has(fromNode) || reflexCorner.has(toNode)) return "valley";
  if (fromCorner || toCorner) return "hip";
  return "ridge";
}

function signedAreaXY(polygon: Polygon3): number {
  let area2 = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    area2 += a.x * b.y - b.x * a.y;
  }
  return area2 / 2;
}

function planAreaMm2(boundary: Polygon3): number {
  return Math.abs(signedAreaXY(boundary));
}

function footprintAreaMm2(polygon: OrthogonalPolygon): number {
  let area2 = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2 / 2);
}
