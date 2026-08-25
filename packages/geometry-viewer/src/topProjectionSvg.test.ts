// @vitest-environment node

import type { GeometryTopProjectionViewModel } from "@sp/geometry";
import { describe, expect, it } from "vitest";
import { serializeTopProjectionSvg } from "@sp/geometry-viewer/svg";

function projection(): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: "world_xy_mm",
    screenAxis: { x: "world_x_left", y: "world_y_down" },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 4000,
      maxY: 3000,
      widthMm: 4000,
      heightMm: 3000,
    },
    shapes: [
      {
        id: "roof-b",
        sourceObjectId: "house-1",
        sourceType: "house_surface",
        family: "house",
        kind: "roof & context",
        polygon: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 1000 },
        ],
        zOrder: 20,
        zMin: 0,
        zMax: 1000,
      },
      {
        id: "pergola-a",
        sourceObjectId: "pergola-1",
        sourceType: "roof_plane",
        family: "pergola",
        kind: "roof",
        polygon: [
          { x: 1000, y: 1000 },
          { x: 3000, y: 1000 },
          { x: 3000, y: 2500 },
        ],
        zOrder: 10,
        zMin: 2000,
        zMax: 2500,
      },
    ],
  };
}

describe("top projection SVG serializer", () => {
  it("serializes in stable z-order using the top-camera screen axis", () => {
    const svg = serializeTopProjectionSvg(projection(), {
      ariaLabel: "Plan & roof",
      paddingMm: 100,
    });

    expect(svg).toContain('viewBox="0 0 4200 3200"');
    expect(svg).toContain('aria-label="Plan &amp; roof"');
    expect(svg.indexOf('data-shape-id="pergola-a"')).toBeLessThan(
      svg.indexOf('data-shape-id="roof-b"'),
    );
    expect(svg).toContain('data-kind="roof &amp; context"');
    expect(svg).toContain('points="3100,1100 1100,1100 1100,2600"');
  });

  it("returns a deterministic empty SVG without browser globals", () => {
    const empty = projection();
    empty.extents = null;
    empty.shapes = [];

    expect(serializeTopProjectionSvg(empty)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" role="img" aria-label="Top projection"></svg>',
    );
  });
});
