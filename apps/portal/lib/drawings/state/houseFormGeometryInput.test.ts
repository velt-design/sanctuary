import { describe, expect, it } from "vitest";
import { getSanctuaryGeometryWorkbenchFixture } from "@/lib/drawings/sanctuaryWorkbenchFixtures";
import { buildWorkbenchSolvedModel } from "./workbenchSolvedModel";
import { buildHouseFormGeometryInput } from "./houseFormGeometryInput";

function multiHouseProjectModel() {
  const fixture = getSanctuaryGeometryWorkbenchFixture(
    "multi-house-u-two-pergola",
  );
  if (!fixture) throw new Error("Missing multi-house fixture.");
  return buildWorkbenchSolvedModel({
    snapshot: fixture.snapshot,
    draft: fixture.draft,
    moduleLabels: fixture.moduleLabels,
    activePergolaId: "pergola-1",
  }).projectModel;
}

describe("buildHouseFormGeometryInput", () => {
  it("builds independent geometry input for each house form id", () => {
    const projectModel = multiHouseProjectModel();

    const houseOne = buildHouseFormGeometryInput({
      projectModel,
      houseFormId: "house-main",
    });
    const houseTwo = buildHouseFormGeometryInput({
      projectModel,
      houseFormId: "house-form-2",
    });

    expect(houseOne.ok).toBe(true);
    expect(houseTwo.ok).toBe(true);
    if (!houseOne.ok || !houseTwo.ok) return;
    expect(houseOne.rawHouseInput.houseId).toBe("house-main");
    expect(houseTwo.rawHouseInput.houseId).toBe("house-form-2");
    expect(houseOne.referenceShape.id).toContain("house-main");
    expect(houseTwo.referenceShape.id).toContain("house-form-2");
    expect(houseOne.diagnostics.failureStage).toBe("none");
    expect(houseTwo.diagnostics.failureStage).toBe("none");
    expect(houseOne.diagnostics.roofPipelineFailureStage).toBe("none");
    expect(houseTwo.diagnostics.roofPipelineFailureStage).toBe("none");
    expect(houseOne.diagnostics.roofQaStatus).toBe("valid");
    expect(houseTwo.diagnostics.roofQaStatus).toBe("valid");
    expect(houseOne.diagnostics.footprintNormalizationStatus).toBe("ok");
    expect(houseTwo.diagnostics.footprintNormalizationStatus).toBe("ok");
    expect(houseOne.diagnostics.roofPlaneGenerationStatus).toBe("ok");
    expect(houseTwo.diagnostics.roofPlaneGenerationStatus).toBe("ok");
    expect(houseOne.diagnostics.eavePolygonPointCount).toBeGreaterThan(0);
    expect(houseTwo.diagnostics.eavePolygonPointCount).toBeGreaterThan(0);
    expect(houseOne.diagnostics.roofPlaneCountBeforeQa).toBeGreaterThan(0);
    expect(houseOne.diagnostics.roofPlaneCountAfterQa).toBeGreaterThan(0);
    expect(houseTwo.diagnostics.roofPlaneCountBeforeQa).toBeGreaterThan(0);
    expect(houseTwo.diagnostics.roofPlaneCountAfterQa).toBeGreaterThan(0);
  });

  it("fails missing ids without falling back to the first house form", () => {
    const projectModel = multiHouseProjectModel();

    const result = buildHouseFormGeometryInput({
      projectModel,
      houseFormId: "missing-house-form",
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        houseFormId: "missing-house-form",
        failureStage: "missing_house_form",
        diagnosticCode: "missing_house_form",
      }),
    );
    expect(result.diagnostics.roofQaStatus).toBeNull();
    expect(result.diagnostics.footprintNormalizationStatus).toBe("not_started");
    expect(result.diagnostics.roofPipelineFailureStage).toBe("not_started");
    expect(result.diagnostics.roofPlaneGenerationStatus).toBe("not_started");
    expect(result.diagnostics.roofPlaneCountBeforeQa).toBe(0);
    expect(result.diagnostics.roofPlaneCountAfterQa).toBe(0);
  });

  it("reports invalid object-owned footprints as the first failing stage", () => {
    const projectModel = multiHouseProjectModel();
    const invalidProjectModel = {
      ...projectModel,
      houseAssembly: {
        ...projectModel.houseAssembly!,
        houseForms: projectModel.houseAssembly!.houseForms.map((houseForm) =>
          houseForm.id === "house-form-2"
            ? {
                ...houseForm,
                footprint: {
                  ...houseForm.footprint,
                  mode: "custom_polygon" as const,
                  polygon: [
                    { alongM: "0", depthM: "0" },
                    { alongM: "1", depthM: "0" },
                  ],
                },
              }
            : houseForm,
        ),
      },
    };

    const result = buildHouseFormGeometryInput({
      projectModel: invalidProjectModel,
      houseFormId: "house-form-2",
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        houseFormId: "house-form-2",
        failureStage: "invalid_footprint",
        diagnosticCode: "invalid_footprint",
      }),
    );
    expect(result.diagnostics.roofPipelineFailureStage).toBe("not_started");
  });
});
