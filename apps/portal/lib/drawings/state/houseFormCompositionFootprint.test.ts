import { describe, expect, it } from "vitest";
import type { HouseComposition } from "@sp/geometry";
import {
  deriveCompositionUnionPolygon3,
  deriveHouseFormFootprintPolygon,
} from "./houseFormCompositionFootprint";
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

describe("deriveCompositionUnionPolygon3 (PR-COMP-PHASE4a.2)", () => {
  function singleRectangleComposition(): HouseComposition {
    return {
      primitives: [
        {
          kind: "axisAlignedRectangle",
          originXMm: 0,
          originYMm: 0,
          widthMm: 6000,
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
  }

  it("returns null when composition is null or undefined", () => {
    expect(deriveCompositionUnionPolygon3(null)).toBeNull();
    expect(deriveCompositionUnionPolygon3(undefined)).toBeNull();
  });

  it("returns null when composition is empty (no primitives)", () => {
    expect(deriveCompositionUnionPolygon3({ primitives: [], joins: [] })).toBeNull();
  });

  it("returns null for a single-primitive composition (preserves Phase 3.2 byte-equivalence)", () => {
    // Phase 3.2 pinned: single-rectangle composites must render byte-
    // equivalent to the legacy preset path. Substituting the union
    // for single-rectangle would risk drift; return null so the
    // pipeline uses the legacy preset footprint instead.
    expect(deriveCompositionUnionPolygon3(singleRectangleComposition())).toBeNull();
  });

  it("returns the union Polygon3 for a 2-primitive L composition (Graham–Oratia v1)", () => {
    const polygon = deriveCompositionUnionPolygon3(L_COMPOSITION);
    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(6);
    // Every vertex has z = 0 (Polygon3 contract).
    expect(polygon!.every((vertex) => vertex.z === 0)).toBe(true);
    // Vertex coordinates (mm) — order doesn't matter for this assertion.
    const sorted = polygon!
      .map((vertex) => [vertex.x, vertex.y])
      .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
    expect(sorted).toEqual([
      [0, -2400],
      [0, 8000],
      [5814, -2400],
      [5814, 0],
      [12500, 0],
      [12500, 8000],
    ]);
  });

  it("returns the union Polygon3 for a 2-primitive T composition", () => {
    // T composition: 6m × 4m base + 2m × 2m centred extension on top.
    //
    //       +---+
    //       | B |
    //   +---+---+---+
    //   |     A     |
    //   +-----------+
    const tComposition: HouseComposition = {
      primitives: [
        {
          kind: "axisAlignedRectangle",
          originXMm: 0,
          originYMm: 0,
          widthMm: 6000,
          depthMm: 4000,
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
          originXMm: 2000,
          originYMm: 4000,
          widthMm: 2000,
          depthMm: 2000,
          roofIntent: {
            form: "hipped",
            pitchDeg: 25,
            ridgeAxis: "y",
            startCap: "hipped",
            endCap: "hipped",
          },
        },
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
      ],
    };
    const polygon = deriveCompositionUnionPolygon3(tComposition);
    expect(polygon).not.toBeNull();
    // T has 8 distinct corner vertices.
    expect(polygon).toHaveLength(8);
    expect(polygon!.every((vertex) => vertex.z === 0)).toBe(true);
  });

  it("returns the union Polygon3 for a fused-rectangle composition (2 rectangles that union into one)", () => {
    // Two side-by-side 3m × 4m rectangles that fuse into a 6m × 4m
    // rectangle. composeFootprintFromComposition merges them cleanly.
    const fused: HouseComposition = {
      primitives: [
        {
          kind: "axisAlignedRectangle",
          originXMm: 0,
          originYMm: 0,
          widthMm: 3000,
          depthMm: 4000,
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
          originXMm: 3000,
          originYMm: 0,
          widthMm: 3000,
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
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
      ],
    };
    const polygon = deriveCompositionUnionPolygon3(fused);
    expect(polygon).not.toBeNull();
    // Fused result is one rectangle = 4 corners after the
    // collinear-cleanup pass inside composeFootprintFromComposition.
    expect(polygon).toHaveLength(4);
    const sorted = polygon!
      .map((vertex) => [vertex.x, vertex.y])
      .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
    expect(sorted).toEqual([
      [0, 0],
      [0, 4000],
      [6000, 0],
      [6000, 4000],
    ]);
  });

  it("returns null defensively when composeFootprintFromComposition throws (malformed composition)", () => {
    // A 2-primitive composition where one primitive has a non-rectangle
    // kind. composeFootprintFromComposition throws "unsupported
    // primitive kind"; our helper catches and returns null so the
    // pipeline falls back to the legacy preset path instead of
    // crashing.
    const broken: HouseComposition = {
      primitives: [
        {
          kind: "axisAlignedRectangle",
          originXMm: 0,
          originYMm: 0,
          widthMm: 6000,
          depthMm: 4000,
          roofIntent: {
            form: "hipped",
            pitchDeg: 25,
            ridgeAxis: "x",
            startCap: "hipped",
            endCap: "hipped",
          },
        },
        // The polymorphic primitive union allows `kind: "unknown"`
        // for future extensibility; composeFootprintFromComposition
        // throws on it ("unsupported primitive kind"). Our helper
        // catches and returns null — the defensive fallback.
        { kind: "unknown", reserved: true },
      ],
      joins: [],
    };
    expect(deriveCompositionUnionPolygon3(broken)).toBeNull();
  });
});
