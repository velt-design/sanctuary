import {
  websiteEligibilityEnvelope,
  type WebsiteEligibilityEnvelope,
} from "../websiteEligibilityEnvelope";
import { evaluateWebsiteCompositionEligibility } from "../websiteCompositionEligibility";
import { solvePergolaPreview } from "@sp/configurator/geometry";
import type { StudioAuthoringEdit } from "../authoringView";
import {
  canonicalHouseProjection,
  studioHousePose,
  validateWebsiteAttachments,
  type StudioHouse,
  type StudioHouseScene,
} from "../studioHouseScene";
import {
  houseWorld,
  solveStudioHouse,
  type StudioHouseGeometry,
} from "../studioHouseGeometry";
import {
  websiteComposition,
  transformWebsitePoint,
} from "../websiteComposition";
import { studioDisplayProduct } from "../studioDisplayProduct";
import {
  websiteProductPhysical,
  type WebsitePhysicalProduct,
} from "../websiteProductPhysical";
import { applyResolvedStudioDetachment } from "../studioHouseCommands";
import { detachWebsitePergola } from "../websiteAttachment";
import { parseWebsiteJoins } from "../websiteJoinIntent";
import { contactWebsiteEdges } from "../websiteJoinGeometry";

type Row = ReturnType<typeof websiteComposition>[number];
type Pose = NonNullable<Row["position"]>;
type Geometry = ReturnType<typeof solvePergolaPreview>["geometry"] | null;
type LocalProduct = {
  geometry: Geometry;
  physical: WebsitePhysicalProduct | null;
  physicalFailure?: unknown;
  eligibility:
    | { kind: "ready"; points: WebsiteEligibilityEnvelope | null }
    | { kind: "failed"; error: unknown };
  hull: { x: number; y: number }[];
};
export type ResolvedStudioProduct = ReturnType<typeof studioDisplayProduct> &
  LocalProduct;
export type ResolvedStudioHouse = Readonly<{
  id: string;
  label: string;
  source: Readonly<StudioHouse["source"]>;
  house: StudioHouse | null;
  localHouse: StudioHouse | null;
  geometry: StudioHouseGeometry | null;
  error: string | null;
  shapeKey: string;
}>;
export type ResolvedStudioScene = Readonly<{
  key: string;
  arrangementEligibility: string | null;
  wallLines: readonly import("./placementData").PlacementLine[];
  scene: Readonly<{
    schemaVersion: StudioHouseScene["schemaVersion"];
    houses: readonly Readonly<StudioHouse>[];
    attachments: readonly Readonly<StudioHouseScene["attachments"][number]>[];
  }>;
  houseRecords: readonly ResolvedStudioHouse[];
  houses: readonly StudioHouseGeometry[];
  rows: readonly Readonly<Row>[];
  products: readonly Readonly<ResolvedStudioProduct>[];
  free: ReadonlyMap<
    string,
    Readonly<{
      row: Readonly<Row>;
      local: Readonly<LocalProduct>;
      error: string | null;
    }>
  >;
  joins: ReadonlyArray<
    Readonly<
      ReturnType<typeof import("../websiteJoins").websiteJoinStates>[number]
    >
  >;
}>;

export function studioSceneInputKey(edit: StudioAuthoringEdit) {
  // Reading/keying never resolves geometry. Save transport bookkeeping is not shape.
  return JSON.stringify([
    edit.designId,
    edit.spatial,
    edit.site,
    edit.objectOptions,
  ]);
}

export function rigidStudioPoint(
  p: { x: number; y: number },
  from: Pose,
  to: Pose,
) {
  const local = transformWebsitePoint(
    { x: p.x - from.x, y: p.y - from.y },
    { x: 0, y: 0, rotation: -from.rotation },
  );
  const world = transformWebsitePoint(local, to);
  // This is a plan transform. Do not replace a canonical target's real height
  // with transformWebsitePoint's default z when merging its XY projection.
  return { x: world.x, y: world.y };
}
export function houseStudioPose(h: StudioHouse): Pose {
  return {
    x: Number(h.position.xMm),
    y: Number(h.position.yMm),
    rotation: Number(h.position.rotationDeg),
  };
}

