import { act, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectOverviewLayout from "./ProjectOverviewLayout";

describe("ProjectOverviewLayout", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("owns the complete overview region topology and exposes command state", () => {
    const rendered = renderIntoDocument(
      <ProjectOverviewLayout
        orientation={<div>Orientation</div>}
        exception={<div>Exception</div>}
        projectWork={<div>Project Work</div>}
        commercial={<div>Commercial</div>}
        recent={<div>Recent</div>}
        admin={<div>Admin</div>}
        state="refreshing"
      />,
    );

    const layout = rendered.container.querySelector(
      '[data-project-overview-layout="true"]',
    );
    expect(layout?.getAttribute("data-command-centre-state")).toBe(
      "refreshing",
    );
    expect(
      Array.from(layout?.children ?? []).map((node) =>
        node.getAttribute("data-project-overview-region"),
      ),
    ).toEqual([
      "orientation",
      "exception",
      "project-work",
      "commercial",
      "recent",
      "admin",
    ]);

    rendered.unmount();
  });

  it("omits unsupported optional regions instead of rendering placeholders", () => {
    const rendered = renderIntoDocument(
      <ProjectOverviewLayout
        orientation={<div>Orientation</div>}
        projectWork={<div>Project Work</div>}
        commercial={<div>Commercial</div>}
      />,
    );

    expect(
      rendered.container.querySelector(
        '[data-project-overview-region="exception"]',
      ),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-project-overview-region="recent"]',
      ),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-project-overview-region="admin"]',
      ),
    ).toBeNull();

    rendered.unmount();
  });

  it("preserves interactive owner state when responsive regions reorder", () => {
    let mobile = false;
    const listeners = new Set<() => void>();
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: mobile,
        media: "(max-width: 768px)",
        onchange: null,
        addEventListener: (_type: string, listener: () => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: () => void) => {
          listeners.delete(listener);
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }),
    });

    function StatefulOrientation() {
      const [edits, setEdits] = useState(0);
      return (
        <button type="button" onClick={() => setEdits((value) => value + 1)}>
          Orientation edits {edits}
        </button>
      );
    }

    const rendered = renderIntoDocument(
      <ProjectOverviewLayout
        orientation={<StatefulOrientation />}
        projectWork={<div>Project Work</div>}
        commercial={<div>Commercial</div>}
      />,
    );
    const button = rendered.container.querySelector("button")!;
    act(() => button.click());
    expect(button.textContent).toBe("Orientation edits 1");

    act(() => {
      mobile = true;
      listeners.forEach((listener) => listener());
    });

    const layout = rendered.container.querySelector(
      '[data-project-overview-layout="true"]',
    )!;
    expect(
      Array.from(layout.children).map((node) =>
        node.getAttribute("data-project-overview-region"),
      ),
    ).toEqual(["project-work", "commercial", "orientation"]);
    expect(rendered.container.querySelector("button")?.textContent).toBe(
      "Orientation edits 1",
    );

    rendered.unmount();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  });
});
