import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../test/reactHarness";
import { ApiError } from "@/lib/repo/apiClient";

const useQueryMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock("./overview/ProjectOrientationBand", () => ({
  default: ({
    operationalState,
    freshness,
  }: {
    operationalState?: string;
    freshness?: { label: string };
  }) => (
    <section
      data-testid="mock-orientation"
      data-project-orientation="true"
      data-operational-state={operationalState}
      data-freshness={freshness?.label}
    >
      Project orientation
    </section>
  ),
}));

vi.mock("./overview/ProjectCurrentDesignCommercialCard", () => ({
  default: ({ data }: { data: { source: string } }) => (
    <section
      data-testid="mock-current-design"
      data-command-centre-source={data.source}
    >
      Current design
    </section>
  ),
}));

vi.mock("./overview/ProjectWorkSection", () => ({
  default: (props: {
    workModel: string;
    projectWork?: { generatedAt: string };
    stale?: boolean;
  }) => (
    <section
      data-testid="mock-project-work"
      data-project-work-section="true"
      data-project-work-model={props.workModel}
      data-generated-at={props.projectWork?.generatedAt}
      data-stale={
        props.stale === undefined ? "not-applicable" : String(props.stale)
      }
    >
      Project Work
    </section>
  ),
}));

vi.mock("./overview/ProjectRecentNotesEvents", () => ({
  default: ({ projectId }: { projectId: string }) => (
    <section
      data-testid="mock-recent"
      data-project-id={projectId}
      data-recent-notes-events="true"
    >
      Recent notes and events
    </section>
  ),
}));

import OverviewTab from "./OverviewTab";

const snapshot = {
  workModel: "v2",
  project: {
    id: "proj_1",
    name: "Test project",
    stage: "new",
    contactName: "Aroha Smith",
    contactEmail: "aroha@example.test",
    siteAddress: "1 Test Lane",
    quoteRef: "Q-0100",
  },
  pipeline: { stage: "new" },
  activity: [],
  emails: [],
  notes: [],
  projectWork: {
    projectId: "proj_1",
    modelVersion: 2,
    operationalState: "ACTIVE",
    effectiveState: "ACTIVE",
    waitingUntil: null,
    waitingReason: null,
    closedOutcome: null,
    stateRowVersion: 1,
    primaryAction: {
      kind: "needsTriage",
      title: "Needs triage",
      reason: "No current work",
    },
    openItems: [],
    blockedItems: [],
    confirmedFacts: [],
    generatedAt: "2026-07-29T01:00:00.000Z",
  },
} as any;

const v2Projection = {
  projectId: "proj_1",
  modelVersion: 2,
  operationalState: "ACTIVE",
  effectiveState: "ACTIVE",
  waitingUntil: null,
  waitingReason: null,
  closedOutcome: null,
  stateRowVersion: 1,
  primaryAction: {
    kind: "needsTriage",
    title: "Needs triage",
    reason: "No current work",
  },
  openItems: [],
  blockedItems: [],
  confirmedFacts: [],
  generatedAt: "2026-07-29T01:00:00.000Z",
};

function queryState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

async function settleLazyComponents() {
  await act(async () => {
    await Promise.all([
      import("./overview/ProjectCurrentDesignCommercialCard"),
      import("./overview/ProjectOrientationBand"),
      import("./overview/ProjectRecentNotesEvents"),
      import("./overview/ProjectWorkSection"),
    ]);
    await Promise.resolve();
  });
}

