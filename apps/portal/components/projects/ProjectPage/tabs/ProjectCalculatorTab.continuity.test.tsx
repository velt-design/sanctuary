import { act, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../test/reactHarness";
import ProjectCalculatorTab from "./ProjectCalculatorTab";
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  createEmptyLocalFirstState,
  ensureLocalFirstStoreReady,
  enqueueLocalFirstMutation,
  writeLocalFirstWorkingCopy,
  registerLocalFirstIdAlias,
  getLocalFirstStoreSnapshot,
  resolveLocalFirstQueueItemRetry,
  resolveLocalFirstQueueItemConflict,
} from "@/lib/localFirst/store";
import {
  buildEstimateEntityKey,
  PORTAL_LOCAL_FIRST_MUTATIONS,
  replaceEstimateDetailCache,
} from "@/lib/localFirst/portalEntities";
import { qk } from "@/lib/queries/keys";
import type { EstimateDetail } from "@/lib/estimates/types";
let search = "tab=estimates&estimateId=local-estimate:sample&campaign=winter";
const replace = vi.fn();
const push = vi.fn();
let mounts = 0;
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/projects/proj_1",
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/components/ui/toast/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/app/staff/calculator/CalculatorGridClient", () => ({
  default: ({ workspace }: any) => {
    const [dirty, setDirty] = useState("");
    useEffect(() => {
      mounts++;
    }, []);
    return (
      <div data-estimate={workspace.editEstimateId}>
        <input
          aria-label="unsaved edit"
          value={dirty}
          onChange={(event) => setDirty(event.target.value)}
        />
      </div>
    );
  },
}));
const local: EstimateDetail = {
  id: "local-estimate:sample",
  projectId: "proj_1",
  createdAt: "2026-09-23T00:00:00Z",
  status: "draft",
  summary: {},
  versionLabel: "V1",
  isActiveDraft: true,
  hasSentQuote: false,
  jobPackEligible: false,
  jobPackGeneratedAt: null,
  jobPackQuoteVersionId: null,
  calculatorSnapshot: null,
  editability: {
    isLocked: false,
    lockReason: null,
    lockedAt: null,
    lockedByQuoteVersionId: null,
    lockedByQuoteRef: null,
    lockedByQuoteVersionNumber: null,
    hasDraftQuotes: false,
    draftQuoteCount: 0,
  },
};
const durable = { ...local, id: "est_saved" };
let client: QueryClient;
let cleanup: (() => void) | undefined;
function ui() {
  return (
    <QueryClientProvider client={client}>
      <ProjectCalculatorTab host="fixture" projectId="proj_1" />
    </QueryClientProvider>
  );
}
async function tick() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function pendingCreate() {
  await writeLocalFirstWorkingCopy({
    entityKey: buildEstimateEntityKey(local.id),
    data: local,
  });
  await enqueueLocalFirstMutation({
    entityKey: buildEstimateEntityKey(local.id),
    mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
    payload: { projectId: local.projectId, localEstimateId: local.id },
  });
}
beforeEach(async () => {
  mounts = 0;
  replace.mockReset();
  search = "tab=estimates&estimateId=local-estimate:sample&campaign=winter";
  __setLocalFirstStorageAdapterForTests({
    get: async () => createEmptyLocalFirstState(),
    set: async () => undefined,
  });
  __resetLocalFirstStoreForTests();
  await ensureLocalFirstStoreReady();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), [local]);
});
afterEach(() => {
  cleanup?.();
  client.clear();
});
for (const order of ["cache-first", "alias-first"])
  it(`keeps the calculator mounted through real ${order} publication on separate ticks`, async () => {
    await pendingCreate();
    const view = renderIntoDocument(ui());
    cleanup = view.unmount;
    const input = view.container.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "New unsaved edit");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    if (order === "cache-first") {
      await act(async () =>
        replaceEstimateDetailCache(
          client,
          "fixture",
          "proj_1",
          local.id,
          durable,
        ),
      );
      await tick();
    } else {
      await act(async () => {
        await registerLocalFirstIdAlias(local.id, durable.id);
      });
    }
    expect(view.container.textContent).not.toContain("Design unavailable");
    expect(view.container.querySelector("input")).toBe(input);
    expect(mounts).toBe(1);
    expect(input.value).toBe("New unsaved edit");
    expect(replace).not.toHaveBeenCalled();
    if (order === "cache-first")
      await act(async () => {
        await registerLocalFirstIdAlias(local.id, durable.id);
      });
    else {
      await act(async () =>
        replaceEstimateDetailCache(
          client,
          "fixture",
          "proj_1",
          local.id,
          durable,
        ),
      );
      await tick();
    }
    expect(
      view.container
        .querySelector("[data-estimate]")
        ?.getAttribute("data-estimate"),
    ).toBe("est_saved");
    expect(view.container.querySelector("input")).toBe(input);
    expect(mounts).toBe(1);
    expect(input.value).toBe("New unsaved edit");
    expect(replace).toHaveBeenLastCalledWith(
      "/staff/projects/proj_1?tab=estimates&estimateId=est_saved&campaign=winter",
    );
  });
