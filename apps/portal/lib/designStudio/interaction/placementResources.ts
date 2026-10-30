import { projectStudioPreparedMethod } from "./preparedAttachmentProjection";
import { transformWebsitePoint } from "../websiteComposition";
import type { ResolvedStudioScene } from "./resolvedScene";
import {
  type StudioPreparationTask,
  type StudioPreparationResult,
} from "./preparation";
import type { GestureCache, StudioPlacementReadiness } from "./placementData";

/** Materialize current world read data and per-operation readiness from owned
 * scene artifacts. No solve, domain command, authored clone or pointer state. */
export function studioPlacementResources(
  scene: ResolvedStudioScene,
  basis: ResolvedStudioScene,
  tasks: readonly StudioPreparationTask[],
  results: ReadonlyMap<string, StudioPreparationResult> | null,
) {
  const caches = new Map<string, GestureCache>();
  const operations = new Map<string, StudioPlacementReadiness>();
  for (const row of basis.rows) {
    const id = row.object.id,
      free = basis.free.get(id),
      original = scene.products.find((product) => product.object.id === id);
    const freeError =
      row.error ??
      free?.error ??
      (!free?.local.hull.length || !row.position || !original?.position
        ? "Physical geometry unavailable."
        : null);
    operations.set(
      `${id}:freeMove`,
      freeError ? { kind: "refused", reason: freeError } : { kind: "ready" },
    );
    operations.set(
      `${id}:align`,
      freeError ? { kind: "refused", reason: freeError } : { kind: "ready" },
    );
    for (const variant of ["facade", "fascia", "soffit"] as const) {
      const task = tasks.find(
        (entry) => entry.objectId === id && entry.method === variant,
      );
      const result = task && results?.get(task.dependencyKey);
      let projected: ReturnType<typeof projectStudioPreparedMethod> | null =
        null;
      let readiness: StudioPlacementReadiness = freeError
        ? { kind: "refused", reason: freeError }
        : {
            kind: "preparing",
            reason: "Preparing connections. Valid free movement is available.",
          };
      if (task && result) {
        if (result.kind === "refused") readiness = result;
        else
          try {
            projected = projectStudioPreparedMethod(result.value, task, basis);
            const refusal =
              projected.unavailable ??
              projected.refusals[0]?.reason ??
              projected.targets.find((target) => target.error)?.error;
            readiness = projected.candidates.length
              ? { kind: "ready" }
              : {
                  kind: "refused",
                  reason:
                    refusal ??
                    "No compatible house connection is available.",
                };
          } catch (error) {
            readiness = {
              kind: "refused",
              reason:
                error instanceof Error
                  ? error.message
                  : "Connection preparation unavailable.",
            };
          }
      }
      operations.set(`${id}:${variant}`, readiness);
      if (freeError || !free || !row.position || !original?.position) continue;
      caches.set(`${id}:${variant}`, {
        id,
        method: variant,
        row,
        bound: !!row.studioAttachment || !!row.object.attachment?.host,
        original: original.hull.map((point) =>
          transformWebsitePoint(point, original.position!),
        ),
        freeOutline: free.local.hull.map((point) =>
          transformWebsitePoint(point, row.position!),
        ),
        lines: [
          ...basis.wallLines.map((line) => ({
            ...line,
            departureKey: line.departureKey
              ? `${line.departureKey}:${variant}`
              : undefined,
          })),
          ...basis.products
            .filter(
              (product) =>
                product.object.id !== id && product.position && !product.error,
            )
            .flatMap((product) => {
              const points =
                product.geometry?.plan.outline.map((point) =>
                  transformWebsitePoint(point, product.position!),
                ) ?? [];
              return points.map((start, index) => ({
                id: `align:${product.object.id}:${index}`,
                sourceObjectId: product.object.id,
                edgeKind: "pergola_outline",
                label: product.object.label,
                start,
                end: points[(index + 1) % points.length],
              }));
            }),
        ],
        targets: projected?.targets ?? [],
        candidates: projected?.candidates ?? [],
        unavailable: projected?.unavailable ?? null,
      });
    }
  }
  return { caches, operations };
}
