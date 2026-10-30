import { expect, it } from "vitest";
import { studioQuoteSiteAddress, type StudioQuoteView } from "./studioDesign";
it("keeps legacy/manual fallback and freezes automatic destination independently of current Project or keys", () => {
  expect(studioQuoteSiteAddress(undefined, "Current project")).toBe(
    "Current project",
  );
  expect(studioQuoteSiteAddress({} as StudioQuoteView, "Legacy project")).toBe(
    "Legacy project",
  );
  expect(
    studioQuoteSiteAddress(
      {
        travelContext: {
          schemaVersion: "studio_quote_travel.v1",
          destinationCanonical: "Original site",
        },
      } as StudioQuoteView,
      "Later site",
    ),
  ).toBe("Original site");
});
it.each([
  null,
  {},
  { schemaVersion: "studio_quote_travel.v1" },
  { schemaVersion: "studio_quote_travel.v1", destinationCanonical: "" },
  { schemaVersion: "other", destinationCanonical: "Original" },
])("fails explicitly for malformed automatic marker: %j", (travelContext) => {
  expect(() =>
    studioQuoteSiteAddress({ travelContext } as StudioQuoteView, "Later site"),
  ).toThrow(/frozen quote destination/);
});
