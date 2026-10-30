import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Path, Shape } from 'three';
import type { ContextBox } from '@sp/geometry';
import HouseContextMaterial from './HouseContextMaterial';

export default function ContextWall({ wall, opening, fadeAbove, refined = false }: { wall: ContextBox; opening: ContextBox; fadeAbove: number; refined?: boolean }) {
  const geometry = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(wall.min.x, wall.min.z); shape.lineTo(wall.max.x, wall.min.z);
    shape.lineTo(wall.max.x, wall.max.z); shape.lineTo(wall.min.x, wall.max.z); shape.closePath();
    const hole = new Path();
    hole.moveTo(opening.min.x, opening.min.z); hole.lineTo(opening.min.x, opening.max.z);
    hole.lineTo(opening.max.x, opening.max.z); hole.lineTo(opening.max.x, opening.min.z); hole.closePath();
    shape.holes.push(hole);
    const result = new ExtrudeGeometry(shape, { depth: wall.max.y - wall.min.y, bevelEnabled: false });
    result.rotateX(Math.PI / 2); result.translate(0, wall.max.y, 0);
    return result;
  }, [wall, opening]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="house-wall-with-slider" geometry={geometry}>
    <HouseContextMaterial color="#deddd2" fadeAbove={fadeAbove} refined={refined} />
  </mesh>;
}
