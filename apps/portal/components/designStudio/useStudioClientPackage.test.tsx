import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { useStudioClientPackage } from "./useStudioClientPackage";
import { prepareStudioNavigation } from "@/lib/designStudio/studioSessionLifecycle";
const api = vi.hoisted(() => vi.fn());
const storageOwner = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/repo/apiClient", () => ({ apiJson: api }));
vi.mock("@/lib/localFirst/store", () => ({
  getLocalFirstStoreOwner: () => storageOwner.id,
  flushLocalFirstStore: async () => {},
}));
let controller: ReturnType<typeof useStudioClientPackage>,
  mounted: ReturnType<typeof renderIntoDocument> | undefined;
const value = {
  to: "qa@example.test",
  subject: "Quote",
  message: "Hello",
  includeBooklet: true,
  renderFileIds: [] as string[],
  fileIds: [],
};
const state = (revision = 0, files: string[] = [], status = "ready") => ({
  draft: {
    revision,
    value: { ...value, renderFileIds: files },
    documentId: files.length ? "variant" : "base",
    preparedIntentId: null,
    preparedRevision: null,
  },
  document: {
    documentId: files.length ? "variant" : "base",
    state: status,
    totalPages: 13 + files.length,
    completedPages: 0,
  },
  files: [],
});
function Harness({
  quoteId = "qv-test",
  actorId,
}: {
  quoteId?: string;
  actorId?: string;
}) {
  controller = useStudioClientPackage(quoteId, undefined, actorId);
  return (
    <div>
      {controller.saving ? "Saving" : "Idle"}
      {controller.value?.message}
    </div>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  storageOwner.id = null;
  sessionStorage.clear();
  api.mockResolvedValue({ package: state() });
});
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  vi.useRealTimers();
});
async function mount() {
  mounted = renderIntoDocument(<Harness />);
  await act(async () => {});
}
it("coalesces rapid checkbox changes, fences stale responses and retains final authoritative desired variant", async () => {
  await mount();
  let finish!: (value: any) => void;
  api
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ package: state(2, []) });
  act(() => controller.change({ ...value, renderFileIds: ["image-a"] }, true));
  act(() => controller.change({ ...value, renderFileIds: ["image-b"] }, true));
  act(() => controller.change({ ...value, renderFileIds: [] }, true));
  expect(controller.saving).toBe(true);
  expect(api).toHaveBeenCalledTimes(2);
  await act(async () => finish({ package: state(1, ["image-a"], "running") }));
  expect(api).toHaveBeenCalledTimes(3);
  expect(JSON.parse(api.mock.calls[2][1].body)).toMatchObject({
    revision: 1,
    value: { renderFileIds: [] },
  });
  expect(controller.state?.draft.documentId).toBe("base");
  expect(controller.saving).toBe(false);
});
it("reloads during a pending save without leaving saving stuck or applying its late result", async () => {
  await mount();
  let finish!: (value: any) => void;
  api
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ package: state(2) });
  act(() => controller.change({ ...value, message: "Changed locally" }, true));
  expect(controller.saving).toBe(true);
  await act(async () => controller.reload());
  expect(controller.saving).toBe(false);
  expect(controller.state?.draft.revision).toBe(2);
  await act(async () => finish({ package: state(1, ["old"], "running") }));
  expect(controller.state?.draft.revision).toBe(2);
  expect(controller.state?.draft.documentId).toBe("base");
});
it("keeps failed save recoverable and prepares only the exact confirmed revision without invoking send", async () => {
  await mount();
  api.mockRejectedValueOnce(Error("Connection interrupted"));
  await act(async () =>
    controller.change({ ...value, message: "Retained message" }, true),
  );
  expect(controller.error).toContain("interrupted");
  expect(controller.value?.message).toBe("Retained message");
  api
    .mockResolvedValueOnce({
      package: {
        ...state(1),
        draft: {
          ...state(1).draft,
          value: { ...value, message: "Retained message" },
        },
      },
    })
    .mockResolvedValueOnce({ prepared: { id: "intent" } })
    .mockResolvedValueOnce({ package: state(1) });
  await act(async () => controller.action("prepare"));
  const preparation = api.mock.calls.find(([url]) => url.endsWith("/prepare"));
  expect(JSON.parse(preparation![1].body).revision).toBe(1);
  expect(api.mock.calls.some(([url]) => url.endsWith("/send"))).toBe(false);
});
it("merges a deferred file-import completion into the latest edited recipient/message/selection rather than its starting draft", async () => {
  await mount();
  const complete = controller.attachFile;
  act(() =>
    controller.change({
      ...value,
      to: "new@example.test",
      message: "Updated while importing",
      includeBooklet: false,
      renderFileIds: ["render-b"],
      fileIds: ["other-file"],
    }),
  );
  const file = {
    id: "imported-file",
    filename: "Site plan.pdf",
    contentType: "application/pdf",
    sizeBytes: 100,
    sha256: "a".repeat(64),
    renderEligible: false,
  };
  api.mockImplementationOnce(async (_url, request) => {
    const sent = JSON.parse(request.body);
    return {
      package: { ...state(1), draft: { ...state(1).draft, value: sent.value } },
    };
  });
  await act(async () => complete(file));
  expect(controller.value).toMatchObject({
    to: "new@example.test",
    message: "Updated while importing",
    includeBooklet: false,
    renderFileIds: ["render-b"],
    fileIds: ["other-file", "imported-file"],
  });
  expect(JSON.parse(api.mock.calls.at(-1)![1].body).value).toEqual(
    controller.value,
  );
});
it("retires a deferred old-quote import callback when the quote context changes", async () => {
  await mount();
  const complete = controller.attachFile;
  await act(async () => mounted!.rerender(<Harness quoteId="qv-new" />));
  await act(async () =>
    complete({
      id: "old-file",
      filename: "Old.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
      sha256: "a".repeat(64),
      renderEligible: false,
    }),
  );
  expect(controller.state?.files).toEqual([]);
  expect(controller.value?.fileIds).toEqual([]);
});

