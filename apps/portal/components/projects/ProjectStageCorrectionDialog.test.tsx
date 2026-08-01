import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import ProjectStageCorrectionDialog from "./ProjectStageCorrectionDialog";

vi.mock("@/components/ui/PipelineModal", () => ({
  PIPELINE_MODAL_ACTION_CLASSES: { primary: "primary", secondary: "secondary" },
  PipelineModal: ({ title, description, actions, children }: any) => (
    <section role="dialog" aria-label={title}>
      <p>{description}</p>
      {children}
      {actions}
    </section>
  ),
}));

function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ProjectStageCorrectionDialog", () => {
  it("requires an explicit apply for every forward correction and explains work recalculation", async () => {
    const onApply = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    const rendered = renderIntoDocument(
      <ProjectStageCorrectionDialog
        open
        currentStage="contacted"
        busy={false}
        onClose={onClose}
        onApply={onApply}
      />,
    );

    expect(rendered.container.textContent).toContain(
      "Project Work will be recalculated",
    );
    expect(rendered.container.textContent).toContain("No customer email is sent");
    change(
      rendered.container.querySelector("#project-stage-target") as HTMLSelectElement,
      "quoting",
    );
    expect(onApply).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Correct to Quoting")
        ?.click();
      await Promise.resolve();
    });

    expect(onApply).toHaveBeenCalledWith({ nextStage: "quoting", reason: null });
    expect(onClose).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it("requires RESET before a backwards correction", () => {
    const rendered = renderIntoDocument(
      <ProjectStageCorrectionDialog
        open
        currentStage="deposit"
        busy={false}
        onClose={() => {}}
        onApply={() => true}
      />,
    );
    change(
      rendered.container.querySelector("#project-stage-target") as HTMLSelectElement,
      "sent",
    );
    const apply = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Correct to Sent",
    ) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    change(
      rendered.container.querySelector("#project-stage-reset") as HTMLInputElement,
      "RESET",
    );
    expect(apply.disabled).toBe(false);
    rendered.unmount();
  });
});
