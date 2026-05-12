import type {
  DatumFrame3,
  HouseDeck3D,
  HouseModel3D,
  HouseRoofForm,
  HouseWallSegment3D,
  RoofPlane3D,
  Vector3,
} from '../contracts';
import { dotProduct, lineLength, normalizeVector, subtractPoints } from '../math3d';
import {
  DEFAULT_DECK_SURFACE_THICKNESS_MM,
  DEFAULT_FASCIA_SOLID_THICKNESS_MM,
  DEFAULT_ROOF_SOLID_THICKNESS_MM,
  DEFAULT_SOFFIT_SOLID_THICKNESS_MM,
  DEFAULT_WALL_SOLID_THICKNESS_MM,
  WORLD_Z,
} from './constants';
import {
  edgeOutwardVector,
  line,
  planeFromBoundary,
  point,
  type HouseRoofPerimeterEdge,
  type HouseRoofPerimeterEdgeKind,
  type HouseRoofPerimeterFlashingRole,
  type HouseRoofPerimeterLine,
  type HouseRoofPerimeterPolygon,
} from './_internal';
import { buildPerimeterOffsetStripFootprints } from './eave';
import { roofSolidBottomPlaneEquation } from './roofPlane';
import { wallBoundaryHasFlatTop } from './walls';
import {
  boundaryZRange,
  buildMiteredOffsetStripFootprints,
  buildPolygonalWallRenderMesh,
  buildRoofSolidAdjacency,
  buildRoofSolidRenderMesh,
  buildVerticalPrismRenderMesh,
} from './roofSolids';
import { houseWallIsOpenGableFrame } from './roofFrames';
import { sourceEdgeIndexFromId } from './attachment';

function monoPerimeterProjection(edge: HouseRoofPerimeterEdge, fallAxisXY: Vector3): number {
  const midpointX = (edge.roofStart.x + edge.roofEnd.x) / 2;
  const midpointY = (edge.roofStart.y + edge.roofEnd.y) / 2;
  return midpointX * fallAxisXY.x + midpointY * fallAxisXY.y;
}

function monoPerimeterAlignment(edge: HouseRoofPerimeterEdge, axisXY: Vector3): number {
  const edgeVector = normalizeVector({
    x: edge.roofEnd.x - edge.roofStart.x,
    y: edge.roofEnd.y - edge.roofStart.y,
    z: 0,
  });
  return Math.abs(dotProduct(edgeVector, axisXY));
}

function monoWeatherFlashingRole(
  edge: HouseRoofPerimeterEdge,
  fallAxisXY: Vector3,
): HouseRoofPerimeterFlashingRole {
  const acrossAxisXY = normalizeVector({ x: -fallAxisXY.y, y: fallAxisXY.x, z: 0 });
  return monoPerimeterAlignment(edge, acrossAxisXY) >= monoPerimeterAlignment(edge, fallAxisXY)
    ? 'high_side'
    : 'rake';
}

