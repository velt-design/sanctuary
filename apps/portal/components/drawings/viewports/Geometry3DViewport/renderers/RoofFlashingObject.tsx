import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneRoofFlashingObject } from "@sp/geometry";
import { buildPolygonSlabGeometry } from "../geometry/buildGeometries";

/**
 * Multi-wing roof flashing renderer. Each `wing` is a separate slab
 * built from its own plane + boundary; the parent `group` wraps them
 * so selection/focus targets the flashing as one object. Metalness /
 * roughness are tuned to read as folded sheet metal under the default
 * three-light setup.
 */
export function RoofFlashingObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofFlashingObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const wingGeometries = useMemo(
    () =>
      object.wings.map((wing) => ({
        id: wing.id,
        geometry: buildPolygonSlabGeometry(
          wing.boundary,
          wing.plane,
          object.thicknessMm,
        ),
      })),
    [object.thicknessMm, object.wings],
  );
  return (
    <group
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      {wingGeometries.map((wing) => (
        <mesh key={wing.id}>
          <primitive attach="geometry" object={wing.geometry} />
          <meshStandardMaterial
            color={color}
            metalness={0.25}
            roughness={0.48}
            side={THREE.DoubleSide}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      ))}
    </group>
  );
}
