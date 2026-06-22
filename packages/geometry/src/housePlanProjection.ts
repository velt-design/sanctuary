import type {
  GeometryTopProjectionShape,
  HouseModel3D,
  Point2,
  Polygon2,
  Polygon3,
} from './contracts';
import { offsetFootprintPolygon } from './house/footprintMath';
import { deriveHouseGableTerminalEndsFromFootprint } from './house/roofJoined';

const EPSILON_MM = 1e-6;

function toPoint2(point: { x: number; y: number }): Point2 {
  return {
    x: Number(point.x.toFixed(6)),
    y: Number(point.y.toFixed(6)),
  };
}

function toPolygon2(points: Array<{ x: number; y: number }>): Polygon2 {
  return points.map(toPoint2);
}

function polygonArea(points: Polygon2): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function ensureClockwiseScreenPolygon(points: Polygon2): Polygon2 {
  return polygonArea(points) < 0 ? points : [...points].reverse();
}

function dedupePolygon(points: Polygon2): Polygon2 {
  const deduped: Polygon2 = [];
  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > EPSILON_MM) {
      deduped.push(point);
    }
  }
  const first = deduped[0];
  const last = deduped[deduped.length - 1];
  if (first && last && deduped.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) <= EPSILON_MM) {
    deduped.pop();
  }
  return deduped;
}

function cleanPolygon(points: Polygon2): Polygon2 | null {
  const deduped = dedupePolygon(points);
  if (deduped.length < 3 || Math.abs(polygonArea(deduped)) <= EPSILON_MM) return null;
  return ensureClockwiseScreenPolygon(deduped);
}

