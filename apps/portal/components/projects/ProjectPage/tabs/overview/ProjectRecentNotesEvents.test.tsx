import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ProjectActivityItem,
  ProjectNote,
} from "@/lib/projects/types";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectRecentNotesEvents from "./ProjectRecentNotesEvents";

vi.mock("../_components/ProjectNotesPanel.client", () => ({
  default: ({
    projectId,
    initialNotes,
  }: {
    projectId: string;
    initialNotes: ProjectNote[];
  }) => (
    <div data-notes-project={projectId}>
      {initialNotes.map((note) => (
        <p key={note.id}>{note.body}</p>
      ))}
    </div>
  ),
}));

const note: ProjectNote = {
  id: "note_1",
  body: "Customer confirmed the site address by email.",
  authorId: "staff_1",
  authorEmail: "staff@example.test",
  authorDisplayName: "Sam Staff",
  createdAt: "2026-07-29T03:00:00.000Z",
  updatedAt: "2026-07-29T03:00:00.000Z",
  isOwn: false,
};

function event(
  overrides: Partial<ProjectActivityItem> = {},
): ProjectActivityItem {
  return {
    id: "event_1",
    at: "2026-07-29T04:00:00.000Z",
    type: "quote_created",
    title: "Quote Q-0100 created",
    detail: "The server recorded the current quote event.",
    ...overrides,
  };
}

describe("ProjectRecentNotesEvents", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders bounded notes and events while filtering Call and Site Visit content", () => {
    const rendered = renderIntoDocument(
      <ProjectRecentNotesEvents
        projectId="proj_fixture"
        notes={[note]}
        events={[
          event(),
          event({
            id: "event_call",
            title: "Call customer",
            detail: "Legacy call follow-up.",
          }),
          event({
            id: "event_site_visit",
            title: "Legacy task updated",
            detail: "Book Site Visit next week.",
          }),
        ]}
      />,
    );

    expect(
      rendered.container.querySelector('[data-recent-notes-events="true"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Team notes");
    expect(rendered.container.textContent).toContain(note.body);
    expect(rendered.container.textContent).toContain("Recent system events");
    expect(rendered.container.textContent).toContain("Quote Q-0100 created");
    expect(rendered.container.textContent).not.toMatch(/\bcall\b/i);
    expect(rendered.container.textContent).not.toMatch(/\bsite visit\b/i);

    rendered.unmount();
  });

  it("shows a truthful empty event state when every bounded event is prohibited", () => {
    const rendered = renderIntoDocument(
      <ProjectRecentNotesEvents
        projectId="proj_fixture"
        notes={[]}
        events={[
          event({
            title: "Book Site Visit",
            detail: "Legacy task.",
          }),
        ]}
      />,
    );

    expect(rendered.container.textContent).toContain(
      "No recent system events",
    );
    expect(rendered.container.textContent).not.toMatch(/\bsite visit\b/i);

    rendered.unmount();
  });
});