export function buildHouseEnvelopeSolids(input: {
  wallSegments: HouseWallSegment3D[];
  roofPlanes: RoofPlane3D[];
  roofForm: HouseRoofForm;
  decks: HouseDeck3D[];
  perimeterEdges: HouseRoofPerimeterEdge[];
  soffitPolygons: HouseRoofPerimeterPolygon[];
  fasciaPolygons: HouseRoofPerimeterPolygon[];
  gutterLines: HouseRoofPerimeterLine[];
  gutterBoundaries: HouseRoofPerimeterPolygon[];
  gutterWidthMm: number;
  gutterDepthMm: number;
}): NonNullable<HouseModel3D['solids']> {
  const surfaceSolids: NonNullable<HouseModel3D['solids']>['surfaceSolids'] = [];
  const linearSolids: NonNullable<HouseModel3D['solids']>['linearSolids'] = [];
  // Wall solids are offset INWARD from the footprint edge: the outer wall
  // face sits exactly at the footprint outline (where the eave line runs)
  // and the wall extends fully into the building interior by its thickness.
  // This matches conventional construction (the eave overhangs the wall's
  // outer face rather than the wall sticking out past the eave) and gives
  // a clean outside corner where two walls meet at the footprint corner
  // with no extra geometry protruding past the roof outline.
  const wallMiterFootprints = buildMiteredOffsetStripFootprints(
    input.wallSegments.map((segment) => segment.line.start),
    0,
    -DEFAULT_WALL_SOLID_THICKNESS_MM,
  );
  const fasciaMiterFootprints = buildPerimeterOffsetStripFootprints({
    edges: input.perimeterEdges,
    outerOffsetMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
    innerOffsetMm: -DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
  });
  const roofSolidAdjacency = buildRoofSolidAdjacency(input.roofPlanes);
  const roofBottomPlanes = input.roofPlanes.map((roofPlane) =>
    roofSolidBottomPlaneEquation(roofPlane.plane, DEFAULT_ROOF_SOLID_THICKNESS_MM),
  );
  const perimeterEdgeRoles = new Map<string, HouseRoofPerimeterEdgeKind>();
  for (const edge of input.perimeterEdges) {
    if (!edge.sourceRoofPlaneId) continue;
    perimeterEdgeRoles.set(`${edge.sourceRoofPlaneId}:${edge.index}`, edge.edgeKind);
  }

  for (const [index, wall] of input.wallSegments.entries()) {
    const zRange = boundaryZRange(wall.boundary);
    const isFlatTop = wallBoundaryHasFlatTop(wall.boundary);
    const hasMiterFootprint = wallMiterFootprints?.length === input.wallSegments.length;

    let renderMesh = undefined;
    if (zRange && isFlatTop && hasMiterFootprint) {
      // Standard rectangular wall: extrude the corner-mitered plan footprint
      // vertically so mitered corners with neighbouring walls render cleanly.
      renderMesh = buildVerticalPrismRenderMesh(wallMiterFootprints![index]!, zRange.bottomZ, zRange.topZ);
    } else if (!isFlatTop) {
      // Non-flat-top wall (e.g. open-gable end wall whose boundary climbs
      // from the eave up to the ridge apex and back). The wall's own
      // `boundary` polygon already encodes the pentagonal/triangular shape
      // in the wall's vertical plane; extrude it perpendicular to that plane
      // by the standard wall thickness to produce a solid that matches the
      // visual weight of the rectangular walls around it.
      renderMesh = buildPolygonalWallRenderMesh(
        wall.boundary,
        wall.plane.normal,
        DEFAULT_WALL_SOLID_THICKNESS_MM,
      );
    }

    surfaceSolids.push({
      id: `house-solid-${wall.id}`,
      kind: 'wall',
      boundary: wall.boundary,
      plane: wall.plane,
      thicknessMm: DEFAULT_WALL_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: wall.id,
        sourceEdgeId: wall.sourceEdgeId ?? null,
        ...(houseWallIsOpenGableFrame(wall) ? { houseWallMode: 'open_gable_frame' as const } : {}),
      },
    });
  }

  for (const [roofPlaneIndex, roofPlane] of input.roofPlanes.entries()) {
    const renderMesh = buildRoofSolidRenderMesh({
      roofPlanes: input.roofPlanes,
      roofPlaneIndex,
      adjacency: roofSolidAdjacency,
      bottomPlanes: roofBottomPlanes,
      includeBottomFaces: input.roofForm !== 'mono',
      perimeterEdgeRoles,
    });
    surfaceSolids.push({
      id: `house-solid-${roofPlane.id}`,
      kind: 'roof',
      boundary: roofPlane.boundary,
      plane: roofPlane.plane,
      thicknessMm: DEFAULT_ROOF_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...roofPlane.metadata,
        sourceId: roofPlane.id,
      },
    });
  }

  for (const deck of input.decks) {
    const renderMesh = buildVerticalPrismRenderMesh(
      deck.boundary,
      deck.topSurfaceElevationMm - DEFAULT_DECK_SURFACE_THICKNESS_MM,
      deck.topSurfaceElevationMm,
    );
    surfaceSolids.push({
      id: `house-solid-${deck.id}`,
      kind: 'deck',
      boundary: deck.boundary,
      plane: deck.plane,
      thicknessMm: DEFAULT_DECK_SURFACE_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...deck.metadata,
        sourceId: deck.id,
      },
    });
  }

  for (const [index, soffit] of input.soffitPolygons.entries()) {
    const boundary = soffit.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const z = boundary[0]?.z;
    const renderMesh =
      typeof z === 'number' &&
      Number.isFinite(z) &&
      boundary.every((candidate) => Math.abs(candidate.z - z) <= 1e-6)
      ? buildVerticalPrismRenderMesh(
          boundary,
          z - DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
          z + DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
        )
      : undefined;
    surfaceSolids.push({
      id: `house-solid-soffit-${index + 1}`,
      kind: 'soffit',
      boundary,
      plane,
      thicknessMm: DEFAULT_SOFFIT_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-soffit-${index + 1}`,
        sourceEdgeId: soffit.sourceEdgeId,
        houseRoofEdgeKind: soffit.edgeKind,
        houseRoofPerimeterRole: soffit.edgeKind,
        sourceRoofPlaneId: soffit.sourceRoofPlaneId ?? null,
        flashingRole: soffit.flashingRole ?? null,
        houseRoofSoffitMode: soffit.houseRoofSoffitMode ?? null,
      },
    });
  }

  for (const [index, fascia] of input.fasciaPolygons.entries()) {
    const boundary = fascia.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const zRange = boundaryZRange(boundary);
    const renderMesh =
      zRange && fasciaMiterFootprints.length === input.fasciaPolygons.length
        ? buildVerticalPrismRenderMesh(fasciaMiterFootprints[index]!.boundary, zRange.bottomZ, zRange.topZ)
        : undefined;
    surfaceSolids.push({
      id: `house-solid-fascia-${index + 1}`,
      kind: 'fascia',
      boundary,
      plane,
      thicknessMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-fascia-${index + 1}`,
        sourceEdgeId: fascia.sourceEdgeId,
        houseRoofEdgeKind: fascia.edgeKind,
        houseRoofPerimeterRole: fascia.edgeKind,
        flashingRole: fascia.flashingRole ?? null,
        sourceRoofPlaneId: fascia.sourceRoofPlaneId ?? null,
      },
    });
  }

  for (const [index, gutter] of input.gutterLines.entries()) {
    const boundary = input.gutterBoundaries[index]?.boundary;
    const start = gutter.line.start;
    const end = gutter.line.end;
    const gutterLine = line(
      point(start.x, start.y, start.z - input.gutterDepthMm / 2),
      point(end.x, end.y, end.z - input.gutterDepthMm / 2),
    );
    if (lineLength(gutterLine) <= 1e-6) continue;
    const xAxis = normalizeVector(subtractPoints(gutterLine.end, gutterLine.start));
    const perimeterEdge = input.perimeterEdges.find((edge) => edge.sourceEdgeId === gutter.sourceEdgeId);
    const sourcePolygon = perimeterEdge?.perimeterPolygon ?? [];
    const sourceEdgeIndex = perimeterEdge?.index ?? sourceEdgeIndexFromId(gutter.sourceEdgeId, sourcePolygon.length);
    const yAxis =
      sourceEdgeIndex === null || sourcePolygon.length === 0
        ? { x: 0, y: 1, z: 0 }
        : edgeOutwardVector(sourcePolygon, sourceEdgeIndex);
    const localFrame: DatumFrame3 = {
      origin: gutterLine.start,
      xAxis,
      yAxis,
      zAxis: WORLD_Z,
    };
    const gutterBoundaryTopZ = boundary?.[0]?.z;
    const renderMesh =
      boundary && typeof gutterBoundaryTopZ === 'number' && Number.isFinite(gutterBoundaryTopZ)
        ? buildVerticalPrismRenderMesh(
          boundary,
          gutterBoundaryTopZ - input.gutterDepthMm,
          gutterBoundaryTopZ,
        )
        : undefined;
    linearSolids.push({
      id: `house-solid-gutter-${linearSolids.length + 1}`,
      kind: 'gutter',
      centerline: gutterLine,
      localFrame,
      profileWidthMm: input.gutterWidthMm,
      profileDepthMm: input.gutterDepthMm,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-gutter-line-${index + 1}`,
        sourceEdgeId: gutter.sourceEdgeId,
        houseRoofEdgeKind: gutter.edgeKind,
        houseRoofPerimeterRole: gutter.edgeKind,
        flashingRole: gutter.flashingRole ?? null,
        sourceRoofPlaneId: gutter.sourceRoofPlaneId ?? null,
      },
    });
  }

  return { surfaceSolids, linearSolids };
}