/** Private, bounded, disposable session cache. Existing canonical owners resolve
 * each changed local input. World pose updates only transform their artifacts. */
export function createStudioSceneResolver() {
  const houseCache = new Map<
    string,
    {
      house: StudioHouse | null;
      geometry: StudioHouseGeometry | null;
      error: string | null;
    }
  >();
  const rowCache = new Map<string, { row: Row; host: Pose | null }>();
  const productCache = new Map<string, LocalProduct>();
  const freeCache = new Map<
    string,
    { row: Row; local: LocalProduct; error: string | null }
  >();
  let previous: ResolvedStudioScene | null = null;
  function localProduct(row: Row): LocalProduct {
    const display = studioDisplayProduct(row),
      key = JSON.stringify([display.design, display.geometryOptions]);
    let value = productCache.get(key);
    if (!value) {
      const geometry = display.design
        ? solvePergolaPreview(
            display.design.input,
            display.design.roof,
            display.geometryOptions,
          ).geometry
        : null;
      let physical: WebsitePhysicalProduct | null = null,
        physicalFailure: unknown;
      let eligibility: LocalProduct["eligibility"];
      try {
        eligibility = {
          kind: "ready",
          points:
            display.design && geometry
              ? websiteEligibilityEnvelope(display.design, geometry, display.geometryOptions)
              : null,
        };
      } catch (error) {
        eligibility = { kind: "failed", error };
      }
      try {
        if (display.design)
          physical = websiteProductPhysical({ ...display, error: null }, false, geometry ?? null);
      } catch (error) {
        physicalFailure = error;
      }
      // Reuse the physical footprint owner; no alternative shape formula.
      value = {
        geometry,
        physical,
        physicalFailure,
        eligibility,
        hull: physical ? physicalHull(physical.points) : [],
      };
      productCache.set(key, value);
    }
    return value;
  }
  return {
    resolve(edit: StudioAuthoringEdit): ResolvedStudioScene {
      const key = studioSceneInputKey(edit);
      if (previous?.key === key) return previous;
      // Snapshot authored inputs once per changed scene, not during pointer
      // feedback. Public rows must not alias the caller's mutable working copy.
      edit = structuredClone(edit);
      const liveHouseKeys = new Set<string>(),
        liveRowKeys = new Set<string>(),
        liveFreeKeys = new Set<string>();
      const houseRecords = (edit.spatial.houseAssembly?.houseForms ?? []).map(
        (source): ResolvedStudioHouse => {
          const normalized = structuredClone(source);
          // Presentation stays in the current source below, never in a physical
          // shape/task dependency or a replacement geometry policy.
          delete normalized.appearance;
          delete normalized.position;
          normalized.transform = {
            offsetXM: 0,
            offsetYM: 0,
            rotationQuarterTurns: 0,
          };
          const primitive = normalized.composition.primitives[0];
          if (primitive?.kind === "axisAlignedRectangle") {
            primitive.originXMm = 0;
            primitive.originYMm = 0;
          }
          const shapeKey = JSON.stringify(normalized);
          liveHouseKeys.add(shapeKey);
          let local = houseCache.get(shapeKey);
          if (!local) {
            let house: StudioHouse | null = null,
              geometry: StudioHouseGeometry | null = null,
              error: string | null = null;
            try {
              house = canonicalHouseProjection(normalized, edit.spatial);
              geometry = solveStudioHouse(house);
            } catch (failure) {
              error =
                failure instanceof Error
                  ? failure.message
                  : "House geometry unavailable. Your input is kept.";
            }
            local = { house, geometry, error };
            houseCache.set(shapeKey, local);
          }
          let house: StudioHouse | null = null,
            geometry: StudioHouseGeometry | null = null,
            error = local.error;
          try {
            house = local.house
              ? {
                  ...local.house,
                  label: source.label,
                  source,
                  position: studioHousePose(source),
                }
              : null;
            if (house && local.geometry) {
              const world = (points: StudioHouseGeometry["footprint"]) =>
                points.map((point) => houseWorld(house!, point));
              geometry = {
                ...local.geometry,
                house,
                footprint: world(local.geometry.model.footprint),
                walls: local.geometry.model.wallSegments.map((wall) =>
                  world(wall.boundary),
                ),
                roof: local.geometry.model.roofPlanes.map((roof) =>
                  world(roof.boundary),
                ),
                eaves: (local.geometry.model.eave?.fasciaPolygons ?? []).map(
                  world,
                ),
                soffits: (local.geometry.model.eave?.soffitPolygons ?? []).map(
                  world,
                ),
              };
            }
          } catch (failure) {
            error =
              failure instanceof Error
                ? failure.message
                : "House position unavailable. Your input is kept.";
          }
          return Object.freeze({
            id: source.id,
            label: source.label,
            source,
            house,
            localHouse: local.house,
            geometry,
            error,
            shapeKey,
          });
        },
      );
      const houses = houseRecords.flatMap((record) =>
        record.geometry ? [record.geometry] : [],
      );
      const wallLines = houses.flatMap((geometry) =>
        geometry.model.wallSegments.map((wall) => {
          const h = geometry.house,
            start = wall.line.start,
            end = wall.line.end,
            w = Number(h.widthMm),
            d = Number(h.depthMm);
          const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
          const side =
            near(start.y, 0) && near(end.y, 0)
              ? "front"
              : near(start.x, w) && near(end.x, w)
                ? "right"
                : near(start.y, d) && near(end.y, d)
                  ? "rear"
                  : near(start.x, 0) && near(end.x, 0)
                    ? "left"
                    : null;
          return {
            id: `align:house:${h.id}:${wall.id}`,
            sourceObjectId: h.id,
            edgeKind: "house_wall",
            allowVertex: true,
            label: `${h.label} ${side ?? "wall"}`,
            departureKey: side ? `connect:${h.id}:${side}` : undefined,
            start: houseWorld(h, start),
            end: houseWorld(h, end),
          };
        }),
      );
      const scene: StudioHouseScene = {
        schemaVersion: "studio_house_scene.v1",
        houses: houseRecords.flatMap((record) =>
          record.house ? [record.house] : [],
        ),
        attachments: validateWebsiteAttachments(edit.site, edit.spatial),
      };
      const rows = edit.spatial.pergolas.map((object) => {
        const binding = scene.attachments.find(
          (attachment) => attachment.objectId === object.id,
        );
        // The optional Studio companion enriches canonical authority; its
        // absence never means a canonical host-attached object is free.
        const canonicalHost = object.attachment?.host;
        const hostId =
          binding?.houseId ??
          (canonicalHost?.objectFamily === "house_forms"
            ? canonicalHost.objectId
            : null);
        const host = houseRecords.find((record) => record.id === hostId);
        const attached = !!binding || !!canonicalHost;
        const shapeObject = { ...object, position: undefined };
        const rowKey = JSON.stringify([
          shapeObject,
          edit.objectOptions.find((option) => option.objectId === object.id),
          binding ? { ...binding, reference: undefined } : null,
          host
            ? {
                id: host.id,
                shape: host.shapeKey,
                error: host.error,
                ...(host.error
                  ? {
                      position: host.source.position,
                      transform: host.source.transform,
                    }
                  : {}),
              }
            : null,
        ]);
        liveRowKeys.add(rowKey);
        let cached = rowCache.get(rowKey);
        const hostPose =
          host?.house && !host.error ? houseStudioPose(host.house) : null;
        if (!cached) {
          const inputObject =
            !binding && !object.attachment?.host
              ? {
                  ...object,
                  position: {
                    originXMm: "0",
                    originYMm: "0",
                    rotationDeg: "0",
                  },
                }
              : object;
          const row = websiteComposition(
            { ...edit, spatial: { ...edit.spatial, pergolas: [inputObject] } },
            scene,
          )[0];
          cached = { row, host: hostPose };
          rowCache.set(rowKey, cached);
        }
        const row = {
          ...cached.row,
          object,
          studioAttachment: binding ?? null,
          reference: binding?.reference ?? null,
        };
        if (
          attached &&
          cached.host &&
          hostPose &&
          cached.row.attachment?.position &&
          !cached.row.attachment.error
        ) {
          const move = (point: { x: number; y: number }) =>
            rigidStudioPoint(point, cached!.host!, hostPose);
          const pose = cached.row.attachment.position;
          const attachment = cached.row.attachment,
            target = attachment.target;
          let rotation =
            pose.rotation + hostPose.rotation - cached.host.rotation;
          // Retain the canonical resolver's atan2 representation when a rigid
          // transform crosses +/-180, without resolving the shape again.
          if (target) {
            let dx = target.end.x - target.start.x,
              dy = target.end.y - target.start.y;
            if (
              -dy * (target.centre.x - (target.start.x + target.end.x) / 2) +
                dx * (target.centre.y - (target.start.y + target.end.y) / 2) >
              0
            ) {
              dx = -dx;
              dy = -dy;
            }
            const originalAngle = Math.atan2(dy, dx),
              contactAngle = originalAngle - (pose.rotation * Math.PI) / 180;
            const angle =
              originalAngle +
              ((hostPose.rotation - cached.host.rotation) * Math.PI) / 180;
            rotation =
              ((Math.atan2(Math.sin(angle), Math.cos(angle)) - contactAngle) *
                180) /
              Math.PI;
          }
          row.position = {
            ...move(pose),
            rotation,
          };
          row.attachment = {
            ...attachment,
            position: row.position,
            ...(target
              ? {
                  target: {
                    ...target,
                    start: { ...target.start, ...move(target.start) },
                    end: { ...target.end, ...move(target.end) },
                    centre: { ...target.centre, ...move(target.centre) },
                  },
                }
              : {}),
            ...("reference" in attachment && binding
              ? { reference: binding.reference }
              : {}),
            ...("measurements" in attachment && attachment.measurements
              ? {
                  measurements: {
                    ...attachment.measurements,
                    ...(attachment.measurements.target
                      ? {
                          target: {
                            start: move(attachment.measurements.target.start),
                            end: move(attachment.measurements.target.end),
                          },
                        }
                      : {}),
                  },
                }
              : {}),
          } as Row["attachment"];
        } else if (!attached) {
          row.position = websitePosition(object.position);
          row.error =
            row.error ??
            (!row.position
              ? "Enter valid position values. Your input is kept."
              : null);
        } else if (!cached.row.attachment?.position) {
          // An unresolved canonical attachment retains the current raw/reference
          // pose exactly as the canonical resolver does; never transform it as
          // if it were a successful current relationship.
          row.position = websitePosition(object.position);
        }
        return row;
      });
      const products = rows.map((row) => ({
        ...studioDisplayProduct(row),
        ...localProduct(row),
      }));
      const free = new Map<
        string,
        { row: Row; local: LocalProduct; error: string | null }
      >();
      for (const row of rows) {
        const local = localProduct(row);
        if (row.error) {
          free.set(row.object.id, { row, local, error: row.error });
          continue;
        }
        if (!row.studioAttachment && !row.object.attachment?.host) {
          free.set(row.object.id, {
            row,
            local,
            error:
              row.error ??
              (!local.physical ? "Physical geometry unavailable." : null),
          });
          continue;
        }
        const freeKey = JSON.stringify([
          row.object.id,
          row.value,
          row.geometryOptions,
          row.object.attachment,
        ]);
        liveFreeKeys.add(freeKey);
        let entry = freeCache.get(freeKey);
        if (!entry) {
          try {
            if (
              row.error ||
              !row.position ||
              !row.geometryOptions?.supportDatumMm
            )
              throw Error(
                row.error ?? "The current connection is unavailable.",
              );
            const detached = row.studioAttachment
              ? applyResolvedStudioDetachment(edit, row.object.id, {
                  position: row.position,
                  supportDatumMm: row.geometryOptions.supportDatumMm,
                })
              : detachWebsitePergola(edit, row.object.id);
            const detachedScene = {
              ...scene,
              attachments: scene.attachments.filter(
                (a) => a.objectId !== row.object.id,
              ),
            };
            const freeRow = websiteComposition(
              {
                ...detached,
                spatial: {
                  ...detached.spatial,
                  pergolas: detached.spatial.pergolas.filter(
                    (p) => p.id === row.object.id,
                  ),
                },
              },
              detachedScene,
            )[0];
            entry = {
              row: freeRow,
              local: localProduct(freeRow),
              error: freeRow.error,
            };
          } catch (error) {
            entry = {
              row,
              local,
              error:
                error instanceof Error
                  ? error.message
                  : "Free movement unavailable.",
            };
          }
          freeCache.set(freeKey, entry);
        }
        free.set(row.object.id, {
          ...entry,
          row: { ...entry.row, position: row.position },
        });
      }
      const joins = (
        edit.site.websiteJoins
          ? parseWebsiteJoins(edit.site.websiteJoins).joins
          : []
      ).map((join) => {
        const a = products.find((p) => p.object.id === join.a.objectId),
          b = products.find((p) => p.object.id === join.b.objectId);
        const label = `${a?.object.label ?? "Removed pergola"} · ${join.a.edge} to ${b?.object.label ?? "Removed pergola"} · ${join.b.edge}`;
        try {
          if (
            a?.error ||
            b?.error ||
            !a?.position ||
            !b?.position ||
            !a.physical ||
            !b.physical
          )
            throw Error("A joined object is unavailable.");
          return {
            join,
            label,
            error: null,
            witness: contactWebsiteEdges(
              a.physical,
              join.a.edge,
              a.position,
              b.physical,
              join.b.edge,
              b.position,
            ),
          };
        } catch (error) {
          return {
            join,
            label,
            error: error instanceof Error ? error.message : "Join unavailable.",
            witness: null,
          };
        }
      });
      const arrangementEligibility = evaluateWebsiteCompositionEligibility(
        rows,
        edit.site.websiteJoins,
        {
          envelope: (row) => {
            const entry = products.find(
              (p) => p.object.id === row.object.id,
            )!.eligibility;
            if (entry.kind === "failed") throw entry.error;
            return entry.points;
          },
          physical: (row) => {
            // Match websiteProductPhysical's current-row guard. A retained display
            // artifact cannot establish a valid current join or pricing input.
            if (row.error || !row.design)
              throw Error(row.error ?? "Product unavailable.");
            const product = products.find(
              (p) => p.object.id === row.object.id,
            )!;
            if (!product.physical)
              throw (
                product.physicalFailure ??
                Error("Product geometry unavailable.")
              );
            return product.physical;
          },
        },
      );
      // Retain only current/pending reachable shapes. A session holds at most a
      // small set of variants per current object; no cross-session global cache.
      for (const k of houseCache.keys())
        if (!liveHouseKeys.has(k)) houseCache.delete(k);
      for (const k of rowCache.keys())
        if (!liveRowKeys.has(k)) rowCache.delete(k);
      for (const k of freeCache.keys())
        if (!liveFreeKeys.has(k)) freeCache.delete(k);
      if (productCache.size > Math.max(12, rows.length * 8)) {
        const used = new Set(
          [
            ...products,
            ...[...free.values()].map((v) => ({ ...v.row, ...v.local })),
          ].map((p) => p.geometry),
        );
        for (const [k, v] of productCache)
          if (!used.has(v.geometry)) productCache.delete(k);
      }
      // Freeze only owned structural collections/records at authored resolution.
      // Solver artifacts retain their existing provider types and are never
      // recursively frozen on a pointer frame.
      rows.forEach(Object.freeze);
      products.forEach(Object.freeze);
      Object.freeze(scene.houses);
      Object.freeze(scene.attachments);
      Object.freeze(scene);
      return (previous = Object.freeze({
        key,
        arrangementEligibility,
        wallLines: Object.freeze(wallLines),
        scene,
        houseRecords: Object.freeze(houseRecords),
        houses: Object.freeze(houses),
        rows: Object.freeze(rows),
        products: Object.freeze(products),
        free,
        joins: Object.freeze(joins),
      }));
    },
  };
}

import { websitePosition } from "../websiteComposition";
import { physicalFootprint as physicalHull } from "@/lib/designStudio/interaction/finitePlacement";
