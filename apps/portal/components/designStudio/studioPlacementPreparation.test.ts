import { expect, it } from "vitest";
import { newStudioWebsiteDesign } from "@/lib/designStudio/websiteDesign";
import type {
  StudioPreparationResult,
  StudioPreparationTask,
} from "@/lib/designStudio/interaction/preparation";
import {
  createStudioPlacementPreparation,
  type StudioPreparationReply,
  type StudioPreparationRequest,
} from "./studioPlacementPreparation";

const context = {
  scopeKey: "actor:project:estimate:design",
  epoch: "session1",
  pendingKey: null as string | null,
};
const task = (
  objectId: string,
  method: StudioPreparationTask["method"] = "facade",
  shape = "shape1",
): StudioPreparationTask => ({
  objectId,
  method,
  dependencyKey: `${objectId}:${method}:${shape}`,
  value: newStudioWebsiteDesign(objectId),
  houses: [],
});
function reply(request: StudioPreparationRequest): StudioPreparationReply {
  const { task, ...identity } = request;
  return {
    ...identity,
    objectId: task.objectId,
    method: task.method,
    dependencyKey: task.dependencyKey,
    result: {
      kind: "ready",
      value: {
        version: "studio.placement-method.v3",
        objectId: task.objectId,
        method: task.method,
        dependencyKey: task.dependencyKey,
        targets: [],
        candidates: [],
        unavailable: null,
        refusals: [],
        variants: [],
      },
    },
  };
}
function harness() {
  const workers: TestWorker[] = [],
    publications: ReadonlyMap<string, StudioPreparationResult>[] = [];
  class TestWorker {
    onmessage: ((event: MessageEvent<StudioPreparationReply>) => void) | null =
      null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    requests: StudioPreparationRequest[] = [];
    terminated = false;
    postMessage(request: StudioPreparationRequest) {
      this.requests.push(request);
    }
    terminate() {
      this.terminated = true;
    }
    reply(
      request = this.requests.at(-1)!,
      patch: Partial<StudioPreparationReply> = {},
    ) {
      this.onmessage?.({
        data: { ...reply(request), ...patch },
      } as MessageEvent<StudioPreparationReply>);
    }
  }
  const scheduler = createStudioPlacementPreparation(
    () => {
      const worker = new TestWorker();
      workers.push(worker);
      return worker;
    },
    (results) => publications.push(results),
  );
  return { workers, publications, scheduler };
}

it("runs one useful unit at a time, prioritizes the selected method and publishes it before its peers", () => {
  const h = harness(),
    tasks = [task("a"), task("b"), task("a", "fascia"), task("b", "fascia")];
  h.scheduler.update({ context, tasks, selectedId: "b", method: "fascia" });
  const worker = h.workers[0];
  expect(worker.requests).toHaveLength(1);
  expect(worker.requests[0].task).toBe(tasks[3]);
  worker.reply();
  expect(h.publications).toHaveLength(1);
  expect(h.publications[0].has(tasks[3].dependencyKey)).toBe(true);
  expect(worker.requests).toHaveLength(2);
  expect(worker.requests[1].task.objectId).toBe("b");
  worker.reply();
  worker.reply();
  worker.reply();
  expect(h.publications.at(-1)!.size).toBe(4);
  expect(worker.requests).toHaveLength(4);
  h.scheduler.update({ context, tasks, selectedId: "a", method: "facade" });
  expect(worker.requests).toHaveLength(4);
  expect(h.workers).toHaveLength(1);
  h.scheduler.dispose();
  expect(worker.terminated).toBe(true);
});

it("terminates synchronous obsolete work and coalesces to the latest dependency snapshot", () => {
  const h = harness(),
    a = task("a"),
    b = task("a", "facade", "shape2"),
    c = task("a", "facade", "shape3");
  h.scheduler.update({ context, tasks: [a] });
  const old = h.workers[0],
    request = old.requests[0];
  h.scheduler.update({ context, tasks: [b] });
  h.scheduler.update({ context, tasks: [c] });
  expect(old.terminated).toBe(true);
  expect(h.workers[1].terminated).toBe(true);
  expect(h.workers[2].requests.map((request) => request.task)).toEqual([c]);
  old.reply(request);
  expect(h.publications).toHaveLength(0);
  h.workers[2].reply();
  expect([...h.publications.at(-1)!.keys()]).toEqual([c.dependencyKey]);
  // Even a relabelled reply from an old callback cannot acquire the new lease.
  old.reply(request, {
    incarnation: h.workers[2].requests[0].incarnation,
    requestId: h.workers[2].requests[0].requestId,
    dependencyKey: c.dependencyKey,
  });
  expect(h.publications).toHaveLength(1);
  h.scheduler.dispose();
});

it("fences A to B to A pending replacement with its serial even when local geometry is identical", () => {
  const h = harness(),
    tasks = [task("a")];
  h.scheduler.update({ context: { ...context, pendingKey: "A:1" }, tasks });
  const a = h.workers[0],
    first = a.requests[0];
  h.scheduler.update({ context: { ...context, pendingKey: "B:2" }, tasks });
  h.scheduler.update({ context: { ...context, pendingKey: "A:3" }, tasks });
  const current = h.workers[2],
    third = current.requests[0];
  expect(third.pendingKey).toBe("A:3");
  expect(third.incarnation).not.toBe(first.incarnation);
  a.reply();
  expect(h.publications).toHaveLength(0);
  current.reply(third, { pendingKey: first.pendingKey });
  expect(h.publications).toHaveLength(0);
  current.reply();
  expect(h.publications).toHaveLength(1);
  h.scheduler.dispose();
});

it("keeps completed peer results while replacing a shape and isolates worker errors to the active operation", () => {
  const h = harness(),
    a = task("a"),
    b = task("b");
  h.scheduler.update({ context, tasks: [a, b], selectedId: "a" });
  h.workers[0].reply();
  const changed = task("b", "facade", "shape2");
  h.scheduler.update({ context, tasks: [a, changed] });
  const current = h.workers[1];
  current.onerror?.(new ErrorEvent("error"));
  expect(h.publications.at(-1)!.get(a.dependencyKey)?.kind).toBe("ready");
  expect(h.publications.at(-1)!.get(changed.dependencyKey)).toMatchObject({
    kind: "refused",
    reason: "This connection could not be prepared.",
  });
  expect(h.publications.at(-1)!.has(b.dependencyKey)).toBe(false);
  h.scheduler.dispose();
});

it("discards replies and owned results on scope, epoch and disposal boundaries", () => {
  const h = harness(),
    tasks = [task("a"), task("b")];
  h.scheduler.update({ context, tasks });
  h.workers[0].reply();
  const old = h.workers[0];
  h.scheduler.update({ context: { ...context, epoch: "session2" }, tasks });
  const current = h.workers[1];
  old.reply();
  expect(h.publications).toHaveLength(1);
  current.reply(current.requests[0], { scopeKey: "other-project" });
  expect(h.publications).toHaveLength(1);
  current.reply();
  expect([...h.publications.at(-1)!.keys()]).toEqual([tasks[0].dependencyKey]);
  const count = h.publications.length;
  h.scheduler.dispose();
  current.reply();
  expect(h.publications).toHaveLength(count);
});
