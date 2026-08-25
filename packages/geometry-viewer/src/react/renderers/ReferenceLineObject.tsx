import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneReferenceLineObject } from "@sp/geometry";
import { buildLineGeometry } from "../../three";
import { linePoints } from "../../scene";

/**
 * Reference line renderer — drawn for datum axes, fall-vector
 * scaffolding, and the orientation overlays. Single-segment line, no
 * fill, no thickness modulation.
 */
export function ReferenceLineObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneReferenceLineObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const isDiagnosticFallback =
    (object as { metadata?: { renderRole?: unknown } }).metadata?.renderRole ===
    "diagnostic_fallback";
  const geometry = useMemo(
    () => buildLineGeometry(linePoints(object.line)),
    [object.line],
  );
  return (
    <line
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
      <lineBasicMaterial
        color={isDiagnosticFallback ? "#9b6a24" : color}
        clippingPlanes={clippingPlanes}
        depthTest={!isDiagnosticFallback}
        opacity={isDiagnosticFallback ? 0.95 : 1}
        transparent={isDiagnosticFallback}
      />
    </line>
  );
}
