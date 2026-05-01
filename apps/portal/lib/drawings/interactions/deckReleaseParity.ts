import type { ObjectWorkbenchDeckPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { DeckCommitCoordinateTrace, DeckCommitTransformDiagnostics } from './deckCommitAdapter';

export type DeckReleaseRebuildParityStatus = 'matched' | 'drift' | 'pending';

export type DeckReleaseRebuildParityReport = {
  status: DeckReleaseRebuildParityStatus;
  releasePolygon: PlanPoint[];
  commitSpacePolygon: PlanPoint[];
  rebuiltProjectionPolygon: PlanPoint[] | null;
  patch: ObjectWorkbenchDeckPatch;
  transform: DeckCommitTransformDiagnostics;
  centroidDeltaM: {
    previewToCommit: PlanPoint | null;
    releaseToRebuilt: PlanPoint | null;
  };
};

function polygonCenter(polygon: readonly PlanPoint[]): PlanPoint | null {
  if (!polygon.length) return null;
  return polygon.reduce(
    (center, point) => ({
      x: center.x + point.x / polygon.length,
      y: center.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
}

function centroidDelta(from: readonly PlanPoint[], to: readonly PlanPoint[] | null): PlanPoint | null {
  const fromCenter = polygonCenter(from);
  const toCenter = to ? polygonCenter(to) : null;
  if (!fromCenter || !toCenter) return null;
  return {
    x: toCenter.x - fromCenter.x,
    y: toCenter.y - fromCenter.y,
  };
}

function pointsApproximatelyEqual(left: PlanPoint, right: PlanPoint, toleranceM: number): boolean {
  return Math.hypot(left.x - right.x, left.y - right.y) <= toleranceM;
}

function polygonsApproximatelyEqual(
  left: readonly PlanPoint[],
  right: readonly PlanPoint[] | null,
  toleranceM: number,
): boolean {
  if (!left.length || !right?.length || left.length !== right.length) return false;
  const unmatched = [...right];
  for (const point of left) {
    const matchIndex = unmatched.findIndex((candidate) => pointsApproximatelyEqual(point, candidate, toleranceM));
    if (matchIndex < 0) return false;
    unmatched.splice(matchIndex, 1);
  }
  return unmatched.length === 0;
}

export function buildDeckReleaseRebuildParityReport(input: {
  coordinateTrace: DeckCommitCoordinateTrace;
  rebuiltProjectionPolygon?: PlanPoint[] | null;
  toleranceM?: number;
}): DeckReleaseRebuildParityReport {
  const rebuiltProjectionPolygon = input.rebuiltProjectionPolygon ?? input.coordinateTrace.rebuiltProjectionPolygon;
  const releaseToRebuilt = centroidDelta(input.coordinateTrace.releasePolygon, rebuiltProjectionPolygon ?? null);
  const toleranceM = input.toleranceM ?? 0.1;
  const status = !rebuiltProjectionPolygon
    ? 'pending'
    : polygonsApproximatelyEqual(input.coordinateTrace.releasePolygon, rebuiltProjectionPolygon, toleranceM)
      ? 'matched'
      : 'drift';

  return {
    status,
    releasePolygon: input.coordinateTrace.releasePolygon,
    commitSpacePolygon: input.coordinateTrace.commitSpacePolygon,
    rebuiltProjectionPolygon: rebuiltProjectionPolygon ?? null,
    patch: input.coordinateTrace.patch,
    transform: input.coordinateTrace.transform,
    centroidDeltaM: {
      previewToCommit: input.coordinateTrace.centroidDeltaM.previewToCommit,
      releaseToRebuilt,
    },
  };
}
