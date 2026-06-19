import { describe, expect, it } from "vitest";
import type { HouseFormModel } from "./objectFirstWorkbenchModel";
import {
  buildSingleRectangleCompositionFromCustomPolygonForm,
  buildSingleRectangleCompositionFromHouseForm,
  deriveSeamIconCompositionForForm,
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
    // PR-COMP-PHASE4b followup (2026-06-19): origin Y is -depth so
    // the composition rectangle occupies the same -Y half-plane the
    // legacy preset polygon does (attachment side `rear` →
    // setbackM=0 → polygon at y ∈ [-depth, 0]). See
    // `buildSingleRectangleCompositionFromHouseForm` for the
    // legacy-frame discussion.
    expect(rect.originYMm).toBe(-4000);
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

  describe("legacy-frame coherence (PR-COMP-PHASE4b followup)", () => {
    it("composition rectangle occupies the same world-Y range as the legacy preset polygon", () => {
      // This is the load-bearing regression test for the
      // composition-vs-legacy frame mismatch that caused the roof
      // to render translated south from the walls (and the Join
      // chip to appear on the wrong edge) before today's fix.
      //
      // For attachmentSide `rear` + setbackM 0 + offsetXM 0 +
      // widthM 6 + bandDepthM 4, the legacy preset polygon
      // (`buildHouseFootprintPolygon`) returns corners at
      //   (0, 0), (6000, 0), (6000, -4000), (0, -4000)
      // i.e. world-Y range [-4000, 0]. The composition rectangle
      // MUST occupy the same range so the composition roof aligns
      // with the legacy walls.
      const composition = buildSingleRectangleCompositionFromHouseForm(
        straightPresetForm({ widthM: "6", bandDepthM: "4" }),
      );
      const rect = composition!.primitives[0]!;
      if (rect.kind !== "axisAlignedRectangle") {
        throw new Error("expected axisAlignedRectangle primitive");
      }
      // Composition Y range = [originYMm, originYMm + depthMm].
      const yMin = rect.originYMm;
      const yMax = rect.originYMm + rect.depthMm;
      expect(yMin).toBe(-4000);
      expect(yMax).toBe(0);
    });

    it("honours non-zero setback + offsetX (legacy frame shifts both axes)", () => {
      // setbackM 1 + offsetXM 2 + widthM 6 + bandDepthM 4 should
      // place the legacy polygon at
      //   x ∈ [2000, 8000]
      //   y ∈ [-5000, -1000]
      // The composition rectangle must mirror that.
      const houseForm = straightPresetForm({ widthM: "6", bandDepthM: "4" });
      houseForm.footprint.params.offsetXM = "2";
      houseForm.footprint.params.setbackM = "1";
      const composition = buildSingleRectangleCompositionFromHouseForm(houseForm);
      const rect = composition!.primitives[0]!;
      if (rect.kind !== "axisAlignedRectangle") {
        throw new Error("expected axisAlignedRectangle primitive");
      }
      expect(rect.originXMm).toBe(2000);
      expect(rect.originXMm + rect.widthMm).toBe(8000);
      expect(rect.originYMm).toBe(-5000);
      expect(rect.originYMm + rect.depthMm).toBe(-1000);
    });
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

describe("buildSingleRectangleCompositionFromCustomPolygonForm (PR-WB-CUSTOM-POLY-COMPOSITION)", () => {
  function customPolygonForm(input: {
    polygon: Array<{ alongM: string; depthM: string }>;
  }): HouseFormModel {
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
        polygon: input.polygon,
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

  it("builds a synthetic composition for a 4-vertex axis-aligned polygon (resize-converted form)", () => {
    // House 1 from the user's actual workbench: a 6m wide form
    // resized to ~16.8m deep, stored as a custom_polygon with the
    // legacy frame's `-y = depth` convention.
    const form = customPolygonForm({
      polygon: [
        { alongM: "0", depthM: "-7.575685093268681" },
        { alongM: "6", depthM: "-7.575685093268681" },
        { alongM: "6", depthM: "9.219380999731317" },
        { alongM: "0", depthM: "9.219380999731317" },
      ],
    });
    const composition = buildSingleRectangleCompositionFromCustomPolygonForm(form);
    expect(composition).not.toBeNull();
    expect(composition!.primitives).toHaveLength(1);
    const rect = composition!.primitives[0]!;
    if (rect.kind !== "axisAlignedRectangle") {
      throw new Error("expected rectangle");
    }
    // Polygon spans form-local (x, y):
    //   x = alongM * 1000 ∈ [0, 6000]
    //   y = -depthM * 1000 ∈ [-9219.38, 7575.69]
    // Composition rectangle should occupy the same form-local
    // extent so the seam detector sees the form's edges where the
    // walls actually are.
    expect(rect.originXMm).toBe(0);
    expect(rect.widthMm).toBe(6000);
    expect(Math.round(rect.originYMm)).toBe(-9219);
    expect(Math.round(rect.depthMm)).toBe(16795);
  });

  it("returns null for a non-axis-aligned polygon (truly free-form shape)", () => {
    // A diamond-shaped polygon — vertices at the cardinal midpoints.
    // Every edge is diagonal, none axis-aligned.
    const form = customPolygonForm({
      polygon: [
        { alongM: "3", depthM: "0" },
        { alongM: "6", depthM: "2" },
        { alongM: "3", depthM: "4" },
        { alongM: "0", depthM: "2" },
      ],
    });
    expect(buildSingleRectangleCompositionFromCustomPolygonForm(form)).toBeNull();
  });

  it("returns null for a non-4-vertex polygon (e.g. an L-shape)", () => {
    const form = customPolygonForm({
      polygon: [
        { alongM: "0", depthM: "0" },
        { alongM: "6", depthM: "0" },
        { alongM: "6", depthM: "2" },
        { alongM: "3", depthM: "2" },
        { alongM: "3", depthM: "4" },
        { alongM: "0", depthM: "4" },
      ],
    });
    expect(buildSingleRectangleCompositionFromCustomPolygonForm(form)).toBeNull();
  });

  it("returns null for preset mode forms (caller should use the standard builder)", () => {
    const form = customPolygonForm({
      polygon: [
        { alongM: "0", depthM: "0" },
        { alongM: "6", depthM: "0" },
        { alongM: "6", depthM: "4" },
        { alongM: "0", depthM: "4" },
      ],
    });
    form.footprint.mode = "preset";
    expect(buildSingleRectangleCompositionFromCustomPolygonForm(form)).toBeNull();
  });

  it("tolerates sub-millimetre floating-point noise on the axis-aligned check", () => {
    // Drag-commit-encoded polygons sometimes have tiny float drift
    // (1e-10 metres ~ 1e-7 mm). The axis-aligned check must accept
    // this since the validator/normaliser preserve the same noise.
    const form = customPolygonForm({
      polygon: [
        { alongM: "-1.2531927495729177e-10", depthM: "-7.575685093268681" },
        { alongM: "5.999999999874681", depthM: "-7.575685093268681" },
        { alongM: "5.999999999874681", depthM: "9.219380999731317" },
        { alongM: "-1.2531927495729177e-10", depthM: "9.219380999731317" },
      ],
    });
    const composition = buildSingleRectangleCompositionFromCustomPolygonForm(form);
    expect(composition).not.toBeNull();
  });
});

describe("deriveSeamIconCompositionForForm (PR-WB-CUSTOM-POLY-COMPOSITION)", () => {
  function customPolygonForm(): HouseFormModel {
    return {
      id: "house-1",
      label: "House 1",
      transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
      footprint: {
        mode: "custom_polygon",
        preset: "straight",
        params: {
          widthM: "6", offsetXM: "0", setbackM: "0", bandDepthM: "4",
          returnRunM: "0", recessWidthM: "0", recessDepthM: "0",
          leftLegRunM: "0", rightLegRunM: "0", sideRunM: "0",
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
        form: "hipped", material: "corrugated_iron",
        primaryPitchDeg: "25", primaryFallDirection: "positive_y",
        ridgeAxis: "x", openGableEndIds: [],
      },
      storeyMode: "single_storey",
      attachmentStrategy: null,
    };
  }

  it("returns the authored composition when present (composition wins over inference)", () => {
    const form = straightPresetForm();
    const composition = buildSingleRectangleCompositionFromHouseForm(form)!;
    const formWithComposition: HouseFormModel = { ...form, composition };
    const result = deriveSeamIconCompositionForForm(formWithComposition);
    expect(result).toBe(composition);
  });

  it("synthesises a composition for a custom_polygon form that's an axis-aligned rectangle", () => {
    const result = deriveSeamIconCompositionForForm(customPolygonForm());
    expect(result).not.toBeNull();
    expect(result!.primitives).toHaveLength(1);
  });

  it("returns null for a custom_polygon form whose polygon is genuinely free-form", () => {
    const form = customPolygonForm();
    form.footprint.polygon = [
      { alongM: "3", depthM: "0" },
      { alongM: "6", depthM: "2" },
      { alongM: "3", depthM: "4" },
      { alongM: "0", depthM: "2" },
    ];
    expect(deriveSeamIconCompositionForForm(form)).toBeNull();
  });
});
