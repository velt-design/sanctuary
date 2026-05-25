import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneHouseLinearSolidObject } from "@sp/geometry";
import {
  buildLinearSolidPlacement,
  buildRenderMeshGeometry,
} from "../geometry/buildGeometries";

/**
 * House linear-solid renderer (gutters, fascia bars, etc.). Two render
 * paths:
 *  - precomputed `renderMesh` available: render the mesh directly in
 *    world space (no matrix transform needed).
 *  - otherwise: derive a centred local frame from the centerline +
 *    profile dimensions via `buildLinearSolidPlacement` and draw a
 *    boxGeometry with `matrixAutoUpdate=false` so the local frame
 *    sticks.
 *
 * `useMemo` for `placement` depends on the spread of centerline +
 * localFrame axes + profile dims rather than the object reference;
 * the scene graph re-renders frequently and the object identity flips
 * for unchanged data.
 */
export function HouseLinearSolidObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseLinearSolidObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const renderMeshGeometry = useMemo(
    () => buildRenderMeshGeometry(object.renderMesh),
    [object.renderMesh],
  );
  const placement = useMemo(() => buildLinearSolidPlacement(object), [
    object.centerline.end.x,
    object.centerline.end.y,
    object.centerline.end.z,
    object.centerline.start.x,
    object.centerline.start.y,
    object.centerline.start.z,
    object.localFrame.xAxis.x,
    object.localFrame.xAxis.y,
    object.localFrame.xAxis.z,
    object.localFrame.yAxis.x,
    object.localFrame.yAxis.y,
    object.localFrame.yAxis.z,
    object.localFrame.zAxis.x,
    object.localFrame.zAxis.y,
    object.localFrame.zAxis.z,
    object.profileDepthMm,
    object.profileWidthMm,
  ]);
  if (renderMeshGeometry) {
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
        <primitive attach="geometry" object={renderMeshGeometry} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.76}
          side={THREE.DoubleSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    );
  }
  if (!placement) return null;

  return (
    <mesh
      data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}`}
      matrixAutoUpdate={false}
      matrix={placement.matrix}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <boxGeometry
        args={[
          placement.lengthMm,
          placement.profileWidthMm,
          placement.profileDepthMm,
        ]}
      />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.76}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