it("keeps an imported existing selected render inside the booklet without creating a duplicate loose attachment", async () => {
  await mount();
  act(() =>
    controller.change({ ...value, renderFileIds: ["existing-render"] }),
  );
  let result: unknown;
  act(() => {
    result = controller.attachFile({
      id: "existing-render",
      filename: "Garden.png",
      contentType: "image/png",
      sizeBytes: 100,
      sha256: "a".repeat(64),
      renderEligible: true,
    });
  });
  expect(result).toBe("rendered");
  expect(controller.value?.renderFileIds).toEqual(["existing-render"]);
  expect(controller.value?.fileIds).toEqual([]);
});

it("preserves local edits as a conflict when a status poll observes another-window package revision", async () => {
  vi.useFakeTimers();
  let finishPoll!: (value: any) => void;
  api
    .mockResolvedValueOnce({ package: state(1, [], "running") })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPoll = resolve;
        }),
    );
  await mount();
  await act(async () => vi.advanceTimersByTime(1500));
  act(() => controller.change({ ...value, message: "My pending message" }));
  const remote = {
    ...state(2, [], "ready"),
    draft: {
      ...state(2).draft,
      value: { ...value, to: "elsewhere@example.test" },
    },
  };
  await act(async () => finishPoll({ package: remote }));
  await act(async () => vi.advanceTimersByTime(400));
  expect(
    api.mock.calls.filter(([, request]) => request?.method === "PUT"),
  ).toHaveLength(0);
  expect(controller.conflicted).toBe(true);
  expect(controller.value).toMatchObject({
    to: value.to,
    message: "My pending message",
  });
  expect(controller.state?.draft.revision).toBe(1);
  api.mockResolvedValueOnce({ package: remote });
  await act(async () => controller.reload());
  expect(controller.value?.to).toBe("elsewhere@example.test");
  expect(controller.retainedValue?.message).toBe("My pending message");
  expect(
    api.mock.calls.filter(([, request]) => request?.method === "PUT"),
  ).toHaveLength(0);
});
it("adopts a pristine remote package and form together without automatically writing stale form values back", async () => {
  vi.useFakeTimers();
  const remote = {
    ...state(2, [], "ready"),
    draft: {
      ...state(2).draft,
      value: { ...value, to: "elsewhere@example.test" },
    },
  };
  api
    .mockResolvedValueOnce({ package: state(1, [], "running") })
    .mockResolvedValueOnce({ package: remote });
  await mount();
  await act(async () => vi.advanceTimersByTime(1500));
  await act(async () => vi.advanceTimersByTime(400));
  expect(controller.state?.draft.revision).toBe(2);
  expect(controller.value?.to).toBe("elsewhere@example.test");
  expect(
    api.mock.calls.filter(([, request]) => request?.method === "PUT"),
  ).toHaveLength(0);
});
it("flushes pending message edits before exact booklet retry and updates progress without resetting the composer", async () => {
  api.mockResolvedValueOnce({ package: state(1, [], "failed") });
  await mount();
  act(() => controller.change({ ...value, message: "Message before retry" }));
  api
    .mockImplementationOnce(async (_url, request) => ({
      package: {
        ...state(2, [], "failed"),
        draft: { ...state(2).draft, value: JSON.parse(request.body).value },
      },
    }))
    .mockResolvedValueOnce({
      document: { ...state(2, [], "queued").document, packageRevision: 2 },
    });
  await act(async () => controller.action("retry"));
  expect(controller.value?.message).toBe("Message before retry");
  expect(controller.state?.draft.value.message).toBe("Message before retry");
  expect(controller.state?.document?.state).toBe("queued");
  expect(api.mock.calls[1][1].method).toBe("PUT");
  expect(api.mock.calls[2][0]).toContain("revision=2");
  expect(api.mock.calls).toHaveLength(3);
});
it("keeps edits and refuses dependent retry when flushing them fails", async () => {
  api.mockResolvedValueOnce({ package: state(1, [], "failed") });
  await mount();
  act(() => controller.change({ ...value, message: "Retained retry message" }));
  api.mockRejectedValueOnce(Error("Save interrupted"));
  await act(async () => controller.action("retry"));
  expect(controller.value?.message).toBe("Retained retry message");
  expect(controller.error).toContain("interrupted");
  expect(api.mock.calls.some(([url]) => url.includes("/document?"))).toBe(
    false,
  );
});

