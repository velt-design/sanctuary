import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneHouseSurfaceObject } from "@sp/geometry";
import { buildPolygonGeometry } from "../geometry/buildGeometries";

/**
 * Flat house-surface renderer (non-solid) — used for the diagnostic
 * surface objects emitted by the scene builder before the solid mesh
 * is available: roof projections, wall outlines, attachment zones /
 * planes, and opening markers. Opacity + colour are keyed off `kind`
 * so each surface family reads differently:
 *  - roof:               low-opacity tint
 *  - wall:               near-transparent FRONT-only (so interiors
 *                        stay visible past the wall plane)
 *  - opening_marker:     boosted opacity + the marker blue so the
 *                        marker pops on the wall surface beneath
 *  - attachment_zone /
 *    attachment_plane:   medium opacity in the layer colour
 *  - any other kind:     default low-opacity tint
 */
export function HouseSurfaceObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseSurfaceObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildPolygonGeometry(object.boundary),
    [object.boundary],
  );
  const opacity =
    object.kind === "roof"
      ? 0.32
      : object.kind === "wall"
        ? 0.2
        : object.kind === "opening_marker"
          ? 0.52
        : object.kind === "attachment_zone" ||
            object.kind === "attachment_plane"
          ? 0.4
          : 0.26;
  const surfaceColor = object.kind === "opening_marker" ? "#95b9cf" : color;
  const materialSide =
    object.kind === "wall" ? THREE.FrontSide : THREE.DoubleSide;

  return (
    <mesh
      data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial
        color={surfaceColor}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={materialSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
