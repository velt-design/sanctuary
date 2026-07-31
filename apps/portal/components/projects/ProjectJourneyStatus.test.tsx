import { afterEach, describe, expect, it } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import ProjectJourneyStatus from "./ProjectJourneyStatus";

describe("ProjectJourneyStatus", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("presents journey, detailed stage and operational state as accessible text", () => {
    const rendered = renderIntoDocument(
      <ProjectJourneyStatus stage="site_visit" operationalState="WAITING" />,
    );
    const summary = rendered.container.querySelector(
      '[aria-label="Project journey and status"]',
    );

    expect(summary).not.toBeNull();
    expect(summary?.getAttribute("data-project-journey-phase")).toBe(
      "PROPOSAL",
    );
    expect(summary?.getAttribute("data-project-stage")).toBe("site_visit");
    expect(summary?.getAttribute("data-project-operational-state")).toBe(
      "WAITING",
    );
    expect(summary?.textContent).toContain("Journey");
    expect(summary?.textContent).toContain("Proposal");
    expect(summary?.textContent).toContain("Stage");
    expect(summary?.textContent).toContain("Site Visit");
    expect(summary?.textContent).toContain("Operational state");
    expect(summary?.textContent).toContain("Waiting");

    rendered.unmount();
  });

  it("omits operational state when the owning contract does not provide one", () => {
    const rendered = renderIntoDocument(
      <ProjectJourneyStatus stage="quoting" />,
    );
    const summary = rendered.container.querySelector(
      "[data-project-journey-status]",
    );

    expect(summary?.textContent).toContain("Proposal");
    expect(summary?.textContent).toContain("Quoting");
    expect(summary?.textContent).not.toContain("Operational state");
    expect(summary?.hasAttribute("data-project-operational-state")).toBe(false);

    rendered.unmount();
  });

  it("supports the borderless embedded presentation used by Overview", () => {
    const rendered = renderIntoDocument(
      <ProjectJourneyStatus
        stage="sent"
        operationalState="ACTIVE"
        presentation="embedded"
      />,
    );

    expect(
      rendered.container
        .querySelector("[data-project-journey-status]")
        ?.getAttribute("data-presentation"),
    ).toBe("embedded");

    rendered.unmount();
  });

  it("shows a safe explicit unknown state without exposing arbitrary input", () => {
    const rendered = renderIntoDocument(
      <ProjectJourneyStatus
        stage="unexpected-stage-from-server"
        ariaLabel="Project lifecycle"
      />,
    );
    const summary = rendered.container.querySelector(
      '[aria-label="Project lifecycle"]',
    );

    expect(summary?.getAttribute("data-project-journey-known")).toBe("false");
    expect(summary?.textContent).toContain("JourneyUnknown");
    expect(summary?.textContent).toContain("StageUnknown");
    expect(summary?.textContent).not.toContain("unexpected-stage-from-server");

    rendered.unmount();
  });
});
