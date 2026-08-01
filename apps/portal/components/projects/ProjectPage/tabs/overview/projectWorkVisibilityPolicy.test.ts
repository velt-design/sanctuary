import { describe, expect, it } from "vitest";
import type { ProjectWorkPrimaryCandidate } from "@/lib/projects/workItems/types";
import {
  hasProhibitedProjectWorkText,
  isProhibitedProjectWorkItem,
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

  it("classifies a retired legacy-review source even when its title is neutral", () => {
    expect(
      isProhibitedProjectWorkItem({
        title: "Review project",
        sourceType: "LEGACY_REVIEW",
        sourceKey: null,
        seriesKey: null,
      } as any),
    ).toBe(true);
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

  it("permits only the bounded server-owned Site Visit specialist action", () => {
    expect(
      isProhibitedProjectWorkPrimary({
        kind: "specialist",
        key: "journey-site-visit:complete:proj_fixture",
        title: "Complete the site visit",
        reason: "The project is at the Site Visit stage.",
        owner: "Operations",
        expectedResult: "The site visit is recorded complete.",
        href: "/staff/schedule?view=site-visits&project=proj_fixture",
        actionLabel: "Book or confirm site visit",
      }),
    ).toBe(false);
  });
});
