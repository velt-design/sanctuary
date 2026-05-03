import { describe, expect, it } from "vitest";
import {
  buildAssemblyQuantityTakeoff,
  solveAssembly3D,
  type Assembly3D,
  type GeometryConfig,
} from "@sp/geometry";
import { listGeometryFixtureCases } from "./fixtures";
import { makeGableConfig } from "./fixtures/builders";
import { lineLength, polygonArea } from "./math3d";

function solve(config: GeometryConfig): Assembly3D {
  const result = solveAssembly3D(config);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function supportedAssembly(id: string): Assembly3D {
  const fixture = listGeometryFixtureCases().find(
    (candidate) => candidate.id === id,
  );
  if (!fixture || fixture.kind !== "supported") {
    throw new Error(`Missing supported fixture ${id}.`);
  }
  return solve(fixture.config);
}

function makeHipCornerConfig(): GeometryConfig {
  return makeGableConfig({
    projectId: "proj_hip_corner",
    estimateId: "est_hip_corner",
    designRequestId: "dpr_hip_corner",
    family: "hip_corner",
    dimensions: {
      lengthMm: 6000,
      projectionMm: 3000,
      lengthBMm: 4000,
      projectionBMm: 2000,
      roofPitchDeg: 5,
    },
    roof: {
      material: "timber",
      mode: "hip_corner",
      fallDirection: "positiveY",
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    supports: {
      postCount: 3,
    },
  });
}

function hookQuantity(assembly: Assembly3D, key: string): number {
  const hook = assembly.quantityHooks.find((candidate) => candidate.key === key);
  if (!hook) {
    throw new Error(`Missing quantity hook ${key}.`);
  }
  return hook.quantity;
}

function flashingSurfaceAreaMm2(assembly: Assembly3D): number {
  return (assembly.roofFlashings ?? []).reduce(
    (sum, flashing) =>
      sum + flashing.wings.reduce((wingSum, wing) => wingSum + polygonArea(wing.boundary), 0),
    0,
  );
}

describe("buildAssemblyQuantityTakeoff", () => {
  it("derives coherent physical takeoff for every supported geometry fixture", () => {
    for (const fixture of listGeometryFixtureCases().filter((candidate) => candidate.kind === "supported")) {
      const assembly = solve(fixture.config);
      const takeoff = buildAssemblyQuantityTakeoff(assembly);

      expect(takeoff.family, fixture.id).toBe(assembly.family);
      expect(takeoff.primaryDimensionsMm, fixture.id).toEqual({
        length: fixture.config.dimensions.lengthMm,
        projection: fixture.config.dimensions.projectionMm,
      });
      expect(takeoff.roofPlanes.count, fixture.id).toBe(assembly.roofPlanes.length);
      expect(takeoff.roofPlanes.items, fixture.id).toHaveLength(assembly.roofPlanes.length);
      expect(takeoff.members.items, fixture.id).toHaveLength(assembly.members.length);
      expect(takeoff.flashings.count, fixture.id).toBe(assembly.roofFlashings?.length ?? 0);
      expect(takeoff.flashings.items, fixture.id).toHaveLength(assembly.roofFlashings?.length ?? 0);
      expect(takeoff.flashings.totalSurfaceAreaMm2, fixture.id).toBeCloseTo(flashingSurfaceAreaMm2(assembly), 3);
      for (const roofPlane of takeoff.roofPlanes.items) {
        expect(roofPlane.rafterBayCount, `${fixture.id} ${roofPlane.id}`).toBe(
          Math.max(0, roofPlane.rafterCount - 1),
        );
        if (roofPlane.rafterCount > 1) {
          expect(roofPlane.rafterAverageSpacingMm, `${fixture.id} ${roofPlane.id}`).toBeGreaterThan(0);
          expect(roofPlane.rafterAverageSpacingM, `${fixture.id} ${roofPlane.id}`).toBeGreaterThan(0);
        } else {
          expect(roofPlane.rafterAverageSpacingMm, `${fixture.id} ${roofPlane.id}`).toBeNull();
          expect(roofPlane.rafterAverageSpacingM, `${fixture.id} ${roofPlane.id}`).toBeNull();
        }
      }
      expect(takeoff.quantityHooks, fixture.id).toEqual([...assembly.quantityHooks].sort((a, b) => a.key.localeCompare(b.key)));
      expect(takeoff.diagnostics, fixture.id).toEqual([]);
    }
  });

  it("derives mono acrylic physical takeoff from the solved assembly", () => {
    const assembly = supportedAssembly("mono_attached_soffit_away_standard");
    const takeoff = buildAssemblyQuantityTakeoff(assembly);

    const expectedRoofAreaMm2 = assembly.roofPlanes.reduce(
      (sum, plane) => sum + polygonArea(plane.boundary),
      0,
    );
    const expectedCladdingAreaMm2 = assembly.roofCladdingPanels.reduce(
      (sum, panel) => sum + polygonArea(panel.boundary),
      0,
    );

    expect(takeoff.family).toBe("mono");
    expect(takeoff.primaryDimensionsMm).toEqual({ length: 6000, projection: 3000 });
    expect(takeoff.roofPlanes.count).toBe(assembly.roofPlanes.length);
    expect(takeoff.roofPlanes.totalAreaMm2).toBeCloseTo(expectedRoofAreaMm2, 3);
    expect(takeoff.roofPlanes.items[0]).toEqual(
      expect.objectContaining({
        id: assembly.roofPlanes[0]?.id,
        rafterCount: assembly.members.filter((member) => member.role === "rafter").length,
        rafterBayCount: assembly.members.filter((member) => member.role === "rafter").length - 1,
        rafterTotalLengthM: takeoff.members.byRole.rafter.totalLengthM,
        rafterAverageSpacingMm: 600,
        rafterAverageSpacingM: 0.6,
        claddingPanelCount: assembly.roofCladdingPanels.length,
        claddingAreaM2: takeoff.roofCladding.totalAreaM2,
        joinerCount: assembly.members.filter((member) => member.role === "joiner").length,
        joinerTotalLengthM: takeoff.joiners.totalLengthM,
      }),
    );
    expect(takeoff.roofCladding.panelCount).toBe(assembly.roofCladdingPanels.length);
    expect(takeoff.roofCladding.totalAreaMm2).toBeCloseTo(expectedCladdingAreaMm2, 3);
    expect(takeoff.roofCladding.items).toHaveLength(assembly.roofCladdingPanels.length);
    expect(takeoff.roofCladding.items[0]).toEqual(
      expect.objectContaining({
        id: assembly.roofCladdingPanels[0]?.id,
        material: "acrylic",
        roofPlaneId: assembly.roofPlanes[0]?.id,
        thicknessMm: assembly.roofCladdingPanels[0]?.thicknessMm,
      }),
    );
    expect(takeoff.members.byRole.post.count).toBe(hookQuantity(assembly, "posts.count"));
    expect(takeoff.members.items).toHaveLength(assembly.members.length);
    expect(takeoff.members.byRole.post.items).toHaveLength(takeoff.members.byRole.post.count);
    expect(takeoff.members.byRole.post.items[0]).toEqual(
      expect.objectContaining({
        role: "post",
        lengthMm: expect.any(Number),
        profileKey: expect.any(String),
      }),
    );
    expect(takeoff.members.byRole.rafter.totalLengthMm).toBeCloseTo(
      hookQuantity(assembly, "rafters.total_length_mm"),
      0,
    );
    expect(takeoff.joiners.count).toBe(assembly.members.filter((member) => member.role === "joiner").length);
    expect(takeoff.joiners.totalLengthM).toBe(takeoff.members.byRole.joiner.totalLengthM);
    expect(takeoff.joiners.averageLengthM).toBe(takeoff.members.byRole.joiner.averageLengthM);
    expect(takeoff.joiners.items).toHaveLength(takeoff.joiners.count);
    expect(takeoff.beams.totalBeamLengthM).toBe(takeoff.members.byRole.beam.totalLengthM);
    expect(takeoff.gutters.totalLengthM).toBe(takeoff.members.byRole.gutter.totalLengthM);
    expect(takeoff.gutters.items).toHaveLength(takeoff.members.byRole.gutter.count);
    expect(takeoff.quantityHooks).toEqual([...assembly.quantityHooks].sort((a, b) => a.key.localeCompare(b.key)));
    expect(takeoff.diagnostics).toEqual([]);
  });

  it("derives gable acrylic ridge flashing physical takeoff from Assembly3D roof flashings", () => {
    const assembly = solve(
      makeGableConfig({
        roof: {
          material: "acrylic",
        },
        roofCovering: {
          kind: "acrylic",
        },
      }),
    );
    const takeoff = buildAssemblyQuantityTakeoff(assembly);
    const ridgeFlashing = assembly.roofFlashings?.find((flashing) => flashing.id === "ridge-flashing");

    expect(ridgeFlashing).toBeDefined();
    expect(takeoff.flashings.count).toBe(1);
    expect(takeoff.flashings.items).toEqual([
      expect.objectContaining({
        id: "ridge-flashing",
        lengthMm: ridgeFlashing?.metadata?.runLengthMm,
        lengthM: 6.55,
        girthMm: 300,
        thicknessMm: 1,
        wingCount: 2,
        surfaceAreaMm2: expect.any(Number),
        surfaceAreaM2: expect.any(Number),
      }),
    ]);
    expect(takeoff.flashings.totalLengthMm).toBe(ridgeFlashing?.metadata?.runLengthMm);
    expect(takeoff.flashings.totalLengthM).toBe(6.55);
    expect(takeoff.flashings.totalSurfaceAreaMm2).toBeCloseTo(flashingSurfaceAreaMm2(assembly), 3);
    expect(takeoff.flashings.byGirthMm["300"]).toEqual(
      expect.objectContaining({
        girthMm: 300,
        count: 1,
        totalLengthMm: ridgeFlashing?.metadata?.runLengthMm,
        totalLengthM: 6.55,
      }),
    );
    expect(takeoff.quantityHooks).toEqual([...assembly.quantityHooks].sort((a, b) => a.key.localeCompare(b.key)));
    expect(takeoff.diagnostics).toEqual([]);
  });

  it("derives gable and hip physical takeoff from their solved assemblies", () => {
    const gable = supportedAssembly("gable_attached_standard");
    const hip = solve(makeGableConfig({ family: "hip" }));

    for (const assembly of [gable, hip]) {
      const takeoff = buildAssemblyQuantityTakeoff(assembly);
      const expectedTieLengthMm = assembly.members
        .filter((member) => member.metadata?.frameRole === "tie_beam")
        .reduce((sum, member) => sum + lineLength(member.centerline), 0);

      expect(takeoff.family).toBe(assembly.family);
      expect(takeoff.roofPlanes.count).toBe(2);
      expect(takeoff.roofPlanes.items).toHaveLength(2);
      expect(takeoff.roofPlanes.items.map((plane) => plane.rafterCount)).toEqual([12, 12]);
      expect(takeoff.roofPlanes.items.map((plane) => plane.rafterBayCount)).toEqual([11, 11]);
      expect(takeoff.roofPlanes.items.map((plane) => plane.rafterAverageSpacingMm)).toEqual([590.909091, 590.909091]);
      expect(takeoff.roofPlanes.items.map((plane) => plane.rafterAverageSpacingM)).toEqual([0.590909, 0.590909]);
      expect(takeoff.roofPlanes.items.every((plane) => plane.rafterTotalLengthMm > 0)).toBe(true);
      expect(takeoff.members.byRole.ridge.totalLengthMm).toBeGreaterThan(0);
      expect(takeoff.beams.tieBeamLengthMm).toBeCloseTo(expectedTieLengthMm, 3);
      expect(takeoff.quantityHookMap["roof_planes.count"]).toBe(2);
    }
  });

  it("derives box perimeter beam and gutter quantities without pricing policy", () => {
    const assembly = supportedAssembly("box_attached_standard");
    const takeoff = buildAssemblyQuantityTakeoff(assembly);

    expect(takeoff.family).toBe("box");
    expect(takeoff.beams.supportBeamLengthMm).toBeCloseTo(
      hookQuantity(assembly, "box_perimeter_beams.total_length_mm"),
      0,
    );
    expect(takeoff.beams.supportBeamItems.map((member) => member.id)).toEqual([
      "left-box-beam",
      "outer-box-beam",
      "right-box-beam",
    ]);
    expect(takeoff.gutters.ourGutterLengthMm).toBeCloseTo(
      hookQuantity(assembly, "outer_gutter.length_mm"),
      0,
    );
    expect(takeoff.gutters.items).toEqual([
      expect.objectContaining({
        id: "outer-gutter",
        role: "gutter",
        lengthMm: expect.any(Number),
      }),
    ]);
    expect(takeoff.roofPlanes.items[0]).toEqual(
      expect.objectContaining({
        rafterCount: 10,
        claddingPanelCount: 0,
        joinerCount: 0,
      }),
    );
    expect(takeoff.members.byRole.post.count).toBe(3);
  });

  it("derives hip-corner primary and secondary dimensions from one solved model", () => {
    const assembly = solve(makeHipCornerConfig());
    const takeoff = buildAssemblyQuantityTakeoff(assembly);

    expect(takeoff.family).toBe("hip_corner");
    expect(takeoff.primaryDimensionsMm).toEqual({ length: 6000, projection: 3000 });
    expect(takeoff.secondaryDimensionsMm).toEqual({ length: 4000, projection: 2000 });
    expect(takeoff.roofPlanes.count).toBe(2);
    expect(takeoff.beams.ledgerLengthMm).toBeCloseTo(hookQuantity(assembly, "ledger.length_mm"), 0);
    expect(takeoff.beams.supportBeamLengthMm).toBeCloseTo(
      hookQuantity(assembly, "support_beams.total_length_mm"),
      0,
    );
    expect(takeoff.members.byRole.rafter.items.length).toBeGreaterThan(0);
    expect(takeoff.members.byRole.rafter.items.map((member) => member.metadata?.wing)).toEqual(
      expect.arrayContaining(["A", "B"]),
    );
    expect(takeoff.gutters.ourGutterLengthMm).toBeCloseTo(
      hookQuantity(assembly, "gutters.total_length_mm"),
      0,
    );
  });
});
