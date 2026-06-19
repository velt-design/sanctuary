import { describe, expect, it } from "vitest";
import { validateOrthogonalPolygon } from "./validate";
import type { OrthogonalPolygon } from "./types";

describe("validateOrthogonalPolygon", () => {
  it("accepts a valid CCW orthogonal rectangle", () => {
    const rect: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 0, y: 6 },
    ];
    expect(validateOrthogonalPolygon(rect)).toEqual({ ok: true });
  });

  it("accepts a valid CCW orthogonal L-shape", () => {
    const lShape: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(validateOrthogonalPolygon(lShape)).toEqual({ ok: true });
  });

  it("rejects fewer than 4 vertices", () => {
    const triangle: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(validateOrthogonalPolygon(triangle)).toEqual({
      ok: false,
      error: { code: "too_few_vertices", vertexCount: 3 },
    });
  });

  it("rejects non-integer coordinates", () => {
    const polygon: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10.5, y: 0 },
      { x: 10.5, y: 6 },
      { x: 0, y: 6 },
    ];
    const result = validateOrthogonalPolygon(polygon);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("non_integer_coordinate");
  });

  it("rejects non-orthogonal edges", () => {
    const polygon: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 5 }, // diagonal edge
      { x: 10, y: 6 },
      { x: 0, y: 6 },
    ];
    const result = validateOrthogonalPolygon(polygon);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("non_orthogonal_edge");
  });

  it("rejects clockwise winding", () => {
    const cwRect: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      { x: 10, y: 6 },
      { x: 10, y: 0 },
    ];
    const result = validateOrthogonalPolygon(cwRect);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_counter_clockwise");
  });

  it("rejects consecutive collinear (redundant) vertices", () => {
    // Three consecutive horizontal edges — vertex (5, 0) is
    // redundant and should have been removed by `cleanPolygon`.
    const polygon: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 0, y: 6 },
    ];
    const result = validateOrthogonalPolygon(polygon);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("consecutive_collinear_edges");
  });
});
