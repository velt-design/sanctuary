import { describe, expect, it } from "vitest";
import {
  detectSharedSeamBetweenForms,
  findCompositionJoinSeamMidpoint,
  joinTwoHouseForms,
} from "./compositionSeams";
import type {
  AxisAlignedRectangle,
  HouseComposition,
  RectangleRoofIntent,
} from "./types";
import { validateHouseComposition } from "./validateHouseComposition";

function hippedIntent(): RectangleRoofIntent {
  return {
    form: "hipped",
    pitchDeg: 25,
    ridgeAxis: "x",
    startCap: "hipped",
    endCap: "hipped",
  };
}

function rect(input: {
  x: number;
  y: number;
  w: number;
  d: number;
}): AxisAlignedRectangle {
  return {
    kind: "axisAlignedRectangle",
    originXMm: input.x,
    originYMm: input.y,
    widthMm: input.w,
    depthMm: input.d,
    roofIntent: hippedIntent(),
  };
}

function singleRect(input: {
  x: number;
  y: number;
  w: number;
  d: number;
}): HouseComposition {
  return { primitives: [rect(input)], joins: [] };
}

describe("findCompositionJoinSeamMidpoint (PR-COMP-PHASE4b.1)", () => {
  it("returns the midpoint of an east-west seam between two rectangles", () => {
    // A: (0, 0) 6x4; B: (6000, 0) 4x4. Seam runs along x = 6000,
    // y in [0, 4000]. Overlap segment is the full 4000mm; midpoint
    // is (6000, 2000).
    const composition: HouseComposition = {
      primitives: [
        rect({ x: 0, y: 0, w: 6000, d: 4000 }),
        rect({ x: 6000, y: 0, w: 4000, d: 4000 }),
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
      ],
    };
    const midpoint = findCompositionJoinSeamMidpoint(composition, 0);
    expect(midpoint).toEqual({ x: 6000, y: 2000 });
  });

  it("returns the midpoint of a north-south seam between two rectangles", () => {
    // A: (0, 0) 4x6; B: (0, 6000) 4x4. Seam along y = 6000,
    // x in [0, 4000]; midpoint (2000, 6000).
    const composition: HouseComposition = {
      primitives: [
        rect({ x: 0, y: 0, w: 4000, d: 6000 }),
        rect({ x: 0, y: 6000, w: 4000, d: 4000 }),
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
      ],
    };
    const midpoint = findCompositionJoinSeamMidpoint(composition, 0);
    expect(midpoint).toEqual({ x: 2000, y: 6000 });
  });

  it("returns the midpoint of a partial overlap (rectangles of different lengths)", () => {
    // A: (0, 0) 6x4; B: (3000, 4000) 4x4. Seam along y = 4000,
    // x overlap is [3000, 6000] of length 3000; midpoint (4500, 4000).
    const composition: HouseComposition = {
      primitives: [
        rect({ x: 0, y: 0, w: 6000, d: 4000 }),
        rect({ x: 3000, y: 4000, w: 4000, d: 4000 }),
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
      ],
    };
    const midpoint = findCompositionJoinSeamMidpoint(composition, 0);
    expect(midpoint).toEqual({ x: 4500, y: 4000 });
  });

  it("returns null for a negative joinIndex", () => {
    const composition: HouseComposition = {
      primitives: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      joins: [],
    };
    expect(findCompositionJoinSeamMidpoint(composition, -1)).toBeNull();
  });

  it("returns null for a joinIndex past the end", () => {
    const composition: HouseComposition = {
      primitives: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      joins: [],
    };
    expect(findCompositionJoinSeamMidpoint(composition, 0)).toBeNull();
  });
});