function finiteHousePlanPoint(point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function modelRoofQaIsValid(model: HouseModel3D): boolean {
  return model.metadata?.roofQaStatus === 'valid';
}

function repairedEavePolygonFromModel(model: HouseModel3D): Polygon3 | null {
  if (model.metadata?.roofEaveOffsetRepairStatus !== 'repaired') return null;
  const gutterPolygon = model.eave?.gutterLines?.map((candidate) => ({
    x: candidate.start.x,
    y: candidate.start.y,
    z: 0,
  })) ?? [];
  return gutterPolygon.length >= 3 ? gutterPolygon : null;
}

function buildHouseRoofPlanBodyPolygon(model: HouseModel3D): Polygon2 | null {
  if (!modelRoofQaIsValid(model)) return null;
  const metadataEffectiveEaveOverhangMm =
    typeof model.metadata?.roofEffectiveEaveOverhangMm === 'number' &&
    Number.isFinite(model.metadata.roofEffectiveEaveOverhangMm)
      ? model.metadata.roofEffectiveEaveOverhangMm
      : null;
  const eaveOverhangMm =
    metadataEffectiveEaveOverhangMm ??
    (typeof model.eave?.eaveOverhangMm === 'number' &&
    Number.isFinite(model.eave.eaveOverhangMm)
      ? model.eave.eaveOverhangMm
      : 0);
  const eavePolygon =
    repairedEavePolygonFromModel(model) ??
    offsetFootprintPolygon(model.footprint, eaveOverhangMm) ??
    (model.roofPlanes.length === 1
      ? model.roofPlanes[0]?.boundary ?? null
      : null);
  if (!eavePolygon || !eavePolygon.every(finiteHousePlanPoint)) return null;
  return cleanPolygon(toPolygon2(eavePolygon));
}

function buildHouseRoofPlanBodyShape(model: HouseModel3D): GeometryTopProjectionShape | null {
  const polygon = buildHouseRoofPlanBodyPolygon(model);
  if (!polygon) return null;
  return {
    id: `house_plan_roof:${model.houseId}`,
    sourceObjectId: `house-plan-roof-${model.houseId}`,
    sourceId: `house-plan-roof-${model.houseId}`,
    sourceType: 'house_surface_solid',
    family: 'house',
    kind: 'roof',
    polygon,
    zOrder: 30,
    zMin: null,
    zMax: null,
    metadata: {
      ...(model.metadata ?? {}),
      topProjectionRole: 'top_visible',
      houseFormId: model.houseId,
      planProjectionSource: 'house_eave_perimeter',
    },
  };
}

function pointInPolygonLike(point: Point2, polygon: Polygon3): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const edgeLength = Math.hypot(previous.x - current.x, previous.y - current.y);
    if (edgeLength > EPSILON_MM) {
      const cross = (point.x - current.x) * (previous.y - current.y) - (point.y - current.y) * (previous.x - current.x);
      const dot = (point.x - current.x) * (previous.x - current.x) + (point.y - current.y) * (previous.y - current.y);
      if (Math.abs(cross) <= 1e-3 * edgeLength && dot >= -1e-3 && dot <= edgeLength * edgeLength + 1e-3) {
        return true;
      }
    }
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || 1) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function buildHouseTerminalEndPlanShapes(input: {
  model: HouseModel3D;
  roofBody: GeometryTopProjectionShape;
}): GeometryTopProjectionShape[] {
  const model = input.model;
  const roofForm = typeof model.metadata?.roofForm === 'string' ? model.metadata.roofForm : null;
  if (roofForm !== 'hipped') return [];
  const ridgeAxis = model.roofRidgeAxis === 'x' || model.roofRidgeAxis === 'y'
    ? model.roofRidgeAxis
    : null;
  if (!ridgeAxis) return [];
  const terminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint: model.footprint,
    ridgeAxis,
  });
  if (terminalEnds.length === 0) return [];

  const roofBodyPolygon = input.roofBody.polygon.map((candidate) => ({
    x: candidate.x,
    y: candidate.y,
    z: 0,
  }));
  const openIdsCsv =
    typeof model.metadata?.openGableEndIds === 'string' ? model.metadata.openGableEndIds : '';
  const openIds = new Set(
    openIdsCsv
      ? openIdsCsv.split(',').map((value) => value.trim()).filter(Boolean)
      : [],
  );
  const centroid = model.footprint.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  centroid.x /= model.footprint.length;
  centroid.y /= model.footprint.length;

  return terminalEnds.flatMap((terminalEnd) => {
    const trailing = terminalEnd.id.match(/-(\d+)$/);
    if (!trailing) return [];
    const edgeIndex = Number(trailing[1]) - 1;
    if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= model.footprint.length) {
      return [];
    }
    const wallStart = model.footprint[edgeIndex]!;
    const wallEnd = model.footprint[(edgeIndex + 1) % model.footprint.length]!;
    const dx = wallEnd.x - wallStart.x;
    const dy = wallEnd.y - wallStart.y;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON_MM) return [];

    const mid = { x: (wallStart.x + wallEnd.x) / 2, y: (wallStart.y + wallEnd.y) / 2 };
    const perpA = { x: -dy / length, y: dx / length };
    const perpB = { x: dy / length, y: -dx / length };
    const towardCentroid = { x: centroid.x - mid.x, y: centroid.y - mid.y };
    const inward = perpA.x * towardCentroid.x + perpA.y * towardCentroid.y >= 0 ? perpA : perpB;
    const outward = { x: -inward.x, y: -inward.y };
    const along = { x: dx / length, y: dy / length };
    const metadataEffectiveEaveOverhangMm =
      typeof model.metadata?.roofEffectiveEaveOverhangMm === 'number' &&
      Number.isFinite(model.metadata.roofEffectiveEaveOverhangMm)
        ? model.metadata.roofEffectiveEaveOverhangMm
        : null;
    const eaveOverhangMm =
      metadataEffectiveEaveOverhangMm ??
      (typeof model.eave?.eaveOverhangMm === 'number' &&
      Number.isFinite(model.eave.eaveOverhangMm)
        ? model.eave.eaveOverhangMm
        : 0);
    const eaveStart = {
      x: wallStart.x + outward.x * eaveOverhangMm - along.x * eaveOverhangMm,
      y: wallStart.y + outward.y * eaveOverhangMm - along.y * eaveOverhangMm,
    };
    const eaveEnd = {
      x: wallEnd.x + outward.x * eaveOverhangMm + along.x * eaveOverhangMm,
      y: wallEnd.y + outward.y * eaveOverhangMm + along.y * eaveOverhangMm,
    };
    const apex = {
      x: mid.x + inward.x * (length / 2),
      y: mid.y + inward.y * (length / 2),
    };
    const polygon = cleanPolygon([apex, eaveStart, eaveEnd]);
    if (!polygon) return [];

    return [{
      id: `house_terminal_end:${model.houseId}:${terminalEnd.id}`,
      sourceObjectId: terminalEnd.id,
      sourceId: terminalEnd.id,
      sourceType: 'house_surface_solid' as const,
      family: 'house' as const,
      kind: 'roof',
      polygon,
      zOrder: input.roofBody.zOrder + 0.001,
      zMin: input.roofBody.zMin,
      zMax: input.roofBody.zMax,
      metadata: {
        topProjectionRole: 'top_visible',
        houseFormId: model.houseId,
        openGableEndId: terminalEnd.id,
        isOpen: openIds.has(terminalEnd.id),
        planProjectionSource: 'house_terminal_end',
        terminalEndSourceEdgeId: terminalEnd.sourceEdgeId,
      },
    } satisfies GeometryTopProjectionShape];
  }).filter((shape) => {
    const first = shape.polygon[0];
    const second = shape.polygon[1];
    const third = shape.polygon[2];
    return Boolean(
      first &&
        second &&
        third &&
        pointInPolygonLike(first, roofBodyPolygon) &&
        pointInPolygonLike(second, roofBodyPolygon) &&
        pointInPolygonLike(third, roofBodyPolygon),
    );
  });
}

export function buildHouseRoofPlanProjectionShapes(model: HouseModel3D): GeometryTopProjectionShape[] {
  const roofBody = buildHouseRoofPlanBodyShape(model);
  if (!roofBody) return [];
  return [
    roofBody,
    ...buildHouseTerminalEndPlanShapes({ model, roofBody }),
  ];
}
