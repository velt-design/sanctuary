import { useEffect, useMemo } from 'react';
import StudioFurnitureMaterial from './StudioFurnitureMaterial';
import StudioContactShadow from './StudioContactShadow';
import { createDiningChairGeometry } from './StudioDiningChairGeometry';

/** Illustrative outdoor chair. Millimetres, Z up, facing -Y; layout owns placement. */
export default function StudioDiningChair() {
  const geometry = useMemo(createDiningChairGeometry, []);
  useEffect(() => () => {
    geometry.frame.dispose();
    geometry.cushion.dispose();
  }, [geometry]);
  return <group name="charcoal-dining-chair">
    <StudioContactShadow width={610} depth={650}/>
    <mesh geometry={geometry.frame} castShadow receiveShadow>
      <StudioFurnitureMaterial color="#292b29" finish="wood"/>
    </mesh>
    <mesh geometry={geometry.cushion} position={[0,-14,467]} castShadow receiveShadow>
      <StudioFurnitureMaterial color="#c3bfb3" finish="fabric" size={[440,406,28]}/>
    </mesh>
  </group>;
}
