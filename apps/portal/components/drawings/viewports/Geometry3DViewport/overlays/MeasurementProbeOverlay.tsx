import { useMemo } from "react";
import * as THREE from "three";
import { buildLineGeometry } from "../geometry/lineBuilders";
import { pointToVector, vectorToPoint } from "../interaction/cameraState";
import type { MeasurementAnchor } from "../interaction/measurement";

/**
 * Measurement-tool probe overlay: two world-space anchor markers, a
 * connecting line, and a perpendicular tick at each anchor. Consumes
 * the `firstAnchor` / `secondAnchor` slots driven by the measurement
 * tool state machine (`MeasurementState`) so an in-progress measurement
 * shows just the first anchor until the second click.
 *
 * Clipping planes are wired into every material so the section-cut
 * plane hides any portion of the markers / line / ticks that's
 * outside the cut region; without this the probe would draw through
 * walls and the readout's reported distance would no longer match
 * what the user sees.
 */
export function MeasurementProbeOverlay({
  firstAnchor,
  secondAnchor,
  clippingPlanes,
  markerRadiusMm,
}: {
  firstAnchor: MeasurementAnchor | null;
  secondAnchor: MeasurementAnchor | null;
  clippingPlanes: THREE.Plane[];
  markerRadiusMm: number;
}) {
  const lineGeometry = useMemo(() => {
    if (!firstAnchor || !secondAnchor) return null;
    return buildLineGeometry([firstAnchor.point, secondAnchor.point]);
  }, [firstAnchor, secondAnchor]);

  const tickGeometries = useMemo(() => {
    if (!firstAnchor || !secondAnchor) return null;

    const start = pointToVector(firstAnchor.point);
    const end = pointToVector(secondAnchor.point);
    const direction = end.clone().sub(start);
    if (direction.lengthSq() < 1e-6) return null;

    const normalizedDirection = direction.normalize();
    const reference =
      Math.abs(normalizedDirection.z) < 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const tickDirection = new THREE.Vector3()
      .crossVectors(normalizedDirection, reference)
      .normalize();
    const tickHalfLength = Math.max(markerRadiusMm * 0.9, 22);

    const buildTick = (point: THREE.Vector3) =>
      buildLineGeometry([
        vectorToPoint(
          point
            .clone()
            .add(tickDirection.clone().multiplyScalar(-tickHalfLength)),
        ),
        vectorToPoint(
          point
            .clone()
            .add(tickDirection.clone().multiplyScalar(tickHalfLength)),
        ),
      ]);

    return {
      first: buildTick(start),
      second: buildTick(end),
    };
  }, [firstAnchor, secondAnchor, markerRadiusMm]);

  return (
    <group data-testid="measurement-probe-overlay">
      {firstAnchor ? (
        <mesh
          position={[
            firstAnchor.point.x,
            firstAnchor.point.y,
            firstAnchor.point.z,
          ]}
          data-testid="measurement-anchor-a"
        >
          <sphereGeometry args={[markerRadiusMm, 18, 18]} />
          <meshStandardMaterial
            color="#c75656"
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      ) : null}
      {secondAnchor ? (
        <mesh
          position={[
            secondAnchor.point.x,
            secondAnchor.point.y,
            secondAnchor.point.z,
          ]}
          data-testid="measurement-anchor-b"
        >
          <sphereGeometry args={[markerRadiusMm, 18, 18]} />
          <meshStandardMaterial
            color="#3f7ec3"
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      ) : null}
      {lineGeometry ? (
        <line data-testid="measurement-probe-line">
          <primitive attach="geometry" object={lineGeometry} />
          <lineBasicMaterial color="#2d302f" clippingPlanes={clippingPlanes} />
        </line>
      ) : null}
      {tickGeometries ? (
        <>
          <line data-testid="measurement-probe-tick-a">
            <primitive attach="geometry" object={tickGeometries.first} />
            <lineBasicMaterial
              color="#2d302f"
              clippingPlanes={clippingPlanes}
            />
          </line>
          <line data-testid="measurement-probe-tick-b">
            <primitive attach="geometry" object={tickGeometries.second} />
            <lineBasicMaterial
              color="#2d302f"
              clippingPlanes={clippingPlanes}
            />
          </line>
        </>
      ) : null}
    </group>
  );
}
