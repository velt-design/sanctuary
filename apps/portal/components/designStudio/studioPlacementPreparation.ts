import type { StudioAuthoredIdentity } from "@/lib/designStudio/interaction/contracts";
import type {
  StudioPreparationTask,
  StudioPreparationResult,
} from "@/lib/designStudio/interaction/preparation";

export type StudioPreparationContext = Pick<
  StudioAuthoredIdentity,
  "scopeKey" | "epoch"
> & {
  pendingKey: string | null;
};
export type StudioPreparationRequest = StudioPreparationContext & {
  version: "studio.placement-task.v1";
  incarnation: number;
  requestId: number;
  task: StudioPreparationTask;
};
export type StudioPreparationReply = Omit<StudioPreparationRequest, "task"> & {
  objectId: string;
  method: StudioPreparationTask["method"];
  dependencyKey: string;
  result: StudioPreparationResult;
};
type PreparationWorker = {
  onmessage: ((event: MessageEvent<StudioPreparationReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (request: StudioPreparationRequest) => void;
  terminate: () => void;
};
type Desired = {
  context: StudioPreparationContext;
  tasks: readonly StudioPreparationTask[];
  selectedId?: string;
  method?: StudioPreparationTask["method"];
};
const sameContext = (
  a: StudioPreparationContext,
  b: StudioPreparationContext,
) =>
  a.scopeKey === b.scopeKey &&
  a.epoch === b.epoch &&
  a.pendingKey === b.pendingKey;

/** One synchronous unit in flight and one latest desired snapshot. Superseded
 * dependencies terminate the Worker, because a cancel message cannot interrupt
 * its synchronous canonical solve. Results and errors publish per operation. */
export function createStudioPlacementPreparation(
  createWorker: () => PreparationWorker,
  publish: (results: ReadonlyMap<string, StudioPreparationResult>) => void,
) {
  let worker: PreparationWorker | null = null,
    active: StudioPreparationRequest | null = null,
    desired: Desired | null = null,
    disposed = false,
    incarnation = 0,
    requestId = 0;
  const results = new Map<string, StudioPreparationResult>();
  function terminate() {
    worker?.terminate();
    worker = null;
    active = null;
    incarnation++;
  }
  const snapshot = () => publish(new Map(results));
  function next() {
    if (disposed || active || !desired) return;
    const priority = (task: StudioPreparationTask) =>
      (task.objectId === desired!.selectedId ? 0 : 2) +
      (task.method === desired!.method ? 0 : 1);
    const task = [...desired.tasks]
      .sort((a, b) => priority(a) - priority(b))
      .find((entry) => !results.has(entry.dependencyKey));
    if (!task) return;
    try {
      if (!worker) worker = createWorker();
      const currentWorker = worker;
      const request: StudioPreparationRequest = {
        ...desired.context,
        version: "studio.placement-task.v1",
        incarnation,
        requestId: ++requestId,
        task,
      };
      active = request;
      worker.onmessage = ({ data }) => {
        if (
          disposed ||
          worker !== currentWorker ||
          active !== request ||
          !desired ||
          !sameContext(data, request) ||
          !sameContext(desired.context, request) ||
          data.version !== request.version ||
          data.incarnation !== incarnation ||
          data.requestId !== request.requestId ||
          data.objectId !== task.objectId ||
          data.method !== task.method ||
          data.dependencyKey !== task.dependencyKey ||
          !desired.tasks.some(
            (entry) => entry.dependencyKey === task.dependencyKey,
          )
        )
          return;
        // Descriptor contents must agree with the envelope too. A protocol
        // mismatch is not permission to bless another task's physical result.
        const result = data.result;
        if (
          result.kind === "ready" &&
          (result.value.objectId !== task.objectId ||
            result.value.method !== task.method ||
            result.value.dependencyKey !== task.dependencyKey)
        )
          return;
        results.set(task.dependencyKey, result);
        active = null;
        snapshot();
        next();
      };
      worker.onerror = () => {
        if (
          disposed ||
          worker !== currentWorker ||
          active !== request ||
          !desired ||
          !sameContext(desired.context, request)
        )
          return;
        results.set(task.dependencyKey, {
          kind: "refused",
          reason:
            "This connection could not be prepared.",
        });
        terminate();
        snapshot();
        next();
      };
      worker.postMessage(request);
    } catch (error) {
      results.set(task.dependencyKey, {
        kind: "refused",
        reason:
          error instanceof Error
            ? error.message
            : "Connection preparation unavailable.",
      });
      terminate();
      snapshot();
      next();
    }
  }
  return {
    update(value: Desired) {
      if (disposed) return;
      if (
        desired &&
        (value.context.scopeKey !== desired.context.scopeKey ||
          value.context.epoch !== desired.context.epoch)
      ) {
        terminate();
        results.clear();
      }
      desired = value;
      const wanted = new Set(value.tasks.map((task) => task.dependencyKey));
      let removed = false;
      for (const key of results.keys())
        if (!wanted.has(key)) {
          results.delete(key);
          removed = true;
        }
      if (
        active &&
        (!sameContext(active, value.context) ||
          !wanted.has(active.task.dependencyKey))
      )
        terminate();
      // Exact selected-position refills preempt unrelated background methods.
      // A synchronous worker cannot service a priority message while solving.
      if (
        active &&
        value.tasks.some(
          (task) =>
            task.objectId === value.selectedId &&
            task.method === value.method &&
            !results.has(task.dependencyKey),
        ) &&
        (active.task.objectId !== value.selectedId ||
          active.task.method !== value.method)
      )
        terminate();
      if (removed) snapshot();
      next();
    },
    dispose() {
      disposed = true;
      desired = null;
      terminate();
      results.clear();
    },
  };
}
