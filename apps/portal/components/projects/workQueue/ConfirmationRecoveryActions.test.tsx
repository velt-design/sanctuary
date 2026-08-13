import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import ConfirmationCorrectionControls from "./ConfirmationCorrectionControls.client";
import ConfirmationReviewResolution from "./ConfirmationReviewResolution.client";

const mocks = vi.hoisted(() => ({
  correct: vi.fn(),
  reconcile: vi.fn(),
  invalidate: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock("@/components/auth/PortalAuthProvider", () => ({
  usePortalSession: () => ({ isAdmin: true }),
}));

vi.mock("@/lib/projects/workItems/confirmationCorrections/client", () => ({
  correctProjectConfirmation: (...args: unknown[]) => mocks.correct(...args),
  reconcileProjectConfirmationCorrection: (...args: unknown[]) =>
    mocks.reconcile(...args),
}));

vi.mock("@/lib/queries/projectWorkCache", () => ({
  invalidateProjectWorkReads: (...args: unknown[]) => mocks.invalidate(...args),
}));

const PROJECT_ID = "proj_11111111-1111-4111-8111-111111111111";

function render(component: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderIntoDocument(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
}

function setValue(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const prototype =
    control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function click(container: Element, label: string) {
  const target = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label,
  );
  if (!target) throw new Error(`Missing button: ${label}`);
  act(() => target.click());
  return target;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  document.body.innerHTML = "";
});

describe("confirmation recovery actions", () => {
  it("locks a confirmation review before React rerenders", async () => {
    let resolveCommand: ((value: unknown) => void) | undefined;
    mocks.reconcile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const rendered = render(
      <ConfirmationReviewResolution
        projectId={PROJECT_ID}
        repairSignalId="22222222-2222-4222-8222-222222222222"
        expectedSignalRowVersion={1}
        host="fixture"
      />,
    );
    setValue(rendered.container.querySelector("textarea")!, "Checked current state");
    click(rendered.container, "Mark review complete");

    const confirm = Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "Confirm review complete")!;
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommand?.({
        command: { id: "command", committed: true, replayed: false },
        result: {},
      });
      await Promise.resolve();
    });
  });

  it("does not clear correction inputs without server confirmation", async () => {
    mocks.correct.mockResolvedValue({
      command: { id: "command", committed: false, replayed: false },
      result: {},
    });
    const rendered = render(
      <ConfirmationCorrectionControls
        projectId={PROJECT_ID}
        host="fixture"
        facts={[
          {
            id: "33333333-3333-4333-8333-333333333333",
            type: "SITE_VISIT_COMPLETED",
            occurredAt: "2026-08-01T00:00:00.000Z",
          } as never,
        ]}
      />,
    );
    setValue(rendered.container.querySelector("select")!, "33333333-3333-4333-8333-333333333333");
    setValue(rendered.container.querySelector("textarea")!, "Recorded by mistake");
    act(() => rendered.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());

    await act(async () => {
      click(rendered.container, "Record correction");
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain(
      "The server did not confirm this correction.",
    );
    expect(rendered.container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Recorded by mistake",
    );
  });
});
