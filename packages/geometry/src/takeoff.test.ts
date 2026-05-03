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

describe("buildAssemblyQuantityTakeoff", () => {
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
        claddingPanelCount: assembly.roofCladdingPanels.length,
        joinerCount: assembly.members.filter((member) => member.role === "joiner").length,
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
    expect(takeoff.joiners.items).toHaveLength(takeoff.joiners.count);
    expect(takeoff.gutters.items).toHaveLength(takeoff.members.byRole.gutter.count);
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
