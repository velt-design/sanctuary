import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { RoundedBoxGeometry } from 'three-stdlib';
import StudioFurnitureMaterial from './StudioFurnitureMaterial';
import StudioContactShadow from './StudioContactShadow';
import type { GeometryPlanViewModel } from '@sp/geometry';
import { studioFurnitureLayout } from './studioFurnitureLayout';

type V = [number, number, number];
const frame = '#292b29', fabric = '#ded8ca', stone = '#b5afa2';
function Soft({ at, size, color, radius = 20, rotation }: { at: V; size: V; color: string; radius?: number; rotation?: V }) {
  return <RoundedBox position={at} args={size} radius={radius} smoothness={3} rotation={rotation}>
    <StudioFurnitureMaterial color={color} finish={color===frame?'frame':color===stone?'stone':'fabric'}/>
  </RoundedBox>;
}
function Leg({ at, height = 400 }: { at: V; height?: number }) {
  return <mesh position={at} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[12, 16, height, 8]}/><meshStandardMaterial color={frame} roughness={.5} metalness={.3}/></mesh>;
}
function Lounge() {
  return <group>
    <group position={[-400,-300,0]}>
    <StudioContactShadow width={2220} depth={1700} y={0}/>
    <Soft at={[0,-445,300]} size={[2220,850,95]} color={frame} radius={8}/>
    {[-1,1].map(side => <group key={side}>
      <Soft at={[side*1060,-445,475]} size={[100,850,310]} color={fabric} radius={12}/>
      <Soft at={[side*505,-370,410]} size={[980,690,170]} color={fabric} radius={18}/>
      <Soft at={[side*505,-755,620]} size={[985,190,440]} color={fabric} radius={18}/>
      {[-740,-120].map(y => <Leg key={y} at={[side*960,y,135]} height={270}/>)}
    </group>)}
    {/* Full-depth return makes the seating an L, rather than a separate ottoman. */}
    <Soft at={[-605,430,300]} size={[1010,900,95]} color={frame} radius={8}/>
    <Soft at={[-550,425,410]} size={[880,890,170]} color={fabric} radius={18}/>
    <Soft at={[-1060,430,475]} size={[100,900,310]} color={fabric} radius={12}/>
    {[-960,-230].map(x=><Leg key={x} at={[x,760,135]} height={270}/>)}
    </group>
    <group position={[110,570,0]}><CoffeeTable/></group>
    <group position={[1190,610,0]} rotation={[0,0,Math.PI/2]}><LoungeChair/></group>
  </group>;
}
function CoffeeTable() {
  return <group><StudioContactShadow width={950} depth={600}/><Soft at={[0,0,330]} size={[950,600,70]} color={stone} radius={2}/>
    {[-290,290].map(x => <Soft key={x} at={[x,0,165]} size={[130,380,310]} color={stone} radius={2}/>)}</group>;
}
function LoungeChair() {
  return <group><StudioContactShadow width={820} depth={840}/>
    <Soft at={[0,0,300]} size={[820,840,95]} color={frame} radius={8}/>
    <Soft at={[0,60,410]} size={[630,680,170]} color={fabric} radius={18}/>
    <Soft at={[0,-330,620]} size={[640,170,440]} color={fabric} radius={18}/>
    {[-1,1].map(side=><group key={side}>
      <Soft at={[side*365,0,475]} size={[90,840,310]} color={fabric} radius={12}/>
      {[-300,300].map(y=><Leg key={y} at={[side*340,y,135]} height={270}/>)}</group>)}
  </group>;
}
function SmallSofa() {
  return <group>
    <StudioContactShadow width={1700} depth={820}/>
    <Soft at={[0,0,300]} size={[1700,820,95]} color={frame} radius={8}/>
    {[-1,1].map(side=><group key={side}>
      <Soft at={[side*805,0,475]} size={[90,820,310]} color={fabric} radius={12}/>
      <Soft at={[side*375,70,410]} size={[735,650,170]} color={fabric} radius={18}/>
      <Soft at={[side*375,-325,620]} size={[735,170,440]} color={fabric} radius={18}/>
      {[-300,300].map(y=><Leg key={y} at={[side*730,y,135]} height={270}/>)}
    </group>)}
  </group>;
}
function SmallCoffeeTable() {
  return <group><StudioContactShadow width={800} depth={450}/>
    <Soft at={[0,0,330]} size={[800,450,65]} color={stone} radius={2}/>
    {[-245,245].map(x=><Soft key={x} at={[x,0,165]} size={[100,300,300]} color={stone} radius={2}/>)}
  </group>;
}
function CompactLounge({ chair = false }: { chair?: boolean }) {
  return <group>
    <group position={[chair?-650:0,-430,0]}><SmallSofa/></group>
    <group position={[chair?-650:0,580,0]}><SmallCoffeeTable/></group>
    {chair&&<group position={[1200,0,0]} rotation={[0,0,Math.PI/2]}><LoungeChair/></group>}
  </group>;
}
function Bistro() {
  return <group><StudioContactShadow width={650} depth={650}/>
    <Soft at={[0,0,735]} size={[650,650,65]} color={stone} radius={2}/>
    <Soft at={[0,0,350]} size={[170,170,700]} color={stone} radius={2}/>
    {[-1,1].map(side=><group key={side} position={[side*575,0,0]} rotation={[0,0,side*Math.PI/2]}><Chair/></group>)}
  </group>;
}
function Chair() {
  const back = useMemo(() => {
    const geometry = new RoundedBoxGeometry(530,110,260,5,48);
    const positions = geometry.attributes.position;
    for(let i=0;i<positions.count;i++) positions.setY(i,positions.getY(i)-positions.getX(i)**2*.0011);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(()=>()=>back.dispose(),[back]);
  return <group>
    <Soft at={[0,0,455]} size={[510,480,95]} color="#bdb5a5" radius={42}/>
    <mesh geometry={back} position={[0,185,735]}><StudioFurnitureMaterial color="#bdb5a5" finish="fabric"/></mesh>
    {[-1,1].flatMap(side => [-1,1].map(end => <mesh key={`${side}-${end}`} position={[side*210,end*160,end===1?355:210]} rotation={[Math.PI/2,0,-side*.055]}>
      <cylinderGeometry args={[18,24,end===1?710:420,10]}/><StudioFurnitureMaterial color="#46372d" finish="wood"/>
    </mesh>))}
  </group>;
}
function Dining() {
  return <group><StudioContactShadow width={2100} depth={950}/>
    <Soft at={[0,0,745]} size={[2100,950,85]} color={stone} radius={2}/>
    {[-650,650].map(x => <Soft key={x} at={[x,0,355]} size={[210,590,710]} color={stone} radius={2}/>)}
    {[-1,1].flatMap(side => [-700,0,700].map(x => <group key={`${side}-${x}`} position={[x,side*830,0]} rotation={[0,0,side===1?0:Math.PI]}><Chair/></group>))}
  </group>;
}
export default function StudioFurniture({ plan, floor }: { plan: GeometryPlanViewModel; floor: number }) {
  const layout = studioFurnitureLayout(plan.extents, plan.members.posts.map(p => ({ x:p.centerline.start.x, y:p.centerline.start.y, radius:p.profile.widthMm/2 })));
  return <group name="illustrative-outdoor-furniture">{layout.map(item => <group key={item.kind} name={`illustrative-${item.kind}`} position={[item.x,item.y,floor+4]} rotation={[0,0,item.rotation]}>
    {item.kind==='lounge'?<Lounge/>:item.kind==='dining'?<Dining/>:item.kind==='bistro'?<Bistro/>:<CompactLounge chair={item.kind==='small-lounge'}/>}
  </group>)}</group>;
}
