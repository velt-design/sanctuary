import {
  studioPreparedMethodVersion,
  type StudioPreparedMethod,
  type StudioPreparationTask,
} from "./preparation";
import {
  houseStudioPose,
  rigidStudioPoint,
  type ResolvedStudioScene,
} from "./resolvedScene";
import type { PlacementPose, StudioPlacementCandidate } from "./placementData";
import type { StudioHouseTarget } from "../studioHouseGeometry";
import {
  evaluateStudioAttachment,
  StudioContactVariantMissing,
} from "../studioAttachmentResolver";
import { contactWebsiteEdges } from "../websiteJoinGeometry";
import { transformWebsitePoint } from "../websiteComposition";
import {prospectiveStudioFacadeClearance,readStudioFacadeClearance} from '../studioFacadeClearance';

function validFacadeChoice(candidate:StudioPreparedMethod['candidates'][number],task:StudioPreparationTask) {
 try {
  const expected=prospectiveStudioFacadeClearance(task.value,task.method,candidate.choice,task.retainedFacade);
  if(candidate.choice.facadeClearanceMm!==expected||candidate.choice.method!==task.method||candidate.choice.objectId!==task.objectId)return false;
  const requested=readStudioFacadeClearance(expected);
  if(candidate.artifacts.facadeClearanceMm!==requested)return false;
  if(requested!==undefined&&candidate.canonicalAtZero.error===null){
   const measurements=candidate.canonicalAtZero.measurements;
   if(measurements?.requestedRoofClearanceMm!==requested||!Number.isFinite(measurements.roofClearanceMm)||measurements.roofClearanceMm! < requested-1e-4)return false;
  }
  return true;
 }catch{return false;}
}

/** A descriptor must contain the complete canonical worker outcome. A malformed
 * or stale DTO cannot become an optimistic ready relationship. */
function validCanonicalBase(
  value: ReturnType<typeof evaluateStudioAttachment> | undefined,
) {
  if (
    !value ||
    ![
      "error",
      "measurements",
      "position",
      "geometryOptions",
      "attachmentHeightMm",
      "target",
      "reference",
    ].every((key) => Object.hasOwn(value, key))
  )
    return false;
  const pose = (p: typeof value.position) =>
    !!p && [p.x, p.y, p.rotation].every(Number.isFinite);
  if (
    !value.reference ||
    !pose(value.reference.position) ||
    !Number.isFinite(value.reference.supportDatumMm) ||
    (value.measurements !== null && typeof value.measurements !== "object")
  )
    return false;
  if (typeof value.error === "string")
    return (
      value.error.length > 0 &&
      value.position === null &&
      value.geometryOptions === undefined &&
      value.attachmentHeightMm === null &&
      value.target === null
    );
  const target = value.target,
    measurements = value.measurements;
  return (
    value.error === null &&
    pose(value.position) &&
    !!value.geometryOptions &&
    Number.isFinite(value.geometryOptions.supportDatumMm) &&
    Number.isFinite(value.attachmentHeightMm) &&
    !!measurements &&
    measurements.alongEdgeMm === 0 &&
    !!measurements.target?.start &&
    !!measurements.target?.end &&
    [
      measurements.availableSpanMm,
      measurements.targetAttachmentHeightMm,
      measurements.requiredSpanMm,
      measurements.authoredWidthMm,
      measurements.supportDatumMm,
      measurements.target.start.x,
      measurements.target.start.y,
      measurements.target.end.x,
      measurements.target.end.y,
    ].every(Number.isFinite) &&
    measurements.supportDatumMm === value.geometryOptions.supportDatumMm &&
    !!target &&
    !!target.start &&
    !!target.end &&
    !!target.centre &&
    [
      target.heightMm,
      target.start.x,
      target.start.y,
      target.start.z,
      target.end.x,
      target.end.y,
      target.end.z,
      target.centre.x,
      target.centre.y,
      target.centre.z,
    ].every(Number.isFinite)
  );
}

function rebaseTarget(
  target: StudioHouseTarget,
  from: PlacementPose,
  to: PlacementPose,
): StudioHouseTarget {
  const point = (p: StudioHouseTarget["start"]) => ({
    ...p,
    ...rigidStudioPoint(p, from, to),
  });
  return {
    ...target,
    start: point(target.start),
    end: point(target.end),
    centre: point(target.centre),
  };
}

/** Cheap world projection. It never resolves geometry, writes an authored edit
 * or borrows stale relationship eligibility from a changed shape. */
