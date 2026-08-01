import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderDialog(onConfirm = vi.fn().mockResolvedValue(true)) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <ProjectCloseDialog
        open
        stage="contacted"
        openWorkCount={2}
        busy={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
  });
  return { container, onConfirm };
}

function chooseRadio(value: string) {
  const radio = container!.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${value}"]`,
  )!;
  act(() => radio.click());
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
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
    const { container, onConfirm } = renderDialog();
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
    await act(async () => action.click());
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
