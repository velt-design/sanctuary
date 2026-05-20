import { useMemo } from "react";
import * as THREE from "three";
import type { Point3 } from "@sp/geometry";
import { buildLineGeometry } from "../geometry/lineBuilders";
import { pointToVector, vectorToPoint } from "../interaction/cameraState";

/**
 * Three-line arrow overlay rendered between two world-space points.
 * Used by the diagnostics layer (fall vectors, datum axes, member-local
 * axes) when the corresponding `overlayVisibility` toggle is on.
 *
 * Renders as a shaft + two head segments — kept as straight line
 * geometry so the arrow is visible under any clipping plane and doesn't
 * need its own lighting tuning. Head size scales with arrow length
 * within `80–180mm` so tiny vectors stay readable and large ones don't
 * grow comically big.
 */
export function ArrowOverlay({
  testId,
  start,
  end,
  color,
}: {
  testId: string;
  start: Point3;
  end: Point3;
  color: string;
}) {
  const geometries = useMemo(() => {
    const startVector = pointToVector(start);
    const endVector = pointToVector(end);
    const direction = endVector.clone().sub(startVector);
    const length = direction.length();
    if (length === 0) {
      return {
        shaft: buildLineGeometry([start, end]),
        headA: buildLineGeometry([end, end]),
        headB: buildLineGeometry([end, end]),
      };
    }

    const normalizedDirection = direction.clone().normalize();
    const reference =
      Math.abs(normalizedDirection.z) < 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3()
      .crossVectors(normalizedDirection, reference)
      .normalize();
    const headLength = Math.min(Math.max(length * 0.18, 80), 180);
    const headWidth = Math.min(Math.max(length * 0.08, 50), 120);
    const back = normalizedDirection.clone().multiplyScalar(-headLength);
    const left = endVector
      .clone()
      .add(back)
      .add(side.clone().multiplyScalar(headWidth));
    const right = endVector
      .clone()
      .add(back)
      .add(side.clone().multiplyScalar(-headWidth));

    return {
      shaft: buildLineGeometry([start, end]),
      headA: buildLineGeometry([vectorToPoint(left), end]),
      headB: buildLineGeometry([vectorToPoint(right), end]),
    };
  }, [end, start]);

  return (
    <group data-testid={testId}>
      <line>
        <primitive attach="geometry" object={geometries.shaft} />
        <lineBasicMaterial color={color} />
      </line>
      <line>
        <primitive attach="geometry" object={geometries.headA} />
        <lineBasicMaterial color={color} />
      </line>
      <line>
        <primitive attach="geometry" object={geometries.headB} />
        <lineBasicMaterial color={color} />
      </line>
    </group>
  );
}
