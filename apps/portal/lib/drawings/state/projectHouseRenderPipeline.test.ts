import { describe, expect, it } from "vitest";
import { getSanctuaryGeometryWorkbenchFixture } from "@/lib/drawings/sanctuaryWorkbenchFixtures";
import { planHouseFormOwner } from "@/lib/drawings/views/plan/planShapeOwnership";
import { buildWorkbenchSolvedModel } from "./workbenchSolvedModel";
import { buildProjectHouseRenderPipeline } from "./projectHouseRenderPipeline";

function getFixture(
  name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0],
) {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) throw new Error(`Missing ${name} workbench fixture.`);
  return fixture;
}

describe("buildProjectHouseRenderPipeline", () => {
  it("reports each house render stage by houseFormId", () => {
    const fixture = getFixture("multi-house-u-two-pergola");
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: "pergola-1",
    });

    const pipeline = buildProjectHouseRenderPipeline({
      projectModel: solvedModel.projectModel,
      projectHouseGeometries: solvedModel.projectHouseGeometries,
    });

    expect(pipeline.projectHouseProjectionHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          houseFormId: "house-main",
          referencePresent: true,
          modelPresent: true,
          wallCount: expect.any(Number),
          roofPlaneCount: expect.any(Number),
          roofBodyCount: expect.any(Number),
          roofMaterialBodyCount: expect.any(Number),
          sceneBodyCount: expect.any(Number),
          sceneRoofBodyCount: expect.any(Number),
          sceneRoofMaterialBodyCount: expect.any(Number),
          roofQaStatus: "valid",
          roofQaFailureReason: null,
          footprintNormalizationStatus: "ok",
          roofPlaneGenerationStatus: "ok",
          roofQaValidationStatus: "ok",
          roofPlaneCountBeforeQa: expect.any(Number),
          roofPlaneCountAfterQa: expect.any(Number),
          canRenderCommittedBody: true,
          failureStage: "none",
          diagnosticCode: null,
        }),
        expect.objectContaining({
          houseFormId: "house-form-2",
          referencePresent: true,
          modelPresent: true,
          wallCount: expect.any(Number),
          roofPlaneCount: expect.any(Number),
          canRenderCommittedBody: true,
          failureStage: "none",
        }),
      ]),
    );
  });

  it("keeps house shape ownership independent across multiple forms", () => {
    const fixture = getFixture("multi-house-u-two-pergola");
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: "pergola-2",
    });
    const pipeline = buildProjectHouseRenderPipeline({
      projectModel: solvedModel.projectModel,
      projectHouseGeometries: solvedModel.projectHouseGeometries,
    });

    for (const health of pipeline.projectHouseProjectionHealth) {
      expect(health.planBodyIds.length).toBeGreaterThan(0);
      for (const id of health.planBodyIds) {
        const shape = pipeline.projectHousePlanShapes.find(
          (candidate) => candidate.id === id,
        );
        expect(shape, id).toBeDefined();
        expect(shape ? planHouseFormOwner(shape) : null).toBe(
          health.houseFormId,
        );
      }
    }
  });

  it("reports missing render registry geometry without borrowing another form", () => {
    const fixture = getFixture("multi-house-u-two-pergola");
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: "pergola-1",
    });
    const houseFormIds =
      solvedModel.projectModel.houseAssembly?.houseForms.map(
        (form) => form.id,
      ) ?? [];
    const onlyFirstGeometry = solvedModel.projectHouseGeometries.slice(0, 1);

    const pipeline = buildProjectHouseRenderPipeline({
      projectModel: solvedModel.projectModel,
      projectHouseGeometries: onlyFirstGeometry,
    });

    const missingHouseId = houseFormIds.find(
      (id) => !onlyFirstGeometry.some((entry) => entry.houseFormId === id),
    );
    expect(missingHouseId).toBeTruthy();
    expect(pipeline.projectHouseProjectionHealth).toContainEqual(
      expect.objectContaining({
        houseFormId: missingHouseId,
        referencePresent: false,
        modelPresent: false,
        canRenderCommittedBody: false,
        failureStage: "missing_geometry_input",
        diagnosticCode: "missing_geometry_input",
      }),
    );
  });

  it("reports custom house projection health independently per form", () => {
    const fixture = getFixture("multi-house-custom-projection");
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: "pergola-1",
    });

    const pipeline = buildProjectHouseRenderPipeline({
      projectModel: solvedModel.projectModel,
      projectHouseGeometries: solvedModel.projectHouseGeometries,
    });

    expect(
      pipeline.projectHouseProjectionHealth
        .map((health) => health.houseFormId)
        .sort(),
    ).toEqual(
      ["house-main", "house-form-2", "house-form-3", "house-form-4"].sort(),
    );
    expect(pipeline.projectHouseProjectionHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          houseFormId: "house-main",
          referencePresent: true,
          modelPresent: true,
          wallCount: expect.any(Number),
          roofPlaneCount: expect.any(Number),
          canRenderCommittedBody: true,
          failureStage: "none",
          diagnosticCode: null,
        }),
        expect.objectContaining({
          houseFormId: "house-form-2",
          referencePresent: true,
          modelPresent: true,
          wallCount: expect.any(Number),
          roofPlaneCount: expect.any(Number),
          canRenderCommittedBody: true,
          failureStage: "none",
          diagnosticCode: null,
        }),
        expect.objectContaining({
          houseFormId: "house-form-3",
          referencePresent: true,
          modelPresent: true,
          wallCount: expect.any(Number),
          roofPlaneCount: expect.any(Number),
          canRenderCommittedBody: true,
          failureStage: "none",
          diagnosticCode: null,
        }),
        expect.objectContaining({
          houseFormId: "house-form-4",
          referencePresent: true,
          modelPresent: true,
          wallCount: expect.any(Number),
          roofPlaneCount: expect.any(Number),
          canRenderCommittedBody: true,
          failureStage: "none",
          diagnosticCode: null,
          footprintCanonicalizationStatus: "canonicalized",
          footprintCanonicalizationPrecisionMm: 0.001,
          footprintCanonicalizationPointCountBefore: 6,
          footprintCanonicalizationPointCountAfter: 6,
          roofEaveOffsetRepairStatus: null,
          roofEaveOffsetRepairCode: null,
          roofQaStatus: "valid",
          roofQaFailureReason: null,
        }),
      ]),
    );
    for (const health of pipeline.projectHouseProjectionHealth) {
      expect(health.roofBodyCount, health.houseFormId).toBeGreaterThan(0);
      expect(health.roofMaterialBodyCount, health.houseFormId).toBe(0);
      expect(health.sceneBodyCount, health.houseFormId).toBeGreaterThan(0);
      expect(health.sceneRoofBodyCount, health.houseFormId).toBeGreaterThan(0);
      expect(
        health.sceneRoofMaterialBodyCount,
        health.houseFormId,
      ).toBeGreaterThan(0);
      expect(health.roofQaStatus, health.houseFormId).toBe("valid");
      expect(health.roofPlaneCountBeforeQa, health.houseFormId).toBeGreaterThan(
        0,
      );
      expect(health.roofPlaneCountAfterQa, health.houseFormId).toBeGreaterThan(
        0,
      );
      expect(health.visibleReferenceFallbackIds, health.houseFormId).toEqual(
        [],
      );
    }
  });
});
