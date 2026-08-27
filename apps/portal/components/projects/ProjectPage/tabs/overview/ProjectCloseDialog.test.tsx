import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectCloseDialog from "./ProjectCloseDialog";

vi.mock("@/components/ui/PipelineModal", () => ({
  PipelineModal: ({ open, title, description, actions, hint, children }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        <div>{actions}</div>
        <small>{hint}</small>
      </div>
    ) : null,
}));

let rendered: ReturnType<typeof renderIntoDocument> | null = null;

function renderDialog(
  onConfirm = vi.fn().mockResolvedValue(true),
  onClose = vi.fn(),
) {
  rendered = renderIntoDocument(
    <ProjectCloseDialog
      open
      stage="contacted"
      openWorkCount={2}
      busy={false}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );
  return { container: rendered.container, onClose, onConfirm };
}

function chooseRadio(value: string) {
  const radio = rendered!.container.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${value}"]`,
  )!;
  act(() => radio.click());
}

afterEach(() => {
  rendered?.unmount();
  rendered = null;
});

describe("ProjectCloseDialog", () => {
  it("requires an explicit Lost, Cancelled or Complete path", () => {
    const { container } = renderDialog();
    const radios = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    );
    expect(radios.map((radio) => radio.value)).toEqual([
      "LOST",
      "CANCELLED",
      "COMPLETE",
    ]);
    expect(radios.every((radio) => !radio.checked)).toBe(true);
    const action = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Choose a close outcome",
    );
    expect(action?.disabled).toBe(true);
  });

  it("uses a structured Lost outcome with only an optional note", async () => {
    const { container, onClose, onConfirm } = renderDialog();
    chooseRadio("LOST");
    const select = container.querySelector<HTMLSelectElement>(
      "#project-lost-outcome",
    )!;
    act(() => {
      select.value = "LOST_BUDGET_PRICE";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("Additional note (optional)");
    expect(container.querySelector("#project-close-reason")).toBeNull();
    expect(container.textContent).toContain("stays at the Contacted stage");
    expect(container.textContent).toContain(
      "2 open or blocked Project Work items will be cancelled safely",
    );
    const action = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Close as Lost - Budget or price",
    )!;
    await act(async () => {
      action.click();
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    });
    expect(onConfirm).toHaveBeenCalledWith({
      outcome: "LOST_BUDGET_PRICE",
      note: undefined,
      cancellationReason: undefined,
    });
  });

  it.each([
    ["CANCELLED", "Close as Cancelled"],
    ["COMPLETE", "Close as Complete"],
  ])("requires a reason for the %s path", (path, actionLabel) => {
    const { container } = renderDialog();
    chooseRadio(path);
    const action = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === actionLabel,
    )!;
    expect(container.querySelector("#project-close-reason")).not.toBeNull();
    expect(action.disabled).toBe(true);
    const reason = container.querySelector<HTMLTextAreaElement>(
      "#project-close-reason",
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(reason, "Confirmed by operations");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(action.disabled).toBe(false);
    if (path === "COMPLETE") {
      expect(container.textContent).toContain(
        "required schedule or payment conditions",
      );
    }
  });
});
