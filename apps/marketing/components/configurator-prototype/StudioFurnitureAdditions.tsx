import { Soft, Leg, LoungeChair } from './StudioFurniturePieces';
import Chair from './StudioDiningChair';
import StudioContactShadow from './StudioContactShadow';
import type { FurnitureKind } from './studioFurnitureCatalog';
const fabric='#ded8ca',frame='#292b29',stone='#b5afa2';
function Sofa() {
  return <group><StudioContactShadow width={2400} depth={850}/>
    <Soft at={[0,0,300]} size={[2400,850,95]} color={frame} radius={8}/>
    {[-1,1].map(side=><group key={side}>
      <Soft at={[side*1150,0,475]} size={[100,850,310]} color={fabric} radius={12}/>
      {[-310,310].map(y=><Leg key={y} at={[side*1060,y,135]} height={270}/>)}
    </group>)}
    {[-730,0,730].map(x=><group key={x}>
      <Soft at={[x,70,410]} size={[715,650,170]} color={fabric} radius={18}/>
      <Soft at={[x,-335,620]} size={[715,170,440]} color={fabric} radius={18}/>
    </group>)}
  </group>;
}
function Table({width=1100,depth=600,height=365}:{width?:number;depth?:number;height?:number}){
  return <group><StudioContactShadow width={width} depth={depth}/>
    <Soft at={[0,0,height-35]} size={[width,depth,70]} color={stone} radius={2}/>
    {[-1,1].map(side=><Soft key={side} at={[side*width*.31,0,(height-70)/2]} size={[100,depth*.65,height-70]} color={stone} radius={2}/>)}
  </group>;
}
function Social({shallow=false}:{shallow?:boolean}){
  return <group>
    <group position={[0,shallow?-250:-620,0]}><Sofa/></group>
    {[-1,1].map(side=><group key={side} position={[side*1800,shallow?0:250,0]} rotation={[0,0,side*Math.PI/2]}><LoungeChair/></group>)}
    <group position={[0,shallow?625:500,0]}><Table depth={shallow?350:600}/></group>
  </group>;
}
function Bench({width=1400}:{width?:number}){
  return <group><StudioContactShadow width={width} depth={450}/>
    <Soft at={[0,0,430]} size={[width,430,70]} color="#414441" radius={14}/>
    <Soft at={[0,0,385]} size={[width,400,35]} color={frame} radius={3}/>
    {[-1,1].flatMap(x=>[-1,1].map(y=><Leg key={`${x}-${y}`} at={[x*(width/2-90),y*135,180]} height={360}/>))}
  </group>;
}
function CompactDining(){
  return <group>
    <group position={[0,-150,0]}><Table width={1400} depth={750} height={760}/></group>
    <group position={[0,-775,0]}><Bench/></group>
    {[-1,1].map(side=><group key={side} position={[side*380,610,0]}><Chair/></group>)}
  </group>;
}
export default function StudioFurnitureAdditions({kind}:{kind:FurnitureKind}){
  if(kind==='social'||kind==='shallow-social')return <Social shallow={kind==='shallow-social'}/>;
  if(kind==='compact-dining')return <CompactDining/>;
  if(kind==='bench-social')return <group>
    {[-1,1].map(side=><group key={side} position={[side*1080,-170,0]}><Bench width={1300}/></group>)}
    <group position={[0,-100,0]}><Table width={300} depth={300} height={500}/></group>
  </group>;
  if(kind==='sofa-nook')return <group><group position={[0,-225,0]}><Sofa/></group><group position={[1325,-125,0]}><Table width={250} depth={350} height={500}/></group></group>;
  return <group><group position={[-150,-170,0]}><Bench width={1300}/></group><group position={[700,-100,0]}><Table width={250} depth={300} height={500}/></group></group>;
}
