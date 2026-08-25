// @vitest-environment node

import type { ViewerSceneObject } from "@sp/geometry";
import { describe, expect, it } from "vitest";
import { SceneObjectNode } from "@sp/geometry-viewer/react";

const plane = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
};
const frame = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  zAxis: { x: 0, y: 0, z: 1 },
};
const boundary = [
  { x: 0, y: 0, z: 0 },
  { x: 1000, y: 0, z: 0 },
  { x: 1000, y: 1000, z: 0 },
  { x: 0, y: 1000, z: 0 },
];
const line = {
  start: { x: 0, y: 0, z: 0 },
  end: { x: 1000, y: 0, z: 0 },
};

const objects: ViewerSceneObject[] = [
  {
    id: "member",
    type: "member_prism",
    sourceId: "member",
    role: "beam",
    centerline: line,
    profile: { shape: "rectangular", widthMm: 100, depthMm: 150 },
    localFrame: frame,
    lengthMm: 1000,
    renderMode: "prism",
  },
  {
    id: "roof",
    type: "roof_plane",
    sourceId: "roof",
    boundary,
    plane,
    fallVector: { x: 0, y: 1, z: 0 },
  },
  {
    id: "panel",
    type: "roof_cladding_panel",
    sourceId: "panel",
    material: "acrylic",
    boundary,
    thicknessMm: 6,
    plane,
  },
  {
    id: "flashing",
    type: "roof_flashing",
    sourceId: "flashing",
    wings: [{ id: "wing", boundary, plane }],
    thicknessMm: 2,
  },
  {
    id: "reference-line",
    type: "reference_line",
    kind: "roof_edge",
    line,
  },
  {
    id: "reference-plane",
    type: "reference_plane",
    kind: "house_wall",
    boundary,
    plane,
  },
  {
    id: "house-surface",
    type: "house_surface",
    kind: "wall",
    boundary,
    plane,
  },
  {
    id: "house-line",
    type: "house_line",
    kind: "wall_segment",
    line,
  },
  {
    id: "house-solid",
    type: "house_surface_solid",
    kind: "wall",
    boundary,
    plane,
    thicknessMm: 90,
  },
  {
    id: "house-linear-solid",
    type: "house_linear_solid",
    kind: "gutter",
    centerline: line,
    localFrame: frame,
    profileWidthMm: 100,
    profileDepthMm: 80,
  },
];

describe("shared scene-object dispatch", () => {
  it("dispatches every current viewer scene object type", () => {
    const renderedTypes = objects.map((object) => {
      const element = SceneObjectNode({
        object,
        color: "#556655",
        selected: false,
        hovered: false,
        onSelect: () => undefined,
        onHoverEnter: () => undefined,
        onHoverLeave: () => undefined,
        onFocus: () => undefined,
        clippingPlanes: [],
      });

      expect(element, object.type).not.toBeNull();
      return typeof element?.type === "function" ? element.type.name : String(element?.type);
    });

    expect(renderedTypes).toEqual([
      "MemberObject",
      "RoofPlaneObject",
      "RoofCladdingPanelObject",
      "RoofFlashingObject",
      "ReferenceLineObject",
      "ReferencePlaneObject",
      "HouseSurfaceObject",
      "HouseLineObject",
      "HouseSurfaceSolidObject",
      "HouseLinearSolidObject",
    ]);
  });
});
