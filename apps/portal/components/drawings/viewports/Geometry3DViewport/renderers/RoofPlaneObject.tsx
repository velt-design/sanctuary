import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneRoofPlaneObject } from "@sp/geometry";
import { buildPolygonGeometry } from "../geometry/buildGeometries";

/**
 * Translucent roof-plane surface renderer. Roof planes share the
 * pergola layer's body color and render at 0.45 opacity so the rafter
 * lines beneath stay legible. No depth-write tweaks here â€” the parent
 * viewport relies on plain alpha blending for these.
 */
export function RoofPlaneObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofPlaneObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildPolygonGeometry(object.boundary),
    [object.boundary],
  );
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
        color={color}
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
