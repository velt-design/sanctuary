import type { HouseRoofForm, Point3, RoofPlane3D } from '../contracts';
import { lineLength } from '../math3d';
import { DEFAULT_ROOF_SOLID_THICKNESS_MM, ROOF_REGION_MIN_AREA_MM2 } from './constants';
import {
  edgeOutwardVector,
  finiteRoofQaPoint,
  line,
  miterCornerPoint,
  point,
  polygonArea3D,
  signedAreaXY,
  type HouseRoofPerimeterEdge,
  type HouseRoofPerimeterEdgeKind,
  type HouseRoofPerimeterLine,
  type HouseRoofPerimeterPolygon,
} from './_internal';
import { roofPlaneEquationHeightAtXY, roofSolidBottomPlaneEquation } from './roofPlane';

export function isEavePackageEdge(edgeKind: HouseRoofPerimeterEdgeKind): boolean {
  return edgeKind === 'drain_eave';
}

export function buildPerimeterOffsetStripFootprints(input: {
  edges: HouseRoofPerimeterEdge[];
  outerOffsetMm: number;
  innerOffsetMm: number;
}): HouseRoofPerimeterPolygon[] {
  if (
    input.edges.length === 0 ||
    !Number.isFinite(input.outerOffsetMm) ||
    !Number.isFinite(input.innerOffsetMm) ||
    Math.abs(input.outerOffsetMm - input.innerOffsetMm) <= 1e-6
  ) {
    return [];
  }

  const edgesByPerimeter = new Map<string, HouseRoofPerimeterEdge[]>();
  for (const edge of input.edges) {
    const collection = edgesByPerimeter.get(edge.perimeterId) ?? [];
    collection.push(edge);
    edgesByPerimeter.set(edge.perimeterId, collection);
  }

  return [...edgesByPerimeter.values()].flatMap((group) => {
    const orderedEdges = [...group].sort((a, b) => a.index - b.index);
    const sourcePolygon = orderedEdges[0]?.perimeterPolygon;
    if (!sourcePolygon || orderedEdges.length !== sourcePolygon.length) return [];

    const exposedEdges = orderedEdges.filter((edge) => isEavePackageEdge(edge.edgeKind));
    const exposedIndexes = new Set(exposedEdges.map((edge) => edge.index));
    const shifted = orderedEdges.map((edge) => {
      const outward = edgeOutwardVector(sourcePolygon, edge.index);
      return {
        edge,
        outer: {
          start: point(
            edge.eaveStart.x + outward.x * input.outerOffsetMm,
            edge.eaveStart.y + outward.y * input.outerOffsetMm,
            0,
          ),
          end: point(
            edge.eaveEnd.x + outward.x * input.outerOffsetMm,
            edge.eaveEnd.y + outward.y * input.outerOffsetMm,
            0,
          ),
        },
        inner: {
          start: point(
            edge.eaveStart.x + outward.x * input.innerOffsetMm,
            edge.eaveStart.y + outward.y * input.innerOffsetMm,
            0,
          ),
          end: point(
            edge.eaveEnd.x + outward.x * input.innerOffsetMm,
            edge.eaveEnd.y + outward.y * input.innerOffsetMm,
            0,
          ),
        },
      };
    });

    return exposedEdges.flatMap((edge) => {
      const current = shifted[edge.index]!;
      const previousIndex = (edge.index - 1 + orderedEdges.length) % orderedEdges.length;
      const nextIndex = (edge.index + 1) % orderedEdges.length;
      const previous = shifted[previousIndex]!;
      const next = shifted[nextIndex]!;
      const sharesPreviousCorner = exposedIndexes.has(previousIndex);
      const sharesNextCorner = exposedIndexes.has(nextIndex);

      const outerStart = sharesPreviousCorner
        ? miterCornerPoint(previous.outer, current.outer)
        : current.outer.start;
      const outerEnd = sharesNextCorner
        ? miterCornerPoint(current.outer, next.outer)
        : current.outer.end;
      const innerEnd = sharesNextCorner
        ? miterCornerPoint(current.inner, next.inner)
        : current.inner.end;
      const innerStart = sharesPreviousCorner
        ? miterCornerPoint(previous.inner, current.inner)
        : current.inner.start;

      if (!outerStart || !outerEnd || !innerEnd || !innerStart) return [];

      const boundary = [outerStart, outerEnd, innerEnd, innerStart];
      if (
        Math.abs(signedAreaXY(boundary)) <= 1e-6 ||
        boundary.some(
          (candidate, index) =>
            lineLength(line(candidate, boundary[(index + 1) % boundary.length]!)) <= 1e-6,
        )
      ) {
        return [];
      }

      return [{
        boundary,
        sourceEdgeId: edge.sourceEdgeId,
        edgeKind: edge.edgeKind,
        sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
        flashingRole: edge.flashingRole ?? null,
      }];
    });
  });
}

export function buildPolygonGutterLines(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
}): HouseRoofPerimeterLine[] {
  return input.perimeterEdges.flatMap((edge) => {
    if (!isEavePackageEdge(edge.edgeKind)) return [];
    const gutterLine = line(edge.eaveStart, edge.eaveEnd);
    if (lineLength(gutterLine) <= 1e-6) return [];
    return [{
      line: gutterLine,
      sourceEdgeId: edge.sourceEdgeId,
      edgeKind: edge.edgeKind,
      sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
      flashingRole: edge.flashingRole ?? null,
    }];
  });
}

