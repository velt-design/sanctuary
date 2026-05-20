import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneHouseRoofMaterialObject } from "@sp/geometry";
import { buildLineGeometry } from "../geometry/lineBuilders";
import { linePoints } from "../geometry/scenePointHelpers";

/**
 * House roof material renderer — emits the periodic line set (corrugation
 * ribs, standing seams, etc.) projected onto the roof plane. The parent
 * group is the click/focus target; per-line geometries render with the
 * shared material colour for the layer.
 */
export function HouseRoofMaterialObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseRoofMaterialObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const lineGeometries = useMemo(
    () =>
      object.lines.map((line, index) => ({
        id: `${object.id}-${index + 1}`,
        geometry: buildLineGeometry(linePoints(line)),
      })),
    [object.id, object.lines],
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
      {lineGeometries.map((line) => (
        <line key={line.id}>
          <primitive attach="geometry" object={line.geometry} />
          <lineBasicMaterial color={color} clippingPlanes={clippingPlanes} />
        </line>
      ))}
    </group>
  );
}