describe("OverviewTab", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    useQueryMock.mockReset();
    invalidateQueriesMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("composes one V2 Project Work surface with orientation, commercial facts and recent history", async () => {
    useQueryMock.mockReturnValue(
      queryState({
        data: {
          workModel: "v2",
          currentDesign: { source: "estimate" },
          projectWork: v2Projection,
          owner: {},
          generatedAt: "2026-07-30T00:00:00.000Z",
        },
      }),
    );
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady
        snapshotState="fresh"
        host="host"
      />,
    );
    await settleLazyComponents();

    expect(
      rendered.container.querySelector('[data-project-overview-layout="true"]'),
    ).not.toBeNull();
    expect(
      rendered.container
        .querySelector('[data-testid="mock-orientation"]')
        ?.getAttribute("data-freshness"),
    ).toBe("Current");
    expect(
      rendered.container
        .querySelector('[data-testid="mock-current-design"]')
        ?.getAttribute("data-command-centre-source"),
    ).toBe("estimate");
    expect(
      rendered.container.querySelectorAll('[data-project-work-section="true"]'),
    ).toHaveLength(1);
    expect(
      rendered.container
        .querySelector('[data-testid="mock-project-work"]')
        ?.getAttribute("data-project-work-model"),
    ).toBe("v2");
    expect(
      rendered.container.querySelector('[data-testid="mock-recent"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector("[data-stage3-workstreams-slot]"),
    ).toBeNull();
    expect(rendered.container.textContent).not.toContain("Tasks");
    rendered.unmount();
  });

  it("uses one command-centre V2 projection for both the primary and secondary work presentation", async () => {
    const v2Snapshot = {
      ...snapshot,
      workModel: "v2",
      projectWork: {
        ...v2Projection,
        generatedAt: "2026-07-29T00:00:00.000Z",
      },
    };
    useQueryMock.mockReturnValue(
      queryState({
        data: {
          workModel: "v2",
          currentDesign: { source: "draft_quote" },
          projectWork: v2Projection,
          owner: {},
          generatedAt: "2026-07-29T01:00:00.000Z",
        },
      }),
    );

    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={v2Snapshot as any}
        snapshotContentReady
        snapshotState="fresh"
        host="host"
      />,
    );
    await settleLazyComponents();

    const work = rendered.container.querySelector(
      '[data-testid="mock-project-work"]',
    );
    expect(
      rendered.container.querySelectorAll('[data-project-work-section="true"]'),
    ).toHaveLength(1);
    expect(work?.getAttribute("data-generated-at")).toBe(
      "2026-07-29T01:00:00.000Z",
    );
    expect(work?.getAttribute("data-stale")).toBe("false");
    expect(
      rendered.container
        .querySelector('[data-testid="mock-orientation"]')
        ?.getAttribute("data-operational-state"),
    ).toBe("ACTIVE");
    rendered.unmount();
  });

  it("keeps pending and summary states truthful without inventing work or commercial facts", async () => {
    useQueryMock.mockReturnValue(queryState({ isPending: true }));
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady={false}
        snapshotState="summary"
        host="host"
      />,
    );
    await settleLazyComponents();

    expect(
      rendered.container.querySelector('[data-command-centre-state="pending"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).not.toContain(
      "Loading the complete project",
    );
    expect(
      rendered.container.querySelector('[data-project-work-model="pending"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Updating recent history");
    expect(rendered.container.textContent).not.toContain("No current design");
    expect(
      rendered.container.querySelector('[data-testid="mock-recent"]'),
    ).toBeNull();
    rendered.unmount();
  });

  it("retains cached facts and pauses Project Work after a refresh failure", async () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue(
      queryState({
        data: {
          workModel: "v2",
          currentDesign: { source: "sent_quote" },
          projectWork: v2Projection,
          owner: {},
          generatedAt: "2026-07-30T00:00:00.000Z",
        },
        error: new Error("offline"),
        isError: true,
        refetch,
      }),
    );
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady
        snapshotState="fresh"
        host="host"
      />,
    );
    await settleLazyComponents();

    expect(
      rendered.container.querySelector('[data-command-centre-state="stale"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="mock-current-design"]'),
    ).not.toBeNull();
    expect(
      rendered.container
        .querySelector('[data-testid="mock-project-work"]')
        ?.getAttribute("data-stale"),
    ).toBe("true");
    expect(
      rendered.container
        .querySelector('[data-testid="mock-orientation"]')
        ?.getAttribute("data-freshness"),
    ).toBe("Saved view");
    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Retry")
        ?.click();
    });
    expect(refetch).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it("keeps cached facts visible but makes Project Work read-only during refresh", async () => {
    useQueryMock.mockReturnValue(
      queryState({
        data: {
          workModel: "v2",
          currentDesign: { source: "draft_quote" },
          projectWork: v2Projection,
          owner: {},
          generatedAt: "2026-07-30T00:00:00.000Z",
        },
        isFetching: true,
      }),
    );
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={
          { ...snapshot, workModel: "v2", projectWork: v2Projection } as any
        }
        snapshotContentReady
        snapshotState="fresh"
        host="host"
      />,
    );
    await settleLazyComponents();

    expect(
      rendered.container.querySelector(
        '[data-command-centre-state="refreshing"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="mock-current-design"]'),
    ).not.toBeNull();
    expect(
      rendered.container
        .querySelector('[data-testid="mock-project-work"]')
        ?.getAttribute("data-stale"),
    ).toBe("true");
    expect(
      rendered.container
        .querySelector('[data-testid="mock-orientation"]')
        ?.getAttribute("data-freshness"),
    ).toBe("Refreshing");
    rendered.unmount();
  });

  it("shows one read-only work region when snapshot and command-centre models disagree", async () => {
    useQueryMock.mockReturnValue(
      queryState({
        data: {
          workModel: "legacy",
          currentDesign: { source: "draft_quote" },
          legacyWork: { status: "retired" },
          owner: {},
          generatedAt: "2026-07-30T00:00:00.000Z",
        },
      }),
    );
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady
        snapshotState="fresh"
        host="host"
      />,
    );
    await settleLazyComponents();

    expect(
      rendered.container.querySelector(
        '[data-command-centre-state="model-mismatch"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Project Work is paused");
    expect(
      rendered.container.querySelectorAll('[data-project-work-section="true"]'),
    ).toHaveLength(1);
    expect(
      rendered.container.querySelector('[data-project-work-model="mismatch"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="mock-project-work"]'),
    ).toBeNull();
    rendered.unmount();
  });

  it("shows retryable initial failures without empty-state fallbacks", async () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue(
      queryState({
        error: new Error("offline"),
        isError: true,
        refetch,
      }),
    );
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady
        snapshotState="fresh"
        host="host"
      />,
    );
    await settleLazyComponents();

    expect(
      rendered.container.querySelector('[data-command-centre-state="failed"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain(
      "Could not load Project Work",
    );
    expect(rendered.container.textContent).toContain(
      "No commercial fallback has been selected",
    );
    expect(rendered.container.textContent).not.toContain("No current design");
    act(() => {
      (rendered.container.querySelector("button") as HTMLButtonElement).click();
    });
    expect(refetch).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it("reports access-ending errors and never renders cached command-centre facts", async () => {
    const onAccessEnding = vi.fn();
    useQueryMock.mockReturnValue(
      queryState({
        data: {
          workModel: "v2",
          currentDesign: { source: "accepted_quote" },
          projectWork: v2Projection,
          owner: {},
          generatedAt: "2026-07-30T00:00:00.000Z",
        },
        error: new ApiError("Forbidden", { status: 403, body: null }),
        isError: true,
      }),
    );
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady
        snapshotState="fresh"
        host="host"
        onAccessEnding={onAccessEnding}
      />,
    );
    await settleLazyComponents();

    expect(onAccessEnding).toHaveBeenCalledWith(403);
    expect(
      rendered.container.querySelector(
        '[data-command-centre-state="unavailable"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="mock-current-design"]'),
    ).toBeNull();
    expect(rendered.container.textContent).toContain(
      "Project access unavailable",
    );
    rendered.unmount();
  });

  it("pauses Project Work when only a summary snapshot is available", async () => {
    useQueryMock.mockReturnValue(
      queryState({
        data: {
          workModel: "v2",
          currentDesign: { source: "estimate" },
          projectWork: v2Projection,
          owner: {},
          generatedAt: "2026-07-30T00:00:00.000Z",
        },
      }),
    );
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady={false}
        snapshotState="summary"
        host="host"
      />,
    );
    await settleLazyComponents();

    expect(
      rendered.container
        .querySelector('[data-testid="mock-project-work"]')
        ?.getAttribute("data-stale"),
    ).toBe("true");
    expect(rendered.container.textContent).toContain("Updating recent history");
    expect(rendered.container.textContent).not.toContain(
      "Project Work controls and recent history remain paused",
    );
    rendered.unmount();
  });
});