export function buildPolygonGutterBoundaries(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  gutterWidthMm: number;
  gutterProjectionMm: number;
}): HouseRoofPerimeterPolygon[] {
  const edgeById = new Map(input.perimeterEdges.map((edge) => [edge.sourceEdgeId, edge]));
  return buildPerimeterOffsetStripFootprints({
    edges: input.perimeterEdges,
    outerOffsetMm: input.gutterProjectionMm,
    innerOffsetMm: input.gutterProjectionMm - input.gutterWidthMm,
  }).flatMap((footprint) => {
    const edge = edgeById.get(footprint.sourceEdgeId);
    const topZ = edge?.eaveStart.z;
    if (typeof topZ !== 'number' || !Number.isFinite(topZ)) return [];
    return [{
      ...footprint,
      boundary: footprint.boundary.map((candidate) => point(candidate.x, candidate.y, topZ)),
    }];
  });
}

export function buildPolygonFasciaPolygons(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  fasciaHeightMm: number;
}): HouseRoofPerimeterPolygon[] {
  const polygons: HouseRoofPerimeterPolygon[] = [];
  for (const edge of input.perimeterEdges) {
    if (!isEavePackageEdge(edge.edgeKind)) continue;
    const fascia = [
      edge.eaveStart,
      edge.eaveEnd,
      point(edge.eaveEnd.x, edge.eaveEnd.y, edge.eaveEnd.z - input.fasciaHeightMm),
      point(edge.eaveStart.x, edge.eaveStart.y, edge.eaveStart.z - input.fasciaHeightMm),
    ];
    if (lineLength(line(fascia[0]!, fascia[1]!)) > 1e-6) {
      polygons.push({
        boundary: fascia,
        sourceEdgeId: edge.sourceEdgeId,
        edgeKind: edge.edgeKind,
        sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
        flashingRole: edge.flashingRole ?? null,
      });
    }
  }
  return polygons;
}

export function buildPolygonSoffitPolygons(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  roofForm: HouseRoofForm;
  roofPlanes: RoofPlane3D[];
}): HouseRoofPerimeterPolygon[] {
  if (input.roofForm === 'mono') {
    const roofPlaneById = new Map(input.roofPlanes.map((roofPlane) => [roofPlane.id, roofPlane]));
    const polygons: HouseRoofPerimeterPolygon[] = [];

    for (const edge of input.perimeterEdges) {
      if (!isEavePackageEdge(edge.edgeKind)) continue;
      const roofPlane =
        (edge.sourceRoofPlaneId ? roofPlaneById.get(edge.sourceRoofPlaneId) : null) ??
        (input.roofPlanes.length === 1 ? input.roofPlanes[0]! : null);
      const bottomPlane = roofPlane
        ? roofSolidBottomPlaneEquation(roofPlane.plane, DEFAULT_ROOF_SOLID_THICKNESS_MM)
        : null;
      if (!roofPlane || !bottomPlane) continue;

      const soffit = [
        point(
          edge.eaveStart.x,
          edge.eaveStart.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.eaveStart.x, edge.eaveStart.y) ?? Number.NaN,
        ),
        point(
          edge.eaveEnd.x,
          edge.eaveEnd.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.eaveEnd.x, edge.eaveEnd.y) ?? Number.NaN,
        ),
        point(
          edge.wallEnd.x,
          edge.wallEnd.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.wallEnd.x, edge.wallEnd.y) ?? Number.NaN,
        ),
        point(
          edge.wallStart.x,
          edge.wallStart.y,
          roofPlaneEquationHeightAtXY(bottomPlane, edge.wallStart.x, edge.wallStart.y) ?? Number.NaN,
        ),
      ];
      if (
        soffit.every(finiteRoofQaPoint) &&
        lineLength(line(soffit[0]!, soffit[1]!)) > 1e-6 &&
        lineLength(line(soffit[1]!, soffit[2]!)) > 1e-6 &&
        polygonArea3D(soffit) > ROOF_REGION_MIN_AREA_MM2
      ) {
        polygons.push({
          boundary: soffit,
          sourceEdgeId: edge.sourceEdgeId,
          edgeKind: edge.edgeKind,
          sourceRoofPlaneId: roofPlane.id,
          flashingRole: edge.flashingRole ?? null,
          houseRoofSoffitMode: 'sloped_underroof',
        });
      }
    }

    return polygons;
  }

  const polygons: HouseRoofPerimeterPolygon[] = [];
  for (const edge of input.perimeterEdges) {
    if (!isEavePackageEdge(edge.edgeKind)) continue;
    const soffit = [
      edge.eaveStart,
      edge.eaveEnd,
      point(edge.wallEnd.x, edge.wallEnd.y, edge.eaveEnd.z),
      point(edge.wallStart.x, edge.wallStart.y, edge.eaveStart.z),
    ];
    if (lineLength(line(soffit[0]!, soffit[1]!)) > 1e-6 && lineLength(line(soffit[1]!, soffit[2]!)) > 1e-6) {
      polygons.push({
        boundary: soffit,
        sourceEdgeId: edge.sourceEdgeId,
        edgeKind: edge.edgeKind,
        sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
        flashingRole: edge.flashingRole ?? null,
        houseRoofSoffitMode: 'horizontal',
      });
    }
  }
  return polygons;
}
