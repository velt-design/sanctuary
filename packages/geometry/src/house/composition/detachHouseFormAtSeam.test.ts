import { describe, expect, it } from "vitest";
import { detachHouseFormAtSeam } from "./detachHouseFormAtSeam";
import type {
  AxisAlignedRectangle,
  CompositionJoin,
  HouseComposition,
  RectangleRoofIntent,
} from "./types";
import { validateHouseComposition } from "./validateHouseComposition";

function hippedIntent(overrides?: Partial<{
  pitchDeg: number;
  ridgeAxis: "x" | "y";
}>): RectangleRoofIntent {
  return {
    form: "hipped",
    pitchDeg: overrides?.pitchDeg ?? 25,
    ridgeAxis: overrides?.ridgeAxis ?? "x",
    startCap: "hipped",
    endCap: "hipped",
  };
}

function rect(input: {
  x: number;
  y: number;
  w: number;
  d: number;
  intent?: RectangleRoofIntent;
}): AxisAlignedRectangle {
  return {
    kind: "axisAlignedRectangle",
    originXMm: input.x,
    originYMm: input.y,
    widthMm: input.w,
    depthMm: input.d,
    roofIntent: input.intent ?? hippedIntent(),
  };
}

/**
 * 2-primitive L composite (A left, B right, sharing the east-west seam):
 *
 *   A: (0, 0) -> 6000 x 4000   (south block)
 *   B: (6000, 0) -> 4000 x 4000 (east block)
 *
 * Join: A.east <-> B.west (a single seam between the two rectangles).
 */
function twoPrimitiveLComposite(): HouseComposition {
  return {
    primitives: [
      rect({ x: 0, y: 0, w: 6000, d: 4000 }),
      rect({ x: 6000, y: 0, w: 4000, d: 4000 }),
    ],
    joins: [
      {
        fromPrimitiveIndex: 0,
        fromEdge: "east",
        toPrimitiveIndex: 1,
        toEdge: "west",
      },
    ],
  };
}

/**
 * 3-primitive linear composite (A - B - C, two seams in a chain):
 *
 *   A: (0,    0) -> 4000 x 4000
 *   B: (4000, 0) -> 4000 x 4000
 *   C: (8000, 0) -> 4000 x 4000
 *
 * Joins:
 *   0: A.east <-> B.west
 *   1: B.east <-> C.west
 */
function threePrimitiveLinearComposite(): HouseComposition {
  return {
    primitives: [
      rect({ x: 0, y: 0, w: 4000, d: 4000 }),
      rect({ x: 4000, y: 0, w: 4000, d: 4000 }),
      rect({ x: 8000, y: 0, w: 4000, d: 4000 }),
    ],
    joins: [
      {
        fromPrimitiveIndex: 0,
        fromEdge: "east",
        toPrimitiveIndex: 1,
        toEdge: "west",
      },
      {
        fromPrimitiveIndex: 1,
        fromEdge: "east",
        toPrimitiveIndex: 2,
        toEdge: "west",
      },
    ],
  };
}

