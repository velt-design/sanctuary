import { attachmentUnavailable } from "@sp/configurator/geometry";
import {
  resolveStudioWebsiteDesign,
  type StudioWebsiteDesign,
} from "../websiteDesign";
import { studioAttachmentCanonicalEdge } from "../studioHouseCommands";
import {
  studioHouseTargets,
  type StudioHouseTarget,
} from "../studioHouseGeometry";
import { websiteSoffitTarget } from "../studioHouseWebsiteContact";
import type { StudioHouse } from "../studioHouseScene";
import {
  prepareStudioAttachmentArtifacts,
  evaluateStudioAttachment,
  prepareStudioContactVariant,
  type StudioAttachmentArtifacts,
  type StudioContactVariant,
} from "../studioAttachmentResolver";
import { type WebsitePhysicalProduct } from "../websiteProductPhysical";
import { physicalFootprint, segmentAxis } from "./finitePlacement";
import { houseStudioPose, type ResolvedStudioScene } from "./resolvedScene";
import {prospectiveStudioFacadeClearance,type StudioRetainedFacade} from '../studioFacadeClearance';
import type {
  PlacementPose,
  PlacementPoint,
  StudioPlacementCandidate,
  StudioPlacementMethod,
} from "./placementData";

export const studioPreparedMethodVersion =
  "studio.placement-method.v3" as const;
export const studioPlacementMethods = ["facade", "fascia", "soffit"] as const;
type HouseInput = {
  id: string;
  shapeKey: string;
  house: StudioHouse | null;
  error: string | null;
};
export type StudioPreparationTask = {
  objectId: string;
  method: StudioPlacementMethod;
  dependencyKey: string;
  value: StudioWebsiteDesign;
  houses: HouseInput[];
  requestedDatums?: number[];
  retainedFacade?: StudioRetainedFacade;
};
type PreparedTarget = { target: StudioHouseTarget; hostPose: PlacementPose };
type PreparedCandidate = {
  key: string;
  target: StudioHouseTarget;
  contactTarget: StudioHouseTarget;
  hostPose: PlacementPose;
  choice: StudioPlacementCandidate["choice"];
  canonicalHost: StudioPlacementCandidate["canonicalHost"];
  tangent: PlacementPoint;
  travel: number;
  pose: PlacementPose;
  height: number;
  connectionAngle: number;
  artifacts: StudioAttachmentArtifacts;
  canonicalAtZero: ReturnType<typeof evaluateStudioAttachment>;
  hull: PlacementPoint[];
  physical: WebsitePhysicalProduct;
};
export type StudioPreparedMethod = {
  version: typeof studioPreparedMethodVersion;
  objectId: string;
  method: StudioPlacementMethod;
  dependencyKey: string;
  targets: PreparedTarget[];
  candidates: PreparedCandidate[];
  unavailable: string | null;
  refusals: { houseId: string; reason: string }[];
  variants: (StudioContactVariant & { hull: PlacementPoint[] })[];
};
export type StudioPreparationResult =
  | { kind: "ready"; value: StudioPreparedMethod }
  | { kind: "refused"; reason: string };

/** Selected INPUTS only. A rigid world pose, selection, transport revision and
 * joins cannot invalidate local candidate geometry. Join witnesses use the
 * current resolved scene when the descriptor is projected. */
export function studioPreparationTasks(
  scene: ResolvedStudioScene,
): StudioPreparationTask[] {
  const houses = scene.houseRecords.map(
    ({ id, shapeKey, localHouse, error }) => ({
      id,
      shapeKey,
      house: localHouse,
      error,
    }),
  );
  return scene.rows.flatMap((row) => {
    if (row.error || !row.value || !row.design || !row.position) return [];
    const retainedFacade=row.studioAttachment?.method==='facade'&&row.value.facadeClearanceMm===undefined?{houseId:row.studioAttachment.houseId,edge:row.studioAttachment.edge}:undefined;
    const shape = JSON.stringify([
      row.object.id,
      row.value,
      row.design,
      row.geometryOptions,
      retainedFacade,
      houses.map(({ id, shapeKey, error }) => [id, shapeKey, error]),
    ]);
    return studioPlacementMethods.map((method) => ({
      objectId: row.object.id,
      method,
      dependencyKey: JSON.stringify([
        studioPreparedMethodVersion,
        shape,
        method,
      ]),
      value: row.value!,
      ...(retainedFacade?{retainedFacade}:{}),
      houses,
    }));
  });
}

/** Worker owner for ONE object/method. The canonical relationship resolver is
 * the same owner used by previewStudioAttachment; no candidate edit is stored
 * or sent across the worker boundary. A failed house/edge remains local. */
