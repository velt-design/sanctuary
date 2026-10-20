import { expect, it } from "vitest";
import { serializeWebsiteSubmittedDesign } from "./serialize";

it("serializes exact optional selections without inserting defaults", () => {
  const design = {
    version: 1,
    input: {
      widthMm: 6000,
      projectionMm: 3000,
      level: "elevated",
      connection: "soffit",
    },
    roof: {
      family: "box",
      orientation: "away",
      infills: false,
      blinds: [],
      sidePanels: [],
      attachmentIntent: "unsure",
    },
  };
  const encoded = serializeWebsiteSubmittedDesign(design);
  expect(encoded.startsWith("3~")).toBe(true);
  expect(JSON.parse(decodeURIComponent(encoded.slice(2)))).toEqual(design);
});

it("never serializes private metadata or a future version", () => {
  expect(() => serializeWebsiteSubmittedDesign({ version: 2 })).toThrow();
  expect(() =>
    serializeWebsiteSubmittedDesign({
      price: 100,
      summary: "trusted?",
      reopenPath: "/anything",
    }),
  ).toThrow();
});
