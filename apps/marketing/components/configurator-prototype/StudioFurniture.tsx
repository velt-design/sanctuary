import { Soft, Leg, LoungeChair } from './StudioFurniturePieces';
import { useRef } from 'react';
import type { Group } from 'three';
import { useStudioFurnitureEvidence } from './useStudioFurnitureEvidence';
import StudioFurnitureAdditions from './StudioFurnitureAdditions';
import StudioContactShadow from './StudioContactShadow';
import Chair from './StudioDiningChair';
import type { GeometryPlanViewModel } from '@sp/geometry';
import { studioFurnitureLayout } from './studioFurnitureLayout';

const frame = '#292b29', fabric = '#ded8ca', stone = '#b5afa2';
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
    <group position={[chair?-400:0,-430,0]}><SmallSofa/></group>
    <group position={[chair?-350:0,580,0]}><SmallCoffeeTable/></group>
    {chair&&<group position={[950,350,0]} rotation={[0,0,Math.PI/2]}><LoungeChair/></group>}
  </group>;
}
function Bistro() {
  return <group><StudioContactShadow width={650} depth={650}/>
    <Soft at={[0,0,735]} size={[650,650,65]} color={stone} radius={2}/>
    <Soft at={[0,0,350]} size={[170,170,700]} color={stone} radius={2}/>
    {[-1,1].map(side=><group key={side} position={[side*550,0,0]} rotation={[0,0,-side*Math.PI/2]}><Chair/></group>)}
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
  const root=useRef<Group>(null);
  const choice = process.env.NODE_ENV === 'development' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('furniture') : null;
  const layout = studioFurnitureLayout(plan.extents, plan.members.posts.map(p => ({ x:p.centerline.start.x, y:p.centerline.start.y, radius:p.profile.widthMm/2 })), choice === 'social' || choice === 'mixed' ? choice : undefined);
  useStudioFurnitureEvidence(root,layout);
  return <group ref={root} name="illustrative-outdoor-furniture">{layout.map((item,i) => <group key={`${item.kind}-${i}`} name={`illustrative-${item.kind}`} position={[item.x,item.y,floor+4]} rotation={[0,0,item.rotation]}>
    {item.kind==='lounge'?<Lounge/>:item.kind==='dining'?<Dining/>:item.kind==='bistro'?<Bistro/>:item.kind==='compact'||item.kind==='small-lounge'?<CompactLounge chair={item.kind==='small-lounge'}/>:<StudioFurnitureAdditions kind={item.kind}/>}
  </group>)}</group>;
}
