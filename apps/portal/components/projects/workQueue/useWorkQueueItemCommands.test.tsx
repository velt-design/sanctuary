import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import type { WorkQueueEntryView } from "./workQueuePresentation";
import { useWorkQueueItemCommands } from "./useWorkQueueItemCommands";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(async (..._args: unknown[]) => undefined),
  patch: vi.fn((..._args: unknown[]) => undefined),
  runWorkItem: vi.fn(),
  runConfirmation: vi.fn(),
}));

vi.mock("@/lib/queries/projectWorkCache", () => ({
  invalidateProjectWorkReads: (...args: unknown[]) => mocks.invalidate(...args),
  patchProjectWorkProjectionCaches: (...args: unknown[]) => mocks.patch(...args),
}));

vi.mock("@/lib/projects/workItems/client", () => ({
  runProjectWorkItemCommand: (...args: unknown[]) => mocks.runWorkItem(...args),
  runProjectConfirmationCommand: (...args: unknown[]) =>
    mocks.runConfirmation(...args),
}));

const entry = {
  projectId: "proj_11111111-1111-4111-8111-111111111111",
  workItemId: "22222222-2222-4222-8222-222222222222",
  workItemRowVersion: 1,
} as WorkQueueEntryView;

let commands: ReturnType<typeof useWorkQueueItemCommands> | null = null;
const mounted: Array<() => void> = [];

function Probe() {
  commands = useWorkQueueItemCommands({
    entry,
    host: "fixture",
    mutationsEnabled: true,
  });
  return null;
}

function renderCommands() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  mounted.push(rendered.unmount);
}

beforeEach(() => {
  vi.clearAllMocks();
  commands = null;
});

afterEach(() => {
  while (mounted.length) mounted.pop()?.();
});

describe("useWorkQueueItemCommands", () => {
  it("sends one command for same-tick duplicate actions", async () => {
    let resolveCommand: ((value: unknown) => void) | undefined;
    mocks.runWorkItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommand = resolve;
        }),
    );
    renderCommands();

    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    act(() => {
      first = commands!.complete();
      second = commands!.complete();
    });

    expect(mocks.runWorkItem).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBe(false);

    await act(async () => {
      resolveCommand?.({
        command: {
          id: "33333333-3333-4333-8333-333333333333",
          committed: true,
          replayed: false,
          rowVersion: 2,
        },
      });
      await expect(first).resolves.toBe(true);
    });
  });

  it("does not report success without a committed server result", async () => {
    mocks.runWorkItem.mockResolvedValue({
      command: {
        id: "33333333-3333-4333-8333-333333333333",
        committed: false,
        replayed: false,
        rowVersion: null,
      },
    });
    renderCommands();

    await act(async () => {
      await commands!.complete();
    });

    expect(commands!.message).toBeNull();
    expect(commands!.error).toBe(
      "The server did not confirm this project-work command.",
    );
  });
});
