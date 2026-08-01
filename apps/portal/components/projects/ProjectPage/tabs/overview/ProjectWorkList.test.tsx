import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ProjectWorkItem,
  ProjectWorkProjection,
} from "@/lib/projects/workItems/types";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectWorkList from "./ProjectWorkList";
import type { ProjectWorkCommandController } from "./useProjectWorkCommandController";

const WORK_PROJECT_ID = "22222222-2222-4222-8222-222222222222";

function workItem(overrides: Partial<ProjectWorkItem> = {}): ProjectWorkItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: WORK_PROJECT_ID,
    title: "Prepare revised concept",
    responsibilityArea: "DESIGN",
    status: "OPEN",
    dueAt: "2026-07-30T05:00:00.000Z",
    slaBreachAt: null,
    deadlinePolicy: null,
    calendarRevision: null,
    assigneeUserId: null,
    effectiveAssignee: { kind: "projectOwner", ownerKey: "jordan" },
    priority: "NORMAL",
    priorityReason: null,
    blockedReason: null,
    origin: "MANUAL",
    sourceType: "MANUAL",
    sourceKey: null,
    seriesKey: null,
    subjectKind: null,
    subjectId: null,
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

function projection({
  primary,
  openItems,
  blockedItems = [],
}: {
  primary: ProjectWorkItem;
  openItems: ProjectWorkItem[];
  blockedItems?: ProjectWorkItem[];
}): ProjectWorkProjection {
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
      item: primary,
      dueState: "today",
      reason: "This work is due today.",
    },
    openItems,
    blockedItems,
    confirmedFacts: [],
    generatedAt: "2026-07-29T00:00:00.000Z",
  };
}

function controllerFor(
  projectWork: ProjectWorkProjection,
  {
    stale = false,
    runItemAction = vi.fn().mockResolvedValue(true),
  }: {
    stale?: boolean;
    runItemAction?: ReturnType<typeof vi.fn>;
  } = {},
): ProjectWorkCommandController {
  const primaryItem =
    projectWork.primaryAction.kind === "workItem"
      ? projectWork.primaryAction.item
      : null;
  return {
    projection: projectWork,
    primary: projectWork.primaryAction,
    primaryItem,
    pending: false,
    pendingItemId: null,
    stale,
    runItemAction,
  } as unknown as ProjectWorkCommandController;
}

function rowWith(container: HTMLElement, text: string): HTMLLIElement {
  const row = Array.from(container.querySelectorAll("li")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!row) throw new Error(`Missing Project Work row for ${text}.`);
  return row;
}

describe("ProjectWorkList", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders nothing when the server selected the only current item", () => {
    const primary = workItem();
    const rendered = renderIntoDocument(
      <ProjectWorkList
        controller={controllerFor(
          projection({ primary, openItems: [primary] }),
        )}
      />,
    );

    expect(rendered.container.textContent).toBe("");
    expect(
      rendered.container.querySelector('[data-project-work-list="v2"]'),
    ).toBeNull();
    rendered.unmount();
  });

  it("keeps the primary item out of the list and routes email/manual actions through the controller", async () => {
    const primary = workItem({ title: "Prepare revised concept" });
    const email = workItem({
      id: "22222222-2222-4222-8222-222222222223",
      title: "Email customer follow-up",
      responsibilityArea: "CUSTOMER",
      origin: "AUTOMATION",
      sourceType: "LEAD_CADENCE",
      sourceKey: "lead:follow-up:request-1:1",
      subjectKind: "PROJECT",
      subjectId: WORK_PROJECT_ID,
      effectiveAssignee: { kind: "staff", userId: "staff-1" },
    });
    const stageReview = workItem({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Review proposal progress",
      dueAt: "2026-08-03T05:00:00.000Z",
      sourceType: "STAGE_REVIEW",
      sourceKey: "stage-review:sent:v1",
    });
    const blocked = workItem({
      id: "44444444-4444-4444-8444-444444444444",
      title: "Confirm engineering input",
      status: "BLOCKED",
      blockedReason: "Waiting for structural drawings.",
      responsibilityArea: "OPERATIONS",
    });
    const projectWork = projection({
      primary,
      openItems: [primary, email, stageReview],
      blockedItems: [blocked],
    });
    const runItemAction = vi.fn().mockResolvedValue(true);
    const workController = controllerFor(projectWork, { runItemAction });
    const rendered = renderIntoDocument(
      <ProjectWorkList controller={workController} />,
    );

    expect(
      rendered.container.querySelectorAll('[data-project-work-list="v2"] li'),
    ).toHaveLength(3);
    expect(rendered.container.textContent).not.toContain(primary.title);
    expect(rendered.container.textContent).toContain("2 open");
    expect(rendered.container.textContent).toContain("1 blocked");

    const emailRow = rowWith(rendered.container, email.title);
    expect(emailRow.textContent).toContain("Assigned staff");
    expect(emailRow.textContent).toContain("Due");
    const emailSent = Array.from(emailRow.querySelectorAll("button")).find(
      (button) => button.textContent === "Record email sent",
    )!;
    const customerReplied = Array.from(
      emailRow.querySelectorAll("button"),
    ).find((button) => button.textContent === "Record customer reply")!;

    const stageReviewRow = rowWith(rendered.container, stageReview.title);
    expect(stageReviewRow.textContent).toContain("Jordan");
    const complete = Array.from(stageReviewRow.querySelectorAll("button")).find(
      (button) => button.textContent === "Mark complete",
    )!;

    const blockedRow = rowWith(rendered.container, blocked.title);
    expect(blockedRow.textContent).toContain(
      "Waiting for structural drawings.",
    );
    expect(blockedRow.textContent).toContain("Blocked");
    expect(blockedRow.querySelectorAll("button")).toHaveLength(0);

    await act(async () => {
      emailSent.click();
      customerReplied.click();
      complete.click();
    });
    expect(runItemAction).toHaveBeenCalledWith(email, "sent");
    expect(runItemAction).toHaveBeenCalledWith(email, "reply");
    expect(runItemAction).toHaveBeenCalledWith(stageReview, "complete");
    expect(
      rendered.container.querySelectorAll('input[type="checkbox"]'),
    ).toHaveLength(0);
    expect(
      Array.from(rendered.container.querySelectorAll("button")).some((button) =>
        /\b(?:call|site visits?)\b/i.test(button.textContent ?? ""),
      ),
    ).toBe(false);
    rendered.unmount();
  });

  it("keeps stale V2 work visible while every row action is disabled", () => {
    const primary = workItem({ title: "Prepare revised concept" });
    const email = workItem({
      id: "22222222-2222-4222-8222-222222222223",
      title: "Email customer follow-up",
      origin: "AUTOMATION",
      sourceType: "LEAD_CADENCE",
      sourceKey: "lead:follow-up:request-1:1",
    });
    const projectWork = projection({
      primary,
      openItems: [primary, email],
    });
    const runItemAction = vi.fn();
    const rendered = renderIntoDocument(
      <ProjectWorkList
        controller={controllerFor(projectWork, { stale: true, runItemAction })}
      />,
    );

    expect(rendered.container.textContent).toContain(email.title);
    const buttons = rowWith(rendered.container, email.title).querySelectorAll(
      "button",
    );
    expect(buttons).toHaveLength(2);
    expect(Array.from(buttons).every((button) => button.disabled)).toBe(true);
    Array.from(buttons).forEach((button) => button.click());
    expect(runItemAction).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
