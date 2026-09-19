import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { Quaternion, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import StudioFurnitureMaterial from './StudioFurnitureMaterial';
import StudioContactShadow from './StudioContactShadow';

type Point = [number, number, number];
const charcoal = '#414441', black = '#242723';
function Rail({ from, to, width = 40 }: { from: Point; to: Point; width?: number }) {
  const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0,0,1), direction.clone().normalize());
  return <mesh position={a.add(b).multiplyScalar(.5)} quaternion={rotation}>
    <boxGeometry args={[width,32,direction.length()]}/><StudioFurnitureMaterial color={black} finish="wood"/>
  </mesh>;
}

/** Illustrative chair: angular black timber frame with a charcoal wraparound back. */
export default function StudioDiningChair() {
  const back = useMemo(() => {
    const geometry = new RoundedBoxGeometry(540,95,245,4,36);
    const p = geometry.attributes.position;
    for (let i=0;i<p.count;i++) p.setY(i,p.getY(i)-p.getX(i)**2*.00165);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => back.dispose(), [back]);
  return <group name="charcoal-dining-chair">
    <StudioContactShadow width={610} depth={650}/>
    <RoundedBox position={[0,-10,452]} args={[500,460,85]} radius={32} smoothness={3}>
      <StudioFurnitureMaterial color={charcoal} finish="fabric" size={[500,460,85]}/>
    </RoundedBox>
    <mesh geometry={back} position={[0,205,720]}><StudioFurnitureMaterial color={charcoal} finish="fabric"/></mesh>
    {[-1,1].map(side => <group key={side}>
      <Rail from={[side*250,-265,18]} to={[side*202,120,735]} width={43}/>
      <Rail from={[side*245,280,18]} to={[side*202,120,735]} width={38}/>
      <Rail from={[side*210,-170,398]} to={[side*210,180,398]} width={32}/>
    </group>)}
    <Rail from={[-215,-165,398]} to={[215,-165,398]} width={28}/>
  </group>;
}
