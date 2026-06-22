import type {
  GeometryConfig,
  HouseAttachmentStrategy,
  HouseAttachmentTarget3D,
  HouseRoofForm,
  HouseWallSegment3D,
  Line3,
  Point3,
  Polygon3,
} from '../contracts';
import { lineLength, planeFromOriginAxes } from '../math3d';
import { buildHouseSideAttachmentLine } from '../footprints';
import { DEFAULT_EAVE_HEIGHT_MM } from './constants';
import { clamp, distanceSquared2, line, midpoint2, point } from './_internal';

function findAttachmentWallSegment(
  wallSegments: HouseWallSegment3D[],
  attachmentEdge: Line3 | null,
): HouseWallSegment3D | null {
  if (!wallSegments.length) return null;
  if (!attachmentEdge) return wallSegments[0] ?? null;

  const attachmentMidpoint = midpoint2(attachmentEdge);
  return wallSegments.reduce<HouseWallSegment3D | null>((selected, candidate) => {
    if (!selected) return candidate;

    const candidateDistance = distanceSquared2(midpoint2(candidate.line), attachmentMidpoint);
    const selectedDistance = distanceSquared2(midpoint2(selected.line), attachmentMidpoint);
    if (candidateDistance < selectedDistance) return candidate;
    if (Math.abs(candidateDistance - selectedDistance) <= 1e-6 && lineLength(candidate.line) > lineLength(selected.line)) {
      return candidate;
    }
    return selected;
  }, null);
}

function clampLineZ(input: { source: Line3; bottomZ: number; topZ: number }): Line3 {
  return {
    start: {
      ...input.source.start,
      z: clamp(input.source.start.z, input.bottomZ, input.topZ),
    },
    end: {
      ...input.source.end,
      z: clamp(input.source.end.z, input.bottomZ, input.topZ),
    },
  };
}

type AttachmentWallProjection = {
  line: Line3 | null;
  wallOrientedLine: Line3 | null;
  metadata?: {
    attachmentSpanStatus: 'no_overlap';
  };
};

function interpolateAttachmentZ(attachmentEdge: Line3, rawStartT: number, rawEndT: number, targetT: number): number {
  const range = rawEndT - rawStartT;
  if (Math.abs(range) <= 1e-6) {
    return (attachmentEdge.start.z + attachmentEdge.end.z) / 2;
  }
  const ratio = (targetT - rawStartT) / range;
  return attachmentEdge.start.z + (attachmentEdge.end.z - attachmentEdge.start.z) * ratio;
}

function projectAttachmentEdgeToWallSegment(
  attachmentEdge: Line3 | null,
  sourceWall: HouseWallSegment3D | null,
): AttachmentWallProjection {
  if (!attachmentEdge || !sourceWall) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const wallLengthMm = lineLength(sourceWall.line);
  if (wallLengthMm <= 1e-6) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const wallUnit = {
    x: (sourceWall.line.end.x - sourceWall.line.start.x) / wallLengthMm,
    y: (sourceWall.line.end.y - sourceWall.line.start.y) / wallLengthMm,
  };
  const projectToWallT = (candidate: Point3): number =>
    (candidate.x - sourceWall.line.start.x) * wallUnit.x +
    (candidate.y - sourceWall.line.start.y) * wallUnit.y;
  const pointAtT = (t: number): Point3 => ({
    x: sourceWall.line.start.x + wallUnit.x * t,
    y: sourceWall.line.start.y + wallUnit.y * t,
    z: interpolateAttachmentZ(attachmentEdge, rawStartT, rawEndT, t),
  });

  const rawStartT = projectToWallT(attachmentEdge.start);
  const rawEndT = projectToWallT(attachmentEdge.end);
  const rawMinT = Math.min(rawStartT, rawEndT);
  const rawMaxT = Math.max(rawStartT, rawEndT);
  const overlapMinT = Math.max(0, rawMinT);
  const overlapMaxT = Math.min(wallLengthMm, rawMaxT);
  if (overlapMaxT - overlapMinT <= 1e-6) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const orderedStartT = rawStartT <= rawEndT ? overlapMinT : overlapMaxT;
  const orderedEndT = rawStartT <= rawEndT ? overlapMaxT : overlapMinT;
  return {
    line: line(pointAtT(orderedStartT), pointAtT(orderedEndT)),
    wallOrientedLine: line(pointAtT(overlapMinT), pointAtT(overlapMaxT)),
  };
}