describe("detectSharedSeamBetweenForms (PR-COMP-PHASE4b.1)", () => {
  it("detects a seam when two forms are placed edge-to-edge along east-west", () => {
    // Form A at world (0, 0) with a single 6x4 rectangle.
    // Form B at world (6000, 0) with a single 4x4 rectangle.
    // Both rectangles at their form-local origin; the world-space
    // seam runs along x = 6000, y in [0, 4000].
    const seam = detectSharedSeamBetweenForms({
      formARectangles: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formBRectangles: [rect({ x: 0, y: 0, w: 4000, d: 4000 })],
      formBWorldOffsetXMm: 6000,
      formBWorldOffsetYMm: 0,
    });
    expect(seam).not.toBeNull();
    expect(seam!.midpointWorldMm).toEqual({ x: 6000, y: 2000 });
    expect(seam!.lengthMm).toBe(4000);
    expect(seam!.formAEdge).toBe("east");
    expect(seam!.formBEdge).toBe("west");
    expect(seam!.formAPrimitiveIndex).toBe(0);
    expect(seam!.formBPrimitiveIndex).toBe(0);
  });

  it("detects a seam when two forms are placed edge-to-edge along north-south", () => {
    const seam = detectSharedSeamBetweenForms({
      formARectangles: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formBRectangles: [rect({ x: 0, y: 0, w: 6000, d: 2000 })],
      formBWorldOffsetXMm: 0,
      formBWorldOffsetYMm: 4000,
    });
    expect(seam).not.toBeNull();
    expect(seam!.midpointWorldMm).toEqual({ x: 3000, y: 4000 });
    expect(seam!.formAEdge).toBe("north");
    expect(seam!.formBEdge).toBe("south");
  });

  it("returns null when two forms are separated by a gap outside snap tolerance", () => {
    // 5mm gap; tolerance is 1mm. Edges don't qualify as aligned.
    const seam = detectSharedSeamBetweenForms({
      formARectangles: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formBRectangles: [rect({ x: 0, y: 0, w: 4000, d: 4000 })],
      formBWorldOffsetXMm: 6005,
      formBWorldOffsetYMm: 0,
    });
    expect(seam).toBeNull();
  });

  it("DOES return a seam when edges are within snap tolerance (sub-millimetre noise)", () => {
    // 0.5mm misalignment is within the 1mm tolerance — Join would
    // succeed structurally (the validator accepts up to 1mm offset),
    // so the seam icon MUST appear. Pinning this so a future
    // refactor doesn't silently make Join unreachable on snapped
    // forms with floating-point noise.
    const seam = detectSharedSeamBetweenForms({
      formARectangles: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formBRectangles: [rect({ x: 0, y: 0, w: 4000, d: 4000 })],
      formBWorldOffsetXMm: 6000.5,
      formBWorldOffsetYMm: 0,
    });
    expect(seam).not.toBeNull();
  });

  it("returns null when two forms are touching only at a corner (zero-length overlap)", () => {
    // A: world (0, 0) 4x4. B: world (4000, 4000) 4x4. Their corners
    // touch at (4000, 4000) but no edge overlaps by 1mm or more.
    const seam = detectSharedSeamBetweenForms({
      formARectangles: [rect({ x: 0, y: 0, w: 4000, d: 4000 })],
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formBRectangles: [rect({ x: 0, y: 0, w: 4000, d: 4000 })],
      formBWorldOffsetXMm: 4000,
      formBWorldOffsetYMm: 4000,
    });
    expect(seam).toBeNull();
  });

  it("detects a seam from a multi-rectangle composition's outer perimeter", () => {
    // Form A is an L composite (2 primitives); form B is a single
    // rectangle pressed against the L's east edge of primitive 1.
    // The seam should reference form A's primitive 1 (the extension),
    // not primitive 0 (the main block).
    //
    //  +-------+ - - - - - +
    //  |       |     B     |
    //  |   A0  +-------+ - +
    //  |       |  A1   |
    //  +-------+-------+
    const seam = detectSharedSeamBetweenForms({
      formARectangles: [
        rect({ x: 0, y: 0, w: 4000, d: 4000 }),
        rect({ x: 4000, y: 0, w: 2000, d: 2000 }),
      ],
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formBRectangles: [rect({ x: 0, y: 0, w: 4000, d: 4000 })],
      formBWorldOffsetXMm: 6000,
      formBWorldOffsetYMm: 0,
    });
    expect(seam).not.toBeNull();
    expect(seam!.formAPrimitiveIndex).toBe(1);
    expect(seam!.formAEdge).toBe("east");
    expect(seam!.formBEdge).toBe("west");
    // Overlap is [0, 2000] (form A's primitive 1 ends at y=2000).
    expect(seam!.lengthMm).toBe(2000);
  });
});

