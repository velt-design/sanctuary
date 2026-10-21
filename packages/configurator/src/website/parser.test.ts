import { describe, expect, it } from "vitest";
import { parseWebsiteSubmittedDesign } from "./parser";
import type { WebsiteSubmittedDesignV1 } from "./contracts";
const base: WebsiteSubmittedDesignV1 = {
  version: 1,
  input: {
    widthMm: 6000,
    projectionMm: 3000,
    level: "ground",
    connection: "facade",
  },
  roof: { family: "mono", orientation: "parallel", infills: false },
};
describe("exact submitted website intent", () => {
  it("retains sparse historical optional shape and creates no defaults", () => {
    expect(parseWebsiteSubmittedDesign(base)).toEqual({
      ok: true,
      value: base,
    });
  });
  it("preserves every optional field including dormant selections without aliasing", () => {
    const full: WebsiteSubmittedDesignV1 = {
      ...structuredClone(base),
      roof: {
        ...base.roof,
        attachmentIntent: "unsure",
        finish: {
          material: "acrylic",
          layout: "house",
          acrylicBays: 16,
          profile: "tray",
          trayWidth: 500,
          ceiling: "thermopine-150",
        },
        blinds: [
          {
            opening: "front-1of2",
            fabric: "urban",
            colour: "Carbon",
            cover: "PELMET",
            lowered: 50,
            infill: true,
          },
        ],
        sidePanels: [
          {
            opening: "left-1of1",
            kind: "timber",
            species: "cedar",
            profile: "65x39",
            edge: true,
            gap: 50,
            customGap: false,
            frame: 100,
            battens: false,
            direction: "vertical",
          },
        ],
        roofBattens: {
          species: "thermopine",
          profile: "39x39",
          edge: true,
          gap: 50,
          customGap: false,
        },
        lighting: {
          rafterCount: 0,
          cedarCount: 0,
          rafterLayout: "central",
          cedarLayout: "perimeter",
          strips: ["rafter-1"],
          cedarPerSection: 4,
          cedarIndividual: false,
          cedarOverrides: { "section-1": { count: 9, pattern: "rows3" } },
          cedarPattern: "rows2",
          rafterAmount: "off",
        },
      },
    };
    const result = parseWebsiteSubmittedDesign(full);
    expect(result).toEqual({ ok: true, value: full });
    if (!result.ok) throw Error();
    result.value.roof.lighting!.strips.push("changed");
    expect(full.roof.lighting!.strips).toEqual(["rafter-1"]);
  });
  it.each([
    { ...base, version: 2 },
    { ...base, price: 100 },
    { ...base, reopenPath: "https://example.com" },
    { ...base, input: { ...base.input, widthMm: Infinity } },
    { ...base, roof: { ...base.roof, privateCost: 10 } },
    { ...base, roof: { ...base.roof, finish: null } },
    { ...base, roof: { ...base.roof, blinds: Array(1) } },
    {
      ...base,
      roof: {
        ...base.roof,
        lighting: {
          rafterCount: 0,
          cedarCount: 0,
          rafterLayout: "even",
          cedarLayout: "even",
          strips: [],
          cedarOverrides: {
            "section-1": { count: 2, pattern: "rows2", private: 1 },
          },
        },
      },
    },
  ])("rejects malformed, future and private additions", (value) =>
    expect(parseWebsiteSubmittedDesign(value).ok).toBe(false),
  );
});


it.each(['clear','light_grey','dark_grey','opal'] as const)('retains %s tint and white frame through a saved JSON round trip', acrylicTint => {
  const design = {...structuredClone(base),roof:{...base.roof,acrylicTint,frameFinish:'white' as const}};
  expect(parseWebsiteSubmittedDesign(JSON.parse(JSON.stringify(design)))).toEqual({ok:true,value:design});
});
