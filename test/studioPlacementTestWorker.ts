import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import {
  prepareStudioPlacement,
  studioPreparationTasks,
} from "@/lib/designStudio/interaction/preparation";
import { studioPlacementResources } from "@/lib/designStudio/interaction/placementResources";
import type {
  StudioPreparationReply,
  StudioPreparationRequest,
} from "../apps/portal/components/designStudio/studioPlacementPreparation";

/** Only transport is substituted. Both focused and connected tests execute the
 * live per-object/method preparation and descriptor projection owners. */
export function studioPreparationReply(
  request: StudioPreparationRequest,
): StudioPreparationReply {
  const { task, ...identity } = request;
  return structuredClone({
    ...identity,
    objectId: task.objectId,
    method: task.method,
    dependencyKey: task.dependencyKey,
    result: prepareStudioPlacement(task),
  });
}
export function preparedStudioResources(edit: StudioAuthoringEdit) {
  const scene = createStudioSceneResolver().resolve(edit),
    tasks = studioPreparationTasks(scene);
  const results = new Map(
    tasks.map((task) => [task.dependencyKey, prepareStudioPlacement(task)]),
  );
  return {
    scene,
    tasks,
    results,
    ...studioPlacementResources(scene, scene, tasks, results),
  };
}
