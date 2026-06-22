import * as THREE from "three";
import type { ViewerSceneObject } from "@sp/geometry";
import {
  buildLinearSolidPlacement,
  isRenderableSlab,
} from "../geometry/buildGeometries";
import {
  isRenderableLine,
  isRenderablePolygon,
  isRenderableRenderMesh,
} from "../geometry/scenePointHelpers";
import { HouseLineObject } from "./HouseLineObject";
import { HouseLinearSolidObject } from "./HouseLinearSolidObject";
import { HouseSurfaceObject } from "./HouseSurfaceObject";
import { HouseSurfaceSolidObject } from "./HouseSurfaceSolidObject";
import { MemberObject } from "./MemberObject";
import { ReferenceLineObject } from "./ReferenceLineObject";
import { ReferencePlaneObject } from "./ReferencePlaneObject";
import { RoofCladdingPanelObject } from "./RoofCladdingPanelObject";
import { RoofFlashingObject } from "./RoofFlashingObject";
import { RoofPlaneObject } from "./RoofPlaneObject";

/**
 * Scene-object dispatcher. The viewport iterates over every renderable
 * `ViewerSceneObject` and hands it to this component; the type tag
 * selects the matching per-kind renderer.
 *
 * Each branch additionally short-circuits with a renderability check
 * appropriate to the geometry kind (`isRenderableSlab`,
 * `isRenderableRenderMesh`, `isRenderablePolygon`, `isRenderableLine`,
 * `buildLinearSolidPlacement`) — drops degenerate scene objects before
 * the renderer constructs THREE buffers it can't use anyway.
 *
 * `selected` / `hovered` flow through to `HouseSurfaceSolidObject`
 * (the only renderer that currently varies on either). The other
 * renderers don't consume those props yet; phase 2/3 of milestone 16
 * adds per-renderer hover styling and the dispatcher will widen
 * to forward the flags more broadly.
 */
export function SceneObjectNode({
  object,
  color,
  selected,
  hovered,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneObject;
  color: string;
  selected: boolean;
  /**
   * True when the cross-viewport hover ref points at this object's id (or
   * its workbench-level parent for grouped objects -- handled at the dispatch
   * site). Per-renderer hover styling lives in the renderer component;
   * milestone 16 phase 2 wires this for the deck renderer first.
   */
  hovered: boolean;
  onSelect: (id: string) => void;
  /** R3F pointer-over: object's id was entered. Phase 2/3 of milestone 16. */
  onHoverEnter: (id: string) => void;
  /** R3F pointer-out: object's id was left. */
  onHoverLeave: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  if (object.type === "member_prism") {
    return (
      <MemberObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "roof_plane") {
    return (
      <RoofPlaneObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "roof_cladding_panel") {
    return (
      <RoofCladdingPanelObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "roof_flashing") {
    return (
      <RoofFlashingObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "reference_line") {
    return (
      <ReferenceLineObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_surface_solid") {
    if (
      !isRenderableRenderMesh(object.renderMesh) &&
      !isRenderableSlab(object.boundary, object.plane, object.thicknessMm)
    ) {
      return null;
    }
    return (
      <HouseSurfaceSolidObject
        object={object}
        color={color}
        selected={selected}
        hovered={hovered}
        onSelect={onSelect}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_linear_solid") {
    if (!isRenderableRenderMesh(object.renderMesh) && !buildLinearSolidPlacement(object)) {
      return null;
    }
    return (
      <HouseLinearSolidObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_surface") {
    if (!isRenderablePolygon(object.boundary)) return null;
    return (
      <HouseSurfaceObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_line") {
    if (!isRenderableLine(object.line)) return null;
    return (
      <HouseLineObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  return (
    <ReferencePlaneObject
      object={object}
      color={color}
      onSelect={onSelect}
      onFocus={onFocus}
      clippingPlanes={clippingPlanes}
    />
  );
}
