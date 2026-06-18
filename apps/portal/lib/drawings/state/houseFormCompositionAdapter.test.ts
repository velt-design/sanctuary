import { describe, expect, it } from "vitest";
import type { HouseFormModel } from "./objectFirstWorkbenchModel";
import {
  buildSingleRectangleCompositionFromHouseForm,
  syncSingleRectangleComposition,
} from "./houseFormCompositionAdapter";

function straightPresetForm(overrides?: {
  widthM?: string;
  bandDepthM?: string;
  pitchDeg?: string;
  ridgeAxis?: "x" | "y";
  openGableEndIds?: string[];
  form?: "flat" | "mono" | "hipped";
  fallDirection?: "positive_x" | "negative_x" | "positive_y" | "negative_y";
}): HouseFormModel {
  return {
    id: "house-1",
    label: "House 1",
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
    footprint: {
      mode: "preset",
      preset: "straight",
      params: {
        widthM: overrides?.widthM ?? "6",
        offsetXM: "0",
        setbackM: "0",
        bandDepthM: overrides?.bandDepthM ?? "4",
        returnRunM: "0",
        recessWidthM: "0",
        recessDepthM: "0",
        leftLegRunM: "0",
        rightLegRunM: "0",
        sideRunM: "0",
      },
      polygon: [],
      attachmentSide: "rear",
    },
    roofIntent: {
      form: overrides?.form ?? "hipped",
      material: "corrugated_iron",
      primaryPitchDeg: overrides?.pitchDeg ?? "25",
      primaryFallDirection: overrides?.fallDirection ?? "positive_y",
      ridgeAxis: overrides?.ridgeAxis ?? "x",
      openGableEndIds: overrides?.openGableEndIds ?? [],
    },
    storeyMode: "single_storey",
    attachmentStrategy: null,
  };
}

describe("buildSingleRectangleCompositionFromHouseForm (PR-COMP-PHASE3)", () => {
  it("builds a 6m × 4m composition for the default straight preset (hipped)", () => {
    const composition = buildSingleRectangleCompositionFromHouseForm(
      straightPresetForm(),
    );
    expect(composition).not.toBeNull();
    expect(composition?.primitives).toHaveLength(1);
    expect(composition?.joins).toHaveLength(0);
    const rect = composition!.primitives[0]!;
    if (rect.kind !== "axisAlignedRectangle") {
      throw new Error("expected axisAlignedRectangle primitive");
    }
    expect(rect.widthMm).toBe(6000);
    expect(rect.depthMm).toBe(4000);
    expect(rect.originXMm).toBe(0);
    expect(rect.originYMm).toBe(0);
    if (rect.roofIntent.form !== "hipped") {
      throw new Error("expected hipped intent");
    }
    expect(rect.roofIntent.pitchDeg).toBe(25);
    expect(rect.roofIntent.ridgeAxis).toBe("x");
    expect(rect.roofIntent.startCap).toBe("hipped");
    expect(rect.roofIntent.endCap).toBe("hipped");
  });

  it("returns null for custom_polygon mode (legacy free-form forms)", () => {
    const houseForm = straightPresetForm();
    houseForm.footprint.mode = "custom_polygon";
    expect(buildSingleRectangleCompositionFromHouseForm(houseForm)).toBeNull();
  });

  it("returns null for non-straight presets (L / U / etc. are Phase 4 territory)", () => {
    const houseForm = straightPresetForm();
    houseForm.footprint.preset = "l_left";
    expect(buildSingleRectangleCompositionFromHouseForm(houseForm)).toBeNull();
  });

  it("returns null for non-positive width or depth", () => {
    expect(
      buildSingleRectangleCompositionFromHouseForm(straightPresetForm({ widthM: "0" })),
    ).toBeNull();
    expect(
      buildSingleRectangleCompositionFromHouseForm(straightPresetForm({ bandDepthM: "0" })),
    ).toBeNull();
  });

  it("translates mono intent with the requested fall direction", () => {
    const composition = buildSingleRectangleCompositionFromHouseForm(
      straightPresetForm({
        form: "mono",
        pitchDeg: "15",
        fallDirection: "negative_x",
      }),
    );
    const rect = composition!.primitives[0]!;
    if (rect.kind !== "axisAlignedRectangle") {
      throw new Error("expected axisAlignedRectangle primitive");
    }
    if (rect.roofIntent.form !== "mono") {
      throw new Error("expected mono intent");
    }
    expect(rect.roofIntent.pitchDeg).toBe(15);
    expect(rect.roofIntent.fallDirection).toBe("negative_x");
  });

  it("translates flat intent (no pitch / fall data needed)", () => {
    const composition = buildSingleRectangleCompositionFromHouseForm(
      straightPresetForm({ form: "flat" }),
    );
    const rect = composition!.primitives[0]!;
    if (rect.kind !== "axisAlignedRectangle") {
      throw new Error("expected axisAlignedRectangle primitive");
    }
    expect(rect.roofIntent.form).toBe("flat");
  });
});

describe("syncSingleRectangleComposition (PR-COMP-PHASE3)", () => {
  it("derives a fresh composition when none exists yet", () => {
    const result = syncSingleRectangleComposition({
      existing: null,
      houseForm: straightPresetForm({ widthM: "8", bandDepthM: "5" }),
    });
    const rect = result!.primitives[0]!;
    if (rect.kind !== "axisAlignedRectangle") {
      throw new Error("expected axisAlignedRectangle primitive");
    }
    expect(rect.widthMm).toBe(8000);
    expect(rect.depthMm).toBe(5000);
  });

  it("overwrites a single-rectangle composition when the form has been resized", () => {
    const original = buildSingleRectangleCompositionFromHouseForm(
      straightPresetForm({ widthM: "6", bandDepthM: "4" }),
    );
    // Designer resizes the form: widthM 6 → 10
    const resizedForm = straightPresetForm({ widthM: "10", bandDepthM: "4" });
    const synced = syncSingleRectangleComposition({
      existing: original,
      houseForm: resizedForm,
    });
    const rect = synced!.primitives[0]!;
    if (rect.kind !== "axisAlignedRectangle") {
      throw new Error("expected axisAlignedRectangle primitive");
    }
    expect(rect.widthMm).toBe(10000);
  });

  it("returns multi-rectangle compositions UNCHANGED (Phase 4 authored data must survive)", () => {
    const multiRect = {
      primitives: [
        {
          kind: "axisAlignedRectangle" as const,
          originXMm: 0,
          originYMm: 0,
          widthMm: 12500,
          depthMm: 8000,
          roofIntent: {
            form: "hipped" as const,
            pitchDeg: 25,
            ridgeAxis: "x" as const,
            startCap: "hipped" as const,
            endCap: "hipped" as const,
          },
        },
        {
          kind: "axisAlignedRectangle" as const,
          originXMm: 0,
          originYMm: -2400,
          widthMm: 5814,
          depthMm: 2400,
          roofIntent: {
            form: "hipped" as const,
            pitchDeg: 25,
            ridgeAxis: "x" as const,
            startCap: "hipped" as const,
            endCap: "hipped" as const,
          },
        },
      ],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "south" as const,
          toPrimitiveIndex: 1,
          toEdge: "north" as const,
        },
      ],
    };
    const synced = syncSingleRectangleComposition({
      existing: multiRect,
      houseForm: straightPresetForm({ widthM: "6", bandDepthM: "4" }),
    });
    // Multi-rectangle composition survives the sync attempt unchanged.
    expect(synced).toBe(multiRect);
  });
});