it("retains recipient/message before debounce across leaving and returning, and distinguishes local from server confirmation", async () => {
  vi.useFakeTimers();
  const actorId = "10000000-0000-4000-8000-000000000001",
    quoteId = "qv_10000000-0000-4000-8000-000000000002";
  storageOwner.id = actorId;
  api.mockResolvedValueOnce({ package: state(1) });
  mounted = renderIntoDocument(<Harness actorId={actorId} quoteId={quoteId} />);
  await act(async () => {});
  act(() =>
    controller.change({
      ...value,
      to: "return@example.test",
      message: "Keep this message on return",
    }),
  );
  expect(controller.dirty).toBe(true);
  expect(controller.state?.draft.value.to).toBe(value.to);
  const navigation = prepareStudioNavigation(actorId);
  await navigation.ready;
  navigation.release();
  mounted.unmount();
  mounted = undefined;
  expect(api.mock.calls.some(([, request]) => request?.method === "PUT")).toBe(
    false,
  );
  api.mockResolvedValueOnce({ package: state(1) });
  mounted = renderIntoDocument(<Harness actorId={actorId} quoteId={quoteId} />);
  await act(async () => {});
  expect(controller.value).toMatchObject({
    to: "return@example.test",
    message: "Keep this message on return",
  });
  expect(controller.dirty).toBe(true);
  expect(controller.state?.draft.value.to).toBe(value.to);
  let finish!: (value: any) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => vi.advanceTimersByTime(400));
  expect(controller.saving).toBe(true);
  const sent = JSON.parse(api.mock.calls.at(-1)![1].body);
  await act(async () =>
    finish({
      package: {
        ...state(2),
        draft: {
          ...state(2).draft,
          value: Object.fromEntries(Object.entries(sent.value).reverse()),
        },
      },
    }),
  );
  expect(controller.dirty).toBe(false);
  expect(controller.state?.draft.value.to).toBe("return@example.test");
  expect(sessionStorage.length).toBe(0);
});
it("does not restore another actor local copy or run an old actor completion", async () => {
  const actorA = "10000000-0000-4000-8000-000000000001",
    actorB = "10000000-0000-4000-8000-000000000003",
    quoteId = "qv_10000000-0000-4000-8000-000000000002";
  storageOwner.id = actorA;
  api.mockResolvedValueOnce({ package: state(1) });
  mounted = renderIntoDocument(<Harness actorId={actorA} quoteId={quoteId} />);
  await act(async () => {});
  act(() => controller.change({ ...value, message: "Actor A private draft" }));
  const oldComplete = controller.attachFile;
  storageOwner.id = actorB;
  api.mockResolvedValueOnce({ package: state(1) });
  await act(async () =>
    mounted!.rerender(<Harness actorId={actorB} quoteId={quoteId} />),
  );
  expect(controller.value?.message).toBe("Hello");
  expect(controller.retainedValue).toBeNull();
  act(() =>
    oldComplete({
      id: "old-file",
      filename: "Old.pdf",
      contentType: "application/pdf",
      sizeBytes: 10,
      sha256: "a".repeat(64),
      renderEligible: false,
    }),
  );
  expect(controller.value?.fileIds).toEqual([]);
  expect(sessionStorage.length).toBe(1);
});
it("treats JSONB property order as identical and does not repeat already confirmed saves", async () => {
  vi.useFakeTimers();
  api.mockResolvedValueOnce({ package: state(1) });
  await mount();
  api.mockImplementationOnce(async (_url, request) => ({
    package: {
      ...state(2),
      draft: {
        ...state(2).draft,
        value: Object.fromEntries(
          Object.entries(JSON.parse(request.body).value).reverse(),
        ),
      },
    },
  }));
  await act(async () =>
    controller.change({ ...value, message: "Changed once" }, true),
  );
  await act(async () => vi.advanceTimersByTime(1000));
  expect(controller.dirty).toBe(false);
  expect(
    api.mock.calls.filter(([, request]) => request?.method === "PUT"),
  ).toHaveLength(1);
});
