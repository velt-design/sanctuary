import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectOverviewLayout from "./ProjectOverviewLayout";
import ProjectWorkFilesCard from "./ProjectWorkFilesCard";
import { ProjectRecentNotesSurface } from "../ProjectOverviewSurface";

vi.mock("./ProjectSharePointFilesPanel", () => ({
  default: () => <button type="button">Selected file preview</button>,
}));

describe("ProjectOverviewLayout", () => {
  it("keeps the user's disclosed history and draft while complete events arrive", () => {
    const history = (count: number) => <ProjectRecentNotesSurface notes={<textarea aria-label="Team note draft" defaultValue="" />} events={Array.from({ length: count }, (_, index) => <p key={index}>Complete event {index + 1}</p>)} />;
    const view = renderIntoDocument(history(1));
    const disclosure = view.container.querySelector('details')!;
    const card = view.container.querySelector('[data-recent-notes-events]');
    const draft = view.container.querySelector<HTMLTextAreaElement>('textarea')!;
    act(() => { disclosure.open = true; });
    draft.value = 'Unsaved note'; draft.focus();
    view.rerender(history(25));
    expect(disclosure.open).toBe(true);
    expect(view.container.querySelector('[data-recent-notes-events]')).toBe(card);
    expect(view.container.querySelector('textarea')).toBe(draft);
    expect(draft.value).toBe('Unsaved note'); expect(document.activeElement).toBe(draft);
    expect(view.container.textContent).toContain('Complete event 25');
    view.unmount();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lets CSS respond to available width without measuring or subscribing", () => {
    const geometry = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const events = vi.spyOn(window, "addEventListener");
    const rendered = renderIntoDocument(
      <ProjectOverviewLayout orientation={<div>Orientation</div>} projectWork={<div>Work</div>} commercial={<div>Commercial</div>} />,
    );
    try {
      expect(geometry).not.toHaveBeenCalled();
      expect(events.mock.calls.filter(([type]) => type === "resize")).toHaveLength(0);
    } finally {
      rendered.unmount();
      geometry.mockRestore();
      events.mockRestore();
    }
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
      Array.from(layout?.querySelectorAll('[data-project-overview-region]') ?? []).map((node) =>
        node.getAttribute("data-project-overview-region"),
      ),
    ).toEqual([
      "exception",
      "project-work",
      "commercial",
      "orientation",
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

  it("keeps Overview topology stable when opening the dedicated Files workspace", () => {
    const rendered = renderIntoDocument(
      <ProjectOverviewLayout
        orientation={<input aria-label="Contact draft" defaultValue="Saved contact" />}
        projectWork={<ProjectWorkFilesCard projectId="fixture" host="synthetic">Work actions</ProjectWorkFilesCard>}
        commercial={<input aria-label="Commercial draft" defaultValue="Saved estimate" />}
      />,
    );
    const contact = rendered.container.querySelector<HTMLInputElement>('[aria-label="Contact draft"]')!;
    const commercial = rendered.container.querySelector<HTMLInputElement>('[aria-label="Commercial draft"]')!;
    contact.value = "Unsaved contact edit";
    commercial.value = "Unsaved estimate edit";
    const card = rendered.container.querySelector('[data-project-work-panel]')!;
    expect(card.querySelector('[role="tab"][aria-controls="project-files-panel"]')).toBeNull();
    const filesShortcut = card.querySelector<HTMLAnchorElement>('a[href="?tab=files"]')!;
    act(() => filesShortcut.click());
    expect(card.getAttribute("data-project-work-panel")).toBe("work");
    expect(card.textContent).toContain("Work actions");
    expect(rendered.container.querySelector('[aria-label="Contact draft"]')).toBe(contact);
    expect(rendered.container.querySelector('[aria-label="Commercial draft"]')).toBe(commercial);
    expect(contact.value).toBe("Unsaved contact edit");
    expect(commercial.value).toBe("Unsaved estimate edit");
    rendered.unmount();
  });

  it("preserves interactive owner state when responsive regions reorder", () => {
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
      (rendered.container.firstElementChild as HTMLElement).style.width = "760px";
      window.dispatchEvent(new Event("resize"));
    });

    const layout = rendered.container.querySelector(
      '[data-project-overview-layout="true"]',
    )!;
    expect(
      Array.from(layout.querySelectorAll('[data-project-overview-region]')).map((node) =>
        node.getAttribute("data-project-overview-region"),
      ),
    ).toEqual(["project-work", "commercial", "orientation"]);
    expect(rendered.container.querySelector("button")).toBe(button);
    expect(button.textContent).toBe("Orientation edits 1");

    rendered.unmount();
  });
});
