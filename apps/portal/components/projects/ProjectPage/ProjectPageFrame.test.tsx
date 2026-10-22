import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import Frame from "./ProjectPageFrame";
import ProjectSnapshotNotice from './ProjectSnapshotNotice';
import { useProjectTabSelection } from "./useProjectTabSelection";
import type { ComponentProps } from "react";
function ProjectPageFrame(props: Omit<ComponentProps<typeof Frame>, 'optimisticTab' | 'onTabSelect'>) {
  const navigation = useProjectTabSelection(props.projectId ?? props.snapshot?.project.id ?? "", props.tab, Boolean(props.snapshot?.project.hasJobPacks));
  return <Frame {...props} optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab} />;
}

let mockSearchParams = "tab=activity";

vi.mock("@/components/navigation/ProjectsIndexLink", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

vi.mock("@/components/auth/PortalAuthProvider", () => ({
  usePortalSession: () => ({ role: "admin" }),
}));

vi.mock("@/components/ui/toast/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/repo/projectsRepo", () => ({ deleteProject: vi.fn() }));

vi.mock("./ProjectTabNavigation", () => ({
  default: ({ initialTab, optimisticTab, onTabSelect, tabAvailabilityReady }: any) => (
    <nav
      data-testid="header-tabs"
      data-tab={initialTab}
      data-optimistic-tab={optimisticTab ?? ""}
      data-availability-ready={String(tabAvailabilityReady)}
    >
      <button type="button" onClick={() => onTabSelect?.("job-packs")}>
        Job Packs
      </button>
    </nav>
  ),
}));

vi.mock("./ProjectPageShell", () => ({
  default: ({ optimisticTab, calculatorWorkspace, statusPanel }: any) => (
    <section
      data-testid="mock-project-shell"
      data-optimistic-tab={optimisticTab ?? ""}
      data-calculator-workspace={String(Boolean(calculatorWorkspace))}
    >
      {statusPanel}Shell
    </section>
  ),
}));

vi.mock("./ProjectHeaderOwnerControl", () => ({
  default: ({ project, externallyPaused }: any) => (
    <span data-project-owner={project.owner?.key ?? "unassigned"} data-owner-paused={String(externallyPaused)}>
      <strong>Owner</strong>
      <span>{project.owner?.displayName ?? "Unassigned"}</span>
    </span>
  ),
}));

const snapshot = {
  workModel: "legacy",
  project: {
    id: "proj_123",
    name: "Test project",
    stage: "new",
    contactName: "Alex",
    region: "North",
    owner: { key: "jordan", displayName: "Jordan" },
  },
  pipeline: { stage: "new" },
  activity: [],
  emails: [],
  notes: [],
} as any;

describe("ProjectPageFrame", () => {
  it('keeps the focused masthead before changing refresh notices and preserves Retry', () => {
    const retry = vi.fn();
    const frame = (state: 'summary' | 'refresh-failed' | 'fresh') => <ProjectPageFrame
      snapshot={snapshot} host="host" tab="estimates" snapshotState={state} snapshotContentReady={state === 'fresh'}
      statusPanel={<ProjectSnapshotNotice state={state} onRetry={retry} />} />;
    const rendered = renderIntoDocument(frame('summary'));
    const masthead = rendered.container.querySelector('[data-project-masthead-slot]')!;
    const returnLink = Array.from(masthead.querySelectorAll('a')).find(link => link.textContent === 'Projects')!;
    act(() => returnLink.focus());
    for (const state of ['summary', 'refresh-failed', 'summary', 'fresh'] as const) {
      rendered.rerender(frame(state));
      expect(rendered.container.querySelector('[data-project-page-frame]')?.firstElementChild).toBe(masthead);
      expect(document.activeElement).toBe(returnLink);
      expect(returnLink.getAttribute('href')).toBe('/staff/projects');
      expect(rendered.container.querySelector('[data-owner-paused]')?.getAttribute('data-owner-paused')).toBe(String(state !== 'fresh'));
      if (state === 'refresh-failed') {
        const button = Array.from(rendered.container.querySelectorAll('button')).find(node => node.textContent === 'Retry')!;
        expect(masthead.contains(button)).toBe(false);
        act(() => button.click());
        expect(retry).toHaveBeenCalledTimes(1);
      }
    }
    expect(rendered.container.textContent).not.toContain('Updating project');
    expect(rendered.container.textContent).not.toContain('Showing saved project details');
    rendered.unmount();
  });

  it.each(['activity', 'estimates', 'quotes', 'invoices'])('shows closure rather than historic Scheduled on %s', (tab) => {
    const rendered = renderIntoDocument(
      <ProjectPageFrame snapshot={{
        ...snapshot, workModel: 'v2', project: { ...snapshot.project, stage: 'scheduled' },
        projectWork: { projectId: snapshot.project.id, effectiveState: 'CLOSED', closedOutcome: 'CANCELLED' },
      }} host="host" tab={tab} />,
    );
    expect(rendered.container.querySelector('[data-project-current-status]')?.textContent).toBe('Closed · Cancelled');
    expect(rendered.container.querySelector('[data-stage="scheduled"]')).toBeNull();
    rendered.unmount();
  });

  it('never flashes a pipeline stage while operational state is unknown, and retains known closure after a failed refresh', () => {
    const summary = { ...snapshot, workModel: 'v2', project: { ...snapshot.project, stage: 'scheduled' } };
    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={summary} host="host" tab="estimates" snapshotState="summary" />);
    expect(rendered.container.textContent).toContain('Updating status…');
    expect(rendered.container.textContent).not.toContain('Scheduled');
    rendered.rerender(<ProjectPageFrame snapshot={summary} host="host" tab="estimates" snapshotState="refresh-failed" />);
    expect(rendered.container.textContent).toContain('Status unavailable');
    rendered.rerender(<ProjectPageFrame snapshot={{
      ...summary, projectWork: { projectId: snapshot.project.id, effectiveState: 'CLOSED', closedOutcome: 'CANCELLED' },
    }} host="host" tab="estimates" snapshotState="refresh-failed" />);
    expect(rendered.container.querySelector('[data-project-current-status]')?.textContent).toBe('Closed · Cancelled');
    expect(rendered.container.querySelector('[data-project-current-status]')?.getAttribute('title')).toContain('Last known');
    rendered.unmount();
  });
  it('does not treat the legacy marker in a list-derived placeholder as verified operational state', () => {
    const placeholder = { ...snapshot, project: { ...snapshot.project, stage: 'scheduled' } };
    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={placeholder} host="host" tab="estimates" snapshotContentReady={false} snapshotState="summary" />);
    expect(rendered.container.textContent).toContain('Updating status…');
    expect(rendered.container.textContent).not.toContain('Scheduled');
    rendered.rerender(<ProjectPageFrame snapshot={placeholder} host="host" tab="estimates" snapshotContentReady={false} snapshotState="refresh-failed" />);
    expect(rendered.container.textContent).toContain('Status unavailable');
    rendered.unmount();
  });
  it("keeps summary-only tab availability unresolved", () => {
    const rendered = renderIntoDocument(
      <ProjectPageFrame snapshot={snapshot} host="host" tab="job-packs" snapshotContentReady={false} snapshotState="summary" />,
    );
    expect(rendered.container.querySelector('[data-testid="header-tabs"]')?.getAttribute('data-availability-ready')).toBe('false');
    rendered.unmount();
  });
  afterEach(() => {
    mockSearchParams = "tab=activity";
    act(() => window.history.replaceState(null, "", "/"));
    document.body.innerHTML = "";
  });

  it("uses one fixed two-row header with identity, stage, commands, and tab navigation", () => {
    const rendered = renderIntoDocument(
      <ProjectPageFrame snapshot={snapshot} host="host" tab="estimates" />,
    );

    expect(
      rendered.container.querySelector('[data-project-masthead-slot="fixed"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-project-masthead-slot-sticky="true"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Test project");
    expect(rendered.container.textContent).toContain("New");
    expect(rendered.container.textContent).toContain("Jordan");
    expect(rendered.container.textContent).not.toContain("proj_123");
    expect(rendered.container.textContent).toContain("Alex · North");
    expect(rendered.container.textContent).toContain("Projects");
    expect(rendered.container.textContent).toContain("Design Workbench");
    expect(rendered.container.textContent).toContain("More");
    expect(rendered.container.textContent).not.toContain("Delete project");
    expect(
      rendered.container
        .querySelector('[data-testid="header-tabs"]')
        ?.getAttribute("data-tab"),
    ).toBe("estimates");
    expect(
      rendered.container.querySelector('[data-testid="mock-project-shell"]'),
    ).not.toBeNull();
    expect(rendered.container.querySelector('[role="separator"]')).toBeNull();
    expect(
      rendered.container.querySelector("[data-project-pipeline]"),
    ).toBeNull();
    expect(
      rendered.container.querySelectorAll("[data-project-header-row]"),
    ).toHaveLength(2);
    expect(
      rendered.container.querySelector(
        '[data-project-header-row="command"] [data-stage="new"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-project-header-row="tabs"] [data-testid="header-tabs"]',
      ),
    ).not.toBeNull();

    rendered.unmount();
  });

  it("opens and dismisses the accessible project actions menu with the keyboard", () => {
    const rendered = renderIntoDocument(
      <ProjectPageFrame snapshot={snapshot} host="host" tab="estimates" />,
    );
    const moreButton = Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent === "More");
    expect(moreButton?.getAttribute("aria-haspopup")).toBe("menu");

    act(() => moreButton?.click());
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu?.parentElement).toBe(document.body);
    expect(rendered.container.contains(menu)).toBe(false);
    expect(menu?.getAttribute("aria-label")).toBe("Project actions");
    expect(menu?.textContent).toContain("Delete project");

    act(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(moreButton);

    rendered.unmount();
  });

  it("shares optimistic tab intent between the masthead and body", () => {
    const rendered = renderIntoDocument(
      <ProjectPageFrame snapshot={snapshot} host="host" tab="activity" />,
    );
    const jobPacks = Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent === "Job Packs");

    act(() => jobPacks?.click());

    expect(
      rendered.container
        .querySelector('[data-testid="header-tabs"]')
        ?.getAttribute("data-optimistic-tab"),
    ).toBe("job-packs");
    expect(
      rendered.container
        .querySelector('[data-testid="mock-project-shell"]')
        ?.getAttribute("data-optimistic-tab"),
    ).toBe("job-packs");
    rendered.unmount();
  });

  it("clears optimistic tab intent when Back or Forward selects a different URL tab", () => {
    const rendered = renderIntoDocument(
      <ProjectPageFrame snapshot={snapshot} host="host" tab="activity" />,
    );
    const jobPacks = Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent === "Job Packs");

    act(() => jobPacks?.click());
    expect(
      rendered.container
        .querySelector('[data-testid="mock-project-shell"]')
        ?.getAttribute("data-optimistic-tab"),
    ).toBe("job-packs");

    mockSearchParams = "tab=estimates";
    act(() => window.history.replaceState(null, "", "/staff/projects/proj_123?tab=estimates"));
    rendered.rerender(
      <ProjectPageFrame snapshot={snapshot} host="host" tab="activity" />,
    );
    expect(
      rendered.container
        .querySelector('[data-testid="mock-project-shell"]')
        ?.getAttribute("data-optimistic-tab"),
    ).toBe("");
    rendered.unmount();
  });

  it("replaces the project masthead with the focused calculator workspace", () => {
    const rendered = renderIntoDocument(
      <ProjectPageFrame snapshot={snapshot} host="host" tab="estimates" calculatorWorkspace />,
    );

    expect(rendered.container.querySelector('[data-project-calculator-workspace="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-masthead-slot="fixed"]')).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="mock-project-shell"]')?.getAttribute('data-calculator-workspace'),
    ).toBe('true');
    expect(rendered.container.textContent).not.toContain('Test project');
    rendered.unmount();
  });
});