describe("joinTwoHouseForms (PR-COMP-PHASE4b.1)", () => {
  it("merges two single-rectangle forms placed edge-to-edge", () => {
    // Form A: world (0, 0), single 6x4 rectangle.
    // Form B: world (6000, 0), single 4x4 rectangle.
    // After Join: composition with both rectangles in form A's local
    // frame and a single east<->west join between them.
    const result = joinTwoHouseForms({
      formA: singleRect({ x: 0, y: 0, w: 6000, d: 4000 }),
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formB: singleRect({ x: 0, y: 0, w: 4000, d: 4000 }),
      formBWorldOffsetXMm: 6000,
      formBWorldOffsetYMm: 0,
    });
    if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
    expect(result.merged.primitives).toHaveLength(2);
    expect(result.merged.joins).toHaveLength(1);
    // Form B's rectangle was translated by (6000, 0) into A's frame.
    const rectB = result.merged.primitives[1]!;
    if (rectB.kind !== "axisAlignedRectangle") throw new Error("expected rectangle");
    expect(rectB.originXMm).toBe(6000);
    expect(rectB.originYMm).toBe(0);
    // The new join references the correct edges + indices.
    const join = result.merged.joins[0]!;
    expect(join.fromPrimitiveIndex).toBe(0);
    expect(join.toPrimitiveIndex).toBe(1);
    expect(join.fromEdge).toBe("east");
    expect(join.toEdge).toBe("west");
  });

  it("merged composition validates cleanly via validateHouseComposition", () => {
    const result = joinTwoHouseForms({
      formA: singleRect({ x: 0, y: 0, w: 6000, d: 4000 }),
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formB: singleRect({ x: 0, y: 0, w: 4000, d: 4000 }),
      formBWorldOffsetXMm: 6000,
      formBWorldOffsetYMm: 0,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(validateHouseComposition(result.merged)).toEqual({ ok: true });
  });

  it("preserves form A and form B existing joins, renumbering form B's join indices", () => {
    // Form A: 2-primitive L; Form B: 2-primitive L.
    // After merge, the resulting composition has 4 primitives + 3
    // joins (1 from A, 1 from B-renumbered, 1 new seam between).
    const formA: HouseComposition = {
      primitives: [
        rect({ x: 0, y: 0, w: 4000, d: 4000 }),
        rect({ x: 4000, y: 0, w: 2000, d: 2000 }),
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
      ],
    };
    const formB: HouseComposition = {
      primitives: [
        rect({ x: 0, y: 0, w: 4000, d: 4000 }),
        rect({ x: 4000, y: 0, w: 2000, d: 2000 }),
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
      ],
    };
    // Position B at world (0, 4000) so A's north edge of primitive 0
    // meets B's south edge of primitive 0 (a 4000mm overlap).
    const result = joinTwoHouseForms({
      formA,
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formB,
      formBWorldOffsetXMm: 0,
      formBWorldOffsetYMm: 4000,
    });
    if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
    expect(result.merged.primitives).toHaveLength(4);
    expect(result.merged.joins).toHaveLength(3);
    // Form A's join unchanged.
    expect(result.merged.joins[0]).toEqual(formA.joins[0]);
    // Form B's join renumbered by +2 (offset = formA.primitives.length).
    const renumberedB = result.merged.joins[1]!;
    expect(renumberedB.fromPrimitiveIndex).toBe(2);
    expect(renumberedB.toPrimitiveIndex).toBe(3);
    // New seam between A's primitive 0 and B's primitive 0 (which
    // is at merged index 2).
    const newSeam = result.merged.joins[2]!;
    expect(newSeam.fromPrimitiveIndex).toBe(0);
    expect(newSeam.toPrimitiveIndex).toBe(2);
    expect(newSeam.fromEdge).toBe("north");
    expect(newSeam.toEdge).toBe("south");
    // Whole thing must validate.
    expect(validateHouseComposition(result.merged)).toEqual({ ok: true });
  });

  it("rejects join when no shared seam exists (forms separated)", () => {
    const result = joinTwoHouseForms({
      formA: singleRect({ x: 0, y: 0, w: 6000, d: 4000 }),
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formB: singleRect({ x: 0, y: 0, w: 4000, d: 4000 }),
      formBWorldOffsetXMm: 10000,
      formBWorldOffsetYMm: 0,
    });
    expect(result).toEqual({ ok: false, error: { code: "no_shared_seam" } });
  });

  it("rejects join when a non-seam primitive interpenetrates the other form", () => {
    // Constructed pathological case: Form A is a 2-primitive
    // wide-rectangle (A0 and A1 share their east-west seam). Form B
    // is placed so its rectangle aligns edge-to-edge with A0 AND
    // also fully overlaps A1's interior. The seam-finder finds the
    // A0<->B0 seam; the interpenetration check catches the A1<->B0
    // overlap and rejects.
    //
    // World layout (mm):
    //   A0: (0, 0)    -> 4000 x 4000
    //   A1: (4000, 0) -> 4000 x 4000  (shares A0.east seam)
    //   B0: (4000, 0) -> 4000 x 4000  (occupies SAME space as A1!)
    // A0.east edge meets B0.west edge -> seam found.
    // A1 interior fully overlaps B0 interior -> reject.
    const formA: HouseComposition = {
      primitives: [
        rect({ x: 0, y: 0, w: 4000, d: 4000 }),
        rect({ x: 4000, y: 0, w: 4000, d: 4000 }),
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
      ],
    };
    const result = joinTwoHouseForms({
      formA,
      formAWorldOffsetXMm: 0,
      formAWorldOffsetYMm: 0,
      formB: singleRect({ x: 0, y: 0, w: 4000, d: 4000 }),
      formBWorldOffsetXMm: 4000,
      formBWorldOffsetYMm: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("merged_primitives_overlap");
  });

  it("handles two forms with non-zero world offsets correctly", () => {
    // Form A at world (5000, 2000); form B at world (11000, 2000).
    // The translation into A's frame is (6000, 0), so B's rectangle
    // ends up at form-A-local (6000, 0) — same as the simple case.
    const result = joinTwoHouseForms({
      formA: singleRect({ x: 0, y: 0, w: 6000, d: 4000 }),
      formAWorldOffsetXMm: 5000,
      formAWorldOffsetYMm: 2000,
      formB: singleRect({ x: 0, y: 0, w: 4000, d: 4000 }),
      formBWorldOffsetXMm: 11000,
      formBWorldOffsetYMm: 2000,
    });
    if (!result.ok) throw new Error("expected ok");
    const rectB = result.merged.primitives[1]!;
    if (rectB.kind !== "axisAlignedRectangle") throw new Error("expected rectangle");
    expect(rectB.originXMm).toBe(6000);
    expect(rectB.originYMm).toBe(0);
    expect(validateHouseComposition(result.merged)).toEqual({ ok: true });
  });
});
