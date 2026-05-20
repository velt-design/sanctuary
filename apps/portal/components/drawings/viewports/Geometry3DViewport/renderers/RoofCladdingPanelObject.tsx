import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneRoofCladdingPanelObject } from "@sp/geometry";
import { buildPolygonSlabGeometry } from "../geometry/buildGeometries";

/**
 * Roof cladding panel renderer — the per-panel slab geometry the
 * geometry pipeline emits between the roof plane and the rafter
 * spacing. Slightly more opaque than the roof plane itself (0.52)
 * because cladding sits on top and reads as a distinct surface.
 */
export function RoofCladdingPanelObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofCladdingPanelObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () =>
      buildPolygonSlabGeometry(
        object.boundary,
        object.plane,
        object.thicknessMm,
      ),
    [object.boundary, object.plane, object.thicknessMm],
  );
  return (
    <mesh
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
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.52}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
