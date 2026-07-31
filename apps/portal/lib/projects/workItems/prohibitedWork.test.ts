import { describe, expect, it } from "vitest";
import {
  hasProhibitedProjectWorkText,
  isRetiredProjectWorkIdentity,
} from "./prohibitedWork";

describe("prohibited Project Work identity", () => {
  it.each([
    "Call customer",
    "Book site visit",
    "schedule-site_visits",
  ])("recognises retired action identity: %s", (value) => {
    expect(hasProhibitedProjectWorkText(value)).toBe(true);
  });

  it("does not classify contextual prose that is not action identity", () => {
    expect(
      hasProhibitedProjectWorkText("Customer asked us to reconnect next week"),
    ).toBe(false);
  });

  it("always retires the legacy-review source", () => {
    expect(
      isRetiredProjectWorkIdentity({
        title: "Review project",
        sourceType: "LEGACY_REVIEW",
      }),
    ).toBe(true);
  });
});
