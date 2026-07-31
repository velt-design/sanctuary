import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectCommandStaffSummary } from "@/lib/projects/commandCentre/types";
import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type {
  ProjectWorkItem,
  ProjectWorkProjection,
} from "@/lib/projects/workItems/types";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectWorkSection, {
  type ProjectWorkSectionProps,
} from "./ProjectWorkSection";

const mocks = vi.hoisted(() => ({
  fetchProjectStaffDirectory: vi.fn(),
}));

vi.mock("@/lib/projects/commandCentre/client", () => ({
  fetchProjectStaffDirectory: (...args: unknown[]) =>
    mocks.fetchProjectStaffDirectory(...args),
}));

vi.mock(
  "@/components/projects/workQueue/ConfirmationCorrectionControls.client",
  () => ({
    default: () => <div data-confirmation-correction-controls="true" />,
  }),
);

const PROJECT_ID = "proj_22222222-2222-4222-8222-222222222222";
const WORK_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const mounted: Array<() => void> = [];

const staff: ProjectCommandStaffSummary[] = [
  {
    userId: "00000000-0000-4000-8000-000000000001",
    displayName: "Sam Sales",
    email: "sam@example.test",
    accessRole: "staff",
  },
];

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

function projection(
  overrides: Partial<ProjectWorkProjection> = {},
): ProjectWorkProjection {
  const primary = workItem();
  return {
    projectId: WORK_PROJECT_ID,
    modelVersion: 2,
    operationalState: "ACTIVE",
    effectiveState: "ACTIVE",
    waitingUntil: null,
    waitingReason: null,
    closedOutcome: null,
    stateRowVersion: 1,
    primaryAction: { kind: "workItem", item: primary, dueState: "today" },
    openItems: [primary],
    blockedItems: [],
    confirmedFacts: [],
    generatedAt: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

function renderSection(props: ProjectWorkSectionProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ProjectWorkSection {...props} />
    </QueryClientProvider>,
  );
  mounted.push(rendered.unmount);
  return rendered;
}

function renderV2(
  projectWork: ProjectWorkProjection,
  stale = false,
  pipelineStage: ProjectPageSnapshot["project"]["stage"] = "quoting",
) {
  return renderSection({
    workModel: "v2",
    projectId: PROJECT_ID,
    host: "fixture",
    projectWork,
    pipelineStage,
    stale,
    onRefresh: vi.fn(),
    initialStaff: staff,
  });
}

function valueFor(panel: Element, label: string): string | null {
  const term = Array.from(panel.querySelectorAll("dt")).find(
    (candidate) => candidate.textContent === label,
  );
  return term?.nextElementSibling?.textContent ?? null;
}

describe("ProjectWorkSection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mocks.fetchProjectStaffDirectory.mockReset().mockResolvedValue(staff);
  });

  afterEach(() => {
    while (mounted.length) mounted.pop()?.();
    document.body.innerHTML = "";
  });

  it("renders one V2 primary action with owner and due truth above open and blocked work", () => {
    const primary = workItem({
      title: "Review proposal progress",
      sourceType: "STAGE_REVIEW",
      sourceKey: "stage-review:sent:v1",
    });
    const other = workItem({
      id: "22222222-2222-4222-8222-222222222223",
      title: "Email the revised concept",
      responsibilityArea: "CUSTOMER",
      origin: "AUTOMATION",
      sourceType: "LEAD_CADENCE",
      sourceKey: "lead:follow-up:request-1:1",
      effectiveAssignee: { kind: "staff", userId: staff[0].userId },
    });
    const blocked = workItem({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Confirm engineering input",
      status: "BLOCKED",
      blockedReason: "Waiting for structural drawings.",
      responsibilityArea: "OPERATIONS",
      priority: "CRITICAL",
      priorityReason: "Engineering is required before pricing.",
    });
    const projectWork = projection({
      primaryAction: { kind: "workItem", item: primary, dueState: "today" },
      openItems: [primary, other],
      blockedItems: [blocked],
    });
    const rendered = renderV2(projectWork);

    expect(
      rendered.container.querySelectorAll(
        '[data-project-work-section="true"][data-project-work-model="v2"]',
      ),
    ).toHaveLength(1);
    const primaryPanel = rendered.container.querySelector(
      'section[data-tone="inverse"]',
    )!;
    expect(primaryPanel.textContent).toContain(primary.title);
    expect(primaryPanel.textContent).not.toContain(
      "work selected by the server",
    );
    expect(valueFor(primaryPanel, "Owner")).toBe("Jordan");
    expect(valueFor(primaryPanel, "Due")).toContain("30 Jul 2026");
    expect(
      Array.from(primaryPanel.querySelectorAll("button")).some(
        (button) => button.textContent === "Complete",
      ),
    ).toBe(true);
    expect(
      (
        rendered.container.textContent?.match(new RegExp(primary.title, "g")) ??
        []
      ).length,
    ).toBe(1);

    const list = rendered.container.querySelector(
      '[data-project-work-list="v2"]',
    )!;
    expect(list.textContent).toContain(other.title);
    expect(list.textContent).toContain("Sam Sales");
    expect(list.textContent).toContain(blocked.title);
    expect(list.textContent).not.toContain(primary.title);
    expect(rendered.container.textContent).toContain(
      "1 blocked project-work item",
    );
    expect(rendered.container.textContent).toContain(
      "Waiting for structural drawings.",
    );
  });

  it("renders a server-selected blocked item as an exception without an enabled primary action", () => {
    const blocked = workItem({
      status: "BLOCKED",
      blockedReason: "Waiting for structural drawings.",
      origin: "MANUAL",
      sourceType: "MANUAL",
    });
    const rendered = renderV2(
      projection({
        primaryAction: { kind: "workItem", item: blocked, dueState: "critical" },
        openItems: [],
        blockedItems: [blocked],
      }),
    );

    expect(rendered.container.textContent).toContain(
      "Blocked project work needs review",
    );
    expect(rendered.container.textContent).toContain(blocked.title);
    expect(rendered.container.textContent).toContain(
      "Waiting for structural drawings.",
    );
    expect(
      rendered.container.querySelector('section[data-tone="inverse"]'),
    ).toBeNull();
    expect(
      Array.from(rendered.container.querySelectorAll("button")).some((button) =>
        /^(?:Complete|Email sent|Customer replied)$/.test(
          button.textContent ?? "",
        ),
      ),
    ).toBe(false);
  });

  it("renders the server-owned specialist owner, expected result and permitted destination", () => {
    const rendered = renderV2(
      projection({
        primaryAction: {
          kind: "specialist",
          key: "design-review",
          title: "Review the current design",
          reason: "A design specialist needs to confirm the current concept.",
          owner: "Design specialist",
          expectedResult: "Concept approved for estimating",
          href: `/staff/projects/${PROJECT_ID}/design`,
        },
      }),
    );
    const primaryPanel = rendered.container.querySelector(
      'section[data-tone="inverse"]',
    )!;

    expect(valueFor(primaryPanel, "Owner")).toBe("Design specialist");
    expect(valueFor(primaryPanel, "Expected result")).toBe(
      "Concept approved for estimating",
    );
    expect(
      primaryPanel.querySelector<HTMLAnchorElement>("a")?.getAttribute("href"),
    ).toBe(`/staff/projects/${PROJECT_ID}/design`);
  });

  it("fails closed when V2 server work identifies a prohibited Call or Site Visit action", () => {
    const prohibitedPrimary = workItem({
      title: "Call the customer",
      sourceType: "MANUAL",
      sourceKey: null,
    });
    const prohibitedSecondary = workItem({
      id: "22222222-2222-4222-8222-222222222223",
      title: "Book Site Visit",
      sourceType: "MANUAL",
      sourceKey: null,
    });
    const allowedSecondary = workItem({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Review design details",
      sourceType: "MANUAL",
      sourceKey: null,
    });
    const rendered = renderV2(
      projection({
        primaryAction: {
          kind: "workItem",
          item: prohibitedPrimary,
          dueState: "today",
        },
        openItems: [prohibitedPrimary, prohibitedSecondary, allowedSecondary],
      }),
    );

    expect(rendered.container.textContent).toContain(
      "Legacy work needs review",
    );
    expect(rendered.container.textContent).toContain(
      "no browser replacement is chosen",
    );
    expect(rendered.container.textContent).not.toContain(
      prohibitedPrimary.title,
    );
    expect(rendered.container.textContent).not.toContain(
      prohibitedSecondary.title,
    );
    expect(rendered.container.textContent).toContain(allowedSecondary.title);
    expect(
      rendered.container.querySelector(
        'section[data-tone="inverse"], section[data-tone="critical"]',
      ),
    ).toBeNull();
    expect(
      Array.from(rendered.container.querySelectorAll("button")).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });

  it("links an active V2 site-visit project to the bounded booking workflow", () => {
    const rendered = renderV2(projection(), false, "site_visit");
    const manage = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Manage project work")!;

    act(() => manage.click());

    const bookingLink = Array.from(
      rendered.container.querySelectorAll<HTMLAnchorElement>("a"),
    ).find((link) => link.textContent === "Book or confirm site visit");
    expect(bookingLink?.getAttribute("href")).toBe(
      `/staff/schedule?view=site-visits&project=${PROJECT_ID}`,
    );
    expect(rendered.container.textContent).toContain(
      "Completion remains a separate manual fact.",
    );
  });

  it.each([
    {
      state: "Waiting",
      projectWork: projection({
        operationalState: "WAITING",
        effectiveState: "WAITING",
        waitingUntil: "2026-08-05T05:00:00.000Z",
        waitingReason: "Customer requested more time.",
        primaryAction: {
          kind: "stateReview",
          key: "waiting-review",
          title: "Review waiting project",
          reason: "The waiting period has ended.",
          dueAt: "2026-08-05T05:00:00.000Z",
        },
        openItems: [
          workItem({
            id: "44444444-4444-4444-8444-444444444444",
            title: "Hidden ordinary work",
          }),
        ],
        blockedItems: [
          workItem({
            id: "55555555-5555-4555-8555-555555555555",
            title: "Hidden blocked work",
            status: "BLOCKED",
            blockedReason: "Hidden blocker",
          }),
        ],
      }),
      detailLabel: "Waiting until",
      detailValue: "5 Aug 2026",
      waitingReason: "Customer requested more time.",
      notice: "Ordinary project work is paused",
      canChangeState: true,
    },
    {
      state: "Closed",
      projectWork: projection({
        operationalState: "CLOSED",
        effectiveState: "CLOSED",
        closedOutcome: "LOST_NO_RESPONSE",
        primaryAction: {
          kind: "none",
          title: "Project closed",
          reason: "Closed projects have no active work.",
        },
        openItems: [
          workItem({
            id: "44444444-4444-4444-8444-444444444444",
            title: "Hidden ordinary work",
          }),
        ],
        blockedItems: [
          workItem({
            id: "55555555-5555-4555-8555-555555555555",
            title: "Hidden blocked work",
            status: "BLOCKED",
            blockedReason: "Hidden blocker",
          }),
        ],
      }),
      detailLabel: "Outcome",
      detailValue: "lost no response",
      waitingReason: null,
      notice: "Closed project work is paused",
      canChangeState: true,
    },
    {
      state: "Archived",
      projectWork: projection({
        operationalState: "CLOSED",
        effectiveState: "ARCHIVED",
        closedOutcome: "COMPLETE",
        primaryAction: {
          kind: "none",
          title: "Project archived",
          reason: "Archived projects remain read-only.",
        },
        openItems: [
          workItem({
            id: "44444444-4444-4444-8444-444444444444",
            title: "Hidden ordinary work",
          }),
        ],
        blockedItems: [
          workItem({
            id: "55555555-5555-4555-8555-555555555555",
            title: "Hidden blocked work",
            status: "BLOCKED",
            blockedReason: "Hidden blocker",
          }),
        ],
      }),
      detailLabel: "Operational state",
      detailValue: "Archived",
      waitingReason: null,
      notice: "Archived project work is read-only",
      canChangeState: false,
    },
  ])(
    "renders $state from the server projection without deriving a replacement state",
    ({
      projectWork,
      detailLabel,
      detailValue,
      waitingReason,
      notice,
      canChangeState,
    }) => {
      const rendered = renderV2(projectWork);
      const stateGrid = rendered.container.querySelector(
        'dl[aria-label="Project work state"]',
      )!;

      expect(valueFor(stateGrid, detailLabel)).toContain(detailValue);
      if (waitingReason) {
        expect(valueFor(stateGrid, "Waiting reason")).toBe(waitingReason);
      }
      expect(valueFor(stateGrid, "Current work")).toBeNull();
      expect(rendered.container.textContent).toContain(notice);
      expect(rendered.container.textContent).not.toContain(
        "Hidden ordinary work",
      );
      expect(rendered.container.textContent).not.toContain(
        "Hidden blocked work",
      );
      expect(
        rendered.container.querySelector('[data-project-work-list="v2"]'),
      ).toBeNull();
      expect(
        rendered.container.querySelector(
          '[data-confirmation-correction-controls="true"]',
        ),
      ).toBeNull();

      const manage = Array.from(
        rendered.container.querySelectorAll("button"),
      ).find((button) => button.textContent === "Manage project work");
      if (canChangeState) {
        expect(manage).not.toBeUndefined();
        act(() => manage?.click());
        expect(rendered.container.textContent).toContain(
          "Change operational state",
        );
        expect(rendered.container.textContent).not.toContain(
          "Create manual work",
        );
      } else {
        expect(manage).toBeUndefined();
        expect(rendered.container.querySelectorAll("button")).toHaveLength(0);
      }
    },
  );

});
