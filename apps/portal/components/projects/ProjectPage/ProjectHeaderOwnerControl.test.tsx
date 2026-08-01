import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  commandCentreFixtures,
  commandCentreWorkFixtures,
} from "@/app/qa/project-command-centre-fixture/fixtures";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import ProjectHeaderOwnerControl from "./ProjectHeaderOwnerControl";

const fetchProjectCommandCentre = vi.fn();
const setProjectCommandOwner = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const useQueryMock = vi.fn();
const invalidateQueries = vi.fn();
const patchProjectCommandCentreCache = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useQueryClient: () => ({
    invalidateQueries,
  }),
}));

vi.mock("@/lib/queries/projectWorkCache", () => ({
  invalidateProjectWorkReads: vi.fn(async () => undefined),
  patchProjectCommandCentreCache: (...args: unknown[]) =>
    patchProjectCommandCentreCache(...args),
}));

vi.mock("@/lib/projects/commandCentre/client", () => ({
  fetchProjectCommandCentre: (...args: unknown[]) =>
    fetchProjectCommandCentre(...args),
  setProjectCommandOwner: (...args: unknown[]) =>
    setProjectCommandOwner(...args),
}));

vi.mock("@/components/ui/toast/ToastProvider", () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}));

vi.mock("@/components/ui/PipelineModal", () => ({
  PipelineModal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        {children}
      </section>
    ) : null,
}));

const project = {
  id: "proj_fixture",
  name: "Fixture project",
  stage: "new",
  contactName: "Aroha Smith",
  owner: { key: "jordan", displayName: "Jordan" },
} as any;

function response(
  owner: {
    key: "ellen" | "jordan" | "jp" | "joe" | "bruce" | "dave";
    displayName: string;
  } | null,
) {
  const fixture = commandCentreWorkFixtures["v2-primary"];
  if (fixture.workModel !== "v2") throw new Error("Expected V2 fixture");
  return {
    projectId: project.id,
    workModel: "v2" as const,
    projectWork: fixture.projectWork,
    currentDesign: commandCentreFixtures["standard-estimate"],
    generatedAt: "2026-07-30T00:00:00.000Z",
    owner: {
      owner,
      required: true,
      missing: owner === null,
      version: "owner-v1",
      permissions: { canManage: true },
    },
  };
}

function renderOwnerControl(
  data: ReturnType<typeof response>,
  {
    expectedWorkModel = "v2",
    externallyPaused = false,
    isError = false,
    isFetching = false,
  }: {
    expectedWorkModel?: "legacy" | "v2";
    externallyPaused?: boolean;
    isError?: boolean;
    isFetching?: boolean;
  } = {},
) {
  useQueryMock.mockReturnValue({
    data,
    isFetching,
    isError,
    refetch: vi.fn(),
  });
  return renderIntoDocument(
    <ProjectHeaderOwnerControl
      project={project}
      host="fixture"
      active
      expectedWorkModel={expectedWorkModel}
      externallyPaused={externallyPaused}
    />,
  );
}

