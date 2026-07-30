import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  commandCentreActionFixtures,
  commandCentreFixtureStaff,
} from "@/app/qa/project-command-centre-fixture/fixtures";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectPrimaryActionCard from "./ProjectPrimaryActionCard";

const runProjectActionCommand = vi.fn();
const setProjectCommandOwner = vi.fn();

vi.mock("@/components/auth/PortalAuthProvider", () => ({
  usePortalSession: () => ({
    user: { id: commandCentreFixtureStaff[0].userId },
    isAdmin: false,
  }),
}));
vi.mock("@/lib/projects/commandCentre/client", () => ({
  fetchProjectStaffDirectory: vi
    .fn()
    .mockResolvedValue(commandCentreFixtureStaff),
  runProjectActionCommand: (...args: unknown[]) =>
    runProjectActionCommand(...args),
  setProjectCommandOwner: (...args: unknown[]) =>
    setProjectCommandOwner(...args),
}));

function renderCard(scenario: keyof typeof commandCentreActionFixtures) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderIntoDocument(
    <QueryClientProvider client={client}>
      <ProjectPrimaryActionCard
        projectId="proj_fixture"
        host="fixture"
        operations={commandCentreActionFixtures[scenario]}
        stale={false}
        onRefresh={vi.fn()}
        initialStaff={commandCentreFixtureStaff}
      />
    </QueryClientProvider>,
  );
}

describe("ProjectPrimaryActionCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    runProjectActionCommand
      .mockReset()
      .mockResolvedValue({ command: { id: "command", committed: true } });
    setProjectCommandOwner.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps action title, action owner, due state and source visible without repeating project ownership", () => {
    const rendered = renderCard("primary");
    expect(rendered.container.textContent).toContain("Finalise and send quote");
    expect(rendered.container.textContent).toContain("Sam Sales");
    expect(rendered.container.textContent).toContain("Overdue");
    expect(rendered.container.textContent).toContain("Automation task");
    expect(
      rendered.container.querySelectorAll("[data-project-owner]").length,
    ).toBe(0);
    expect(rendered.container.textContent).not.toContain(
      "Manage project owner",
    );
    expect(rendered.container.getAttribute("data-project-owner")).toBeNull();
    rendered.unmount();
  });

  it("renders explicit no-action state and hides prohibited undated legacy work", () => {
    const empty = renderCard("empty");
    expect(
      empty.container.querySelector('[data-primary-action-state="empty"]'),
    ).not.toBeNull();
    expect(empty.container.textContent).toContain(
      "No next action has been set",
    );
    empty.unmount();

    const undated = renderCard("undated");
    expect(undated.container.textContent).toContain(
      "No permitted legacy next action is visible",
    );
    expect(undated.container.textContent).not.toContain("Book site visit");
    expect(undated.container.textContent).not.toContain("Due date required");
    undated.unmount();
  });

  it("uses non-colour critical text and blocks prohibited legacy conflicts without choosing a replacement", () => {
    const critical = renderCard("critical");
    expect(critical.container.textContent).toContain("Critical");
    expect(critical.container.textContent).toContain(
      "Customer cannot proceed without a revised quote",
    );
    critical.unmount();

    const conflict = renderCard("conflict");
    expect(
      conflict.container.querySelector('[role="alert"]')?.textContent,
    ).toContain("Legacy work needs review");
    expect(conflict.container.textContent).not.toContain(
      "Call for quote follow-up",
    );
    expect(conflict.container.textContent).not.toContain("Use selected action");
    expect(
      Array.from(conflict.container.querySelectorAll("button")).some(
        (button) => button.textContent === "Reschedule",
      ),
    ).toBe(false);
    expect(runProjectActionCommand).not.toHaveBeenCalled();
    conflict.unmount();
  });

  it("audits inline history and sends completion only once per click", async () => {
    const rendered = renderCard("primary");
    expect(rendered.container.querySelectorAll("li").length).toBe(5);
    const complete = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Complete")!;
    await act(async () => {
      complete.click();
    });
    expect(runProjectActionCommand).toHaveBeenCalledTimes(1);
    expect(runProjectActionCommand).toHaveBeenCalledWith(
      "proj_fixture",
      expect.objectContaining({ command: "complete" }),
    );
    rendered.unmount();
  });

  it("reuses the same command identity after an ambiguous legacy retry", async () => {
    runProjectActionCommand
      .mockRejectedValueOnce(new Error("Connection ended before confirmation"))
      .mockResolvedValueOnce({
        command: { id: "command", committed: true },
      });
    const rendered = renderCard("primary");
    const complete = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Complete")!;

    await act(async () => {
      complete.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rendered.container.textContent).toContain(
      "Connection ended before confirmation",
    );

    await act(async () => {
      complete.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(runProjectActionCommand).toHaveBeenCalledTimes(2);
    const firstCommandId =
      runProjectActionCommand.mock.calls[0]?.[1]?.commandId;
    const retryCommandId =
      runProjectActionCommand.mock.calls[1]?.[1]?.commandId;
    expect(firstCommandId).toEqual(expect.any(String));
    expect(retryCommandId).toBe(firstCommandId);

    rendered.unmount();
  });

  it("suppresses a same-tick duplicate legacy command", async () => {
    let resolveCommand: ((value: unknown) => void) | undefined;
    runProjectActionCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const rendered = renderCard("primary");
    const complete = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Complete")!;

    act(() => {
      complete.click();
      complete.click();
    });
    expect(runProjectActionCommand).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommand?.({
        command: { id: "command", committed: true },
      });
      await Promise.resolve();
    });

    rendered.unmount();
  });

  it("preserves the displayed action owner when reassign is clicked without changing the selection", async () => {
    await import("./ProjectPrimaryActionControls");
    const rendered = renderCard("primary");
    const manage = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Manage next action")!;
    await act(async () => {
      manage.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const ownerSelect = Array.from(
      rendered.container.querySelectorAll("select"),
    ).find((select) =>
      select.parentElement?.textContent?.includes("Action owner"),
    )!;
    expect(ownerSelect.value).toBe(commandCentreFixtureStaff[0].userId);
    const reassign = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Reassign")!;
    await act(async () => {
      reassign.click();
    });
    expect(runProjectActionCommand).toHaveBeenCalledWith(
      "proj_fixture",
      expect.objectContaining({
        command: "reassign",
        ownerUserId: commandCentreFixtureStaff[0].userId,
      }),
    );
    rendered.unmount();
  });
});
