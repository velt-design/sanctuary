import { useMemo } from "react";
import * as THREE from "three";
import type { Point3 } from "@sp/geometry";
import { buildPolygonGeometry } from "../geometry/buildGeometries";
import { buildClosedLineGeometry } from "../geometry/lineBuilders";

/**
 * Section-cut hint overlay. Renders the cut polygon as a translucent
 * plane plus a darker outline so the user can see exactly where the
 * section is taken when the section-cut toggle is on. The polygon is
 * supplied pre-computed by the parent (`sectionCutBoundary`) so this
 * component stays a thin presenter — no plane math or clipping logic
 * here.
 */
export function SectionCutHint({ boundary }: { boundary: Point3[] }) {
  const planeGeometry = useMemo(
    () => buildPolygonGeometry(boundary),
    [boundary],
  );
  const outlineGeometry = useMemo(
    () => buildClosedLineGeometry(boundary),
    [boundary],
  );

  return (
    <group data-testid="section-cut-hint">
      <mesh data-testid="section-cut-plane">
        <primitive attach="geometry" object={planeGeometry} />
        <meshStandardMaterial
          color="#7da3d1"
          transparent
          opacity={0.14}
          side={THREE.DoubleSide}
        />
      </mesh>
      <line data-testid="section-cut-outline">
        <primitive attach="geometry" object={outlineGeometry} />
        <lineBasicMaterial color="#4673b5" />
      </line>
    </group>
  );
}
