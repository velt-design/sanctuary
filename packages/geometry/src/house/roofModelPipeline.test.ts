import { describe, expect, it } from "vitest";
import type { Polygon3, RawHouseInput } from "../contracts";
import { buildHouseModel3DFromRawHouseInput } from "../houseModel";
import { buildHouseRoofModelPipeline } from "./roofModelPipeline";

function rectangleFootprint(widthMm = 6000, depthMm = 1800): Polygon3 {
  return [
    { x: 0, y: -depthMm, z: 0 },
    { x: widthMm, y: -depthMm, z: 0 },
    { x: widthMm, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
}

function rawHouse(overrides: Partial<RawHouseInput> = {}): RawHouseInput {
  return {
    houseId: "house-form-1",
    eaveHeightM: "2.4",
    wallHeightM: "2.4",
    roofPitchDeg: "20",
    roofForm: "hipped",
    roofRidgeAxis: "x",
    ...overrides,
  };
}

describe("buildHouseRoofModelPipeline", () => {
  it("classifies a healthy package roof model with no failing stage", () => {
    const model = buildHouseModel3DFromRawHouseInput({
      rawHouse: rawHouse(),
      footprint: rectangleFootprint(),
      pergolaAttachment: null,
    });

    const result = buildHouseRoofModelPipeline({
      houseId: "house-form-1",
      model,
    });

    expect(result.ok).toBe(true);
    expect(result.houseId).toBe("house-form-1");
    expect(result.diagnostics).toEqual(
      expect.objectContaining({
        houseId: "house-form-1",
        modelPresent: true,
        failureStage: "none",
        diagnosticCode: null,
        footprintNormalizationStatus: "ok",
        eavePolygonConstructionStatus: "ok",
        roofIntentNormalizationStatus: "ok",
        roofTopologyClassificationStatus: "ok",
        roofPlaneGenerationStatus: "ok",
        roofQaValidationStatus: "ok",
      }),
    );
    expect(result.diagnostics.roofPlaneCountAfterQa).toBeGreaterThan(0);
    expect(result.diagnostics.roofSolidCount).toBeGreaterThan(0);
  });

  it("does not classify healthy mono roof body output as an eave construction failure", () => {
    const model = buildHouseModel3DFromRawHouseInput({
      rawHouse: rawHouse({
        roofForm: "mono",
        roofPitchDeg: "25",
        roofRidgeAxis: "x",
      }),
      footprint: rectangleFootprint(4851, 6000),
      pergolaAttachment: null,
    });

    const result = buildHouseRoofModelPipeline({
      houseId: "house-form-mono",
      model,
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.objectContaining({
        failureStage: "none",
        diagnosticCode: null,
        roofGeometry: "footprint_mono",
        eavePolygonConstructionStatus: "ok",
        roofQaValidationStatus: "ok",
      }),
    );
    expect(result.diagnostics.roofPlaneCountAfterQa).toBeGreaterThan(0);
    expect(result.diagnostics.roofSolidCount).toBeGreaterThan(0);
  });

  it("classifies missing models without inventing downstream roof stages", () => {
    const result = buildHouseRoofModelPipeline({
      houseId: "missing-house",
      model: null,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        houseId: "missing-house",
        model: null,
      }),
    );
    expect(result.diagnostics).toEqual(
      expect.objectContaining({
        houseId: "missing-house",
        modelPresent: false,
        failureStage: "missing_model",
        diagnosticCode: "missing_model",
        footprintNormalizationStatus: "not_started",
        eavePolygonConstructionStatus: "not_started",
        roofIntentNormalizationStatus: "not_started",
        roofTopologyClassificationStatus: "not_started",
        roofPlaneGenerationStatus: "not_started",
        roofQaValidationStatus: "not_started",
        roofPlaneCountBeforeQa: 0,
        roofPlaneCountAfterQa: 0,
      }),
    );
  });
});
