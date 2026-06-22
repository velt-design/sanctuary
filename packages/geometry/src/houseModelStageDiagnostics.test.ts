import { describe, expect, it } from "vitest";
import type { Polygon3, RawHouseInput } from "./contracts";
import {
  buildHouseModel3D,
  buildHouseModel3DFromRawHouseInput,
} from "./houseModel";
import { buildHouseModel3DGeometryConfigInputFromRawHouseInput } from "./houseModelRawInputAdapter";
import { buildHouseRoofModelPipeline } from "./house/roofModelPipeline";
import {
  firstHouseRoofStageDiagnosticCode,
  summarizeHouseModelRoofStageDiagnostics,
} from "./houseRoofDiagnostics";

function makeFootprint(widthMm = 6000, depthMm = 1800): Polygon3 {
  return [
    { x: 0, y: -depthMm, z: 0 },
    { x: widthMm, y: -depthMm, z: 0 },
    { x: widthMm, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
}

function makeRawHouse(overrides: Partial<RawHouseInput> = {}): RawHouseInput {
  return {
    houseId: "house-main",
    eaveHeightM: "2.4",
    wallHeightM: "2.4",
    roofPitchDeg: "20",
    roofForm: "hipped",
    roofRidgeAxis: "x",
    ...overrides,
  };
}

describe("house model stage diagnostics", () => {
  it("exposes the raw-house to GeometryConfig boundary without changing the public adapter output", () => {
    const footprint = makeFootprint();
    const rawHouse = makeRawHouse();

    const modelInput = buildHouseModel3DGeometryConfigInputFromRawHouseInput({
      rawHouse,
      footprint,
      pergolaAttachment: null,
    });
    const fromExtractedInput = buildHouseModel3D({
      houseId: modelInput.houseId,
      config: modelInput.config,
      attachmentEdge: modelInput.attachmentEdge,
    });
    const fromPublicAdapter = buildHouseModel3DFromRawHouseInput({
      rawHouse,
      footprint,
      pergolaAttachment: null,
    });

    expect(modelInput.houseId).toBe("house-main");
    expect(modelInput.houseModelConfig).not.toBeNull();
    expect(fromExtractedInput?.footprint).toEqual(fromPublicAdapter?.footprint);
    expect(
      fromExtractedInput?.wallSegments.map((segment) => segment.id).sort(),
    ).toEqual(
      fromPublicAdapter?.wallSegments.map((segment) => segment.id).sort(),
    );
    expect(fromExtractedInput?.roofPlanes).toHaveLength(
      fromPublicAdapter?.roofPlanes.length ?? -1,
    );
  });

  it("reports package roof stage diagnostics for the model build path", () => {
    const model = buildHouseModel3DFromRawHouseInput({
      rawHouse: makeRawHouse(),
      footprint: makeFootprint(),
      pergolaAttachment: null,
    });
    const diagnostics = summarizeHouseModelRoofStageDiagnostics(model);

    expect(diagnostics.footprintNormalizationStatus).toBe("ok");
    expect(diagnostics.eavePolygonConstructionStatus).toBe("ok");
    expect(diagnostics.roofIntentNormalizationStatus).toBe("ok");
    expect(diagnostics.roofTopologyClassificationStatus).toBe("ok");
    expect(diagnostics.roofPlaneGenerationStatus).toBe("ok");
    expect(diagnostics.roofQaValidationStatus).toBe("ok");
    expect(diagnostics.roofPlaneCountBeforeQa).toBeGreaterThan(0);
    expect(diagnostics.roofPlaneCountAfterQa).toBeGreaterThan(0);
    expect(firstHouseRoofStageDiagnosticCode(diagnostics)).toBeNull();

    const pipelineResult = buildHouseRoofModelPipeline({
      houseId: "house-main",
      model,
    });
    expect(pipelineResult.ok).toBe(true);
    expect(pipelineResult.diagnostics.failureStage).toBe("none");
    expect(pipelineResult.diagnostics.diagnosticCode).toBeNull();
  });
});
