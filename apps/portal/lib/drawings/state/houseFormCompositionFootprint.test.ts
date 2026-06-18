import { describe, expect, it } from "vitest";
import type { HouseComposition } from "@sp/geometry";
import { deriveHouseFormFootprintPolygon } from "./houseFormCompositionFootprint";
import {
  normalizeObjectFirstHouseFormDraft,
  type HouseFormModel,
  type ObjectFirstHouseFormDraft,
} from "./objectFirstWorkbenchModel";

function baseHouseForm(): HouseFormModel {
  return {
    id: "house-1",
    label: "House 1",
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
    footprint: {
      mode: "custom_polygon",
      preset: "straight",
      params: {
        widthM: "6",
        offsetXM: "0",
        setbackM: "0",
        bandDepthM: "4",
        returnRunM: "0",
        recessWidthM: "0",
        recessDepthM: "0",
        leftLegRunM: "0",
        rightLegRunM: "0",
        sideRunM: "0",
      },
      polygon: [
        { alongM: "0", depthM: "0" },
        { alongM: "6", depthM: "0" },
        { alongM: "6", depthM: "4" },
        { alongM: "0", depthM: "4" },
      ],
      attachmentSide: "rear",
    },
    roofIntent: {
      form: "hipped",
      material: "corrugated_iron",
      primaryPitchDeg: "25",
      primaryFallDirection: "positive_y",
      ridgeAxis: "x",
      openGableEndIds: [],
    },
    storeyMode: "single_storey",
    attachmentStrategy: null,
  };
}

const L_COMPOSITION: HouseComposition = {
  primitives: [
    {
      kind: "axisAlignedRectangle",
      originXMm: 0,
      originYMm: 0,
      widthMm: 12500,
      depthMm: 8000,
      roofIntent: {
        form: "hipped",
        pitchDeg: 25,
        ridgeAxis: "x",
        startCap: "hipped",
        endCap: "hipped",
      },
    },
    {
      kind: "axisAlignedRectangle",
      originXMm: 0,
      originYMm: -2400,
      widthMm: 5814,
      depthMm: 2400,
      roofIntent: {
        form: "hipped",
        pitchDeg: 25,
        ridgeAxis: "x",
        startCap: "hipped",
        endCap: "hipped",
      },
    },
  ],
  joins: [
    {
      fromPrimitiveIndex: 0,
      fromEdge: "south",
      toPrimitiveIndex: 1,
      toEdge: "north",
    },
  ],
};

describe("deriveHouseFormFootprintPolygon (PR-COMP-PHASE2)", () => {
  it("returns the legacy polygon when composition is absent", () => {
    const polygon = deriveHouseFormFootprintPolygon(baseHouseForm());
    expect(polygon).toEqual([
      { alongM: "0", depthM: "0" },
      { alongM: "6", depthM: "0" },
      { alongM: "6", depthM: "4" },
      { alongM: "0", depthM: "4" },
    ]);
  });

  it("derives the polygon from composition (L-shape, Graham–Oratia v1)", () => {
    const houseForm: HouseFormModel = {
      ...baseHouseForm(),
      composition: L_COMPOSITION,
    };
    const polygon = deriveHouseFormFootprintPolygon(houseForm);
    expect(polygon).toHaveLength(6);
    // L corners (in metres) — order doesn't matter for this assertion.
    const sorted = polygon
      .map((p) => [Number(p.alongM), Number(p.depthM)])
      .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
    expect(sorted).toEqual([
      [0, -2.4],
      [0, 8],
      [5.814, -2.4],
      [5.814, 0],
      [12.5, 0],
      [12.5, 8],
    ]);
  });

  it("prefers composition over the legacy polygon when both are present", () => {
    const houseForm: HouseFormModel = {
      ...baseHouseForm(),
      composition: L_COMPOSITION,
    };
    const polygon = deriveHouseFormFootprintPolygon(houseForm);
    // Composition is the L (6 vertices); legacy polygon was rect (4).
    expect(polygon).toHaveLength(6);
  });
});

describe("normalizeObjectFirstHouseFormDraft composition round-trip (PR-COMP-PHASE2)", () => {
  function baseDraft(): Partial<ObjectFirstHouseFormDraft> {
    return {
      id: "house-1",
      label: "House 1",
      transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
      footprint: {
        mode: "custom_polygon",
        preset: "straight",
        params: {
          widthM: "6",
          offsetXM: "0",
          setbackM: "0",
          bandDepthM: "4",
          returnRunM: "0",
          recessWidthM: "0",
          recessDepthM: "0",
          leftLegRunM: "0",
          rightLegRunM: "0",
          sideRunM: "0",
        },
        polygon: [
          { alongM: "0", depthM: "0" },
          { alongM: "6", depthM: "0" },
          { alongM: "6", depthM: "4" },
          { alongM: "0", depthM: "4" },
        ],
        attachmentSide: "rear",
      },
      roofIntent: {
        form: "hipped",
        material: "corrugated_iron",
        primaryPitchDeg: "25",
        primaryFallDirection: "positive_y",
        ridgeAxis: "x",
        openGableEndIds: [],
      },
      storeyMode: "single_storey",
      attachmentStrategy: null,
    };
  }

  it("preserves a valid composition through normalisation", () => {
    const normalised = normalizeObjectFirstHouseFormDraft({
      ...baseDraft(),
      composition: L_COMPOSITION,
    });
    expect(normalised?.composition).toBeDefined();
    expect(normalised?.composition?.primitives).toHaveLength(2);
    expect(normalised?.composition?.joins).toHaveLength(1);
  });

  it("preserves drafts without a composition (legacy free-form forms)", () => {
    const normalised = normalizeObjectFirstHouseFormDraft(baseDraft());
    expect(normalised?.composition).toBeUndefined();
  });

  it("drops a structurally invalid composition (defensive — bad data must not crash)", () => {
    const invalid: HouseComposition = {
      primitives: [
        {
          kind: "axisAlignedRectangle",
          originXMm: 0,
          originYMm: 0,
          widthMm: 0, // non-positive
          depthMm: 4000,
          roofIntent: {
            form: "hipped",
            pitchDeg: 25,
            ridgeAxis: "x",
            startCap: "hipped",
            endCap: "hipped",
          },
        },
      ],
      joins: [],
    };
    const normalised = normalizeObjectFirstHouseFormDraft({
      ...baseDraft(),
      composition: invalid,
    });
    // Form survives; composition silently dropped.
    expect(normalised).not.toBeNull();
    expect(normalised?.composition).toBeUndefined();
  });

  it("drops an empty composition", () => {
    const empty: HouseComposition = { primitives: [], joins: [] };
    const normalised = normalizeObjectFirstHouseFormDraft({
      ...baseDraft(),
      composition: empty,
    });
    expect(normalised?.composition).toBeUndefined();
  });
});