describe("ProjectHeaderOwnerControl", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    fetchProjectCommandCentre.mockReset();
    setProjectCommandOwner.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    useQueryMock.mockReset();
    patchProjectCommandCentreCache.mockReset();
    invalidateQueries.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses the server owner summary, including an explicit unassigned state", () => {
    const rendered = renderOwnerControl(response(null));

    expect(rendered.container.innerHTML).toContain("Unassigned");
    const control = rendered.container.querySelector(
      '[data-project-owner="unassigned"]',
    );
    expect(control?.textContent).toContain("Unassigned");
    expect(control?.textContent).not.toContain("Jordan");

    rendered.unmount();
  });

  it("keeps Enquiry ownership with Ellen and explains the manual Proposal handoff", () => {
    const rendered = renderOwnerControl(
      response({ key: "ellen", displayName: "Ellen" }),
    );

    act(() => {
      rendered.container
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Manage project owner"]',
        )
        ?.click();
    });

    expect(rendered.container.textContent).toContain(
      "Ellen owns every Enquiry project",
    );
    const options = Array.from(rendered.container.querySelectorAll("option"));
    expect(options.find((option) => option.value === "ellen")?.disabled).toBe(
      false,
    );
    expect(options.find((option) => option.value === "dave")?.disabled).toBe(
      true,
    );

    rendered.unmount();
  });

  it("observes the shared query without fetching and suppresses management while reads disagree", () => {
    const rendered = renderOwnerControl(
      response({
        key: "jp",
        displayName: "JP",
      }),
      { expectedWorkModel: "legacy" },
    );

    expect(useQueryMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ enabled: false }),
    );
    expect(
      rendered.container.querySelector(
        'button[aria-label^="Manage project owner"]',
      ),
    ).toBeNull();
    expect(rendered.container.textContent).toContain("Jordan");
    expect(rendered.container.textContent).not.toContain("JP");

    rendered.unmount();
  });

  it.each([
    { label: "snapshot summary", options: { externallyPaused: true } },
    { label: "command refresh", options: { isFetching: true } },
    { label: "command error", options: { isError: true } },
  ])("suppresses owner mutation during $label", ({ options }) => {
    const rendered = renderOwnerControl(
      response({
        key: "jordan",
        displayName: "Jordan",
      }),
      options,
    );

    expect(
      rendered.container.querySelector(
        'button[aria-label^="Manage project owner"]',
      ),
    ).toBeNull();
    expect(rendered.container.querySelector("select")).toBeNull();

    rendered.unmount();
  });

  it("does not report owner success without a committed server response", async () => {
    setProjectCommandOwner.mockResolvedValue({
      command: {
        id: "command-owner",
        committed: false,
      },
    });
    const rendered = renderOwnerControl(
      response({
        key: "jordan",
        displayName: "Jordan",
      }),
    );
    act(() => {
      rendered.container
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Manage project owner"]',
        )
        ?.click();
    });
    const select = rendered.container.querySelector<HTMLSelectElement>(
      'select[aria-label="Change project owner"]',
    )!;

    await act(async () => {
      select.value = "jp";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "The server did not confirm this project-owner command.",
    );
    expect(patchProjectCommandCentreCache).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it("keeps owner changes behind one header control and suppresses a concurrent command", async () => {
    let resolveMutation: ((value: unknown) => void) | undefined;
    setProjectCommandOwner.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        }),
    );
    const rendered = renderOwnerControl(
      response({
        key: "jordan",
        displayName: "Jordan",
      }),
    );

    const manage = rendered.container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Manage project owner"]',
    );
    expect(manage).not.toBeNull();
    act(() => manage?.click());

    const select = rendered.container.querySelector<HTMLSelectElement>(
      'select[aria-label="Change project owner"]',
    );
    expect(select).not.toBeNull();
    act(() => {
      if (!select) return;
      select.value = "jp";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.value = "joe";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(setProjectCommandOwner).toHaveBeenCalledTimes(1);
    expect(setProjectCommandOwner).toHaveBeenCalledWith(
      project.id,
      expect.objectContaining({
        ownerKey: "jp",
        expectedVersion: "owner-v1",
        commandId: expect.any(String),
      }),
    );

    await act(async () => {
      resolveMutation?.({
        command: {
          id: "command-owner",
          committed: true,
        },
        commandCentre: response({
          key: "jp",
          displayName: "JP",
        }),
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(toastSuccess).toHaveBeenCalledWith(
      "Project owner saved on the server.",
    );
    expect(patchProjectCommandCentreCache).toHaveBeenCalledWith(
      expect.anything(),
      "fixture",
      project.id,
      expect.objectContaining({ workModel: "v2" }),
    );
    expect(toastError).not.toHaveBeenCalled();

    rendered.unmount();
  });
});