describe("detachHouseFormAtSeam (PR-COMP-PHASE4a.1)", () => {
  describe("2-primitive composite", () => {
    it("splits a 2-primitive L composite into 2 single-primitive partitions", () => {
      const result = detachHouseFormAtSeam({
        composition: twoPrimitiveLComposite(),
        joinIndex: 0,
      });
      if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
      expect(result.partitions).toHaveLength(2);
      expect(result.partitions[0]!.primitives).toHaveLength(1);
      expect(result.partitions[1]!.primitives).toHaveLength(1);
      expect(result.partitions[0]!.joins).toHaveLength(0);
      expect(result.partitions[1]!.joins).toHaveLength(0);
    });

    it("preserves each primitive's world-space position", () => {
      const result = detachHouseFormAtSeam({
        composition: twoPrimitiveLComposite(),
        joinIndex: 0,
      });
      if (!result.ok) throw new Error("expected ok");
      const [partitionA, partitionB] = result.partitions;
      const rectA = partitionA!.primitives[0]!;
      const rectB = partitionB!.primitives[0]!;
      if (rectA.kind !== "axisAlignedRectangle" || rectB.kind !== "axisAlignedRectangle") {
        throw new Error("expected axisAlignedRectangle primitives");
      }
      expect(rectA.originXMm).toBe(0);
      expect(rectA.originYMm).toBe(0);
      expect(rectB.originXMm).toBe(6000);
      expect(rectB.originYMm).toBe(0);
    });

    it("preserves per-rectangle roof intent on each partition", () => {
      const composition: HouseComposition = {
        primitives: [
          rect({ x: 0, y: 0, w: 6000, d: 4000, intent: hippedIntent({ pitchDeg: 25 }) }),
          rect({
            x: 6000,
            y: 0,
            w: 4000,
            d: 4000,
            intent: hippedIntent({ pitchDeg: 18, ridgeAxis: "y" }),
          }),
        ],
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "east",
            toPrimitiveIndex: 1,
            toEdge: "west",
          },
        ],
      };
      const result = detachHouseFormAtSeam({ composition, joinIndex: 0 });
      if (!result.ok) throw new Error("expected ok");
      const rectA = result.partitions[0]!.primitives[0]!;
      const rectB = result.partitions[1]!.primitives[0]!;
      if (
        rectA.kind !== "axisAlignedRectangle" ||
        rectB.kind !== "axisAlignedRectangle" ||
        rectA.roofIntent.form !== "hipped" ||
        rectB.roofIntent.form !== "hipped"
      ) {
        throw new Error("expected hipped axisAlignedRectangle primitives");
      }
      expect(rectA.roofIntent.pitchDeg).toBe(25);
      expect(rectA.roofIntent.ridgeAxis).toBe("x");
      expect(rectB.roofIntent.pitchDeg).toBe(18);
      expect(rectB.roofIntent.ridgeAxis).toBe("y");
    });

    it("returns partitions that pass validateHouseComposition", () => {
      const result = detachHouseFormAtSeam({
        composition: twoPrimitiveLComposite(),
        joinIndex: 0,
      });
      if (!result.ok) throw new Error("expected ok");
      for (const partition of result.partitions) {
        const validation = validateHouseComposition(partition);
        expect(validation).toEqual({ ok: true });
      }
    });
  });

  describe("3-primitive linear composite", () => {
    it("breaking the front seam (A-B) returns [A] and [B, C]", () => {
      const result = detachHouseFormAtSeam({
        composition: threePrimitiveLinearComposite(),
        joinIndex: 0,
      });
      if (!result.ok) throw new Error("expected ok");
      expect(result.partitions).toHaveLength(2);
      expect(result.partitions[0]!.primitives).toHaveLength(1);
      expect(result.partitions[1]!.primitives).toHaveLength(2);
      // The 2-primitive partition retains the B-C join, renumbered
      // to point at its local primitives [0, 1] (was original [1, 2]).
      expect(result.partitions[1]!.joins).toHaveLength(1);
      const renumbered = result.partitions[1]!.joins[0]!;
      expect(renumbered.fromPrimitiveIndex).toBe(0);
      expect(renumbered.toPrimitiveIndex).toBe(1);
      expect(renumbered.fromEdge).toBe("east");
      expect(renumbered.toEdge).toBe("west");
    });

    it("breaking the back seam (B-C) returns [A, B] and [C]", () => {
      const result = detachHouseFormAtSeam({
        composition: threePrimitiveLinearComposite(),
        joinIndex: 1,
      });
      if (!result.ok) throw new Error("expected ok");
      expect(result.partitions).toHaveLength(2);
      expect(result.partitions[0]!.primitives).toHaveLength(2);
      expect(result.partitions[1]!.primitives).toHaveLength(1);
      // The 2-primitive partition retains the A-B join unchanged
      // (its indices [0, 1] already match the partition's primitive
      // order).
      expect(result.partitions[0]!.joins).toHaveLength(1);
      const retained = result.partitions[0]!.joins[0]!;
      expect(retained.fromPrimitiveIndex).toBe(0);
      expect(retained.toPrimitiveIndex).toBe(1);
    });

    it("every partition from a 3-primitive split validates cleanly", () => {
      for (const breakAt of [0, 1]) {
        const result = detachHouseFormAtSeam({
          composition: threePrimitiveLinearComposite(),
          joinIndex: breakAt,
        });
        if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
        for (const partition of result.partitions) {
          const validation = validateHouseComposition(partition);
          expect(validation).toEqual({ ok: true });
        }
      }
    });
  });

  describe("error handling", () => {
    it("rejects a negative joinIndex with invalid_join_index", () => {
      const result = detachHouseFormAtSeam({
        composition: twoPrimitiveLComposite(),
        joinIndex: -1,
      });
      expect(result).toEqual({
        ok: false,
        error: { code: "invalid_join_index", joinIndex: -1, joinsLength: 1 },
      });
    });

    it("rejects a joinIndex past the end with invalid_join_index", () => {
      const result = detachHouseFormAtSeam({
        composition: twoPrimitiveLComposite(),
        joinIndex: 5,
      });
      expect(result).toEqual({
        ok: false,
        error: { code: "invalid_join_index", joinIndex: 5, joinsLength: 1 },
      });
    });

    it("rejects joinIndex 0 on a composition with no joins", () => {
      const noJoinComposition: HouseComposition = {
        primitives: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
        joins: [],
      };
      const result = detachHouseFormAtSeam({
        composition: noJoinComposition,
        joinIndex: 0,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.error.code).toBe("invalid_join_index");
    });
  });

  describe("index renumbering correctness", () => {
    it("renumbers join indices in partitions even when component primitives are non-contiguous in the original", () => {
      // Composite: 4 primitives in a chain A-B-C-D with 3 joins.
      // Break the middle seam (B-C). Result: [A, B] and [C, D].
      // The [C, D] partition contains original indices [2, 3]; its
      // single retained join must renumber 2->0 and 3->1.
      const composition: HouseComposition = {
        primitives: [
          rect({ x: 0, y: 0, w: 4000, d: 4000 }),
          rect({ x: 4000, y: 0, w: 4000, d: 4000 }),
          rect({ x: 8000, y: 0, w: 4000, d: 4000 }),
          rect({ x: 12000, y: 0, w: 4000, d: 4000 }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
          { fromPrimitiveIndex: 1, fromEdge: "east", toPrimitiveIndex: 2, toEdge: "west" },
          { fromPrimitiveIndex: 2, fromEdge: "east", toPrimitiveIndex: 3, toEdge: "west" },
        ],
      };
      const result = detachHouseFormAtSeam({ composition, joinIndex: 1 });
      if (!result.ok) throw new Error("expected ok");
      expect(result.partitions).toHaveLength(2);
      const back = result.partitions[1]!;
      expect(back.primitives).toHaveLength(2);
      expect(back.joins).toHaveLength(1);
      const renumbered = back.joins[0]!;
      expect(renumbered.fromPrimitiveIndex).toBe(0);
      expect(renumbered.toPrimitiveIndex).toBe(1);
      // Validate the renumbered partition — catches stale indices.
      const validation = validateHouseComposition(back);
      expect(validation).toEqual({ ok: true });
    });
  });
});
