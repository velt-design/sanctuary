import { prepareStudioPlacement } from "@/lib/designStudio/interaction/preparation";
import type {
  StudioPreparationRequest,
  StudioPreparationReply,
} from "./studioPlacementPreparation";

self.onmessage = ({ data }: MessageEvent<StudioPreparationRequest>) => {
  const { task, ...identity } = data;
  const reply: StudioPreparationReply = {
    ...identity,
    objectId: task.objectId,
    method: task.method,
    dependencyKey: task.dependencyKey,
    result: prepareStudioPlacement(task),
  };
  postMessage(reply);
};
