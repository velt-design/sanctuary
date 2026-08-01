import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProjectWorkItem,
  ProjectWorkProjection,
} from "@/lib/projects/workItems/types";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import {
  useProjectWorkCommandController,
  type ProjectWorkCommandController,
} from "./useProjectWorkCommandController";

const mocks = vi.hoisted(() => ({
  invalidateProjectWorkReads: vi.fn(async (..._args: unknown[]) => undefined),
  patchProjectWorkProjectionCaches: vi.fn(),
  runProjectConfirmationCommand: vi.fn(),
  runProjectStateCommand: vi.fn(),
  runProjectWorkItemCommand: vi.fn(),
}));

vi.mock("@/lib/projects/workItems/client", () => ({
  runProjectConfirmationCommand: (...args: unknown[]) =>
    mocks.runProjectConfirmationCommand(...args),
  runProjectStateCommand: (...args: unknown[]) =>
    mocks.runProjectStateCommand(...args),
  runProjectWorkItemCommand: (...args: unknown[]) =>
    mocks.runProjectWorkItemCommand(...args),
}));

vi.mock("@/lib/queries/projectWorkCache", () => ({
  invalidateProjectWorkReads: (...args: unknown[]) =>
    mocks.invalidateProjectWorkReads(...args),
  patchProjectWorkProjectionCaches: (...args: unknown[]) =>
    mocks.patchProjectWorkProjectionCaches(...args),
}));

const PROJECT_ID = "proj_22222222-2222-4222-8222-222222222222";
const WORK_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const MANUAL_DUE_LOCAL = "2026-07-29T09:30";
const MANUAL_DUE_ISO = "2026-07-28T21:30:00.000Z";

function workItem(overrides: Partial<ProjectWorkItem> = {}): ProjectWorkItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: WORK_PROJECT_ID,
    title: "Send the first staff email",
    responsibilityArea: "CUSTOMER",
    status: "OPEN",
    dueAt: "2026-07-30T05:00:00.000Z",
    slaBreachAt: null,
    deadlinePolicy: "FIRST_ENQUIRY_EMAIL_V1",
    calendarRevision: "v1",
    assigneeUserId: null,
    effectiveAssignee: { kind: "unassigned" },
    priority: "NORMAL",
    priorityReason: null,
    blockedReason: null,
    origin: "AUTOMATION",
    sourceType: "LEAD_CADENCE",
    sourceKey: "lead:first-email:request-1",
    seriesKey: "lead:request-1",
    subjectKind: "PROJECT",
    subjectId: WORK_PROJECT_ID,
    rowVersion: 1,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
    completedAt: null,
    cancelledAt: null,
    outcome: null,
    cancellationReason: null,
    ...overrides,
  };
}