function buildZoneBoundary(sourceLine: Line3 | null, bottomZ: number, topZ: number): Polygon3 | null {
  if (!sourceLine) return null;
  return [
    point(sourceLine.start.x, sourceLine.start.y, bottomZ),
    point(sourceLine.end.x, sourceLine.end.y, bottomZ),
    point(sourceLine.end.x, sourceLine.end.y, topZ),
    point(sourceLine.start.x, sourceLine.start.y, topZ),
  ];
}

function resolveStrategy(config: GeometryConfig): HouseAttachmentStrategy {
  return config.houseContext.attachmentStrategy ?? config.houseContext.model?.attachmentStrategy ?? 'none';
}

function averageAttachmentZ(attachmentEdge: Line3 | null, config: GeometryConfig): number {
  if (attachmentEdge) {
    return (attachmentEdge.start.z + attachmentEdge.end.z) / 2;
  }
  return (
    config.structural.heights.referenceUndersideMm ??
    config.structural.heights.houseUndersideMm ??
    DEFAULT_EAVE_HEIGHT_MM
  );
}

export function buildSemanticHouseAttachmentEdge(config: GeometryConfig, attachmentEdge: Line3 | null): Line3 | null {
  if (!attachmentEdge || config.connection.type === 'freestanding') return null;

  const z = averageAttachmentZ(attachmentEdge, config);
  return buildHouseSideAttachmentLine({
    attachmentSide: config.connection.attachmentSide,
    pergolaWidthMm: config.dimensions.lengthMm,
    pergolaDepthMm: config.dimensions.projectionMm,
    zMm: z,
  });
}

export function buildAttachmentTarget(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
  wallSegments: HouseWallSegment3D[];
  eaveHeightMm: number;
  fasciaHeightMm: number;
}): HouseAttachmentTarget3D {
  const strategy = resolveStrategy(input.config);
  const sourceWall = findAttachmentWallSegment(input.wallSegments, input.attachmentEdge);
  const sourceEdgeId = sourceWall?.sourceEdgeId ?? sourceWall?.id ?? null;
  const targetProjection = projectAttachmentEdgeToWallSegment(input.attachmentEdge, sourceWall);
  const targetLine = targetProjection.line;
  const targetWallOrientedLine = targetProjection.wallOrientedLine;
  const targetMetadata = targetProjection.metadata;

  if (strategy === 'none') {
    return {
      kind: 'none',
      strategy,
      sourceEdgeId,
    };
  }

  if (strategy === 'soffit_brackets') {
    return {
      kind: 'line',
      strategy,
      line: targetLine,
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  if (strategy === 'fascia_under_gutter') {
    const topZMm = input.eaveHeightMm;
    const bottomZMm = input.eaveHeightMm - input.fasciaHeightMm;
    const safeLine = targetLine ? clampLineZ({ source: targetLine, bottomZ: bottomZMm, topZ: topZMm }) : null;
    return {
      kind: 'zone',
      strategy,
      line: safeLine,
      zone: {
        plane: sourceWall?.plane ?? planeFromOriginAxes(input.config.datum.origin, input.config.datum.xAxis, input.config.datum.zAxis),
        topZMm,
        bottomZMm,
        boundary: buildZoneBoundary(targetWallOrientedLine, bottomZMm, topZMm),
        safeLine,
      },
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  if (strategy === 'facade_ledger') {
    return {
      kind: 'plane',
      strategy,
      line: targetLine,
      plane: sourceWall?.plane ?? null,
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  return {
    kind: 'metadata_only',
    strategy,
    sourceEdgeId,
    metadata: {
      tieback: true,
    },
  };
}

export function sourceEdgeIndexFromId(sourceEdgeId: string | null | undefined, footprintLength: number): number | null {
  if (!sourceEdgeId) return null;
  const match = /^footprint-edge-(\d+)$/.exec(sourceEdgeId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 && index < footprintLength ? index : null;
}

export function buildAttachmentAwareMonoEavePolygon(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  attachmentSourceEdgeId?: string | null;
}): Polygon3 {
  if (input.roofForm !== 'mono') return input.eavePolygon;
  if (input.eavePolygon.length !== input.footprint.length) return input.eavePolygon;

  const sourceEdgeIndex = sourceEdgeIndexFromId(
    input.attachmentSourceEdgeId,
    input.footprint.length,
  );
  if (sourceEdgeIndex === null) return input.eavePolygon;

  const nextIndex = (sourceEdgeIndex + 1) % input.footprint.length;
  return input.eavePolygon.map((candidate, index) => {
    if (index === sourceEdgeIndex || index === nextIndex) {
      const footprintPoint = input.footprint[index]!;
      return point(footprintPoint.x, footprintPoint.y, candidate.z);
    }
    return candidate;
  });
}