it("waits for persisted alias hydration then resolves the current project membership", async () => {
  const persisted = createEmptyLocalFirstState();
  persisted.idAliases[local.id] = durable.id;
  let hydrate!: (state: typeof persisted) => void;
  __setLocalFirstStorageAdapterForTests({
    get: () =>
      new Promise((resolve) => {
        hydrate = resolve;
      }),
    set: async () => undefined,
  });
  __resetLocalFirstStoreForTests();
  client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), [
    durable,
  ]);
  const view = renderIntoDocument(ui());
  cleanup = view.unmount;
  expect(view.container.textContent).toContain("Loading project designs");
  await act(async () => {
    hydrate(persisted);
    await ensureLocalFirstStoreReady();
  });
  expect(
    view.container
      .querySelector("[data-estimate]")
      ?.getAttribute("data-estimate"),
  ).toBe(durable.id);
});
it("does not hide unknown local IDs behind perpetual loading or accept a foreign alias", async () => {
  client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), []);
  const view = renderIntoDocument(ui());
  cleanup = view.unmount;
  expect(view.container.textContent).toContain("Design unavailable");
  await act(async () => {
    await registerLocalFirstIdAlias(local.id, "est_foreign");
    client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), [
      { ...durable, id: "est_foreign", projectId: "proj_other" },
    ]);
  });
  await tick();
  expect(view.container.textContent).toContain("Design unavailable");
  expect(replace).not.toHaveBeenCalled();
});
it("does not redirect back after staff navigate to a different draft", async () => {
  await pendingCreate();
  const other = { ...durable, id: "est_other" };
  client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), [
    local,
    other,
  ]);
  const view = renderIntoDocument(ui());
  cleanup = view.unmount;
  search = "tab=estimates&estimateId=est_other&campaign=winter";
  view.rerender(ui());
  await act(async () => {
    replaceEstimateDetailCache(client, "fixture", "proj_1", local.id, durable);
    await registerLocalFirstIdAlias(local.id, durable.id);
  });
  await tick();
  expect(
    view.container
      .querySelector("[data-estimate]")
      ?.getAttribute("data-estimate"),
  ).toBe(other.id);
  expect(replace).not.toHaveBeenCalled();
});
it("retains historical locking after resolving a saved alias", async () => {
  client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), [
    { ...durable, isActiveDraft: false },
  ]);
  await registerLocalFirstIdAlias(local.id, durable.id);
  const view = renderIntoDocument(ui());
  cleanup = view.unmount;
  expect(view.container.textContent).toContain("V1 is historical");
  expect(view.container.querySelector("[data-estimate]")).toBeNull();
});
for (const state of ["queued", "offline", "error", "conflict"] as const)
  it(`retains the matching local draft and existing ${state} recovery state`, async () => {
    await pendingCreate();
    const item = getLocalFirstStoreSnapshot().state.queue[0];
    if (state === "conflict")
      await resolveLocalFirstQueueItemConflict(item.id, {
        message: "Review this save",
      });
    else
      await resolveLocalFirstQueueItemRetry(item.id, {
        status: state,
        message: "Waiting to save",
      });
    client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), []);
    const view = renderIntoDocument(ui());
    cleanup = view.unmount;
    expect(
      view.container
        .querySelector("[data-estimate]")
        ?.getAttribute("data-estimate"),
    ).toBe(local.id);
    expect(
      getLocalFirstStoreSnapshot().state.entityStates[item.entityKey].status,
    ).toBe(state);
    expect(replace).not.toHaveBeenCalled();
  });
it("preserves revision intent and unrelated scope parameters when its alias resolves", async () => {
  search =
    "tab=estimates&fromEstimateId=local-estimate:sample&campaign=winter&estimateKind=add_on&commercialScopeId=scope";
  client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), [
    durable,
  ]);
  await registerLocalFirstIdAlias(local.id, durable.id);
  const view = renderIntoDocument(ui());
  cleanup = view.unmount;
  expect(replace).toHaveBeenLastCalledWith(
    "/staff/projects/proj_1?tab=estimates&fromEstimateId=est_saved&campaign=winter&estimateKind=add_on&commercialScopeId=scope",
  );
});
it("rejects a queued local draft belonging to another project", async () => {
  await writeLocalFirstWorkingCopy({
    entityKey: buildEstimateEntityKey(local.id),
    data: { ...local, projectId: "proj_other" },
  });
  await enqueueLocalFirstMutation({
    entityKey: buildEstimateEntityKey(local.id),
    mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
    payload: { projectId: "proj_other", localEstimateId: local.id },
  });
  client.setQueryData(qk.estimates.metaByProject("fixture", "proj_1"), []);
  const view = renderIntoDocument(ui());
  cleanup = view.unmount;
  expect(view.container.textContent).toContain("Design unavailable");
  expect(replace).not.toHaveBeenCalled();
});
