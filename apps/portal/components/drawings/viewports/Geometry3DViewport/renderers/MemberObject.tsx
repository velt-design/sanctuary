import { useCallback, useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneMemberPrismObject } from "@sp/geometry";
import {
  buildClippedBoxGeometry,
  buildClippedProfileExtrusionGeometry,
  buildProfileExtrusionGeometry,
  buildRectangularCapGeometry,
  numericMetadataValue,
} from "../geometry/buildGeometries";
import { buildLineGeometry } from "../geometry/lineBuilders";
import { linePoints } from "../geometry/scenePointHelpers";

/**
 * Pergola member renderer (posts, beams, rafters, joiners, gutters).
 * Three render modes, all driven by `object.renderMode`:
 *  - `line_fallback`: degenerate cases (profile invalid, length too
 *    short) render as the centerline only.
 *  - `outline_extrusion`: posts with end caps. Two paths:
 *      (a) full outline composite â€” body inset by `bodyInsetStartMm` /
 *          `bodyInsetEndMm`, capped with either a rectangular cap
 *          (when `endCapWidthMm`/`endCapDepthMm` are present) or a
 *          re-extruded profile sans voids. Used by post-style members
 *          where the cap visually differs from the body.
 *      (b) single extrusion â€” full-length profile extrusion, with
 *          `buildClippedProfileExtrusionGeometry` applied only when
 *          end-cuts demand it (otherwise the flat extrusion is fine).
 *  - default (`prism`): box geometry. `buildClippedBoxGeometry`
 *    handles members with end-cuts; otherwise the cheap `boxGeometry`
 *    primitive renders directly. Side is `DoubleSide` only when
 *    end-cuts clipped the box (the clipped result can expose interior
 *    faces); plain boxes use `FrontSide` so the interior of a beam
 *    doesn't bleed light through.
 *
 * Local frame is built from xAxis = centerline direction and
 * yAxis/zAxis from `object.localFrame`; `matrixAutoUpdate=false` is
 * required because we set the basis once via useMemo and don't expect
 * R3F's per-frame transform sync to disturb it.
 */
