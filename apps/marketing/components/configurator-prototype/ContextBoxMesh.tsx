import type { ContextBox } from '@sp/geometry';

export default function ContextBoxMesh({ box, color, glazing = false }: {
  box: ContextBox; color: string; glazing?: boolean;
}) {
  const { min, max } = box;
  return <mesh name={box.id} position={[(min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2]}>
    <boxGeometry args={[max.x - min.x, max.y - min.y, max.z - min.z]} />
    <meshStandardMaterial color={color} roughness={glazing ? .2 : .95}
      metalness={glazing ? .15 : 0} envMapIntensity={glazing ? .7 : 1} transparent />
  </mesh>;
}
