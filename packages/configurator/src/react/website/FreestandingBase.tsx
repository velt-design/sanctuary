import type { GeometryPlanViewModel } from '@sp/geometry';

/** Display-only platform. Not a selected deck, foundation or priced item. */
export default function FreestandingBase({ plan }: { plan: GeometryPlanViewModel }) {
  const { minX, minY, maxX, maxY } = plan.extents;
  return <group name="freestanding-reference-base">
    <mesh position={[(minX + maxX) / 2, (minY + maxY) / 2, -60]}>
      <boxGeometry args={[maxX - minX + 900, maxY - minY + 900, 120]} />
      <meshStandardMaterial color="#cbc8bd" roughness={1} />
    </mesh>
  </group>;
}
