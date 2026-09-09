import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import BookletBulletTextArea from "./BookletBulletTextArea";

function ControlledField() {
  const [value, setValue] = useState("Alpha\nBeta");
  return (
    <BookletBulletTextArea
      id="copy"
      label="Body copy"
      value={value}
      maxLength={100}
      rows={5}
      onChange={setValue}
    />
  );
}

describe("BookletBulletTextArea", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("toggles selected lines and continues the list with Enter", () => {
    const rendered = renderIntoDocument(<ControlledField />);
    const textarea = rendered.container.querySelector(
      "textarea",
    ) as HTMLTextAreaElement;
    const button = rendered.container.querySelector(
      'button[aria-label="Toggle bullets in Body copy"]',
    ) as HTMLButtonElement;

    act(() => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
      textarea.dispatchEvent(new Event("select", { bubbles: true }));
      button.click();
    });
    expect(textarea.value).toBe("- Alpha\n- Beta");
    expect(button.getAttribute("aria-pressed")).toBe("true");

    act(() => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(textarea.value).toBe("- Alpha\n- Beta\n- ");
    expect(textarea.selectionStart).toBe(textarea.value.length);

    rendered.unmount();
  });
});