export function MemberObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneMemberPrismObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const midpoint = useMemo(
    () => ({
      x: (object.centerline.start.x + object.centerline.end.x) / 2,
      y: (object.centerline.start.y + object.centerline.end.y) / 2,
      z: (object.centerline.start.z + object.centerline.end.z) / 2,
    }),
    [
      object.centerline.end.x,
      object.centerline.end.y,
      object.centerline.end.z,
      object.centerline.start.x,
      object.centerline.start.y,
      object.centerline.start.z,
    ],
  );
  const matrix = useMemo(() => {
    const xAxis = new THREE.Vector3(
      object.centerline.end.x - object.centerline.start.x,
      object.centerline.end.y - object.centerline.start.y,
      object.centerline.end.z - object.centerline.start.z,
    ).normalize();
    const yAxis = new THREE.Vector3(
      object.localFrame.yAxis.x,
      object.localFrame.yAxis.y,
      object.localFrame.yAxis.z,
    ).normalize();
    const zAxis = new THREE.Vector3(
      object.localFrame.zAxis.x,
      object.localFrame.zAxis.y,
      object.localFrame.zAxis.z,
    ).normalize();
    const next = new THREE.Matrix4();
    next.makeBasis(xAxis, yAxis, zAxis);
    next.setPosition(midpoint.x, midpoint.y, midpoint.z);
    return next;
  }, [
    midpoint.x,
    midpoint.y,
    midpoint.z,
    object.centerline.end.x,
    object.centerline.end.y,
    object.centerline.end.z,
    object.centerline.start.x,
    object.centerline.start.y,
    object.centerline.start.z,
    object.localFrame.yAxis.x,
    object.localFrame.yAxis.y,
    object.localFrame.yAxis.z,
    object.localFrame.zAxis.x,
    object.localFrame.zAxis.y,
    object.localFrame.zAxis.z,
  ]);
  const handleSelect = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect(object.id);
    },
    [object.id, onSelect],
  );
  const handleFocus = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onFocus(object.id);
    },
    [object.id, onFocus],
  );
  const lineGeometry = useMemo(
    () => buildLineGeometry(linePoints(object.centerline)),
    [object.centerline],
  );
  const outlineComposite = useMemo(() => {
    if (object.renderMode !== "outline_extrusion") {
      return null;
    }

    const bodyInsetStartMm = numericMetadataValue(
      object.metadata,
      "bodyInsetStartMm",
    );
    const bodyInsetEndMm = numericMetadataValue(
      object.metadata,
      "bodyInsetEndMm",
    );
    const endCapStartMm = numericMetadataValue(
      object.metadata,
      "endCapStartMm",
    );
    const endCapEndMm = numericMetadataValue(object.metadata, "endCapEndMm");
    const endCapWidthMm = numericMetadataValue(
      object.metadata,
      "endCapWidthMm",
    );
    const endCapDepthMm = numericMetadataValue(
      object.metadata,
      "endCapDepthMm",
    );
    if (
      bodyInsetStartMm === null ||
      bodyInsetEndMm === null ||
      endCapStartMm === null ||
      endCapEndMm === null ||
      bodyInsetStartMm < 0 ||
      bodyInsetEndMm < 0 ||
      endCapStartMm <= 0 ||
      endCapEndMm <= 0
    ) {
      return null;
    }

    const fullLengthMm = Math.max(object.lengthMm, 1);
    const bodyLengthMm = fullLengthMm - bodyInsetStartMm - bodyInsetEndMm;
    if (bodyLengthMm <= 0) {
      return null;
    }

    return {
      bodyLengthMm,
      bodyOffsetX: (bodyInsetStartMm - bodyInsetEndMm) / 2,
      startCapLengthMm: endCapStartMm,
      startCapOffsetX: -fullLengthMm / 2 + endCapStartMm / 2,
      endCapLengthMm: endCapEndMm,
      endCapOffsetX: fullLengthMm / 2 - endCapEndMm / 2,
      rectangularCap:
        endCapWidthMm !== null &&
        endCapDepthMm !== null &&
        endCapWidthMm > 0 &&
        endCapDepthMm > 0
          ? {
              widthMm: endCapWidthMm,
              depthMm: endCapDepthMm,
            }
          : null,
    };
  }, [object.lengthMm, object.metadata, object.renderMode]);
  const extrusionGeometry = useMemo(
    () => buildProfileExtrusionGeometry(object.profile, object.lengthMm),
    [object.lengthMm, object.profile],
  );
  const insetExtrusionGeometry = useMemo(
    () =>
      outlineComposite
        ? buildProfileExtrusionGeometry(
            object.profile,
            outlineComposite.bodyLengthMm,
          )
        : null,
    [object.profile, outlineComposite],
  );
  const startCapGeometry = useMemo(() => {
    if (!outlineComposite) return null;
    return outlineComposite.rectangularCap
      ? buildRectangularCapGeometry(
          outlineComposite.startCapLengthMm,
          outlineComposite.rectangularCap.widthMm,
          outlineComposite.rectangularCap.depthMm,
        )
      : buildProfileExtrusionGeometry(
          object.profile,
          outlineComposite.startCapLengthMm,
          { includeVoids: false },
        );
  }, [object.profile, outlineComposite]);
  const endCapGeometry = useMemo(() => {
    if (!outlineComposite) return null;
    return outlineComposite.rectangularCap
      ? buildRectangularCapGeometry(
          outlineComposite.endCapLengthMm,
          outlineComposite.rectangularCap.widthMm,
          outlineComposite.rectangularCap.depthMm,
        )
      : buildProfileExtrusionGeometry(
          object.profile,
          outlineComposite.endCapLengthMm,
          { includeVoids: false },
        );
  }, [object.profile, outlineComposite]);
  const clippedBoxGeometry = useMemo(
    () =>
      object.renderMode === "prism"
        ? buildClippedBoxGeometry(object, midpoint)
        : null,
    [midpoint, object],
  );
  const clippedProfileExtrusionGeometry = useMemo(
    () =>
      object.renderMode === "outline_extrusion" && !outlineComposite
        ? buildClippedProfileExtrusionGeometry(object, midpoint)
        : null,
    [midpoint, object, outlineComposite],
  );

  if (object.renderMode === "line_fallback") {
    return (
      <line
        data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}`}
        onClick={handleSelect}
        onDoubleClick={handleFocus}
      >
        <primitive attach="geometry" object={lineGeometry} />
        <lineBasicMaterial color={color} clippingPlanes={clippingPlanes} />
      </line>
    );
  }

  if (
    object.renderMode === "outline_extrusion" &&
    outlineComposite &&
    insetExtrusionGeometry &&
    startCapGeometry &&
    endCapGeometry
  ) {
    return (
      <group
        data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}`}
        matrixAutoUpdate={false}
        matrix={matrix}
        onClick={handleSelect}
        onDoubleClick={handleFocus}
      >
        <mesh position={[outlineComposite.bodyOffsetX, 0, 0]}>
          <primitive attach="geometry" object={insetExtrusionGeometry} />
          <meshStandardMaterial color={color} clippingPlanes={clippingPlanes} />
        </mesh>
        <mesh position={[outlineComposite.startCapOffsetX, 0, 0]}>
          <primitive attach="geometry" object={startCapGeometry} />
          <meshStandardMaterial color={color} clippingPlanes={clippingPlanes} />
        </mesh>
        <mesh position={[outlineComposite.endCapOffsetX, 0, 0]}>
          <primitive attach="geometry" object={endCapGeometry} />
          <meshStandardMaterial color={color} clippingPlanes={clippingPlanes} />
        </mesh>
      </group>
    );
  }

  if (object.renderMode === "outline_extrusion") {
    return (
      <mesh
        data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}`}
        matrixAutoUpdate={false}
        matrix={matrix}
        onClick={handleSelect}
        onDoubleClick={handleFocus}
      >
        <primitive
          attach="geometry"
          object={clippedProfileExtrusionGeometry ?? extrusionGeometry}
        />
        <meshStandardMaterial
          color={color}
          clippingPlanes={clippingPlanes}
          side={
            clippedProfileExtrusionGeometry ? THREE.DoubleSide : THREE.FrontSide
          }
        />
      </mesh>
    );
  }

  return (
    <mesh
      data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}`}
      matrixAutoUpdate={false}
      matrix={matrix}
      onClick={handleSelect}
      onDoubleClick={handleFocus}
    >
      {clippedBoxGeometry ? (
        <primitive attach="geometry" object={clippedBoxGeometry} />
      ) : (
        <boxGeometry
          args={[
            Math.max(object.lengthMm, 1),
            object.profile.widthMm,
            object.profile.depthMm,
          ]}
        />
      )}
      <meshStandardMaterial
        color={color}
        clippingPlanes={clippingPlanes}
        side={clippedBoxGeometry ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}
