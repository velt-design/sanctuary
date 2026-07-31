import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";

const mocks = vi.hoisted(() => ({
  details: {
    canRetry: false,
    canSave: true,
    displayed: {
      contactName: "Taylor",
      contactEmail: "taylor@example.com",
      contactPhone: "0210000000",
      projectName: "Pergola project",
      siteAddress: "1 Example St",
      region: "North",
      quoteRef: "Q-1001",
    },
    draft: {
      contactName: "Taylor",
      contactEmail: "taylor@example.com",
      contactPhone: "0210000000",
      projectName: "Pergola project",
      siteAddress: "1 Example St",
      region: "North",
      quoteRef: "Q-1001",
    },
    error: null as string | null,
    finishEditing: vi.fn(),
    isEditing: false,
    isSaving: false,
    resetEditing: vi.fn(),
    retry: vi.fn(),
    reviewLocalDraft: vi.fn(),
    saveCurrentDraft: vi.fn(),
    setIsEditing: vi.fn(),
    statusText: null as string | null,
    updateDraftField: vi.fn(),
  },
}));

vi.mock("../../useProjectDetailsDraft", () => ({
  useProjectDetailsDraft: () => mocks.details,
}));

vi.mock("./ProjectStageControl", () => ({
  default: ({
    presentation = "status",
  }: {
    presentation?: "status" | "action-only";
  }) => (
    <button
      type="button"
      data-testid="stage-control"
      data-presentation={presentation}
    >
      {presentation === "action-only" ? "Change stage" : "New"}
    </button>
  ),
}));

import ProjectOrientationBand from "./ProjectOrientationBand";

const project = {
  id: "proj_1",
  name: "Pergola project",
  stage: "new",
  contactId: "ct_1",
  contactName: "Taylor",
  contactEmail: "taylor@example.com",
  contactPhone: "0210000000",
  siteAddress: "1 Example St",
  region: "North",
  quoteRef: "Q-1001",
  owner: {
    key: "jordan",
    displayName: "Jordan",
  },
} as const;

async function resolveLazyStageControl() {
  await act(async () => {
    await import("./ProjectStageControl");
    await Promise.resolve();
  });
}

describe("ProjectOrientationBand", () => {
  beforeEach(() => {
    mocks.details.isEditing = false;
    mocks.details.error = null;
    mocks.details.statusText = null;
    mocks.details.setIsEditing.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows approved orientation facts without repeating header identity or phone", async () => {
    const rendered = renderIntoDocument(
      <ProjectOrientationBand
        project={project}
        host="host"
        operationalState="WAITING"
        freshness={{
          label: "Updating",
          detail: "Server view from 30 July",
          tone: "info",
        }}
      />,
    );
    await resolveLazyStageControl();

    const orientation = rendered.container.querySelector(
      '[data-project-orientation="true"]',
    );
    expect(orientation?.getAttribute("data-operational-state")).toBe("WAITING");
    expect(
      orientation
        ?.querySelector("[data-project-journey-status]")
        ?.getAttribute("data-project-journey-phase"),
    ).toBe("ENQUIRY");
    expect(orientation?.textContent).toContain("Journey");
    expect(orientation?.textContent).toContain("New");
    expect(orientation?.textContent).toContain("Taylor");
    expect(orientation?.textContent).toContain("taylor@example.com");
    expect(orientation?.textContent).toContain("1 Example St");
    expect(orientation?.textContent).toContain("Region: North");
    expect(orientation?.textContent).toContain("Q-1001");
    expect(orientation?.textContent).toContain("Waiting");
    expect(orientation?.textContent).toContain("Updating");
    expect(orientation?.textContent).not.toContain("Pergola project");
    expect(orientation?.textContent).not.toContain("0210000000");
    expect(orientation?.textContent).not.toContain("Jordan");
    expect(orientation?.querySelectorAll("button")).toHaveLength(2);
    expect(
      Array.from(orientation?.querySelectorAll("button") ?? []).filter(
        (button) => button.textContent === "Edit details",
      ),
    ).toHaveLength(1);
    expect(
      orientation?.querySelector('[data-presentation="action-only"]'),
    ).not.toBeNull();

    rendered.unmount();
  });

  it("retains every existing editable field in Overview edit mode", async () => {
    mocks.details.isEditing = true;
    const rendered = renderIntoDocument(
      <ProjectOrientationBand
        project={project}
        host="host"
        operationalState="ACTIVE"
        freshness={{ label: "Current" }}
      />,
    );
    await resolveLazyStageControl();

    for (const id of [
      "contactName",
      "contactEmail",
      "contactPhone",
      "projectName",
      "siteAddress",
      "region",
      "quoteRef",
    ]) {
      expect(rendered.container.querySelector(`#${id}`)).not.toBeNull();
    }

    rendered.unmount();
  });

  it("preserves the original status/details presentation in compatibility mode", async () => {
    const rendered = renderIntoDocument(
      <ProjectOrientationBand
        project={project}
        host="host"
        mode="compatibility"
      />,
    );
    await resolveLazyStageControl();

    expect(rendered.container.textContent).toContain("Status & details");
    expect(rendered.container.textContent).toContain("Pergola project");
    expect(rendered.container.textContent).toContain("0210000000");
    expect(
      rendered.container.querySelector('[data-presentation="status"]'),
    ).not.toBeNull();

    rendered.unmount();
  });
});
