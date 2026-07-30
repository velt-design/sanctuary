import { describe, expect, it } from "vitest";
import type { ProjectWorkPrimaryCandidate } from "@/lib/projects/workItems/types";
import {
  hasProhibitedProjectWorkText,
  isProhibitedProjectWorkPrimary,
} from "./projectWorkVisibilityPolicy";

describe("projectWorkVisibilityPolicy", () => {
  it.each([
    "Call customer",
    "Book site visit",
    "/staff/schedule?view=site-visits",
  ])("classifies prohibited Project Work identity text: %s", (value) => {
    expect(hasProhibitedProjectWorkText(value)).toBe(true);
  });

  it("does not classify contextual Waiting reasons as action identity", () => {
    const waitingReview: ProjectWorkPrimaryCandidate = {
      kind: "stateReview",
      key: "waiting-review",
      title: "Review waiting project",
      reason: "Customer asked us to call next week.",
      dueAt: "2026-08-05T05:00:00.000Z",
    };

    expect(isProhibitedProjectWorkPrimary(waitingReview)).toBe(false);
  });

  it.each<ProjectWorkPrimaryCandidate>([
    {
      kind: "recovery",
      key: "book-site-visit",
      title: "Complete recovery",
      reason: "A recovery is required.",
      href: null,
    },
    {
      kind: "specialist",
      key: "schedule-site-visit",
      title: "Open specialist workflow",
      reason: "A specialist fact is required.",
      owner: "Operations",
      expectedResult: "Site Visit booked",
      href: "/staff/schedule?view=site-visits",
    },
  ])("classifies prohibited recovery/specialist identity", (primary) => {
    expect(isProhibitedProjectWorkPrimary(primary)).toBe(true);
  });
});
