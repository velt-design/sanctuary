import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneHouseLineObject } from "@sp/geometry";
import { buildLineGeometry } from "../geometry/lineBuilders";
import { linePoints } from "../geometry/scenePointHelpers";

/**
 * House line renderer — single-segment lines emitted for opening
 * outlines, attachment edges, and other 1D scaffolding in the house
 * model. The `opening_outline` kind overrides the layer colour to the
 * marker blue so an outlined opening reads consistently with its
 * marker surface, regardless of the parent layer's palette entry.
 */
export function HouseLineObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseLineObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildLineGeometry(linePoints(object.line)),
    [object.line],
  );
  const lineColor = object.kind === "opening_outline" ? "#325872" : color;
  return (
    <line
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
      <lineBasicMaterial color={lineColor} clippingPlanes={clippingPlanes} />
    </line>
  );
}
