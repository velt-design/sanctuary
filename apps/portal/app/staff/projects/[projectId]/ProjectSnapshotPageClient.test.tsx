import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../test/reactHarness";
import { ApiError } from "@/lib/repo/apiClient";
import ProjectSnapshotPageClient from "./ProjectSnapshotPageClient";

const useQueryMock = vi.fn();
const placeholderMock = vi.fn();
const refetchMock = vi.fn();
const removeQueriesMock = vi.fn();

vi.mock("@/components/navigation/ProjectsIndexLink", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useQueryClient: () => ({
      getQueryData: vi.fn(),
      removeQueries: removeQueriesMock,
    }),
  };
});

vi.mock("@/lib/queries/projectCache", () => ({
  getProjectSnapshotPlaceholderFromCaches: (...args: unknown[]) =>
    placeholderMock(...args),
}));

vi.mock("@/lib/supabase/browserClient", () => ({
  supabaseHostFromUrl: () => "host",
  supabaseRuntimeUrl: () => "https://host.supabase.co",
}));

vi.mock("@/components/projects/ProjectPage/ProjectPageFrame", () => ({
  default: ({
    snapshot,
    snapshotContentReady,
    snapshotState,
    onProjectAccessEnding,
  }: any) => (
    <div
      data-testid="project-frame"
      data-content-ready={String(snapshotContentReady)}
      data-snapshot-state={snapshotState}
    >
      {snapshot.project.name}
      {[401, 403, 404].map((status) => (
        <button
          key={status}
          type="button"
          data-testid={
            status === 403
              ? "command-access-ending"
              : `command-access-ending-${status}`
          }
          onClick={() => onProjectAccessEnding?.(status)}
        >
          End command access {status}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/debug/PortalDebugExportButton", () => ({
  default: () => <button data-testid="debug-export">Debug export</button>,
}));

const fullSnapshot = {
  project: { id: "proj_1", name: "Fresh Project", stage: "lead" },
  pipeline: { stage: "lead" },
  activity: [],
  emails: [],
  notes: [],
} as any;

const summaryResponse = {
  snapshot: {
    ...fullSnapshot,
    project: { ...fullSnapshot.project, name: "Cached Project" },
  },
  generatedAt: "2026-07-19T00:00:00.000Z",
};

type QueryState = {
  data?: any;
  error: unknown;
  isPlaceholderData: boolean;
  refetch: typeof refetchMock;
};

const pendingQuery = (): QueryState => ({
  data: undefined,
  error: null,
  isPlaceholderData: false,
  refetch: refetchMock,
});

function mockProjectQueries({
  snapshot,
  summary = pendingQuery(),
}: {
  snapshot: QueryState;
  summary?: QueryState;
}) {
  useQueryMock.mockImplementation(
    (options: { queryKey?: readonly unknown[] }) =>
      options.queryKey?.[2] === "summary" ? summary : snapshot,
  );
}

function renderClient(projectId = "proj_1") {
  return renderIntoDocument(
    <ProjectSnapshotPageClient
      projectId={projectId}
      tab="estimates"
      estimateId={null}
      debugExportEnabled
    />,
  );
}

describe("ProjectSnapshotPageClient", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    placeholderMock.mockReset();
    refetchMock.mockReset();
    removeQueriesMock.mockReset();
    placeholderMock.mockReturnValue(summaryResponse);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens immediately from the cached project summary while fresh data loads", () => {
    mockProjectQueries({
      snapshot: {
        data: summaryResponse,
        error: null,
        isPlaceholderData: true,
        refetch: refetchMock,
      },
    });

    const rendered = renderClient();

    expect(
      rendered.container.querySelector('[data-project-shell-ready="true"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-project-snapshot-state="summary"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Cached Project");
    expect(rendered.container.textContent).toContain("Updating project");
    expect(rendered.container.textContent).toContain(
      "Loading the latest Project Work, commercial state, notes and events.",
    );
    expect(rendered.container.textContent).not.toContain(
      "Loading the complete project",
    );
    expect(
      rendered.container.querySelector('[data-content-ready="false"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="debug-export"]'),
    ).toBeNull();

    rendered.unmount();
  });

  it("marks the background work complete only for a full snapshot", () => {
    mockProjectQueries({
      snapshot: {
        data: {
          snapshot: fullSnapshot,
          generatedAt: "2026-07-19T00:00:01.000Z",
        },
        error: null,
        isPlaceholderData: false,
        refetch: refetchMock,
      },
    });

    const rendered = renderClient();

    expect(
      rendered.container.querySelector(
        '[data-project-background-ready="true"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-content-ready="true"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="debug-export"]'),
    ).not.toBeNull();

    rendered.unmount();
  });

  it("keeps known summary data visible after a refresh failure and offers retry", () => {
    mockProjectQueries({
      snapshot: {
        data: summaryResponse,
        error: new ApiError("Failed", { status: 500, body: null }),
        isPlaceholderData: true,
        refetch: refetchMock,
      },
    });

    const rendered = renderClient();
    const retry = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent?.trim() === "Retry");

    expect(
      rendered.container.querySelector(
        '[data-project-snapshot-state="refresh-failed"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Cached Project");
    act(() => retry?.click());
    expect(refetchMock).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it("keeps the cached summary visible when the browser is offline", () => {
    mockProjectQueries({
      snapshot: {
        data: summaryResponse,
        error: new TypeError("Failed to fetch"),
        isPlaceholderData: true,
        refetch: refetchMock,
      },
    });

    const rendered = renderClient();

    expect(
      rendered.container.querySelector(
        '[data-project-snapshot-state="refresh-failed"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Cached Project");
    expect(rendered.container.textContent).toContain("last known details");

    rendered.unmount();
  });

  it.each([401, 403, 404])(
    "hides cached project data after an access-ending %s response",
    (status) => {
      mockProjectQueries({
        snapshot: {
          data: summaryResponse,
          error: new ApiError("Unavailable", { status, body: null }),
          isPlaceholderData: true,
          refetch: refetchMock,
        },
      });

      const rendered = renderClient();

      expect(
        rendered.container.querySelector(
          '[data-project-snapshot-state="unavailable"]',
        ),
      ).not.toBeNull();
      expect(rendered.container.textContent).not.toContain("Cached Project");
      expect(
        rendered.container.querySelector('[data-testid="debug-export"]'),
      ).toBeNull();

      rendered.unmount();
    },
  );

  it.each([401, 403, 404])(
    "clears protected data and caches when command-centre access ends with %s",
    (status) => {
      mockProjectQueries({
        snapshot: {
          data: {
            snapshot: fullSnapshot,
            generatedAt: "2026-07-19T00:00:01.000Z",
          },
          error: null,
          isPlaceholderData: false,
          refetch: refetchMock,
        },
      });
      const rendered = renderClient();
      act(() => {
        (
          rendered.container.querySelector(
            `[data-testid="${
              status === 403
                ? "command-access-ending"
                : `command-access-ending-${status}`
            }"]`,
          ) as HTMLButtonElement
        ).click();
      });
      expect(
        rendered.container.querySelector(
          '[data-project-snapshot-state="unavailable"]',
        ),
      ).not.toBeNull();
      expect(rendered.container.textContent).not.toContain("Fresh Project");
      for (const family of [
        "projects",
        "estimates",
        "quotes",
        "invoices",
        "jobPacks",
      ]) {
        expect(removeQueriesMock).toHaveBeenCalledWith({
          queryKey: [family, "host"],
        });
      }
      rendered.unmount();
    },
  );

  it("scopes a command-centre access-ending state to the affected project", () => {
    mockProjectQueries({
      snapshot: {
        data: {
          snapshot: fullSnapshot,
          generatedAt: "2026-07-19T00:00:01.000Z",
        },
        error: null,
        isPlaceholderData: false,
        refetch: refetchMock,
      },
    });
    const rendered = renderClient();
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="command-access-ending"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      rendered.container.querySelector(
        '[data-project-snapshot-state="unavailable"]',
      ),
    ).not.toBeNull();

    rendered.rerender(
      <ProjectSnapshotPageClient
        projectId="proj_2"
        tab="estimates"
        estimateId={null}
        debugExportEnabled
      />,
    );
    expect(
      rendered.container.querySelector('[data-project-snapshot-state="fresh"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Fresh Project");
    rendered.unmount();
  });

  it("uses a non-blocking pending shell for a direct link without cache", () => {
    placeholderMock.mockReturnValue(undefined);
    mockProjectQueries({ snapshot: pendingQuery() });

    const rendered = renderClient();

    expect(
      rendered.container.querySelector(
        '[data-project-snapshot-state="pending"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Opening project");
    expect(rendered.container.textContent).not.toContain("Project unavailable");

    rendered.unmount();
  });

  it("promotes an authenticated direct-link summary while the full snapshot continues", () => {
    placeholderMock.mockReturnValue(undefined);
    mockProjectQueries({
      summary: {
        data: summaryResponse,
        error: null,
        isPlaceholderData: false,
        refetch: refetchMock,
      },
      snapshot: pendingQuery(),
    });

    const rendered = renderClient();

    expect(
      rendered.container.querySelector('[data-project-shell-ready="true"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-project-snapshot-state="summary"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Cached Project");
    expect(
      rendered.container.querySelector('[data-content-ready="false"]'),
    ).not.toBeNull();

    rendered.unmount();
  });

  it.each([401, 403, 404])(
    "hides direct-link summary data after a summary access-ending %s",
    (status) => {
      placeholderMock.mockReturnValue(undefined);
      mockProjectQueries({
        summary: {
          data: undefined,
          error: new ApiError("Unavailable", { status, body: null }),
          isPlaceholderData: false,
          refetch: refetchMock,
        },
        snapshot: pendingQuery(),
      });

      const rendered = renderClient();

      expect(
        rendered.container.querySelector(
          '[data-project-snapshot-state="unavailable"]',
        ),
      ).not.toBeNull();
      expect(rendered.container.textContent).not.toContain("Cached Project");

      rendered.unmount();
    },
  );
});