export function projectStudioPreparedMethod(
  prepared: StudioPreparedMethod,
  task: StudioPreparationTask,
  scene: ResolvedStudioScene,
) {
  if (
    prepared.version !== studioPreparedMethodVersion ||
    prepared.candidates.some(
      (candidate) => !validCanonicalBase(candidate.canonicalAtZero)||!validFacadeChoice(candidate,task),
    ) ||
    prepared.dependencyKey !== task.dependencyKey ||
    prepared.objectId !== task.objectId ||
    prepared.method !== task.method
  )
    throw Error(
      "The connection preparation belongs to another shape or method.",
    );
  const hostPose = (id: string) => {
    const host = scene.houseRecords.find((record) => record.id === id);
    if (!host?.house || host.error)
      throw Error(host?.error ?? "The prepared house is unavailable.");
    return houseStudioPose(host.house);
  };
  const targets = prepared.targets.map(({ target, hostPose: from }) =>
    rebaseTarget(target, from, hostPose(target.houseId)),
  );
  const candidates = prepared.candidates.map(
    (candidate): StudioPlacementCandidate => {
      const to = hostPose(candidate.choice.houseId),
        from = candidate.hostPose;
      const contact = rebaseTarget(candidate.contactTarget, from, to);
      let { start, end } = contact;
      const dx = end.x - start.x,
        dy = end.y - start.y;
      if (
        -dy * (contact.centre.x - (start.x + end.x) / 2) +
          dx * (contact.centre.y - (start.y + end.y) / 2) >
        0
      )
        [start, end] = [end, start];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const tangent = {
        x: (end.x - start.x) / length,
        y: (end.y - start.y) / length,
      };
      const pose = {
        ...rigidStudioPoint(candidate.pose, from, to),
        // Match the canonical atan2 branch, rather than wrapping a world angle
        // arbitrarily or accumulating rotation on a previously projected pose.
        rotation:
          ((Math.atan2(end.y - start.y, end.x - start.x) -
            candidate.connectionAngle) *
            180) /
          Math.PI,
      };
      const projected: StudioPlacementCandidate = {
        key: candidate.key,
        target: rebaseTarget(candidate.target, from, to),
        choice: candidate.choice,
        canonicalHost: candidate.canonicalHost,
        tangent,
        travel: candidate.travel,
        pose,
        height: candidate.height,
        physical: candidate.physical,
        points: candidate.hull.map((point) =>
          transformWebsitePoint(point, pose),
        ),
        incidentJoins: scene.joins
          .filter(
            ({ join }) =>
              join.a.objectId === task.objectId ||
              join.b.objectId === task.objectId,
          )
          .map(({ label }) => label),
        consequences: [] as string[],
      };
      projected.anchorPoints = projected.points;
      projected.evaluateAlong = (along: number) => {
        const binding = {
          ...candidate.choice,
          alongEdgeMm: along,
          reference: {
            position: { x: 0, y: 0, rotation: 0 },
            supportDatumMm: 2400,
          },
        };
        try {
          const actual =
            along === 0
              ? candidate.canonicalAtZero
              : evaluateStudioAttachment(
                  binding,
                  candidate.artifacts,
                  (datum) => {
                    const v = prepared.variants.find((v) => v.datum === datum);
                    if (!v) throw new StudioContactVariantMissing(datum);
                    return v;
                  },
                );
          if (actual.error || !actual.position || !actual.geometryOptions)
            return {
              ...projected,
              choice: { ...candidate.choice, alongEdgeMm: along },
              points: [],
              unresolved: {
                kind: "refused" as const,
                reason: actual.error ?? "Connection unavailable.",
              },
            };
          const variant = prepared.variants.find(
            (v) => v.datum === actual.geometryOptions!.supportDatumMm,
          );
          if (!variant)
            throw new StudioContactVariantMissing(
              actual.geometryOptions.supportDatumMm,
            );
          const physical = variant.physical;
          const pose = {
            ...rigidStudioPoint(actual.position, from, to),
            rotation: projected.pose.rotation,
          };
          const next = {
            ...projected,
            choice: { ...candidate.choice, alongEdgeMm: along },
            pose,
            height: actual.geometryOptions.supportDatumMm,
            physical,
            points: variant.hull.map((p) => transformWebsitePoint(p, pose)),
            target: projected.target,
          };
          next.consequences = scene.joins.flatMap((state) => {
            if (
              state.join.a.objectId !== task.objectId &&
              state.join.b.objectId !== task.objectId
            )
              return state.error ? [state.label + ": needs repair"] : [];
            try {
              const a = scene.products.find(
                  (r) => r.object.id === state.join.a.objectId,
                ),
                b = scene.products.find(
                  (r) => r.object.id === state.join.b.objectId,
                );
              if (
                !a?.physical ||
                !b?.physical ||
                a.error ||
                b.error ||
                !a.position ||
                !b.position
              )
                throw Error("A joined object is unavailable.");
              contactWebsiteEdges(
                state.join.a.objectId === task.objectId ? physical : a.physical,
                state.join.a.edge,
                state.join.a.objectId === task.objectId ? pose : a.position,
                state.join.b.objectId === task.objectId ? physical : b.physical,
                state.join.b.edge,
                state.join.b.objectId === task.objectId ? pose : b.position,
              );
              return [];
            } catch {
              return [state.label + ": needs repair"];
            }
          });
          return next;
        } catch (error) {
          if (!(error instanceof StudioContactVariantMissing)) throw error;
          return {
            ...projected,
            choice: { ...candidate.choice, alongEdgeMm: along },
            points: [],
            unresolved: {
              kind: "preparing" as const,
              datum: error.datum,
              reason: error.message,
            },
          };
        }
      };
      // Reuse the worker's exact zero outcome. Nonzero travel still evaluates
      // the same finite canonical kernel and exact physical variant lookup.
      return projected.evaluateAlong(0);
    },
  );
  return {
    targets,
    candidates,
    unavailable: prepared.unavailable,
    refusals: prepared.refusals,
  };
}