function projection(
  item = workItem(),
  overrides: Partial<ProjectWorkProjection> = {},
): ProjectWorkProjection {
  return {
    projectId: WORK_PROJECT_ID,
    modelVersion: 2,
    operationalState: "ACTIVE",
    effectiveState: "ACTIVE",
    waitingUntil: null,
    waitingReason: null,
    closedOutcome: null,
    stateRowVersion: 1,
    primaryAction: {
      kind: "workItem",
      item,
      dueState: "today",
      reason: "This work is due today.",
    },
    openItems: [item],
    blockedItems: [],
    confirmedFacts: [],
    generatedAt: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

function committedResponse(
  projectWork?: ProjectWorkProjection,
  options: { replayed?: boolean; refreshRequired?: boolean } = {},
) {
  return {
    command: {
      id: "command",
      committed: true,
      replayed: options.replayed ?? false,
      rowVersion: 2,
    },
    ...(projectWork ? { projectWork } : {}),
    ...(options.refreshRequired ? { refreshRequired: true } : {}),
  };
}

let currentController: ProjectWorkCommandController | null = null;
const mounted: Array<() => void> = [];

function ControllerProbe({
  projectWork,
  stale,
  onRefresh,
}: {
  projectWork: ProjectWorkProjection;
  stale: boolean;
  onRefresh: () => void;
}) {
  currentController = useProjectWorkCommandController({
    projectId: PROJECT_ID,
    host: "fixture",
    projectWork,
    stale,
    onRefresh,
  });
  return null;
}

function controller(): ProjectWorkCommandController {
  if (!currentController)
    throw new Error("Project Work controller was not rendered.");
  return currentController;
}

function renderController({
  projectWork = projection(),
  stale = false,
  onRefresh = vi.fn(),
}: {
  projectWork?: ProjectWorkProjection;
  stale?: boolean;
  onRefresh?: () => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  currentController = null;
  const rendered = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ControllerProbe
        projectWork={projectWork}
        stale={stale}
        onRefresh={onRefresh}
      />
    </QueryClientProvider>,
  );
  mounted.push(rendered.unmount);
  return { queryClient, onRefresh };
}

function expectCommittedProjection(
  queryClient: QueryClient,
  nextProjection: ProjectWorkProjection,
) {
  expect(mocks.patchProjectWorkProjectionCaches).toHaveBeenCalledTimes(1);
  expect(mocks.patchProjectWorkProjectionCaches).toHaveBeenCalledWith(
    queryClient,
    "fixture",
    PROJECT_ID,
    nextProjection,
  );
  expect(mocks.invalidateProjectWorkReads).toHaveBeenCalledTimes(1);
  expect(mocks.invalidateProjectWorkReads).toHaveBeenCalledWith(
    queryClient,
    "fixture",
    PROJECT_ID,
  );
  expect(
    mocks.patchProjectWorkProjectionCaches.mock.invocationCallOrder[0],
  ).toBeLessThan(mocks.invalidateProjectWorkReads.mock.invocationCallOrder[0]!);
  expect(controller().projection).toBe(nextProjection);
  expect(controller().message).toBe("Saved on the server.");
  expect(controller().error).toBeNull();
}

describe("useProjectWorkCommandController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mocks.invalidateProjectWorkReads.mockClear();
    mocks.patchProjectWorkProjectionCaches.mockClear();
    mocks.runProjectConfirmationCommand.mockReset();
    mocks.runProjectStateCommand.mockReset();
    mocks.runProjectWorkItemCommand.mockReset();
  });

  afterEach(() => {
    while (mounted.length) mounted.pop()?.();
    currentController = null;
    document.body.innerHTML = "";
  });

  it("sends semantic email commands through one controller and suppresses an immediate duplicate", async () => {
    let resolveFirst!: (value: ReturnType<typeof committedResponse>) => void;
    const firstResponse = new Promise<ReturnType<typeof committedResponse>>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    mocks.runProjectConfirmationCommand.mockReturnValueOnce(firstResponse);
    renderController();

    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    act(() => {
      first = controller().runItemAction(controller().primaryItem!, "sent");
      duplicate = controller().runItemAction(controller().primaryItem!, "sent");
    });

    await expect(duplicate).resolves.toBe(false);
    expect(mocks.runProjectConfirmationCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runProjectConfirmationCommand).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({
        command: "RECORD_FIRST_ENQUIRY_EMAIL_SENT",
        commandId: expect.any(String),
        subjectId: WORK_PROJECT_ID,
      }),
    );
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();

    await act(async () => {
      resolveFirst(committedResponse());
      await first;
    });

    mocks.runProjectConfirmationCommand.mockResolvedValueOnce(
      committedResponse(),
    );
    await act(async () => {
      await controller().runItemAction(controller().primaryItem!, "reply");
    });

    expect(mocks.runProjectConfirmationCommand).toHaveBeenLastCalledWith(
      PROJECT_ID,
      expect.objectContaining({
        command: "RECORD_ENQUIRY_CUSTOMER_REPLY",
        commandId: expect.any(String),
        subjectId: WORK_PROJECT_ID,
      }),
    );
    expect(mocks.runProjectStateCommand).not.toHaveBeenCalled();
  });

  it("reuses an ambiguous email command id and only reports the committed retry", async () => {
    mocks.runProjectConfirmationCommand
      .mockRejectedValueOnce(new Error("Connection lost after submit"))
      .mockResolvedValueOnce(committedResponse(undefined, { replayed: true }));
    renderController();

    await act(async () => {
      await expect(
        controller().runItemAction(controller().primaryItem!, "sent"),
      ).resolves.toBe(false);
    });

    const firstCommandId =
      mocks.runProjectConfirmationCommand.mock.calls[0]?.[1]?.commandId;
    expect(firstCommandId).toEqual(expect.any(String));
    expect(controller().message).toBeNull();
    expect(controller().error).toBe("Connection lost after submit");
    expect(mocks.invalidateProjectWorkReads).not.toHaveBeenCalled();

    await act(async () => {
      await expect(
        controller().runItemAction(controller().primaryItem!, "sent"),
      ).resolves.toBe(true);
    });

    const secondCommandId =
      mocks.runProjectConfirmationCommand.mock.calls[1]?.[1]?.commandId;
    expect(secondCommandId).toBe(firstCommandId);
    expect(controller().error).toBeNull();
    expect(controller().message).toBe("Already saved on the server.");
    expect(mocks.invalidateProjectWorkReads).toHaveBeenCalledTimes(1);
  });

  it("rejects uncommitted responses without feedback or cache effects", async () => {
    mocks.runProjectConfirmationCommand.mockResolvedValueOnce({
      command: {
        id: "uncommitted-command",
        committed: false,
        replayed: false,
        rowVersion: null,
      },
    });
    renderController();

    await act(async () => {
      await expect(
        controller().runItemAction(controller().primaryItem!, "sent"),
      ).resolves.toBe(false);
    });

    expect(controller().message).toBeNull();
    expect(controller().error).toBe(
      "The server did not confirm this project-work command.",
    );
    expect(mocks.patchProjectWorkProjectionCaches).not.toHaveBeenCalled();
    expect(mocks.invalidateProjectWorkReads).not.toHaveBeenCalled();
  });

  it("patches every project-work cache before invalidating authoritative reads", async () => {
    const nextItem = workItem({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Prepare revised concept",
      origin: "MANUAL",
      sourceType: "MANUAL",
      sourceKey: null,
    });
    const nextProjection = projection(nextItem);
    mocks.runProjectConfirmationCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController();

    await act(async () => {
      await expect(
        controller().runItemAction(controller().primaryItem!, "sent"),
      ).resolves.toBe(true);
    });

    expect(mocks.patchProjectWorkProjectionCaches).toHaveBeenCalledWith(
      queryClient,
      "fixture",
      PROJECT_ID,
      nextProjection,
    );
    expect(mocks.invalidateProjectWorkReads).toHaveBeenCalledWith(
      queryClient,
      "fixture",
      PROJECT_ID,
    );
    expect(
      mocks.patchProjectWorkProjectionCaches.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.invalidateProjectWorkReads.mock.invocationCallOrder[0]!,
    );
    expect(controller().projection).toBe(nextProjection);
    expect(controller().message).toBe("Saved on the server.");
  });

  it("refreshes only after a committed response requires a new Overview read", async () => {
    mocks.runProjectConfirmationCommand.mockResolvedValueOnce(
      committedResponse(undefined, { refreshRequired: true }),
    );
    const onRefresh = vi.fn();
    renderController({ onRefresh });

    await act(async () => {
      await controller().runItemAction(controller().primaryItem!, "sent");
    });

    expect(mocks.invalidateProjectWorkReads).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(
      mocks.invalidateProjectWorkReads.mock.invocationCallOrder[0],
    ).toBeLessThan(onRefresh.mock.invocationCallOrder[0]!);
    expect(controller().message).toBe(
      "Saved on the server. Refreshing the Overview to load the confirmed state.",
    );
  });

  it("creates manual work with the semantic CREATE command and clears committed input", async () => {
    const createdItem = workItem({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Prepare consent email",
      responsibilityArea: "ADMIN",
      dueAt: MANUAL_DUE_ISO,
      origin: "MANUAL",
      sourceType: "MANUAL",
      sourceKey: null,
      seriesKey: null,
    });
    const nextProjection = projection(createdItem);
    mocks.runProjectWorkItemCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController();

    act(() => {
      controller().setManualTitle("  Prepare consent email  ");
      controller().setManualArea("ADMIN");
      controller().setManualDueAt(MANUAL_DUE_LOCAL);
    });
    await act(async () => {
      await expect(controller().createManualItem()).resolves.toBe(true);
    });

    expect(mocks.runProjectWorkItemCommand).toHaveBeenCalledWith(PROJECT_ID, {
      commandId: expect.any(String),
      command: "CREATE",
      title: "Prepare consent email",
      responsibilityArea: "ADMIN",
      dueAt: MANUAL_DUE_ISO,
    });
    expect(mocks.runProjectConfirmationCommand).not.toHaveBeenCalled();
    expect(mocks.runProjectStateCommand).not.toHaveBeenCalled();
    expectCommittedProjection(queryClient, nextProjection);
    expect(controller().manualTitle).toBe("");
    expect(controller().manualDueAt).toBe("");
    expect(controller().manualReason).toBe("");
  });

  it("replaces a decision review with one semantic REPLACE_REVIEW command", async () => {
    const reviewItem = workItem({
      title: "Review whether to close the enquiry",
      sourceKey: "lead:close-review:request-1",
      rowVersion: 7,
    });
    const replacementItem = workItem({
      id: "44444444-4444-4444-8444-444444444444",
      title: "Email the customer for final confirmation",
      responsibilityArea: "CUSTOMER",
      dueAt: MANUAL_DUE_ISO,
      origin: "MANUAL",
      sourceType: "MANUAL",
      sourceKey: null,
      seriesKey: null,
    });
    const nextProjection = projection(replacementItem);
    mocks.runProjectWorkItemCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController({
      projectWork: projection(reviewItem),
    });

    act(() => {
      controller().setManualTitle(
        "  Email the customer for final confirmation  ",
      );
      controller().setManualArea("CUSTOMER");
      controller().setManualDueAt(MANUAL_DUE_LOCAL);
      controller().setManualReason("  Customer asked for one more week.  ");
    });
    await act(async () => {
      await expect(controller().createManualItem()).resolves.toBe(true);
    });

    expect(mocks.runProjectWorkItemCommand).toHaveBeenCalledWith(PROJECT_ID, {
      commandId: expect.any(String),
      command: "REPLACE_REVIEW",
      workItemId: reviewItem.id,
      expectedRowVersion: 7,
      reason: "Customer asked for one more week.",
      title: "Email the customer for final confirmation",
      responsibilityArea: "CUSTOMER",
      dueAt: MANUAL_DUE_ISO,
    });
    expect(mocks.runProjectConfirmationCommand).not.toHaveBeenCalled();
    expect(mocks.runProjectStateCommand).not.toHaveBeenCalled();
    expectCommittedProjection(queryClient, nextProjection);
    expect(controller().manualTitle).toBe("");
    expect(controller().manualDueAt).toBe("");
    expect(controller().manualReason).toBe("");
  });

  it("completes manual work with its stable row identity", async () => {
    const manualItem = workItem({
      title: "Review consent response",
      origin: "MANUAL",
      sourceType: "MANUAL",
      sourceKey: null,
      seriesKey: null,
      subjectKind: null,
      subjectId: null,
      rowVersion: 4,
    });
    const nextProjection = projection(manualItem, {
      primaryAction: {
        kind: "none",
        title: "No active project work",
        reason: "All current work is complete.",
      },
      openItems: [],
    });
    mocks.runProjectWorkItemCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController({
      projectWork: projection(manualItem),
    });

    await act(async () => {
      await expect(
        controller().runItemAction(controller().primaryItem!, "complete"),
      ).resolves.toBe(true);
    });

    expect(mocks.runProjectWorkItemCommand).toHaveBeenCalledWith(PROJECT_ID, {
      commandId: expect.any(String),
      command: "COMPLETE",
      workItemId: manualItem.id,
      expectedRowVersion: 4,
    });
    expect(mocks.runProjectConfirmationCommand).not.toHaveBeenCalled();
    expect(mocks.runProjectStateCommand).not.toHaveBeenCalled();
    expectCommittedProjection(queryClient, nextProjection);
    expect(controller().pendingItemId).toBeNull();
  });

  it("sets Waiting through its explicit lifecycle command", async () => {
    const projectWork = projection(workItem(), { stateRowVersion: 3 });
    const nextProjection = projection(workItem(), {
      operationalState: "WAITING",
      effectiveState: "WAITING",
      waitingUntil: MANUAL_DUE_ISO,
      waitingReason: "Awaiting customer timing.",
      stateRowVersion: 4,
    });
    mocks.runProjectStateCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController({ projectWork });

    act(() => {
      controller().setWaitingUntil(MANUAL_DUE_LOCAL);
      controller().setStateReason("  Awaiting customer timing.  ");
    });
    await act(async () => {
      await expect(controller().waitProject()).resolves.toBe(true);
    });

    expect(mocks.runProjectStateCommand).toHaveBeenCalledWith(PROJECT_ID, {
      commandId: expect.any(String),
      command: "WAIT",
      expectedRowVersion: 3,
      waitingUntil: MANUAL_DUE_ISO,
      reason: "Awaiting customer timing.",
      cancellationReason: "Awaiting customer timing.",
    });
    expectCommittedProjection(queryClient, nextProjection);
  });

  it("closes Lost through a structured outcome with only an optional note", async () => {
    const projectWork = projection(workItem(), { stateRowVersion: 5 });
    const nextProjection = projection(workItem(), {
      operationalState: "CLOSED",
      effectiveState: "CLOSED",
      closedOutcome: "LOST_TIMING_DEFERRED",
      stateRowVersion: 6,
    });
    mocks.runProjectStateCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController({ projectWork });

    await act(async () => {
      await expect(
        controller().closeProject({
          outcome: "LOST_TIMING_DEFERRED",
          note: "  Revisit next season.  ",
        }),
      ).resolves.toBe(true);
    });

    expect(mocks.runProjectStateCommand).toHaveBeenCalledWith(PROJECT_ID, {
      commandId: expect.any(String),
      command: "CLOSE",
      expectedRowVersion: 5,
      outcome: "LOST_TIMING_DEFERRED",
      note: "Revisit next season.",
      cancellationReason: undefined,
    });
    expectCommittedProjection(queryClient, nextProjection);
  });

  it("reopens a Closed project without routing through a generic state form", async () => {
    const projectWork = projection(workItem(), {
      operationalState: "CLOSED",
      effectiveState: "CLOSED",
      closedOutcome: "LOST_NO_RESPONSE",
      stateRowVersion: 9,
    });
    const nextProjection = projection(workItem(), { stateRowVersion: 10 });
    mocks.runProjectStateCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController({ projectWork });

    await act(async () => {
      await expect(controller().activateProject()).resolves.toBe(true);
    });

    expect(mocks.runProjectStateCommand).toHaveBeenCalledWith(PROJECT_ID, {
      commandId: expect.any(String),
      command: "REOPEN",
      expectedRowVersion: 9,
    });
    expectCommittedProjection(queryClient, nextProjection);
  });

  it("still requires a reason when cancelling a project", async () => {
    renderController();

    await act(async () => {
      await expect(
        controller().closeProject({ outcome: "CANCELLED" }),
      ).resolves.toBe(false);
    });

    expect(controller().error).toBe(
      "Record why the current work is being ended.",
    );
    expect(mocks.runProjectStateCommand).not.toHaveBeenCalled();
  });

  it("records only the hidden manual Site Visit completion fact", async () => {
    const nextProjection = projection(workItem(), {
      confirmedFacts: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          type: "SITE_VISIT_COMPLETED",
          subjectKind: "PROJECT",
          subjectId: WORK_PROJECT_ID,
          occurredAt: "2026-07-29T02:00:00.000Z",
          recordedAt: "2026-07-29T02:01:00.000Z",
        },
      ],
    });
    mocks.runProjectConfirmationCommand.mockResolvedValueOnce(
      committedResponse(nextProjection),
    );
    const { queryClient } = renderController();

    await act(async () => {
      await expect(controller().recordSiteVisitCompleted()).resolves.toBe(true);
    });

    expect(mocks.runProjectConfirmationCommand).toHaveBeenCalledWith(
      PROJECT_ID,
      {
        commandId: expect.any(String),
        command: "RECORD_SITE_VISIT_COMPLETED",
      },
    );
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
    expect(mocks.runProjectStateCommand).not.toHaveBeenCalled();
    expectCommittedProjection(queryClient, nextProjection);
  });

  it.each(["Call customer", "Book Site Visit"])(
    "rejects prohibited manual work before any server command: %s",
    async (title) => {
      renderController();

      act(() => {
        controller().setManualTitle(title);
      });
      await act(async () => {
        await expect(controller().createManualItem()).resolves.toBe(false);
      });

      expect(controller().manualTitleProhibited).toBe(true);
      expect(controller().error).toBe(
        "Call and Site Visit work cannot be created from Project Work.",
      );
      expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
      expect(mocks.invalidateProjectWorkReads).not.toHaveBeenCalled();
    },
  );

  it("rejects actions for server-returned blocked work before any command", async () => {
    renderController();
    const blockedItem = {
      ...controller().primaryItem!,
      status: "BLOCKED" as const,
      blockedReason: "Waiting for structural drawings.",
    };

    await act(async () => {
      await expect(
        controller().runItemAction(blockedItem, "complete"),
      ).resolves.toBe(false);
    });

    expect(controller().error).toBe("Only open project work can be actioned.");
    expect(mocks.runProjectConfirmationCommand).not.toHaveBeenCalled();
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
    expect(mocks.invalidateProjectWorkReads).not.toHaveBeenCalled();
  });

  it("makes stale commands a no-op before any server or cache call", async () => {
    renderController({ stale: true });

    await act(async () => {
      await expect(
        controller().runItemAction(controller().primaryItem!, "sent"),
      ).resolves.toBe(false);
      await expect(controller().recordSiteVisitCompleted()).resolves.toBe(
        false,
      );
    });

    expect(mocks.runProjectConfirmationCommand).not.toHaveBeenCalled();
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
    expect(mocks.runProjectStateCommand).not.toHaveBeenCalled();
    expect(mocks.patchProjectWorkProjectionCaches).not.toHaveBeenCalled();
    expect(mocks.invalidateProjectWorkReads).not.toHaveBeenCalled();
    expect(controller().pending).toBe(false);
    expect(controller().message).toBeNull();
    expect(controller().error).toBeNull();
  });
});
