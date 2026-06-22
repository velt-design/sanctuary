import type {
  AttachmentSide,
  HouseDeck3D,
  HouseDeckConfig,
  HouseModel3D,
  HouseWallSegment3D,
  Point3,
  Polygon3,
} from '../contracts';
import { lineLength } from '../math3d';
import {
  pointInPolygon2D,
  planeFromBoundary,
  point,
  polygonCentroid2D,
} from './_internal';

export function buildHouseDecks(input: {
  decks: NonNullable<HouseModel3D['decks']>;
}): HouseDeck3D[] {
  return input.decks
    .map((deck) => {
      if (!deck.boundary.length) return null;
      const topZ = Math.round(deck.topSurfaceElevationMm);
      const boundary = deck.boundary.map((point3) => point(point3.x, point3.y, topZ));
      const plane = planeFromBoundary(boundary);
      if (!plane) return null;
      return {
        ...deck,
        boundary,
        plane,
      };
    })
    .filter((deck): deck is HouseDeck3D => deck !== null);
}

function resolveOutwardUnit2D(input: {
  start: Point3;
  end: Point3;
  footprint: Polygon3;
}): { x: number; y: number } | null {
  const dx = input.end.x - input.start.x;
  const dy = input.end.y - input.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return null;
  const normalA = { x: -dy / length, y: dx / length };
  const normalB = { x: -normalA.x, y: -normalA.y };
  const midpoint = {
    x: (input.start.x + input.end.x) / 2,
    y: (input.start.y + input.end.y) / 2,
  };
  const probeDistanceMm = 10;
  const probeA = {
    x: midpoint.x + normalA.x * probeDistanceMm,
    y: midpoint.y + normalA.y * probeDistanceMm,
  };
  const probeB = {
    x: midpoint.x + normalB.x * probeDistanceMm,
    y: midpoint.y + normalB.y * probeDistanceMm,
  };
  const probeAInside = pointInPolygon2D(probeA, input.footprint);
  const probeBInside = pointInPolygon2D(probeB, input.footprint);
  if (probeAInside && !probeBInside) return normalB;
  if (!probeAInside && probeBInside) return normalA;

  const centroid = polygonCentroid2D(input.footprint);
  const awayFromCentroid = {
    x: midpoint.x - centroid.x,
    y: midpoint.y - centroid.y,
  };
  return normalA.x * awayFromCentroid.x + normalA.y * awayFromCentroid.y >= 0 ? normalA : normalB;
}

function attachmentSideFromWallLine(input: {
  start: Point3;
  end: Point3;
  footprint: Polygon3;
}): AttachmentSide | null {
  const outward = resolveOutwardUnit2D(input);
  if (!outward) return null;
  const dx = input.end.x - input.start.x;
  const dy = input.end.y - input.start.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? outward.y < 0 ? 'rear' : 'front'
    : outward.x < 0 ? 'left' : 'right';
}

function isAttachmentSide(value: string | null | undefined): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function resolveDeckHostWallSegment(input: {
  deck: HouseDeckConfig;
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
}): HouseWallSegment3D | null {
  const requestedEdgeId = input.deck.hostEdgeId?.trim() || input.deck.supportContext?.nearestHouseEdgeId?.trim() || null;
  if (!requestedEdgeId) return null;

  const exactMatch = input.wallSegments.find(
    (segment) =>
      segment.id === requestedEdgeId ||
      segment.sourceEdgeId === requestedEdgeId ||
      segment.metadata?.sourceEdgeId === requestedEdgeId,
  );
  if (exactMatch) return exactMatch;

  if (!isAttachmentSide(requestedEdgeId)) return null;

  return input.wallSegments
    .filter((segment) =>
      attachmentSideFromWallLine({
        start: segment.line.start,
        end: segment.line.end,
        footprint: input.footprint,
      }) === requestedEdgeId,
    )
    .sort((left, right) => lineLength(right.line) - lineLength(left.line))[0] ?? null;
}

function resolvePresetDeckBoundary(input: {
  deck: HouseDeckConfig;
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
}): Polygon3 | null {
  const presetRect = input.deck.presetRect;
  if (!presetRect) return null;
  const widthMm = Number(presetRect.widthMm);
  const depthMm = Number(presetRect.depthMm);
  if (!Number.isFinite(widthMm) || !Number.isFinite(depthMm) || widthMm <= 0 || depthMm <= 0) return null;

  const hostWall = resolveDeckHostWallSegment(input);
  if (!hostWall) return null;
  const hostLengthMm = lineLength(hostWall.line);
  if (hostLengthMm <= 1e-6) return null;

  const alongUnit = {
    x: (hostWall.line.end.x - hostWall.line.start.x) / hostLengthMm,
    y: (hostWall.line.end.y - hostWall.line.start.y) / hostLengthMm,
  };
  const outwardUnit = resolveOutwardUnit2D({
    start: hostWall.line.start,
    end: hostWall.line.end,
    footprint: input.footprint,
  });
  if (!outwardUnit) return null;

  const centerOffsetMm = Number.isFinite(presetRect.centerOffsetMm) ? presetRect.centerOffsetMm : 0;
  const detachedGapMm =
    input.deck.isAttached || input.deck.presetType === 'rect_attached'
      ? 0
      : Math.max(0, Number.isFinite(presetRect.detachedGapMm) ? presetRect.detachedGapMm : 0);
  const hostMidpoint = {
    x: (hostWall.line.start.x + hostWall.line.end.x) / 2,
    y: (hostWall.line.start.y + hostWall.line.end.y) / 2,
  };
  const innerCenter = {
    x: hostMidpoint.x + alongUnit.x * centerOffsetMm + outwardUnit.x * detachedGapMm,
    y: hostMidpoint.y + alongUnit.y * centerOffsetMm + outwardUnit.y * detachedGapMm,
  };
  const halfWidthMm = widthMm / 2;
  const start = point(innerCenter.x - alongUnit.x * halfWidthMm, innerCenter.y - alongUnit.y * halfWidthMm, 0);
  const end = point(innerCenter.x + alongUnit.x * halfWidthMm, innerCenter.y + alongUnit.y * halfWidthMm, 0);
  return [
    start,
    end,
    point(end.x + outwardUnit.x * depthMm, end.y + outwardUnit.y * depthMm, 0),
    point(start.x + outwardUnit.x * depthMm, start.y + outwardUnit.y * depthMm, 0),
  ];
}

export function resolveHouseDeckBoundary(input: {
  deck: HouseDeckConfig;
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
}): Polygon3 | null {
  const outline = input.deck.outline?.length ? input.deck.outline : null;
  if (input.deck.shape === 'custom' && outline && outline.length >= 3) return outline;
  const presetBoundary = resolvePresetDeckBoundary(input);
  if (presetBoundary?.length) return presetBoundary;
  return outline && outline.length >= 3 ? outline : null;
}
