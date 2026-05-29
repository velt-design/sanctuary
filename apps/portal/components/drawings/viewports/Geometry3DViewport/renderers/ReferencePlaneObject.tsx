import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneReferencePlaneObject } from "@sp/geometry";
import { buildPolygonGeometry } from "../geometry/buildGeometries";

/**
 * Reference plane renderer — fallback dispatcher target for any
 * polygon-shaped scene object not handled by a more specific renderer.
 * Renders at very low opacity (0.12) so reference geometry doesn't
 * dominate the scene visually.
 */
export function ReferencePlaneObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneReferencePlaneObject;
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
        opacity={0.12}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