export function prepareStudioPlacement(
  task: StudioPreparationTask,
): StudioPreparationResult {
  try {
    const original = resolveStudioWebsiteDesign(task.value, task.objectId);
    if (!original.ok) throw Error(original.message);
    let unavailable = attachmentUnavailable(
      original.value.input,
      original.value.roof,
      task.method,
    );
    const value = structuredClone(task.value);
    if (
      value.priorManualSupportDatumMm === undefined &&
      value.supportDatumMm !== undefined
    )
      value.priorManualSupportDatumMm = value.supportDatumMm;
    value.selection.input.connection = task.method;
    delete value.selection.roof.attachmentIntent;
    const resolved = resolveStudioWebsiteDesign(value, task.objectId);
    if (!resolved.ok) unavailable = resolved.message;
    const result: StudioPreparedMethod = {
      version: studioPreparedMethodVersion,
      objectId: task.objectId,
      method: task.method,
      dependencyKey: task.dependencyKey,
      targets: [],
      candidates: [],
      unavailable,
      refusals: [],
      variants: [],
    };
    const houses = task.houses;
    const scene = {
      schemaVersion: "studio_house_scene.v1" as const,
      houses: houses.flatMap(({ house }) => (house ? [house] : [])),
      attachments: [],
    };
    const variants = new Map<number, StudioContactVariant>();
    const variant = (datum: number) => {
      let found = variants.get(datum);
      if (!found) {
        if (!resolved.ok) throw Error(resolved.message);
        found = prepareStudioContactVariant(resolved.value, datum);
        // Exact artifacts only. Keep a finite recent set; a dropped variant is
        // requested again rather than approximated or interpolated.
        if (variants.size >= 64) variants.delete(variants.keys().next().value!);
        variants.set(datum, found);
      }
      return found;
    };
    for (const host of houses) {
      if (!host.house || host.error) {
        result.refusals.push({
          houseId: host.id,
          reason: host.error ?? "House geometry unavailable.",
        });
        continue;
      }
      const house = host.house,
        hostPose = houseStudioPose(house);
      let targets: StudioHouseTarget[];
      try {
        targets = studioHouseTargets(house, task.method)
          .filter(
            (target) =>
              target.kind === (task.method === "facade" ? "wall" : "eave"),
          )
          .map((target) => {
            if (task.method !== "soffit") return target;
            try {
              return websiteSoffitTarget(house, target.side);
            } catch (error) {
              return { ...target, error: reason(error) };
            }
          });
      } catch (error) {
        result.refusals.push({ houseId: host.id, reason: reason(error) });
        continue;
      }
      for (const rawTarget of targets) {
        const target = { ...rawTarget, error: unavailable ?? rawTarget.error };
        result.targets.push({ target, hostPose });
        if (target.error) continue;
        try {
          if (!resolved.ok) throw Error(resolved.message);
          const choice: StudioPlacementCandidate["choice"] = {
            objectId: task.objectId,
            houseId: house.id,
            edge: target.side,
            kind: target.kind,
            method: task.method,
            contactBasis: "canonical-house.v1",
          };
          const facadeClearanceMm=prospectiveStudioFacadeClearance(value,task.method,choice,task.retainedFacade);
          if(facadeClearanceMm!==undefined)choice.facadeClearanceMm=facadeClearanceMm;
          const binding = {
            ...choice,
            reference: {
              position: { x: 0, y: 0, rotation: 0 },
              supportDatumMm: 2400,
            },
          };
          const artifacts = prepareStudioAttachmentArtifacts(
            scene,
            binding,
            facadeClearanceMm===undefined?value:{...value,facadeClearanceMm},
          );
          // The unfitted contact variant is essential: finite overlap at another
          // along position can remove the obstruction that governed along zero.
          const layout = evaluateStudioAttachment(
            binding,
            artifacts,
            variant,
            true,
          );
          if (layout.error || !layout.position || !layout.geometryOptions)
            throw Error(layout.error ?? "Connection geometry unavailable.");
          variant(layout.geometryOptions.supportDatumMm);
          const canonical = evaluateStudioAttachment(
            binding,
            artifacts,
            variant,
          );
          const physicalVariant = variant(
            canonical.geometryOptions?.supportDatumMm ??
              layout.geometryOptions.supportDatumMm,
          );
          const edge = studioAttachmentCanonicalEdge(
            {
              houseAssembly: {
                id: "derived",
                label: "House",
                houseForms: [house.source],
              },
              pergolas: [],
              decks: [],
              openings: [],
            },
            house,
            choice,
          );
          const canonicalHost: StudioPlacementCandidate["canonicalHost"] = {
            objectFamily: "house_forms",
            objectId: house.id,
            edgeKind: choice.kind === "wall" ? "wall" : "roof_eave",
            edgeId: edge.id,
            myEdgeIndex: 0,
          };
          const connectionEdge = physicalVariant.edge,
            physical = physicalVariant.physical;
          const targetAxis = segmentAxis(target).u;
          const sign =
            Math.cos((layout.position.rotation * Math.PI) / 180) *
              (connectionEdge.end.x - connectionEdge.start.x) *
              targetAxis.x +
              Math.sin((layout.position.rotation * Math.PI) / 180) *
                (connectionEdge.end.x - connectionEdge.start.x) *
                targetAxis.y <
            0
              ? -1
              : 1;
          result.candidates.push({
            key: `connect:${house.id}:${target.side}:${task.method}`,
            target,
            contactTarget: layout.target!,
            hostPose,
            choice,
            canonicalHost,
            tangent: { x: targetAxis.x * sign, y: targetAxis.y * sign },
            travel: Math.max(
              0,
              segmentAxis(target).length -
                Math.hypot(
                  connectionEdge.end.x - connectionEdge.start.x,
                  connectionEdge.end.y - connectionEdge.start.y,
                ),
            ),
            pose: layout.position,
            height: physicalVariant.datum,
            connectionAngle: Math.atan2(
              connectionEdge.end.y - connectionEdge.start.y,
              connectionEdge.end.x - connectionEdge.start.x,
            ),
            artifacts,
            canonicalAtZero: canonical,
            hull: physicalFootprint(physical.points),
            physical,
          });
        } catch (error) {
          target.error = reason(error);
        }
      }
    }
    for (const datum of task.requestedDatums ?? []) variant(datum);
    result.variants = [...variants.values()].map((v) => ({
      ...v,
      hull: physicalFootprint(v.physical.points),
    }));
    return { kind: "ready", value: result };
  } catch (error) {
    return { kind: "refused", reason: reason(error) };
  }
}

const reason = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Connection preparation unavailable.";
