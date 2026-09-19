import { useEffect, useMemo } from 'react';
import { RoundedBoxGeometry } from 'three-stdlib';
import StudioFurnitureMaterial from './StudioFurnitureMaterial';
import StudioContactShadow from './StudioContactShadow';
type V = [number, number, number];
const frame = '#292b29', fabric = '#ded8ca', stone = '#b5afa2';
export function Soft({ at, size, color, radius = 20, rotation }: { at: V; size: V; color: string; radius?: number; rotation?: V }) {
  const [width, depth, height] = size;
  const upholstered = color !== frame && color !== stone;
  const geometry = useMemo(() => {
    const mesh = new RoundedBoxGeometry(width, depth, height, 3, radius);
    if (upholstered) {
      const p = mesh.attributes.position;
      // A restrained cushion crown catches the light without rounding off the
      // approved square silhouette or changing the furniture layout.
      const crown = Math.min(9, radius * .45);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const nx = x * 2 / width, ny = y * 2 / depth, nz = z * 2 / height;
        p.setXYZ(i, x + crown * nx * (1 - ny*ny) * (1 - nz*nz),
          y + crown * ny * (1 - nx*nx) * (1 - nz*nz),
          z + crown * nz * (1 - nx*nx) * (1 - ny*ny));
      }
      mesh.computeVertexNormals();
    }
    return mesh;
  }, [width, depth, height, radius, upholstered]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={at} geometry={geometry} rotation={rotation}>
    <StudioFurnitureMaterial color={color} size={size} finish={color===frame?'frame':color===stone?'stone':'fabric'}/>
  </mesh>;
}
export function Leg({ at, height = 400 }: { at: V; height?: number }) {
  return <group><mesh position={at} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[12, 16, height, 8]}/><meshStandardMaterial color={frame} roughness={.5} metalness={.3}/></mesh>
    <group position={[at[0],at[1],0]}><StudioContactShadow width={110} depth={110}/></group></group>;
}
export function LoungeChair() {
  return <group><StudioContactShadow width={820} depth={840}/>
    <Soft at={[0,0,300]} size={[820,840,95]} color={frame} radius={8}/>
    <Soft at={[0,60,410]} size={[630,680,170]} color={fabric} radius={18}/>
    <Soft at={[0,-330,620]} size={[640,170,440]} color={fabric} radius={18}/>
    {[-1,1].map(side=><group key={side}>
      <Soft at={[side*365,0,475]} size={[90,840,310]} color={fabric} radius={12}/>
      {[-300,300].map(y=><Leg key={y} at={[side*340,y,135]} height={270}/>)}</group>)}
  </group>;
}
